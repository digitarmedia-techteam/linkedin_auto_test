import { chromium, type BrowserContext } from 'playwright';
import { logger } from '../utils/logger.js';
import type { LinkedInTestUser, StorageStateData } from '../db/models/TestUser.js';
import { config } from '../config/env.js';

export interface SentInvite {
  name: string;
  timeSent: string;
  isToday?: boolean;
}

export interface SentInvitationsResult {
  success: boolean;
  count: number;
  totalPendingCount?: number;
  invites: SentInvite[];
  allVisibleInvites?: SentInvite[];
  message?: string;
  error?: string;
}

export class SentInvitationsService {
  /**
   * Checks the LinkedIn "Sent Invitations" page and extracts invites sent today.
   */
  static async checkTodaySentInvites(
    user: LinkedInTestUser,
    headless: boolean = true
  ): Promise<SentInvitationsResult> {
    if (!user.storage_state_json && !user.session_cookies_json) {
      throw new Error(`User ${user.username} (ID: ${user.id}) does not have an active session saved. Please log in first.`);
    }

    logger.info(`[SentInvitations] Launching browser for user: ${user.username}`);
    const browser = await chromium.launch({
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      // Prepare isolated context with user's stored session cookies
      let cookiesToAdd: any[] = [];
      if (user.storage_state_json) {
        try {
          const parsedState = JSON.parse(user.storage_state_json) as StorageStateData;
          if (parsedState.cookies && parsedState.cookies.length > 0) {
            cookiesToAdd = parsedState.cookies;
          }
        } catch (e) {
          logger.warn(`[SentInvitations] Failed to parse storage_state_json: ${e}`);
        }
      }
      if (cookiesToAdd.length === 0 && user.session_cookies_json) {
        try {
          const parsedCookies = JSON.parse(user.session_cookies_json);
          if (Array.isArray(parsedCookies)) {
            cookiesToAdd = parsedCookies;
          }
        } catch (e) {
          logger.warn(`[SentInvitations] Failed to parse session_cookies_json: ${e}`);
        }
      }

      const context = await browser.newContext({
        baseURL: config.baseUrl,
        userAgent: user.user_agent ?? undefined,
        viewport: { width: 1280, height: 900 },
      });

      if (cookiesToAdd.length > 0) {
        await context.addCookies(cookiesToAdd);
      }

      const page = await context.newPage();
      page.setDefaultTimeout(35_000);
      page.setDefaultNavigationTimeout(35_000);

      logger.info(`[SentInvitations] Navigating to sent invitations page...`);
      await page.goto('https://www.linkedin.com/mynetwork/invitation-manager/sent/', {
        waitUntil: 'domcontentloaded',
      });

      // Check if redirected to login or checkpoint
      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint')) {
        return {
          success: false,
          count: 0,
          invites: [],
          message: 'Sender session is no longer active. Redirected to login/checkpoint.',
        };
      }

      // Wait intelligently for invitations or Withdraw buttons to render
      try {
        await page.waitForSelector(
          'button:has-text("Withdraw"), [aria-label*="Withdraw"], a[href*="/in/"], .mn-invitation-list, .artdeco-list',
          { timeout: 12_000 }
        );
        logger.info('[SentInvitations] Sent invitations content detected on page.');
      } catch {
        logger.warn('[SentInvitations] Selector wait timed out, proceeding to scan current DOM.');
      }

      // Small settle pause for dynamic data rendering
      await page.waitForTimeout(2500);

      // Scroll slightly to trigger any lazy-loaded rows
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(1500);

      const pageTitle = await page.title();
      logger.info(`[SentInvitations] Page title: "${pageTitle}", URL: "${page.url()}"`);

      // Scrape invitations
      const scrapedData = await page.evaluate(() => {
        const foundInvites: { name: string; headline?: string; timeSent: string; isToday: boolean }[] = [];
        const seenNames = new Set<string>();

        // 1. Extract Total Pending count from pill e.g., "People (14)"
        let totalCount: number | undefined = undefined;
        const bodyText = document.body.innerText || '';
        const pillMatch = bodyText.match(/People\s*\((\d+)\)/i);
        if (pillMatch) {
          totalCount = parseInt(pillMatch[1], 10);
        }

        // 2. Verified Block Parser:
        // In LinkedIn's layout, each sent invitation block ends with "Withdraw".
        // Directly preceding "Withdraw" is "Sent <X> ago" or "Sent just now".
        // Directly preceding the timestamp is the headline and recipient's Name.
        const sections = bodyText.split(/\n\s*Withdraw\s*\n/);
        for (let i = 0; i < sections.length - 1; i++) {
          const sec = sections[i].trim();
          const lines = sec.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          if (lines.length < 2) continue;

          const lastLine = lines[lines.length - 1] || '';
          const sentMatch = lastLine.match(/^Sent\s+([\w\d\s]+?(?:ago|now|yesterday))/i);
          if (sentMatch) {
            const timeSent = sentMatch[0].trim();
            // Name is 2 lines above timeSent if headline exists, or 1 line above
            const rawName = lines.length >= 3 ? lines[lines.length - 3] : lines[lines.length - 2];
            const headline = lines.length >= 3 ? lines[lines.length - 2] : '';

            // Clean up any extra trailing possessives or accessibility labels
            let cleanName = rawName.replace(/(?:’s|'s)$/g, '').trim();

            if (cleanName && !seenNames.has(cleanName.toLowerCase())) {
              seenNames.add(cleanName.toLowerCase());

              const t = timeSent.toLowerCase();
              const isToday = (
                t.includes('minute') ||
                t.includes('hour') ||
                t.includes('now') ||
                t.includes('second') ||
                t.includes('moment')
              );

              foundInvites.push({
                name: cleanName,
                headline,
                timeSent,
                isToday,
              });
            }
          }
        }

        return {
          totalCount,
          invites: foundInvites,
        };
      });

      const allVisible = scrapedData.invites;
      const todayInvites = allVisible.filter(inv => inv.isToday);

      logger.info(
        `[SentInvitations] Total parsed invitations: ${allVisible.length}. Sent today: ${todayInvites.length}.`
      );

      allVisible.forEach(inv => {
        logger.info(`[SentInvitations] • Recipient: "${inv.name}" | Time: "${inv.timeSent}" | Today: ${inv.isToday ? 'YES' : 'NO'}`);
      });

      return {
        success: true,
        count: todayInvites.length,
        totalPendingCount: scrapedData.totalCount,
        invites: todayInvites,
        allVisibleInvites: allVisible,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`[SentInvitations] Error checking sent invites: ${msg}`);
      return {
        success: false,
        count: 0,
        invites: [],
        error: msg,
      };
    } finally {
      await browser.close();
    }
  }
}
