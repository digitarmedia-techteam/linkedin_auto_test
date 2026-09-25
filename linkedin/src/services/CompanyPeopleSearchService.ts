import { chromium } from 'playwright';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { LinkedInTestUser, StorageStateData } from '../db/models/TestUser.js';

export interface CompanyPersonResult {
  personId: string;
  name: string;
  profileUrl: string;
  vanityName: string | null;
  photoUrl: string | null;
  headline: string | null;
  position: string | null;
  companyName: string | null;
  companyId: string | null;
  location: string | null;
  degree: '1st' | '2nd' | '3rd' | 'Out of Network' | string;
  connectionStatus: 'connected' | 'not_connected' | 'pending';
  canMessage: boolean;
  canConnect: boolean;
  mutualConnectionsText: string | null;
}

export interface CompanyPeopleSearchResponse {
  success: boolean;
  companyId: string;
  companyName: string | null;
  keywords: string;
  results: CompanyPersonResult[];
  totalFound: number;
  message: string;
  timestamp: string;
}

export class CompanyPeopleSearchService {
  private static async createBrowserContext(user: LinkedInTestUser, headless: boolean = true) {
    if (!user.storage_state_json && !user.session_cookies_json) {
      throw new Error(
        `User ${user.username} does not have an active LinkedIn session. Please log in first.`,
      );
    }

    const browser = await chromium.launch({
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    let cookiesToAdd: any[] = [];
    if (user.storage_state_json) {
      try {
        const parsedState = JSON.parse(user.storage_state_json) as StorageStateData;
        if (parsedState.cookies && parsedState.cookies.length > 0) {
          cookiesToAdd = parsedState.cookies;
        }
      } catch (e) {
        logger.warn(`[PeopleSearch] Failed to parse storage_state_json: ${e}`);
      }
    }
    if (cookiesToAdd.length === 0 && user.session_cookies_json) {
      try {
        const parsedCookies = JSON.parse(user.session_cookies_json);
        if (Array.isArray(parsedCookies)) cookiesToAdd = parsedCookies;
      } catch (e) {
        logger.warn(`[PeopleSearch] Failed to parse session_cookies_json: ${e}`);
      }
    }

    const context = await browser.newContext({
      baseURL: config.baseUrl,
      userAgent: user.user_agent ?? undefined,
      viewport: { width: 1280, height: 900 },
    });

    if (cookiesToAdd.length > 0) await context.addCookies(cookiesToAdd);

    const page = await context.newPage();
    page.setDefaultTimeout(40_000);
    page.setDefaultNavigationTimeout(40_000);

    return { browser, context, page };
  }

  /**
   * Post-scrape relevance validator to ensure that only profiles strictly matching
   * the requested designation/title, name, or keywords are returned.
   */
  private static isPersonMatchingSearchCriteria(
    person: CompanyPersonResult,
    options: { position?: string; name?: string; keywords?: string }
  ): boolean {
    const personName = (person.name || '').toLowerCase();
    const personVanity = (person.vanityName || '').toLowerCase();
    const personHeadline = (person.headline || '').toLowerCase();
    const personPosition = (person.position || '').toLowerCase();
    const combinedPersonRole = `${personHeadline} ${personPosition}`.trim();

    // 1. If Name was specified, the returned profile MUST match the searched name
    if (options.name && options.name.trim()) {
      const nameTokens = options.name
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(t => t.length >= 2);

      if (nameTokens.length > 0) {
        const matchesName = nameTokens.some(
          token => personName.includes(token) || personVanity.includes(token)
        );
        if (!matchesName) {
          return false;
        }
      }
    }

    // 2. If Position/Designation was specified, check if headline or position strictly matches
    if (options.position && options.position.trim()) {
      const queryPos = options.position.trim().toLowerCase();

      // Check for common leadership / executive roles with semantic variations
      let matchesPosition = false;

      if (queryPos.includes('founder')) {
        // Matches: founder, co-founder, cofounder, co founder, founding partner, founding director, etc.
        matchesPosition = /founder|cofounder|co-founder|co\s+founder|founding/i.test(combinedPersonRole);
      } else if (queryPos === 'ceo' || queryPos.includes('chief executive')) {
        matchesPosition = /\bceo\b|chief\s+executive|co-ceo|managing\s+director/i.test(combinedPersonRole);
      } else if (queryPos === 'cto' || queryPos.includes('chief technology') || queryPos.includes('chief technical')) {
        matchesPosition = /\bcto\b|chief\s+technology|chief\s+technical/i.test(combinedPersonRole);
      } else if (queryPos === 'cfo' || queryPos.includes('chief financial')) {
        matchesPosition = /\bcfo\b|chief\s+financial/i.test(combinedPersonRole);
      } else if (queryPos === 'coo' || queryPos.includes('chief operating')) {
        matchesPosition = /\bcoo\b|chief\s+operating/i.test(combinedPersonRole);
      } else if (queryPos === 'cmo' || queryPos.includes('chief marketing')) {
        matchesPosition = /\bcmo\b|chief\s+marketing/i.test(combinedPersonRole);
      } else if (queryPos === 'hr' || queryPos.includes('human resource')) {
        matchesPosition = /\bhr\b|human\s+resource|talent|people\s+ops|recruiter|recruitment/i.test(combinedPersonRole);
      } else {
        // General designation search (e.g. "Account Manager", "Senior Product Designer", "Software Engineer")
        if (combinedPersonRole.includes(queryPos)) {
          matchesPosition = true;
        } else {
          // Token-based matching: all significant tokens in the search query must appear in person's role
          const stopWords = new Set(['and', 'the', 'for', 'with', 'of', 'in', 'at', '&', 'a', 'an', 'to']);
          const posTokens = queryPos
            .split(/[\s,\/|&-]+/)
            .map(t => t.trim())
            .filter(t => t.length >= 2 && !stopWords.has(t));

          if (posTokens.length > 0) {
            const matchedCount = posTokens.filter(t => combinedPersonRole.includes(t)).length;
            if (posTokens.length <= 2) {
              matchesPosition = matchedCount === posTokens.length;
            } else {
              matchesPosition = matchedCount >= Math.ceil(posTokens.length * 0.67);
            }
          }
        }
      }

      if (!matchesPosition) {
        return false;
      }
    }

    // 3. If Keywords were specified, verify at least one keyword token matches
    if (options.keywords && options.keywords.trim()) {
      const kwTokens = options.keywords
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(t => t.length >= 3 && !['and', 'the', 'for', 'with'].includes(t));

      if (kwTokens.length > 0) {
        const fullProfileText = `${personName} ${personHeadline} ${personPosition} ${person.location || ''}`.toLowerCase();
        const matchesKw = kwTokens.some(t => fullProfileText.includes(t));
        if (!matchesKw) {
          return false;
        }
      }
    }

    return true;
  }

  static async searchPeopleInCompany(options: {
    user: LinkedInTestUser;
    companyId: string;
    companyName?: string;
    position?: string;
    name?: string;
    keywords?: string;
    network?: string; // 'F' (1st), 'S' (2nd), 'O' (3rd)
    limit?: number;
    headless?: boolean;
  }): Promise<CompanyPeopleSearchResponse> {
    const { user, companyId, companyName } = options;
    const headless = options.headless !== false;
    const limit = options.limit ? Math.min(options.limit, 100) : 100;
    const timestamp = new Date().toISOString();

    if (!companyId || !companyId.trim()) {
      return {
        success: false,
        companyId: '',
        companyName: null,
        keywords: '',
        results: [],
        totalFound: 0,
        message: 'Company ID is required to search employees within a company.',
        timestamp,
      };
    }

    const cleanCompanyId = companyId.trim();

    // Clean search filters
    const cleanPosition = options.position ? options.position.trim() : '';
    const cleanName = options.name ? options.name.trim() : '';
    const cleanKeywords = options.keywords ? options.keywords.trim() : '';

    const querySummary = [
      cleanPosition ? `Position: "${cleanPosition}"` : '',
      cleanName ? `Name: "${cleanName}"` : '',
      cleanKeywords ? `Keywords: "${cleanKeywords}"` : '',
    ]
      .filter(Boolean)
      .join(', ');

    let browser: any = null;
    let context: any = null;
    const collectedPeople: CompanyPersonResult[] = [];
    const seenVanity = new Set<string>();

    try {
      logger.info(
        `[PeopleSearch] Searching people in Company ID ${cleanCompanyId} (${companyName || 'Unknown'}) with filters [${querySummary || 'All Employees'}] as ${user.username}`,
      );

      const ctx = await CompanyPeopleSearchService.createBrowserContext(user, headless);
      browser = ctx.browser;
      context = ctx.context;
      const page = ctx.page;

      // Determine pagination needs: continue fetching pages to retrieve all matching employees
      let currentPage = 1;
      const maxPagesToScrape = Math.min(Math.ceil(limit / 10), 10);

      while (collectedPeople.length < limit && currentPage <= maxPagesToScrape) {
        // Construct LinkedIn Structured Faceted People Search URL
        // LinkedIn uses dedicated faceted parameters: currentCompany, titleFreeText, firstName, lastName, keywords, network
        const urlParams = new URLSearchParams();
        urlParams.set('origin', 'SWITCH_SEARCH_VERTICAL');
        urlParams.set('currentCompany', `["${cleanCompanyId}"]`);

        // Use dedicated title facet for position
        if (cleanPosition) {
          urlParams.set('titleFreeText', cleanPosition);
        }

        // Use dedicated firstName / lastName facets for name searches
        if (cleanName) {
          const nameParts = cleanName.split(/\s+/);
          if (nameParts.length === 1) {
            urlParams.set('firstName', nameParts[0]);
          } else if (nameParts.length > 1) {
            urlParams.set('firstName', nameParts[0]);
            urlParams.set('lastName', nameParts.slice(1).join(' '));
          }
        }

        // Pass backend keywords to ensure LinkedIn's internal search engine filters employees immediately
        const backendKeywords: string[] = [];
        if (cleanPosition) backendKeywords.push(cleanPosition);
        if (cleanName) backendKeywords.push(cleanName);
        if (cleanKeywords) backendKeywords.push(cleanKeywords);

        if (backendKeywords.length > 0) {
          urlParams.set('keywords', backendKeywords.join(' '));
        }

        // Network degree filter
        if (options.network) {
          urlParams.set('network', `["${options.network}"]`);
        }

        if (currentPage > 1) {
          urlParams.set('page', String(currentPage));
        }

        const searchUrl = `https://www.linkedin.com/search/results/people/?${urlParams.toString()}&origin=SWITCH_SEARCH_VERTICAL`;
        logger.info(`[PeopleSearch] Navigating to page ${currentPage}: ${searchUrl}`);

        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 35_000 });

        // Wait for results container or cards
        try {
          await page.waitForSelector(
            '.reusable-search__entity-result-list, [data-view-name="search-entity-result-universal-template"], .entity-result, div[data-view-name="search-results-container"], div.search-results-container',
            { timeout: 14_000 },
          );
        } catch {
          logger.warn(`[PeopleSearch] Results selector not detected within timeout on page ${currentPage}.`);
        }

        // Progressive scrolling to trigger lazy-loaded avatars & content
        try {
          await page.evaluate(() => window.scrollBy(0, 450));
          await page.waitForTimeout(700);
          await page.evaluate(() => window.scrollBy(0, 600));
          await page.waitForTimeout(700);
          await page.evaluate(() => window.scrollBy(0, 600));
          await page.waitForTimeout(700);
        } catch { }

        // Wait for avatars to render
        try {
          await page.waitForSelector(
            '.reusable-search__entity-result-list img, .entity-result img, [data-view-name="search-entity-result-universal-template"] img',
            { timeout: 3_000 },
          );
        } catch { }

        // Extract people cards strictly from within the results list container
        const pagePeople = await page.evaluate(
          ({ cId, cName }: { cId: string; cName: string | null }) => {
            const people: any[] = [];
            const pageSeen = new Set<string>();

            // 1. Identify the Search Results List root container (strictly ignore header, nav, aside, footer)
            const resultsRoot =
              document.querySelector('.reusable-search__entity-result-list') ||
              document.querySelector('ul[role="list"].reusable-search__entity-result-list') ||
              document.querySelector('div[data-view-name="search-results-container"]') ||
              document.querySelector('.search-results-container') ||
              document.querySelector('.scaffold-finite-scroll__content') ||
              document.querySelector('main .search-results-container') ||
              document.querySelector('main');

            if (!resultsRoot) return people;

            // 2. Query individual Result Card elements inside the results list
            const rawCards = Array.from(
              resultsRoot.querySelectorAll(
                'li.reusable-search__result-container, [data-view-name="search-entity-result-universal-template"], .entity-result, li[role="listitem"]',
              ),
            );

            // Filter out non-card elements or elements located in sidebars / navigation
            const cardElements = rawCards.filter(card => {
              const aside = card.closest('aside, nav, header, footer, .scaffold-layout__aside, [data-view-name="search-spotlight"]');
              return !aside;
            });

            // If no structured cards found, fallback to finding links inside resultsRoot only
            const candidateCards: HTMLElement[] =
              cardElements.length > 0
                ? (cardElements as HTMLElement[])
                : (Array.from(resultsRoot.querySelectorAll('a[href*="/in/"]'))
                  .map(a => a.closest('li') || a.parentElement)
                  .filter(Boolean) as HTMLElement[]);

            for (const card of candidateCards) {
              try {
                // Find primary Profile Title Link inside this specific card
                const titleLink = (
                  card.querySelector('.entity-result__title-text a[href*="/in/"]') ||
                  card.querySelector('.artdeco-entity-lockup__title a[href*="/in/"]') ||
                  card.querySelector('a[data-view-name="search-entity-result-universal-template-title"]') ||
                  card.querySelector('a.app-aware-link[href*="/in/"]') ||
                  card.querySelector('a[href*="/in/"]')
                ) as HTMLAnchorElement | null;

                if (!titleLink) continue;

                let href = titleLink.getAttribute('href') || '';
                if (!href) continue;
                if (!href.startsWith('http')) href = 'https://www.linkedin.com' + href;
                href = href.split('?')[0].replace(/\/+$/, '') + '/';

                const vanityMatch = href.match(/\/in\/([^/?#]+)/);
                if (!vanityMatch) continue;
                const vanityName = vanityMatch[1].toLowerCase();

                // Skip navigation and administrative links
                if (['me', 'unavailable', 'help', 'search', 'jobs', 'feed', 'notifications', 'mynetwork'].includes(vanityName)) {
                  continue;
                }
                if (pageSeen.has(vanityName)) continue;

                // Extract Person Name accurately
                let name: string | null = null;
                const titleSpan = titleLink.querySelector('span[aria-hidden="true"]');
                if (titleSpan && titleSpan.textContent?.trim()) {
                  name = titleSpan.textContent.trim();
                } else {
                  const visualHidden = titleLink.querySelector('.visually-hidden');
                  if (visualHidden && visualHidden.textContent?.trim()) {
                    const vText = visualHidden.textContent.trim();
                    name = vText.replace(/^View\s+/i, '').replace(/[\u2019']s\s+profile$/i, '').trim();
                  }
                }

                if (!name) {
                  name = titleLink.innerText?.split('\n')[0]?.trim() || titleLink.textContent?.trim() || null;
                }

                if (name) {
                  // Clean up badges or connection degree from name text
                  name = name
                    .replace(/•\s*(1st|2nd|3rd\+?)/gi, '')
                    .replace(/\b(1st|2nd|3rd)\s+degree\s+connection\b/gi, '')
                    .replace(/Verified\s+member/gi, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                }

                if (!name || (name === 'LinkedIn Member' && !href.includes('miniProfileUrn'))) {
                  if (name !== 'LinkedIn Member') continue;
                }

                pageSeen.add(vanityName);
                const cardText = card.textContent || '';

                // Extract Connection Degree
                let degree = '2nd';
                let connectionStatus: 'connected' | 'not_connected' | 'pending' = 'not_connected';

                if (/•\s*1st|1st\s*degree/i.test(cardText)) {
                  degree = '1st';
                  connectionStatus = 'connected';
                } else if (/•\s*2nd|2nd\s*degree/i.test(cardText)) {
                  degree = '2nd';
                  connectionStatus = 'not_connected';
                } else if (/•\s*3rd|3rd\+?\s*degree/i.test(cardText)) {
                  degree = '3rd';
                  connectionStatus = 'not_connected';
                }

                // Check Action Buttons strictly inside this card
                const buttons = Array.from(card.querySelectorAll('button, a'));
                let hasMessageBtn = false;
                let hasConnectBtn = false;
                let isPending = false;

                for (const b of buttons) {
                  const bText = b.textContent?.trim() || '';
                  const aria = b.getAttribute('aria-label') || '';
                  if (/pending/i.test(bText) || /invitation sent/i.test(aria) || /withdraw/i.test(aria)) {
                    isPending = true;
                    connectionStatus = 'pending';
                  } else if (/message/i.test(bText) || /message/i.test(aria)) {
                    hasMessageBtn = true;
                  } else if (/connect/i.test(bText) || /invite.*to connect/i.test(aria)) {
                    hasConnectBtn = true;
                  }
                }

                if (degree === '1st') {
                  connectionStatus = 'connected';
                  hasMessageBtn = true;
                }

                // Extract Avatar Photo strictly for this person
                let photoUrl: string | null = null;
                const allImgs = Array.from(card.querySelectorAll('img')) as HTMLImageElement[];
                for (const img of allImgs) {
                  const candidate =
                    img.getAttribute('data-delayed-url') ||
                    img.getAttribute('data-src') ||
                    img.getAttribute('data-lazy-src') ||
                    img.currentSrc ||
                    img.src ||
                    '';

                  if (!candidate) continue;
                  if (candidate.startsWith('data:')) continue;
                  if (/ghost-person|ghost-company|company-logo|school-logo|mini-school/i.test(candidate)) continue;

                  if (candidate.includes('licdn.com') || candidate.includes('profile-displayphoto')) {
                    photoUrl = candidate;
                    break;
                  }
                }

                // Extract Headline and Location
                let headline: string | null = null;
                let location: string | null = null;
                let summarySnippet: string | null = null;

                const primarySubtitle = card.querySelector(
                  '.entity-result__primary-subtitle, .artdeco-entity-lockup__subtitle, div[class*="primary-subtitle"], p[class*="primary-subtitle"]',
                );
                if (primarySubtitle) {
                  headline = primarySubtitle.textContent?.trim()?.replace(/\s+/g, ' ') || null;
                }

                const secondarySubtitle = card.querySelector(
                  '.entity-result__secondary-subtitle, div[class*="secondary-subtitle"], p[class*="secondary-subtitle"]',
                );
                if (secondarySubtitle) {
                  location = secondarySubtitle.textContent?.trim()?.replace(/\s+/g, ' ') || null;
                }

                const summaryEl = card.querySelector(
                  '.entity-result__summary, .entity-result__content--summary, div[class*="summary"], p[class*="summary"]',
                );
                if (summaryEl) {
                  summarySnippet = summaryEl.textContent?.trim()?.replace(/\s+/g, ' ') || null;
                }

                // Fallback for headline if primary subtitle is absent
                if (!headline) {
                  const textNodes = Array.from(card.querySelectorAll('p, span, div'))
                    .map(el => el.textContent?.trim() || '')
                    .filter(Boolean);

                  for (const txt of textNodes) {
                    if (
                      txt === name ||
                      txt.includes('• 1st') ||
                      txt.includes('• 2nd') ||
                      txt.includes('• 3rd') ||
                      txt === 'Message' ||
                      txt === 'Connect' ||
                      txt.includes('mutual connection') ||
                      txt.includes('Current:') ||
                      txt.includes('Past:')
                    ) {
                      continue;
                    }
                    if (txt.length > 15 && !headline) {
                      headline = txt;
                    } else if (txt.includes(',') && !location) {
                      location = txt;
                    }
                  }
                }

                // Parse Clean Position
                let position: string | null = null;
                if (summarySnippet && /current:\s*/i.test(summarySnippet)) {
                  const m = summarySnippet.match(/current:\s*([^•\n\r]+)/i);
                  if (m && m[1]) position = m[1].trim();
                }

                if (!position && headline) {
                  const parts = headline.split(/\||•|\sat\s|\s@\s/i);
                  if (parts[0] && parts[0].trim().length < 60) {
                    position = parts[0].trim();
                  } else {
                    position = headline;
                  }
                }

                // Extract Mutual Connections Text
                let mutualConnectionsText: string | null = null;
                const insightEl = card.querySelector('.entity-result__simple-insight, .entity-result__insight');
                if (insightEl && insightEl.textContent?.trim()) {
                  mutualConnectionsText = insightEl.textContent.trim().replace(/\s+/g, ' ');
                } else {
                  const mutualMatch = cardText.match(
                    /([\w\s]+&\s*\d+\s*other\s*mutual\s*connections?|\d+\s*mutual\s*connections?)/i,
                  );
                  if (mutualMatch) mutualConnectionsText = mutualMatch[1].trim();
                }

                people.push({
                  personId: vanityName,
                  name: name || 'LinkedIn Member',
                  profileUrl: href,
                  vanityName,
                  photoUrl,
                  headline: headline || position || 'Employee',
                  position: position || 'Professional',
                  companyName: cName,
                  companyId: cId,
                  location,
                  degree,
                  connectionStatus,
                  canMessage: hasMessageBtn || connectionStatus === 'connected',
                  canConnect: !isPending && connectionStatus !== 'connected',
                  mutualConnectionsText,
                });
              } catch (e) {
                /* skip malformed item */
              }
            }

            return people;
          },
          { cId: cleanCompanyId, cName: companyName || null },
        );

        logger.info(`[PeopleSearch] Extracted ${pagePeople.length} candidate profiles on page ${currentPage}.`);

        let newOnThisPage = 0;
        for (const p of pagePeople) {
          if (!seenVanity.has(p.vanityName)) {
            // Apply post-scrape relevance validation filter
            const isValid = CompanyPeopleSearchService.isPersonMatchingSearchCriteria(p, {
              position: cleanPosition,
              name: cleanName,
              keywords: cleanKeywords,
            });

            if (isValid) {
              seenVanity.add(p.vanityName);
              collectedPeople.push(p);
              newOnThisPage++;
              if (collectedPeople.length >= limit) break;
            } else {
              logger.debug(
                `[PeopleSearch] Filtered out non-matching profile "${p.name}" (${p.vanityName}) based on search filters.`,
              );
            }
          }
        }

        if (pagePeople.length === 0 || newOnThisPage === 0) {
          logger.info(`[PeopleSearch] Stopping pagination at page ${currentPage}: no additional matching profiles extracted.`);
          break;
        }

        // If Next button is absent or disabled, we reached the end of LinkedIn results
        const isLastPage = await page.evaluate(() => {
          const nextBtn = document.querySelector(
            'button[aria-label="Next"], .artdeco-pagination__button--next',
          ) as HTMLButtonElement | null;
          if (!nextBtn) return null;
          return nextBtn.disabled || nextBtn.classList.contains('artdeco-button--disabled');
        });

        if (isLastPage === true) {
          logger.info(`[PeopleSearch] Next button disabled on page ${currentPage}. Reached end of LinkedIn results.`);
          break;
        }

        currentPage++;
        if (collectedPeople.length < limit) {
          await page.waitForTimeout(1500);
        }
      }

      logger.info(
        `[PeopleSearch] Completed search with ${collectedPeople.length} verified people found for Company ID ${cleanCompanyId}.`,
      );

      return {
        success: true,
        companyId: cleanCompanyId,
        companyName: companyName || null,
        keywords: [cleanPosition, cleanName, cleanKeywords].filter(Boolean).join(' '),
        results: collectedPeople,
        totalFound: collectedPeople.length,
        message:
          collectedPeople.length > 0
            ? `Found ${collectedPeople.length} current employee${collectedPeople.length === 1 ? '' : 's'} matching your criteria.`
            : `No matching employees found for Company ID ${cleanCompanyId}. Try broadening your search filters.`,
        timestamp,
      };
    } catch (error: any) {
      logger.error(`[PeopleSearch] Search error: ${error.message}`);
      return {
        success: false,
        companyId: cleanCompanyId,
        companyName: companyName || null,
        keywords: [cleanPosition, cleanName, cleanKeywords].filter(Boolean).join(' '),
        results: [],
        totalFound: 0,
        message: `People search failed: ${error.message}`,
        timestamp,
      };
    } finally {
      try {
        if (context) await context.close();
      } catch { }
      try {
        if (browser) await browser.close();
      } catch { }
    }
  }
}
