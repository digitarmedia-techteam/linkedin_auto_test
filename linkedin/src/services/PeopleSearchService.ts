import { chromium } from 'playwright';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { LinkedInTestUser, StorageStateData } from '../db/models/TestUser.js';
import { LINKEDIN_COUNTRY_GEO_MAP } from './CompanySearchService.js';

export interface PersonSearchResult {
  personId: string;
  name: string;
  profileUrl: string;
  vanityName: string | null;
  photoUrl: string | null;
  designation: string;
  companyName: string;
  location: string;
  country: string | null;
  countryFlag: string | null;
  headline: string;
  degree: '1st' | '2nd' | '3rd' | 'Out of Network' | string;
  connectionStatus: 'connected' | 'not_connected' | 'pending';
  canMessage: boolean;
  canConnect: boolean;
  mutualConnectionsText: string | null;
  summarySnippet: string | null;
}

export interface PeopleSearchFilterOptions {
  user: LinkedInTestUser;
  keywords?: string;
  designation?: string;
  title?: string;
  countries?: string[] | string;
  geoUrns?: string[] | string;
  currentCompany?: string[] | string;
  companyIds?: string[] | string;
  network?: string; // 'F' (1st), 'S' (2nd), 'O' (3rd+)
  limit?: number;
  headless?: boolean;
}

export interface PeopleSearchResponse {
  success: boolean;
  query: {
    keywords: string;
    designation: string;
    countries: Array<{ geoId: string; name: string; flag: string }>;
    companies: string[];
  };
  results: PersonSearchResult[];
  totalFound: number;
  searchUrl: string;
  message: string;
  timestamp: string;
}

export class PeopleSearchService {
  /**
   * Helper to resolve multiple country inputs (names, codes, or numeric Geo IDs)
   * into a list of normalized Geo URN objects.
   */
  static resolveCountryGeos(
    countriesInput?: string[] | string | null,
    geoUrnsInput?: string[] | string | null,
  ): Array<{ geoId: string; name: string; flag: string; code: string }> {
    const rawList: string[] = [];

    if (Array.isArray(countriesInput)) {
      rawList.push(...countriesInput.map(String));
    } else if (typeof countriesInput === 'string' && countriesInput.trim()) {
      try {
        const parsed = JSON.parse(countriesInput);
        if (Array.isArray(parsed)) rawList.push(...parsed.map(String));
        else rawList.push(countriesInput);
      } catch {
        rawList.push(...countriesInput.split(',').map((s) => s.trim()));
      }
    }

    if (Array.isArray(geoUrnsInput)) {
      rawList.push(...geoUrnsInput.map(String));
    } else if (typeof geoUrnsInput === 'string' && geoUrnsInput.trim()) {
      try {
        const parsed = JSON.parse(geoUrnsInput);
        if (Array.isArray(parsed)) rawList.push(...parsed.map(String));
        else rawList.push(geoUrnsInput);
      } catch {
        rawList.push(...geoUrnsInput.split(',').map((s) => s.trim()));
      }
    }

    const results: Array<{ geoId: string; name: string; flag: string; code: string }> = [];
    const seenGeoIds = new Set<string>();

    for (const item of rawList) {
      const clean = String(item).trim();
      if (!clean) continue;

      let matched: { geoId: string; name: string; flag: string; code: string } | null = null;

      // 1. Direct Geo ID match
      if (/^\d+$/.test(clean)) {
        for (const c of Object.values(LINKEDIN_COUNTRY_GEO_MAP)) {
          if (c.geoId === clean) {
            matched = { ...c };
            break;
          }
        }
        if (!matched) {
          matched = { geoId: clean, name: `Geo ${clean}`, flag: '🌐', code: '' };
        }
      } else {
        const norm = clean.toLowerCase().replace(/[\s\-_,\.]+/g, '');
        if (LINKEDIN_COUNTRY_GEO_MAP[norm]) {
          matched = { ...LINKEDIN_COUNTRY_GEO_MAP[norm] };
        } else {
          for (const c of Object.values(LINKEDIN_COUNTRY_GEO_MAP)) {
            if (
              c.code.toLowerCase() === norm ||
              c.name.toLowerCase().replace(/[\s\-_,\.]+/g, '') === norm
            ) {
              matched = { ...c };
              break;
            }
          }
        }
      }

      if (matched && !seenGeoIds.has(matched.geoId)) {
        seenGeoIds.add(matched.geoId);
        results.push(matched);
      }
    }

    return results;
  }

  /**
   * Helper to parse company inputs (names or numeric company IDs)
   */
  static parseCompanyIds(input?: string[] | string | null): string[] {
    if (!input) return [];
    if (Array.isArray(input)) return input.map((s) => String(s).trim()).filter(Boolean);
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed.map((s) => String(s).trim()).filter(Boolean);
    } catch { }
    return String(input)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /**
   * Fast in-memory cache for resolved company IDs to speed up repeated queries.
   */
  private static companyCache: Map<string, string> = new Map([
    ['digitar media', '67952029'],
    ['digitarmedia', '67952029'],
  ]);

  /**
   * Resolves a company name (e.g. "Digitar Media") into a numeric LinkedIn Company ID (e.g. "67952029").
   * Checks cache first, then executes lightweight in-page query (Voyager typeahead or search results).
   */
  static async resolveNumericCompanyId(page: any, companyName: string): Promise<string | null> {
    const clean = (companyName || '').trim();
    if (!clean) return null;
    if (/^\d+$/.test(clean)) return clean;

    const norm = clean.toLowerCase().replace(/[\s\-_,\.]+/g, ' ').trim();
    if (this.companyCache.has(norm)) {
      return this.companyCache.get(norm)!;
    }

    if (!page) return null;

    try {
      const curUrl = page.url();
      if (!curUrl || curUrl === 'about:blank') {
        // Quick navigation to company search to extract dynamic company ID
        await page.goto(
          `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(clean)}&origin=SWITCH_SEARCH_VERTICAL`,
          { waitUntil: 'domcontentloaded', timeout: 20_000 },
        );

        const extractedId = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href*="currentCompany"]'));
          for (const a of links) {
            const href = a.getAttribute('href') || '';
            const m =
              href.match(/currentCompany=(?:%5B%22|\["|%22)?(\d+)/i) ||
              decodeURIComponent(href).match(/currentCompany=\[?"?(\d+)"?\]?/i);
            if (m && m[1]) return m[1];
          }
          const html = document.body ? document.body.innerHTML : '';
          const m =
            html.match(/currentCompany(?:%3D|=)(?:%5B%22|%5B%27|\["|\['|%22|")?(\d+)/i) ||
            html.match(/urn:li:fsd_company:(\d+)/i) ||
            html.match(/urn:li:company:(\d+)/i);
          return m && m[1] ? m[1] : null;
        });

        if (extractedId) {
          logger.info(`[PeopleSearch] Resolved company "${clean}" to ID ${extractedId} via company search page`);
          this.companyCache.set(norm, extractedId);
          return extractedId;
        }
      } else {
        const resolvedId = await page.evaluate(async (name: string) => {
          try {
            const csrfMatch = document.cookie.match(/JSESSIONID="?([^";]+)/);
            const csrf = csrfMatch ? csrfMatch[1] : '';
            const res = await fetch(`/voyager/api/typeahead/hitsV2?keywords=${encodeURIComponent(name)}&type=COMPANY`, {
              headers: {
                accept: 'application/vnd.linkedin.normalized+json+2.1',
                'csrf-token': csrf,
                'x-restli-protocol-version': '2.0.0',
              },
            });
            if (res.ok) {
              const data = await res.json();
              const str = JSON.stringify(data);
              const m = str.match(/urn:li:fsd_company:(\d+)/) || str.match(/urn:li:company:(\d+)/);
              if (m && m[1]) return m[1];
            }
          } catch { }

          try {
            const res = await fetch(
              `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(name)}&origin=SWITCH_SEARCH_VERTICAL`,
            );
            if (res.ok) {
              const html = await res.text();
              const m =
                html.match(/currentCompany(?:%3D|=)(?:%5B%22|%5B%27|\["|\['|%22|")?(\d+)/i) ||
                html.match(/urn:li:fsd_company:(\d+)/i) ||
                html.match(/urn:li:company:(\d+)/i);
              if (m && m[1]) return m[1];
            }
          } catch { }

          return null;
        }, clean);

        if (resolvedId) {
          logger.info(`[PeopleSearch] Resolved company "${clean}" to ID ${resolvedId}`);
          this.companyCache.set(norm, resolvedId);
          return resolvedId;
        }
      }
    } catch (e: any) {
      logger.warn(`[PeopleSearch] Dynamic company resolution failed for "${clean}": ${e?.message || e}`);
    }

    return null;
  }

  /**
   * Strict Location Validator:
   * Ensures the person's location strictly matches the user-selected country (or countries)
   * and strictly excludes profiles from India or any other non-selected country.
   */
  static verifyLocationMatchesCountries(
    location: string | null | undefined,
    targetCountries: Array<{ geoId: string; name: string; code: string; flag: string }>,
  ): boolean {
    if (!targetCountries || targetCountries.length === 0) {
      // If no country was selected (Global search), all locations are permitted
      return true;
    }

    if (!location || !location.trim()) {
      return false;
    }

    const loc = location.trim().toLowerCase();
    if (loc === 'global' || loc === 'unknown' || loc === 'remote') {
      return false;
    }

    const targetCodes = new Set(targetCountries.map((c) => c.code.toUpperCase()));
    const targetNames = targetCountries.map((c) => c.name.toLowerCase());
    const isTargetingUS =
      targetCodes.has('US') || targetNames.some((n) => n.includes('united states') || n === 'usa');

    // 1. STRICT EXCLUSIONS:
    // If India is NOT one of the selected countries, strictly reject any profile located in India
    const isIndiaTargeted = targetCodes.has('IN') || targetNames.includes('india');
    if (!isIndiaTargeted) {
      const INDIA_EXCLUSIONS = [
        'india',
        'bengaluru',
        'bangalore',
        'mumbai',
        'delhi',
        'new delhi',
        'noida',
        'gurugram',
        'gurgaon',
        'hyderabad',
        'pune',
        'chennai',
        'kolkata',
        'ahmedabad',
        'jaipur',
        'surat',
        'kerala',
        'karnataka',
        'maharashtra',
        'tamil nadu',
        'telangana',
        'uttar pradesh',
        'haryana',
        'gujarat',
        'west bengal',
        'rajasthan',
        'madhya pradesh',
        'andhra pradesh',
        'punjab',
        'chandigarh',
        'kochi',
        'coimbatore',
        'indore',
        'bhopal',
        'nagpur',
        'lucknow',
        'kanpur',
        'vadodara',
        'visakhapatnam',
        'patna',
        'ghaziabad',
        'ludhiana',
        'agra',
        'nashik',
        'faridabad',
        'meerut',
        'rajkot',
        'varanasi',
        'srinagar',
        'aurangabad',
        'dhanbad',
        'amritsar',
        'navi mumbai',
      ];
      for (const term of INDIA_EXCLUSIONS) {
        if (loc.includes(term)) {
          return false;
        }
      }
    }

    // Exclude other major countries if not selected
    if (!targetCodes.has('GB')) {
      if (
        loc.includes('united kingdom') ||
        /\buk\b/i.test(loc) ||
        loc.includes('england') ||
        loc.includes('scotland') ||
        loc.includes('wales') ||
        loc.includes('london')
      ) {
        return false;
      }
    }

    if (!targetCodes.has('CA')) {
      if (
        loc.includes('canada') ||
        loc.includes('toronto') ||
        loc.includes('vancouver') ||
        loc.includes('montreal') ||
        loc.includes('ontario') ||
        loc.includes('quebec') ||
        loc.includes('calgary') ||
        loc.includes('alberta')
      ) {
        return false;
      }
    }

    if (!targetCodes.has('AU')) {
      if (
        loc.includes('australia') ||
        loc.includes('sydney') ||
        loc.includes('melbourne') ||
        loc.includes('brisbane') ||
        loc.includes('perth')
      ) {
        return false;
      }
    }

    // Check against all other countries in LINKEDIN_COUNTRY_GEO_MAP that are not in targetCodes
    for (const c of Object.values(LINKEDIN_COUNTRY_GEO_MAP)) {
      if (!targetCodes.has(c.code.toUpperCase())) {
        const cName = c.name.toLowerCase();
        if (
          cName !== 'united states' &&
          cName !== 'united kingdom' &&
          cName !== 'united arab emirates' &&
          cName !== 'canada' &&
          cName !== 'australia' &&
          cName !== 'india'
        ) {
          if (loc.includes(cName)) {
            return false;
          }
        }
      }
    }

    // 2. POSITIVE MATCHING:
    // Check if location matches USA when USA is targeted
    if (isTargetingUS) {
      if (
        loc.includes('united states') ||
        /\busa\b/i.test(loc) ||
        /\bu\.s\.a?\b/i.test(loc) ||
        loc.endsWith(' us') ||
        loc.endsWith(', us') ||
        loc.endsWith(', usa')
      ) {
        return true;
      }

      // Check all 50 US States
      const US_STATES = [
        'alabama',
        'alaska',
        'arizona',
        'arkansas',
        'california',
        'colorado',
        'connecticut',
        'delaware',
        'florida',
        'georgia',
        'hawaii',
        'idaho',
        'illinois',
        'indiana',
        'iowa',
        'kansas',
        'kentucky',
        'louisiana',
        'maine',
        'maryland',
        'massachusetts',
        'michigan',
        'minnesota',
        'mississippi',
        'missouri',
        'montana',
        'nebraska',
        'nevada',
        'new hampshire',
        'new jersey',
        'new mexico',
        'new york',
        'north carolina',
        'north dakota',
        'ohio',
        'oklahoma',
        'oregon',
        'pennsylvania',
        'rhode island',
        'south carolina',
        'south dakota',
        'tennessee',
        'texas',
        'utah',
        'vermont',
        'virginia',
        'washington',
        'west virginia',
        'wisconsin',
        'wyoming',
        'district of columbia',
        'puerto rico',
      ];

      for (const state of US_STATES) {
        const re = new RegExp(`\\b${state}\\b`, 'i');
        if (re.test(loc)) {
          return true;
        }
      }

      // Check US State postal codes (e.g. ", TX", ", CA", ", NY", "Austin, TX")
      const postalMatch = location.match(/,\s*([A-Z]{2})\b/);
      if (postalMatch) {
        const code = postalMatch[1];
        const US_POSTAL_CODES = new Set([
          'AL',
          'AK',
          'AZ',
          'AR',
          'CA',
          'CO',
          'CT',
          'DE',
          'FL',
          'GA',
          'HI',
          'ID',
          'IL',
          'IN',
          'IA',
          'KS',
          'KY',
          'LA',
          'ME',
          'MD',
          'MA',
          'MI',
          'MN',
          'MS',
          'MO',
          'MT',
          'NE',
          'NV',
          'NH',
          'NJ',
          'NM',
          'NY',
          'NC',
          'ND',
          'OH',
          'OK',
          'OR',
          'PA',
          'RI',
          'SC',
          'SD',
          'TN',
          'TX',
          'UT',
          'VT',
          'VA',
          'WA',
          'WV',
          'WI',
          'WY',
          'DC',
          'PR',
        ]);
        if (US_POSTAL_CODES.has(code)) {
          return true;
        }
      }

      // Check major US Metro areas
      const US_METROS = [
        'san francisco bay area',
        'greater new york city area',
        'greater los angeles area',
        'greater chicago area',
        'greater boston area',
        'greater seattle area',
        'greater austin area',
        'dallas-fort worth',
        'greater houston area',
        'greater atlanta area',
        'greater philadelphia area',
        'greater phoenix area',
        'washington dc-baltimore',
        'greater denver area',
        'greater san diego area',
        'greater minneapolis-st. paul',
        'greater tampa bay area',
        'miami-fort lauderdale',
        'silicon valley',
        'new york metropolitan area',
        'greater orlando area',
        'greater charlotte area',
        'greater salt lake city area',
      ];

      for (const metro of US_METROS) {
        if (loc.includes(metro)) {
          return true;
        }
      }
    }

    // Check matching against any other targeted country
    for (const target of targetCountries) {
      const tName = target.name.toLowerCase();
      const tCode = target.code.toLowerCase();

      if (
        loc.includes(tName) ||
        loc.endsWith(`, ${tCode}`) ||
        loc.endsWith(` ${tCode}`) ||
        (tCode === 'in' && loc.includes('india'))
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Resolves country name and flag for a verified location string
   */
  static resolveCountryDetailsFromLocation(
    location: string | null | undefined,
    targetCountries: Array<{ geoId: string; name: string; code: string; flag: string }>,
  ): { name: string; flag: string } {
    if (!location) {
      if (targetCountries && targetCountries.length === 1) {
        return { name: targetCountries[0].name, flag: targetCountries[0].flag };
      }
      return { name: 'Global', flag: '🌐' };
    }

    const loc = location.toLowerCase();

    // Check if location matches one of the target countries
    for (const c of targetCountries) {
      if (
        loc.includes(c.name.toLowerCase()) ||
        loc.endsWith(`, ${c.code.toLowerCase()}`) ||
        loc.endsWith(` ${c.code.toLowerCase()}`) ||
        (c.code.toLowerCase() === 'in' && loc.includes('india'))
      ) {
        return { name: c.name, flag: c.flag };
      }
    }

    // Check US specific indicators
    const isTargetingUS = targetCountries.some((c) => c.code.toUpperCase() === 'US');
    if (
      isTargetingUS &&
      (loc.includes('united states') ||
        /\busa\b/i.test(loc) ||
        loc.includes('san francisco') ||
        loc.includes('new york') ||
        loc.includes('california') ||
        loc.includes('texas') ||
        /,\s*[A-Z]{2}\b/.test(location))
    ) {
      return { name: 'United States', flag: '🇺🇸' };
    }

    // Fallback to checking full map
    for (const c of Object.values(LINKEDIN_COUNTRY_GEO_MAP)) {
      if (
        loc.includes(c.name.toLowerCase()) ||
        loc.endsWith(`, ${c.code.toLowerCase()}`) ||
        loc.endsWith(` ${c.code.toLowerCase()}`)
      ) {
        return { name: c.name, flag: c.flag };
      }
    }

    if (targetCountries && targetCountries.length === 1) {
      return { name: targetCountries[0].name, flag: targetCountries[0].flag };
    }

    return { name: 'Global', flag: '🌐' };
  }

  /**
   * Validates whether a scraped profile belongs to the specified company.
   * Checks companyName, summarySnippet (e.g. "Current: ... at <Company>"),
   * and headline (e.g. "... at <Company>").
   */
  static verifyPersonMatchesCompany(
    person: { companyName?: string; headline?: string; summarySnippet?: string },
    targetCompany: string,
  ): boolean {
    if (!targetCompany || !targetCompany.trim()) return true;

    const target = targetCompany.trim().toLowerCase();
    const targetTokens = target.split(/\s+/).filter((t) => t.length > 2);

    const comp = (person.companyName || '').toLowerCase();
    const hl = (person.headline || '').toLowerCase();
    const snip = (person.summarySnippet || '').toLowerCase();

    // 1. Direct match on companyName
    if (comp && comp !== 'not specified on card' && comp !== 'self-employed / independent') {
      if (comp.includes(target) || target.includes(comp)) return true;
      if (targetTokens.length > 0 && targetTokens.every((t) => comp.includes(t))) return true;
    }

    // 2. Direct match on summarySnippet (e.g. "Current: Delivery Executive at Digitar Media")
    if (snip) {
      if (snip.includes(target)) return true;
      if (targetTokens.length > 0 && targetTokens.every((t) => snip.includes(t))) return true;
    }

    // 3. Direct match on headline (e.g. "Account Manager at digitar media")
    if (hl) {
      if (hl.includes(target)) return true;
      if (targetTokens.length > 0 && targetTokens.every((t) => hl.includes(t))) return true;
    }

    return false;
  }

  /**
   * Refines company name and designation when a person is confirmed to belong to a target company.
   */
  static refineCompanyAndDesignation(
    person: { designation?: string; companyName?: string; headline?: string; summarySnippet?: string },
    targetCompany: string,
  ): { designation: string; companyName: string } {
    let designation = person.designation || '';
    let companyName = person.companyName || '';
    const hl = person.headline || '';
    const snip = person.summarySnippet || '';

    if (targetCompany && targetCompany.trim()) {
      const cleanTarget = targetCompany.trim();
      const targetNorm = cleanTarget.toLowerCase();

      // Check if snippet has Current: <Role> at <Company>
      if (snip && /current:\s*/i.test(snip)) {
        const m = snip.match(/current:\s*([^\n•\r|]+?)(?:\s+(?:at|@)\s+([^\n•\r|]+)|$)/i);
        if (m) {
          if (m[1]) designation = m[1].trim();
          if (m[2] && m[2].toLowerCase().includes(targetNorm)) {
            companyName = cleanTarget;
          }
        }
      }

      // Check if headline has <Role> at <Company>
      if (
        hl &&
        (!companyName ||
          companyName === 'Not specified on card' ||
          companyName === 'Self-Employed / Independent' ||
          companyName.toLowerCase() === targetNorm)
      ) {
        const atMatch = hl.match(/^(.+?)(?:\s+at\s+|\s+@\s+)(.+?)(?:\s*\||\s*•|\s*\|\||$)/i);
        if (atMatch) {
          if (atMatch[1]) designation = atMatch[1].trim();
          if (atMatch[2] && atMatch[2].toLowerCase().includes(targetNorm)) {
            companyName = cleanTarget;
          }
        } else if (hl.toLowerCase().includes(targetNorm)) {
          const re = new RegExp(`at\\s+${cleanTarget}|@\\s*${cleanTarget}|${cleanTarget}`, 'i');
          const rolePart = hl.replace(re, '').replace(/[|•\-_]+$/, '').replace(/^[|•\-_]+/, '').trim();
          if (rolePart && rolePart.length > 2) {
            designation = rolePart.split(/\s*\|\s*/)[0].trim();
          }
          companyName = cleanTarget;
        }
      }

      if (!companyName || companyName === 'Not specified on card' || companyName === 'Self-Employed / Independent') {
        if (hl.toLowerCase().includes(targetNorm) || snip.toLowerCase().includes(targetNorm)) {
          companyName = cleanTarget;
        }
      }
    }

    if (!designation) designation = hl || 'Professional';
    if (!companyName) companyName = targetCompany || 'Not specified on card';

    designation = designation.replace(/^Current:\s*/i, '').replace(/[\u2019']s\s+profile$/i, '').trim();
    companyName = companyName.replace(/^[•\s\-_,|]+/, '').replace(/[•\s\-_,|]+$/, '').trim();

    return { designation, companyName };
  }

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
   * Main People Search method supporting multiple country filters, designation, keywords,
   * current companies, and structured output extraction (Person → Company → Designation → Country).
   */
  /**
   * Returns true when the query looks like a person's name rather than a job role/keyword.
   * Heuristic: all tokens are alphabetic (no digits), none are common role words.
   */
  private static isNameKeywordSearch(keyword: string): boolean {
    if (!keyword || !keyword.trim()) return false;
    const roleWords = new Set([
      'manager', 'engineer', 'developer', 'analyst', 'director', 'officer', 'lead', 'head',
      'specialist', 'consultant', 'associate', 'executive', 'president', 'vp', 'ceo', 'cto',
      'cfo', 'founder', 'co-founder', 'intern', 'coordinator', 'advisor', 'partner',
      'marketing', 'sales', 'finance', 'product', 'design', 'strategy', 'operations',
    ]);
    const tokens = keyword.trim().toLowerCase().split(/\s+/);
    if (tokens.some((t) => /\d/.test(t))) return false;
    if (tokens.every((t) => !roleWords.has(t))) return true;
    return false;
  }

  static async searchPeople(options: PeopleSearchFilterOptions): Promise<PeopleSearchResponse> {
    const { user } = options;
    const headless = options.headless !== false;
    const limit = options.limit ? Math.min(options.limit, 100) : 20;
    const timestamp = new Date().toISOString();

    const cleanKeywords = (options.keywords || '').trim();
    const cleanDesignation = (options.designation || options.title || '').trim();
    const resolvedCountries = this.resolveCountryGeos(options.countries, options.geoUrns);

    // Detect if keywords represent a person name (e.g. "rahul", "john smith")
    const keywordIsPersonName = cleanKeywords && !cleanDesignation && PeopleSearchService.isNameKeywordSearch(cleanKeywords);
    // Tokens to match against person name + vanity
    const nameKeywordTokens = keywordIsPersonName
      ? cleanKeywords.toLowerCase().split(/\s+/).filter((t) => t.length >= 2)
      : [];

    // Process company input: differentiate numeric Company IDs from text Company Names
    const rawCompany = options.currentCompany || options.companyIds || (options as any).company || '';
    const companyInputs = this.parseCompanyIds(rawCompany);
    const numericCompanyIds: string[] = [];
    const targetCompanyNames: string[] = [];

    for (const item of companyInputs) {
      if (/^\d+$/.test(item)) {
        numericCompanyIds.push(item);
      } else {
        targetCompanyNames.push(item);
        // Check local cache for immediate company ID match
        const norm = item.toLowerCase().replace(/[\s\-_,\.]+/g, ' ').trim();
        const cachedId = PeopleSearchService.companyCache.get(norm);
        if (cachedId && !numericCompanyIds.includes(cachedId)) {
          numericCompanyIds.push(cachedId);
        }
      }
    }

    // Build the query summary
    const querySummary = [
      cleanKeywords ? `Keywords: "${cleanKeywords}"` : '',
      cleanDesignation ? `Designation: "${cleanDesignation}"` : '',
      targetCompanyNames.length > 0
        ? `Company: [${targetCompanyNames.join(', ')}]`
        : numericCompanyIds.length > 0
          ? `Company IDs: [${numericCompanyIds.join(', ')}]`
          : '',
      resolvedCountries.length > 0
        ? `Countries: [${resolvedCountries.map((c) => `${c.flag} ${c.name} (${c.geoId})`).join(', ')}]`
        : 'Global',
    ]
      .filter(Boolean)
      .join(' | ');

    logger.info(`[PeopleSearch] Starting People Search: ${querySummary} (User: ${user.username})`);

    let browser: any = null;
    let context: any = null;
    const collectedPeople: PersonSearchResult[] = [];
    const seenVanity = new Set<string>();
    let primarySearchUrl = '';

    try {
      const ctx = await this.createBrowserContext(user, headless);
      browser = ctx.browser;
      context = ctx.context;
      const page = ctx.page;

      // If company names were specified without a resolved numeric ID, resolve dynamically via page session
      if (numericCompanyIds.length === 0 && targetCompanyNames.length > 0) {
        for (const compName of targetCompanyNames) {
          const resolved = await PeopleSearchService.resolveNumericCompanyId(page, compName);
          if (resolved && !numericCompanyIds.includes(resolved)) {
            numericCompanyIds.push(resolved);
          }
        }
      }

      let currentPage = 1;
      // Allow sufficient page traversal so strict company & location filtering can fill the requested limit
      const maxPagesToScrape = Math.min(Math.ceil(limit / 5) + 4, 15);

      while (collectedPeople.length < limit && currentPage <= maxPagesToScrape) {
        // Construct LinkedIn Structured Faceted People Search URL matching LinkedIn's native format
        const urlParams = new URLSearchParams();
        urlParams.set('origin', 'GLOBAL_SEARCH_HEADER');

        // 1. Numeric Company ID facet (e.g. ["67952029"])
        if (numericCompanyIds.length > 0) {
          urlParams.set('currentCompany', JSON.stringify(numericCompanyIds));
        }

        // 2. Keywords / Search Query:
        // When numeric company is set, keywords MUST NOT contain the company name!
        // Instead, keywords should represent the user's role / designation and/or keywords.
        let searchKeywords = '';
        if (cleanDesignation && cleanKeywords) {
          if (cleanDesignation.toLowerCase() === cleanKeywords.toLowerCase()) {
            searchKeywords = cleanDesignation;
          } else {
            searchKeywords = `"${cleanDesignation}" ${cleanKeywords}`;
          }
        } else if (cleanDesignation) {
          searchKeywords = cleanDesignation;
        } else if (cleanKeywords) {
          searchKeywords = cleanKeywords;
        }

        // If numeric company ID was NOT resolved, and we only have company name as text:
        // fallback to appending company name to keywords
        if (numericCompanyIds.length === 0 && targetCompanyNames.length > 0) {
          const compStr = targetCompanyNames.join(' ');
          if (searchKeywords) {
            searchKeywords = `${searchKeywords} "${compStr}"`;
          } else {
            searchKeywords = compStr;
          }
        }

        if (searchKeywords) {
          urlParams.set('keywords', searchKeywords);
        }

        // 3. Multiple country Geo URNs encoded as JSON array: ["102713980"]
        if (resolvedCountries.length > 0) {
          const geoIdList = resolvedCountries.map((c) => c.geoId);
          urlParams.set('geoUrn', JSON.stringify(geoIdList));
        }

        // 4. Network degree filter
        if (options.network) {
          urlParams.set('network', JSON.stringify([options.network]));
        }

        if (currentPage > 1) {
          urlParams.set('page', String(currentPage));
        }

        const searchUrl = `https://www.linkedin.com/search/results/people/?${urlParams.toString()}`;
        if (currentPage === 1) {
          primarySearchUrl = searchUrl;
        }

        logger.info(`[PeopleSearch] Navigating to page ${currentPage}: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 35_000 });

        // Wait for results container or cards
        try {
          await page.waitForSelector(
            '.reusable-search__entity-result-list, [data-view-name="search-entity-result-universal-template"], .entity-result, div[data-view-name="search-results-container"], div.search-results-container, main',
            { timeout: 14_000 },
          );
        } catch {
          logger.warn(`[PeopleSearch] Results selector not detected within timeout on page ${currentPage}.`);
        }

        // Progressive scrolling to trigger lazy-loaded cards & avatar images
        try {
          await page.evaluate(() => window.scrollBy(0, 450));
          await page.waitForTimeout(700);
          await page.evaluate(() => window.scrollBy(0, 600));
          await page.waitForTimeout(700);
          await page.evaluate(() => window.scrollBy(0, 600));
          await page.waitForTimeout(700);
        } catch { }

        // Wait for images to load
        try {
          await page.waitForSelector(
            '.reusable-search__entity-result-list img, [data-view-name="search-entity-result-universal-template"] img, .entity-result img, main img',
            { timeout: 3_000 },
          );
        } catch { }

        // Extract people cards from DOM with comprehensive Person → Company → Designation → Location structure
        const pagePeople = await page.evaluate(() => {
          const people: any[] = [];
          const pageSeen = new Set<string>();

          const resultsRoot =
            document.querySelector('.reusable-search__entity-result-list') ||
            document.querySelector('ul[role="list"].reusable-search__entity-result-list') ||
            document.querySelector('div[data-view-name="search-results-container"]') ||
            document.querySelector('.search-results-container') ||
            document.querySelector('.scaffold-finite-scroll__content') ||
            document.querySelector('main .search-results-container') ||
            document.querySelector('main');

          if (!resultsRoot) return people;

          const rawCards = Array.from(
            resultsRoot.querySelectorAll(
              'li.reusable-search__result-container, [data-view-name="search-entity-result-universal-template"], .entity-result, li[role="listitem"]',
            ),
          );

          // Strictly exclude sidebar or header elements
          const cardElements = rawCards.filter((card) => {
            const aside = card.closest(
              'aside, nav, header, footer, .scaffold-layout__aside, [data-view-name="search-spotlight"]',
            );
            return !aside;
          });

          const candidateCards: HTMLElement[] =
            cardElements.length > 0
              ? (cardElements as HTMLElement[])
              : (Array.from(resultsRoot.querySelectorAll('a[href*="/in/"]'))
                .map((a) => a.closest('li') || a.parentElement)
                .filter(Boolean) as HTMLElement[]);

          let cardIndex = 0;
          for (const card of candidateCards) {
            cardIndex++;
            try {
              // 1. Profile Link and Title container
              const titleLink = (
                card.querySelector('.entity-result__title-text a[href*="/in/"]') ||
                card.querySelector('.artdeco-entity-lockup__title a[href*="/in/"]') ||
                card.querySelector('a[data-view-name="search-entity-result-universal-template-title"]') ||
                card.querySelector('a.app-aware-link[href*="/in/"]') ||
                card.querySelector('.entity-result__title-text a') ||
                card.querySelector('.artdeco-entity-lockup__title a') ||
                card.querySelector('a[href*="/in/"]')
              ) as HTMLAnchorElement | null;

              let href = '';
              let vanityName = '';
              let isOutOfNetworkMember = false;

              if (titleLink) {
                href = titleLink.getAttribute('href') || '';
                if (href && !href.startsWith('http')) href = 'https://www.linkedin.com' + href;
                href = href.split('?')[0].replace(/\/+$/, '') + '/';

                const vanityMatch = href.match(/\/in\/([^/?#]+)/);
                if (vanityMatch) {
                  vanityName = vanityMatch[1].toLowerCase();
                }
              }

              // Support out-of-network "LinkedIn Member" cards without /in/ link
              if (!vanityName) {
                const titleContainer = card.querySelector(
                  '.entity-result__title-text, .artdeco-entity-lockup__title, [data-view-name="search-entity-result-universal-template-title"]',
                );
                const titleText = titleContainer?.textContent?.trim() || '';
                if (titleText.includes('LinkedIn Member') || titleText === '--') {
                  isOutOfNetworkMember = true;
                  vanityName = `member-${cardIndex}-${Date.now()}`;
                  href = href || 'https://www.linkedin.com/in/unavailable';
                } else {
                  continue; // Skip unknown non-profile card
                }
              }

              // Skip non-profile links
              if (
                ['me', 'unavailable', 'help', 'search', 'jobs', 'feed', 'notifications', 'mynetwork'].includes(
                  vanityName,
                ) &&
                !isOutOfNetworkMember
              ) {
                continue;
              }
              if (pageSeen.has(vanityName)) continue;

              // 2. Extract Person Name
              let name: string | null = null;
              if (isOutOfNetworkMember) {
                name = 'LinkedIn Member';
              } else if (titleLink) {
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
              }

              if (name) {
                name = name
                  .replace(/•\s*(1st|2nd|3rd\+?)/gi, '')
                  .replace(/\b(1st|2nd|3rd)\s+degree\s+connection\b/gi, '')
                  .replace(/Verified\s+member/gi, '')
                  .replace(/\s+/g, ' ')
                  .trim();
              }

              pageSeen.add(vanityName);
              const cardText = card.textContent || '';

              // 3. Degree & Connection Status
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

              // 4. Action Buttons
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

              // 5. Extract Profile Picture (Avatar)
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

              // 6. Subtitles (Headline, Location & Summary Snippet)
              let headline: string | null = null;
              let location: string | null = null;
              let summarySnippet: string | null = null;

              // Primary subtitle (Headline)
              const primarySubtitle = card.querySelector(
                '.entity-result__primary-subtitle, .artdeco-entity-lockup__subtitle, div[class*="primary-subtitle"], p[class*="primary-subtitle"], .t-14.t-black.t-normal',
              );
              if (primarySubtitle) {
                headline = primarySubtitle.textContent?.trim()?.replace(/\s+/g, ' ') || null;
              }

              // Secondary subtitle (Location)
              const secondarySubtitle = card.querySelector(
                '.entity-result__secondary-subtitle, div[class*="secondary-subtitle"], p[class*="secondary-subtitle"], .t-12.t-black--light',
              );
              if (secondarySubtitle) {
                location = secondarySubtitle.textContent?.trim()?.replace(/\s+/g, ' ') || null;
              }

              // Summary snippet
              const summaryEl = card.querySelector(
                '.entity-result__summary, .entity-result__content--summary, div[class*="summary"], p[class*="summary"]',
              );
              if (summaryEl) {
                summarySnippet = summaryEl.textContent?.trim()?.replace(/\s+/g, ' ') || null;
              }

              // Robust Fallback: check all paragraphs/divs for Current: or Past:
              if (!summarySnippet) {
                const cardNodes = Array.from(card.querySelectorAll('p, div, span'));
                for (const node of cardNodes) {
                  const txt = node.textContent?.trim() || '';
                  if (/^current:\s*/i.test(txt) || /^past:\s*/i.test(txt)) {
                    summarySnippet = txt.replace(/\s+/g, ' ');
                    break;
                  }
                }
              }

              // Multi-strategy fallback: inspect text nodes inside the content column if headline or location is missing
              if (!headline || !location) {
                const contentBox =
                  (titleLink && (titleLink.closest('.entity-result__content') || titleLink.closest('.artdeco-entity-lockup__content'))) ||
                  card;

                const textElements = Array.from(contentBox.querySelectorAll('div, p, span'))
                  .map((el) => el.textContent?.trim() || '')
                  .filter((t) => t.length > 2 && t !== name);

                for (const txt of textElements) {
                  if (
                    txt === name ||
                    txt.includes('• 1st') ||
                    txt.includes('• 2nd') ||
                    txt.includes('• 3rd') ||
                    txt === 'Message' ||
                    txt === 'Connect' ||
                    txt === 'Pending' ||
                    txt.includes('mutual connection') ||
                    txt.includes('Verified member')
                  ) {
                    continue;
                  }

                  if (txt.startsWith('Current:') || txt.startsWith('Past:')) {
                    if (!summarySnippet) summarySnippet = txt;
                    continue;
                  }

                  const isLocationCandidate =
                    /area|metro|united states|usa|\b[A-Z]{2}\b|india|delhi|mumbai|bengaluru|bangalore|ghaziabad|noida|gurugram|gurgaon|kingdom|canada|australia|germany|france|,/i.test(
                      txt,
                    ) &&
                    !/engineer|developer|manager|director|founder|ceo|cto|cfo|specialist|officer|lead|president|consultant|analyst|associate|intern|student|executive/i.test(
                      txt,
                    );

                  if (isLocationCandidate && !location) {
                    location = txt.replace(/\s+/g, ' ');
                  } else if (!headline && txt.length > 5 && !isLocationCandidate) {
                    headline = txt.replace(/\s+/g, ' ');
                  }
                }
              }

              // 7. Extract Accurate Person → Company → Designation Breakdown
              let designation: string = '';
              let companyName: string = '';

              // A. Check summary snippet for explicit "Current: <Title> at <Company>"
              if (summarySnippet && /current:\s*/i.test(summarySnippet)) {
                const curMatch = summarySnippet.match(/current:\s*([^\n•\r|]+?)(?:\s+(?:at|@)\s+([^\n•\r|]+)|$)/i);
                if (curMatch) {
                  if (curMatch[1]) designation = curMatch[1].trim();
                  if (curMatch[2]) companyName = curMatch[2].trim();
                }
              }

              // B. If not resolved from snippet, extract from Headline
              if ((!designation || !companyName) && headline) {
                // Split on " at " or " @ "
                const atMatch = headline.match(/^(.+?)(?:\s+at\s+|\s+@\s+)(.+?)(?:\s*\||\s*•|\s*\|\||$)/i);
                if (atMatch) {
                  if (!designation) designation = atMatch[1].trim();
                  if (!companyName) companyName = atMatch[2].trim();
                } else {
                  // Check pipe separated format: "Founder & CEO | Acme Corp"
                  const pipeParts = headline.split(/\s*\|\s*|\s*•\s*/);
                  if (pipeParts.length >= 2) {
                    if (!designation) designation = pipeParts[0].trim();
                    if (!companyName) companyName = pipeParts[1].trim();
                  } else {
                    // Check dash separated format: "Senior Manager - Google"
                    const dashParts = headline.split(/\s+-\s+/);
                    if (dashParts.length === 2) {
                      if (!designation) designation = dashParts[0].trim();
                      if (!companyName) companyName = dashParts[1].trim();
                    } else {
                      if (!designation) designation = headline.trim();
                    }
                  }
                }
              }

              // C. Accurate Fallbacks
              if (!designation) designation = headline || 'Professional';
              if (!companyName) {
                if (/freelance|independent|self-employed|consultant|advisor/i.test(headline || designation)) {
                  companyName = 'Self-Employed / Independent';
                } else {
                  companyName = 'Not specified on card';
                }
              }

              // Clean up trailing prefixes or badges in designation and company
              designation = designation.replace(/^Current:\s*/i, '').replace(/[\u2019']s\s+profile$/i, '').trim();
              companyName = companyName.replace(/^[•\s\-_,|]+/, '').replace(/[•\s\-_,|]+$/, '').trim();

              // 8. Mutual Connections
              let mutualConnectionsText: string | null = null;
              const insightEl = card.querySelector(
                '.entity-result__simple-insight, .entity-result__insight, div[class*="insight"]',
              );
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
                designation,
                companyName,
                location: location || '',
                headline: headline || designation,
                degree,
                connectionStatus,
                canMessage: hasMessageBtn || connectionStatus === 'connected',
                canConnect: !isPending && connectionStatus !== 'connected',
                mutualConnectionsText,
                summarySnippet,
              });
            } catch (e) {
              /* skip malformed item */
            }
          }

          return people;
        });

        // Add to collected results strictly enforcing name / company / location filters
        for (const person of pagePeople) {
          if (seenVanity.has(person.vanityName)) continue;

          // 0. NAME KEYWORD FILTER:
          // If the search keyword looks like a person name (e.g. "rahul"),
          // only accept profiles whose name OR vanityName contains at least one keyword token.
          if (nameKeywordTokens.length > 0) {
            const personNameLower = (person.name || '').toLowerCase();
            const personVanityLower = (person.vanityName || '').toLowerCase();
            const nameMatches = nameKeywordTokens.some(
              (token) => personNameLower.includes(token) || personVanityLower.includes(token),
            );
            if (!nameMatches) {
              logger.info(
                `[PeopleSearch] Discarded "${person.name}" - name does not match keyword tokens [${nameKeywordTokens.join(', ')}]`,
              );
              continue;
            }
          }

          // 1. COMPANY VALIDATION & REFINEMENT:
          if (numericCompanyIds.length > 0) {
            // Company was strictly filtered server-side by LinkedIn's native currentCompany facet!
            // Profiles returned by LinkedIn belong to this company.
            const targetComp = targetCompanyNames[0] || '';
            if (targetComp) {
              if (
                !person.companyName ||
                person.companyName === 'Not specified on card' ||
                person.companyName === 'Self-Employed / Independent'
              ) {
                person.companyName = targetComp;
              }
              const refined = PeopleSearchService.refineCompanyAndDesignation(person, targetComp);
              if (refined.companyName) person.companyName = refined.companyName;
              if (refined.designation) person.designation = refined.designation;
            } else if (person.summarySnippet && /current:\s*/i.test(person.summarySnippet)) {
              const curMatch = person.summarySnippet.match(
                /current:\s*([^\n•\r|]+?)(?:\s+(?:at|@)\s+([^\n•\r|]+)|$)/i,
              );
              if (curMatch) {
                if (curMatch[1]) person.designation = curMatch[1].trim();
                if (curMatch[2]) person.companyName = curMatch[2].trim();
              }
            }
          } else if (targetCompanyNames.length > 0) {
            // Fallback when company was not in currentCompany facet and only keyword was used:
            const matchesCompany = targetCompanyNames.some((tc) =>
              PeopleSearchService.verifyPersonMatchesCompany(person, tc),
            );

            if (!matchesCompany) {
              logger.info(
                `[PeopleSearch] Discarded non-company profile "${person.name}" - does not match target company [${targetCompanyNames.join(', ')}] (Company: "${person.companyName}", Headline: "${person.headline}")`,
              );
              continue;
            }

            const matchedCompany = targetCompanyNames.find((tc) =>
              PeopleSearchService.verifyPersonMatchesCompany(person, tc),
            )!;
            const refined = PeopleSearchService.refineCompanyAndDesignation(person, matchedCompany);
            person.companyName = refined.companyName;
            person.designation = refined.designation;
          }

          // 2. STRICT LOCATION VALIDATION:
          // If country filters are selected, verify that the person's location matches the selected countries
          // and does not belong to an excluded country (such as India when USA is selected).
          if (resolvedCountries.length > 0) {
            const isStrictMatch = PeopleSearchService.verifyLocationMatchesCountries(
              person.location,
              resolvedCountries,
            );

            if (!isStrictMatch) {
              logger.info(
                `[PeopleSearch] Discarded non-matching profile "${person.name}" - Location "${person.location || 'N/A'}" does not strictly match selected countries: [${resolvedCountries.map((c) => c.name).join(', ')}]`,
              );
              continue;
            }
          }

          seenVanity.add(person.vanityName);

          // Resolve country details from location string
          const countryDetails = PeopleSearchService.resolveCountryDetailsFromLocation(
            person.location,
            resolvedCountries,
          );

          collectedPeople.push({
            ...person,
            location: person.location || countryDetails.name,
            country: countryDetails.name,
            countryFlag: countryDetails.flag,
          });

          if (collectedPeople.length >= limit) break;
        }

        logger.info(
          `[PeopleSearch] Page ${currentPage} processed. Collected ${collectedPeople.length}/${limit} strictly verified profiles.`,
        );

        if (pagePeople.length === 0 || collectedPeople.length >= limit) {
          break;
        }

        currentPage++;
      }

      logger.info(
        `[PeopleSearch] Completed. Successfully extracted ${collectedPeople.length} people profiles.`,
      );

      const companySummaryDesc = targetCompanyNames.length > 0
        ? ` at ${targetCompanyNames.join(', ')}`
        : numericCompanyIds.length > 0
          ? ` at Company ID ${numericCompanyIds.join(', ')}`
          : '';
      const countrySummaryDesc = resolvedCountries.length > 0
        ? ` in ${resolvedCountries.map((c) => `${c.flag} ${c.name}`).join(', ')}`
        : '';

      return {
        success: true,
        query: {
          keywords: cleanKeywords,
          designation: cleanDesignation,
          countries: resolvedCountries.map((c) => ({ geoId: c.geoId, name: c.name, flag: c.flag })),
          companies: companyInputs,
        },
        results: collectedPeople,
        totalFound: collectedPeople.length,
        searchUrl: primarySearchUrl,
        message:
          collectedPeople.length > 0
            ? `Successfully found ${collectedPeople.length} verified matching people profiles${companySummaryDesc}${countrySummaryDesc}.`
            : targetCompanyNames.length > 0 || numericCompanyIds.length > 0
              ? `No matching people profiles found${companySummaryDesc}${countrySummaryDesc}. Ensure the company name matches LinkedIn.`
              : resolvedCountries.length > 0
                ? `No matching people profiles found strictly located in ${resolvedCountries.map((c) => `${c.flag} ${c.name}`).join(', ')}.`
                : 'No matching people profiles found for the given criteria.',
        timestamp,
      };
    } catch (error: any) {
      logger.error(`[PeopleSearch] Error executing people search: ${error?.message || error}`);
      return {
        success: false,
        query: {
          keywords: cleanKeywords,
          designation: cleanDesignation,
          countries: resolvedCountries.map((c) => ({ geoId: c.geoId, name: c.name, flag: c.flag })),
          companies: companyInputs,
        },
        results: collectedPeople,
        totalFound: collectedPeople.length,
        searchUrl: primarySearchUrl,
        message: error?.message || 'Failed to search people on LinkedIn',
        timestamp,
      };
    } finally {
      if (context) {
        try {
          await context.close();
        } catch { }
      }
      if (browser) {
        try {
          await browser.close();
        } catch { }
      }
    }
  }
}

