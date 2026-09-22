import { chromium, type BrowserContext, type Page } from 'playwright';
import { logger } from '../utils/logger.js';
import type { LinkedInTestUser, StorageStateData } from '../db/models/TestUser.js';
import { config } from '../config/env.js';
import { extractVanityName } from './DirectConnectionService.js';
import { ConnectionTrackingRepository } from '../db/repositories/ConnectionTrackingRepository.js';
import type { ConnectionTracking, DetectedVia } from '../db/models/ConnectionTracking.js';

export interface AcceptedContactInfo {
  name: string;
  vanityName?: string;
  profileUrl?: string;
  headline?: string;
  timeText?: string;
  acceptedAt?: string;
  detectedVia: DetectedVia;
  snippet?: string;
  isNewDetection?: boolean;
}

export interface SentInvitationItem {
  name: string;
  headline?: string;
  timeSent?: string;
  profileUrl?: string;
  vanityName?: string;
  isToday?: boolean;
}

export interface ConnectionListItem {
  name: string;
  headline?: string;
  profileUrl?: string;
  vanityName?: string;
  avatarUrl?: string;
  connectedTime?: string;
  connectedDate?: string;
  isAcceptedToday?: boolean;
  messageUrl?: string;
  recipientUrn?: string;
  profileUrn?: string;
}

export interface ConnectionsTodayResult {
  success: boolean;
  senderUsername: string;
  senderUserId: number;
  totalConnectionsOnLinkedIn?: string;
  totalScraped: number;
  acceptedTodayCount: number;
  acceptedToday: ConnectionListItem[];
  allScraped: ConnectionListItem[];
  persistedCount: number;
  checkedAt: string;
  message?: string;
  error?: string;
}

/**
 * Checks if a connection date text from LinkedIn corresponds to today.
 * Handles formats like:
 * - "Connected on September 21, 2026"
 * - "Connected on Sep 21, 2026"
 * - "Connected on 21 September 2026"
 * - "September 21, 2026"
 * - "Connected today", "today", "just now", "moments ago"
 * - "Connected 2 hours ago", "Connected 45 minutes ago", "2h", "45m", "10m ago"
 */
export function isConnectionDateToday(rawText: string | undefined | null, now: Date = new Date()): boolean {
  if (!rawText) return false;
  const text = rawText.replace(/^[Cc]onnected\s+(?:on\s+)?/i, '').trim();
  if (!text) return false;

  const lower = text.toLowerCase();

  // 1. Relative keywords for today
  if (
    /^(?:today|just now|moments? ago|\d+\s*(?:minute|min|hour|hr|sec|second)s?\s*ago|\d+[hm])$/i.test(lower) ||
    /\b(?:today|just now|\d+\s*(?:minute|min|hour|hr)s?\s*ago|\d+[hm]\s+ago)\b/i.test(lower)
  ) {
    return true;
  }

  // 2. Relative keywords for past dates
  if (
    /^(?:yesterday|\d+\s*(?:day|week|month|year)s?\s*ago|\d+[dwy])$/i.test(lower) ||
    /\b(?:yesterday|\d+\s*(?:day|week|month|year)s?\s*ago)\b/i.test(lower)
  ) {
    return false;
  }

  // 3. Exact date parsing
  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    const isSameYear = parsed.getFullYear() === now.getFullYear();
    const isSameMonth = parsed.getMonth() === now.getMonth();
    const isSameDate = parsed.getDate() === now.getDate();
    if (isSameYear && isSameMonth && isSameDate) {
      return true;
    }
  }

  // 4. Token-based matching fallback
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  const curMonthIndex = now.getMonth();
  const curMonthName = months[curMonthIndex];
  const curShortMonth = shortMonths[curMonthIndex];
  const curDay = now.getDate();
  const curYear = now.getFullYear();

  const monthMatched = lower.includes(curMonthName) || lower.includes(curShortMonth);
  const dayMatched = new RegExp(`\\b0?${curDay}(?:st|nd|rd|th)?\\b`).test(lower);
  const yearMatched = lower.includes(String(curYear));

  // If month and day match today and year matches (or no 4-digit past year mentioned)
  if (monthMatched && dayMatched) {
    if (yearMatched || !/\b20\d\d\b/.test(lower)) {
      return true;
    }
  }

  return false;
}

export interface FullDetectionResult {
  success: boolean;
  senderUsername: string;
  senderUserId: number;
  totalNewlyDetected: number;
  newlyAcceptedContacts: AcceptedContactInfo[];
  allAcceptedInDb: ConnectionTracking[];
  currentPendingInDb: ConnectionTracking[];
  stats: {
    total: number;
    accepted: number;
    pending: number;
    withdrawn: number;
    rejected: number;
  };
  details: {
    notificationsFound: AcceptedContactInfo[];
    sentDiffDisappeared: { name: string; vanityName?: string; profileUrl?: string }[];
    connectionsFound: ConnectionListItem[];
  };
  timestamp: string;
  message?: string;
  error?: string;
}

export class AcceptedConnectionsService {
  /**
   * Helper to create an isolated browser context with user's stored cookies.
   */
  private static async createBrowserContext(user: LinkedInTestUser, headless: boolean = true) {
    if (!user.storage_state_json && !user.session_cookies_json) {
      throw new Error(
        `User ${user.username} (ID: ${user.id}) does not have an active session saved. Please log in first.`,
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
        logger.warn(`[AcceptedConnections] Failed to parse storage_state_json: ${e}`);
      }
    }
    if (cookiesToAdd.length === 0 && user.session_cookies_json) {
      try {
        const parsedCookies = JSON.parse(user.session_cookies_json);
        if (Array.isArray(parsedCookies)) {
          cookiesToAdd = parsedCookies;
        }
      } catch (e) {
        logger.warn(`[AcceptedConnections] Failed to parse session_cookies_json: ${e}`);
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

    return { browser, context, page };
  }

  /**
   * Method 1: Scrape LinkedIn Notifications page for "accepted your invitation" alerts.
   */
  static async detectFromNotificationsOnPage(page: Page): Promise<AcceptedContactInfo[]> {
    logger.info('[AcceptedConnections] Navigating to notifications page with CONNECTIONS filter...');
    try {
      await page.goto('https://www.linkedin.com/notifications/?filter=CONNECTIONS', {
        waitUntil: 'domcontentloaded',
      });
    } catch {
      logger.warn('[AcceptedConnections] Fallback to standard notifications URL...');
      await page.goto('https://www.linkedin.com/notifications/', {
        waitUntil: 'domcontentloaded',
      });
    }

    // Check login redirect
    const url = page.url();
    if (url.includes('/login') || url.includes('/checkpoint') || url.includes('/authwall')) {
      logger.warn('[AcceptedConnections] Session redirected to login on notifications.');
      return [];
    }

    // Wait for content
    try {
      await page.waitForSelector('.nt-card, article, main, .notifications-list', { timeout: 12_000 });
    } catch {
      logger.warn('[AcceptedConnections] Timeout waiting for notifications selector.');
    }

    await page.waitForTimeout(2000);

    // Scroll 3 times to load more notifications
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(1000);
    }

    // Scrape notifications from the page DOM
    const rawItems = await page.evaluate(() => {
      const results: {
        rawText: string;
        profileUrl?: string;
        timeText?: string;
      }[] = [];

      // Look at all potential notification cards or articles
      const cards = document.querySelectorAll(
        '.nt-card, article[data-activity-id], .notification-item, div[data-artdeco-is-focused], .artdeco-list__item',
      );

      const itemsToScan = cards.length > 0 ? Array.from(cards) : Array.from(document.querySelectorAll('main a, main article, main li'));

      itemsToScan.forEach((card) => {
        const text = (card as HTMLElement).innerText || '';
        if (/accepted\s+your\s+invitation/i.test(text) || /accepted\s+your\s+connection/i.test(text)) {
          const profileLink = card.querySelector('a[href*="/in/"]') as HTMLAnchorElement | null;
          const href = profileLink ? profileLink.href : undefined;

          // Find timestamp
          const timeEl = card.querySelector('time, .time-badge, .nt-card__time, span.visually-hidden');
          const timeText = timeEl ? (timeEl as HTMLElement).innerText : undefined;

          results.push({
            rawText: text,
            profileUrl: href,
            timeText,
          });
        }
      });

      // If cards query didn't capture, fallback to scanning document body text segments
      if (results.length === 0) {
        const bodyText = document.body.innerText || '';
        const lines = bodyText.split('\n').map((l) => l.trim()).filter(Boolean);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (/accepted\s+your\s+invitation/i.test(line) || /accepted\s+your\s+connection/i.test(line)) {
            results.push({
              rawText: line,
              timeText: lines[i + 1] && /^\d+[smhdw]/i.test(lines[i + 1]) ? lines[i + 1] : undefined,
            });
          }
        }
      }

      return results;
    });

    logger.info(`[AcceptedConnections] Scraped ${rawItems.length} raw notification candidates.`);

    const detected: AcceptedContactInfo[] = [];
    const seenNames = new Set<string>();

    for (const item of rawItems) {
      const text = item.rawText;
      let name = '';

      // Pattern 1: "John Doe accepted your invitation to connect"
      const match = text.match(/^([A-Za-z\s\.\-'\u00C0-\u024F\u1E00-\u1EFF]+?)\s+(?:has\s+)?accepted\s+your\s+invitation/i);
      if (match && match[1]) {
        name = match[1].replace(/^(?:Notification|Update|Alert):?\s*/i, '').trim();
      }

      // If name not extracted from regex, try profileUrl vanity
      let vanity = item.profileUrl ? extractVanityName(item.profileUrl) : '';
      if (!name && vanity) {
        name = vanity.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      }

      if (!name) {
        // Fallback: take first non-empty line before "accepted"
        const beforeAccepted = text.split(/accepted/i)[0] || '';
        const lines = beforeAccepted.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !/^(see|view|notification)/i.test(l));
        name = lines[lines.length - 1] || 'LinkedIn User';
      }

      name = name.replace(/^(?:View|See)\s+/i, '').replace(/’s\s+profile.*$/i, '').trim();

      const key = (vanity || name).toLowerCase();
      if (!seenNames.has(key) && name.length > 1) {
        seenNames.add(key);
        detected.push({
          name,
          vanityName: vanity || undefined,
          profileUrl: item.profileUrl || (vanity ? `https://www.linkedin.com/in/${vanity}/` : undefined),
          timeText: item.timeText,
          detectedVia: 'notification',
          snippet: text.slice(0, 160),
        });
      }
    }

    logger.info(`[AcceptedConnections] Extracted ${detected.length} distinct accepted contacts from Notifications.`);
    return detected;
  }

  /**
   * Method 2: Scrape Sent Invitations page and extract current pending items.
   */
  static async scrapeSentInvitationsOnPage(page: Page): Promise<SentInvitationItem[]> {
    logger.info('[AcceptedConnections] Navigating to sent invitations page...');
    await page.goto('https://www.linkedin.com/mynetwork/invitation-manager/sent/', {
      waitUntil: 'domcontentloaded',
    });

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint')) {
      logger.warn('[AcceptedConnections] Sender session redirected to login on sent invitations page.');
      return [];
    }

    try {
      await page.waitForSelector('button:has-text("Withdraw"), [aria-label*="Withdraw"], a[href*="/in/"], .artdeco-list', {
        timeout: 12_000,
      });
    } catch {
      logger.warn('[AcceptedConnections] Selector wait timed out on sent invitations.');
    }

    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(1000);

    const scraped = await page.evaluate(() => {
      const items: {
        name: string;
        headline?: string;
        timeSent?: string;
        profileUrl?: string;
      }[] = [];
      const seen = new Set<string>();

      // 1. Structured DOM scan for cards with links
      const invitationRows = document.querySelectorAll('.invitation-card, li.artdeco-list__item, div.mn-invitation-list__item');
      invitationRows.forEach((row) => {
        const link = row.querySelector('a[href*="/in/"]') as HTMLAnchorElement | null;
        const nameEl = row.querySelector('.invitation-card__title, .mn-invitation-card__name, h3, strong, a[href*="/in/"] span');
        const headlineEl = row.querySelector('.invitation-card__subtitle, .mn-invitation-card__occupation, p');
        const timeEl = row.querySelector('time, .time-badge, .invitation-card__time-ago');

        let rawName = nameEl ? (nameEl as HTMLElement).innerText.trim() : (link ? link.innerText.trim() : '');
        if (rawName && !seen.has(rawName.toLowerCase())) {
          seen.add(rawName.toLowerCase());
          items.push({
            name: rawName.replace(/(?:’s|'s)$/g, '').trim(),
            headline: headlineEl ? (headlineEl as HTMLElement).innerText.trim() : undefined,
            timeSent: timeEl ? (timeEl as HTMLElement).innerText.trim() : undefined,
            profileUrl: link ? link.href : undefined,
          });
        }
      });

      // 2. Text-block parser fallback if structured cards weren't found
      if (items.length === 0) {
        const bodyText = document.body.innerText || '';
        const sections = bodyText.split(/\n\s*Withdraw\s*\n/);
        for (let i = 0; i < sections.length - 1; i++) {
          const sec = sections[i].trim();
          const lines = sec.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
          if (lines.length < 2) continue;

          const lastLine = lines[lines.length - 1] || '';
          const sentMatch = lastLine.match(/^Sent\s+([\w\d\s]+?(?:ago|now|yesterday))/i);
          if (sentMatch) {
            const timeSent = sentMatch[0].trim();
            const rawName = lines.length >= 3 ? lines[lines.length - 3] : lines[lines.length - 2];
            const headline = lines.length >= 3 ? lines[lines.length - 2] : '';
            const cleanName = rawName.replace(/(?:’s|'s)$/g, '').trim();

            if (cleanName && !seen.has(cleanName.toLowerCase())) {
              seen.add(cleanName.toLowerCase());
              items.push({
                name: cleanName,
                headline,
                timeSent,
              });
            }
          }
        }
      }

      return items;
    });

    return scraped.map((item) => {
      const vanity = item.profileUrl ? extractVanityName(item.profileUrl) : undefined;
      const t = (item.timeSent || '').toLowerCase();
      const isToday =
        t.includes('minute') || t.includes('hour') || t.includes('now') || t.includes('second') || t.includes('moment');

      return {
        ...item,
        vanityName: vanity,
        isToday,
      };
    });
  }

  /**
   * Scrape invitations banner on Grow page (/mynetwork/grow/ or /mynetwork/)
   * where alerts like "Lakshita Gupta accepted your invitation to connect" appear.
   */
  static async detectFromGrowPageOnPage(page: Page): Promise<AcceptedContactInfo[]> {
    logger.info('[AcceptedConnections] Checking Grow / MyNetwork invitations banner...');
    try {
      await page.goto('https://www.linkedin.com/mynetwork/grow/', {
        waitUntil: 'domcontentloaded',
      });
    } catch {
      try {
        await page.goto('https://www.linkedin.com/mynetwork/', {
          waitUntil: 'domcontentloaded',
        });
      } catch (e) {
        logger.warn('[AcceptedConnections] Could not open Grow page: ' + e);
        return [];
      }
    }

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint')) {
      return [];
    }

    await page.waitForTimeout(2000);

    const scraped = await page.evaluate(() => {
      const items: { name: string; profileUrl?: string; snippet?: string; avatarUrl?: string }[] = [];
      const seen = new Set<string>();

      // Scan all invitation and alert cards on grow page
      const cards = document.querySelectorAll(
        '.invitation-card, section.mn-invitations-preview, div[data-view-name*="invitation"], div.artdeco-card, main div[tabindex="-1"], section, div'
      );

      cards.forEach((card) => {
        const text = (card as HTMLElement).innerText || '';
        if (/accepted\s+your\s+invitation/i.test(text) || /accepted\s+your\s+connection/i.test(text)) {
          const link = card.querySelector('a[href*="/in/"]') as HTMLAnchorElement | null;
          const img = card.querySelector('img') as HTMLImageElement | null;
          
          let rawName = '';
          const match = text.match(/^([A-Za-z\s\.\-'\u00C0-\u024F\u1E00-\u1EFF]+?)\s+accepted\s+your\s+invitation/i);
          if (match && match[1]) {
            rawName = match[1].trim();
          } else if (link) {
            rawName = link.innerText.trim();
          }

          if (rawName) {
            rawName = rawName.split('\n')[0].replace(/’s\s+profile.*$/i, '').trim();
            const href = link ? link.href : undefined;
            const key = (href || rawName).toLowerCase();

            if (!seen.has(key)) {
              seen.add(key);
              items.push({
                name: rawName,
                profileUrl: href,
                snippet: text.slice(0, 160),
                avatarUrl: img ? (img.src || img.getAttribute('data-delayed-url') || undefined) : undefined,
              });
            }
          }
        }
      });

      return items;
    });

    return scraped.map((item) => {
      const vanity = item.profileUrl ? extractVanityName(item.profileUrl) : undefined;
      return {
        name: item.name,
        vanityName: vanity,
        profileUrl: item.profileUrl || (vanity ? `https://www.linkedin.com/in/${vanity}/` : undefined),
        detectedVia: 'notification',
        snippet: item.snippet,
        timeText: 'Today',
      };
    });
  }

  /**
   * Method 3: Scrape Connections list (Recently added) from /mynetwork/invite-connect/connections/
   * Uses robust multi-container infinite scrolling and multi-strategy DOM extraction.
   * Extracts vanity name, full profile URL, recipient URN, profile URN, and message compose URL.
   */
  static async scrapeConnectionsListOnPage(
    page: Page,
    limit: number = 60,
  ): Promise<{ totalConnectionsCount?: string; connections: ConnectionListItem[] }> {
    logger.info('[AcceptedConnections] Navigating to connections list page: https://www.linkedin.com/mynetwork/invite-connect/connections/...');
    await page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/', {
      waitUntil: 'domcontentloaded',
    });

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint')) {
      logger.warn('[AcceptedConnections] Session redirected to login on connections page.');
      return { connections: [] };
    }

    try {
      await page.waitForSelector(
        'div[componentkey*="ConnectionCard"], .mn-connection-card, li.mn-connection-card, li.artdeco-list__item, a[href*="/in/"], main',
        { timeout: 12_000 }
      );
    } catch {
      logger.warn('[AcceptedConnections] Timeout waiting for connection cards.');
    }

    await page.waitForTimeout(2000);

    // Extract total connection count if visible in header
    const totalConnectionsCount = await page.evaluate(() => {
      const headerEl = document.querySelector(
        '#ConnectionsPage_ConnectionsListHeader p, header h1, .mn-connections__header, h1.t-24, h1, .artdeco-card__header h2'
      );
      return headerEl ? (headerEl as HTMLElement).innerText.trim() : undefined;
    });

    // Progressive deep container-aware scrolling
    for (let scroll = 0; scroll < 8; scroll++) {
      await page.evaluate(() => {
        window.scrollBy(0, 1000);
        const containers = document.querySelectorAll(
          '.scaffold-finite-scroll, .scaffold-layout__main, main, [data-scaffold-center], div.mn-connections, ul.mn-connections-list, div[data-component-type="LazyColumn"]'
        );
        containers.forEach((el) => {
          try {
            el.scrollBy(0, 1000);
            el.scrollTop += 1000;
          } catch (e) {}
        });
      });
      await page.waitForTimeout(1100);

      const count = await page.locator('main a[href*="/in/"], div[componentkey*="ConnectionCard"], .mn-connection-card, li.mn-connection-card').count();
      if (count >= limit) {
        break;
      }
    }

    const scraped = await page.evaluate((maxItems) => {
      const results: {
        name: string;
        vanityName?: string;
        headline?: string;
        profileUrl?: string;
        avatarUrl?: string;
        connectedTime?: string;
        messageUrl?: string;
        recipientUrn?: string;
        profileUrn?: string;
      }[] = [];
      const seen = new Set<string>();

      // Strategy 1: Find all connection card elements (including modern componentkey cards)
      const cardElements = Array.from(
        document.querySelectorAll(
          'div[componentkey*="ConnectionCard"], .mn-connection-card, li.mn-connection-card, li.artdeco-list__item, div.mn-connection-card, ul.mn-connections-list > li, .scaffold-finite-scroll__content li, div[data-view-name*="connection"], li[class*="connection"]'
        )
      );

      // Strategy 2: Find all profile anchors inside main (excluding navigation)
      const profileAnchors = Array.from(
        document.querySelectorAll('main a[href*="/in/"], .scaffold-layout__main a[href*="/in/"]')
      ).filter((a) => {
        const h = (a as HTMLAnchorElement).href;
        return h && !h.includes('/search/') && !h.includes('/feed/') && !h.includes('#');
      });

      const candidateContainers: Element[] = [...cardElements];
      profileAnchors.forEach((a) => {
        const parentCard = a.closest('div[componentkey*="ConnectionCard"], li, article, div[class*="entity-lockup"], div[data-ch-name], .mn-connection-card, .artdeco-list__item, [data-view-name]');
        if (parentCard && !candidateContainers.includes(parentCard)) {
          candidateContainers.push(parentCard);
        } else if (!parentCard) {
          candidateContainers.push(a.parentElement || a);
        }
      });

      candidateContainers.forEach((card) => {
        if (results.length >= maxItems) return;

        const link = (card.querySelector('a[href*="/in/"]') || (card.matches('a[href*="/in/"]') ? card : null)) as HTMLAnchorElement | null;
        
        // Check componentkey on card or descendants (e.g. ConnectionCard_0-khushi-k-rathore-126433269)
        const componentKeyAttr = card.getAttribute('componentkey') || '';
        const childWithComponentKey = card.querySelector('[componentkey*="ConnectionCard"], [componentkey*="ConnectionCardProfileImage"]');
        const fullComponentKey = componentKeyAttr || (childWithComponentKey ? childWithComponentKey.getAttribute('componentkey') || '' : '');

        let extractedSlugFromKey = '';
        const keyMatch = fullComponentKey.match(/(?:ConnectionCard|ConnectionCardProfileImage)_\d+-([a-zA-Z0-9_%-]+)/i);
        if (keyMatch && keyMatch[1]) {
          extractedSlugFromKey = decodeURIComponent(keyMatch[1]);
        }

        const nameEl = card.querySelector(
          'a[href*="/in/"] p, .mn-connection-card__name, .artdeco-entity-lockup__title, span[aria-hidden="true"], h3, strong, a[href*="/in/"] span, a[href*="/in/"]'
        );
        const headlineEl = card.querySelector(
          'a[href*="/in/"] div p span, a[href*="/in/"] div p, .mn-connection-card__occupation, .artdeco-entity-lockup__subtitle, .artdeco-entity-lockup__caption, p.occupation, p, span.t-14'
        );
        const avatarEl = card.querySelector(
          'img[src*="profile-displayphoto"], img[src*="media.licdn.com"], img.presence-entity__image, img.artdeco-entity-lockup__image, img.mn-connection-card__picture, img'
        ) as HTMLImageElement | null;
        const timeEl = card.querySelector(
          'time, .time-badge, .mn-connection-card__created-time, span.time-badge, span.mn-connection-card__details'
        );
        const messageBtn = (
          card.querySelector(
            'a[href*="/messaging/compose"], a[href*="/messaging/"], a[aria-label*="Message"], button[aria-label*="Message"], button.message-anywhere-button'
          ) ||
          Array.from(card.querySelectorAll('a, button')).find((el) => {
            const txt = (el.textContent || '').trim().toLowerCase();
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            return txt === 'message' || aria.includes('message');
          }) ||
          null
        ) as HTMLElement | null;

        let rawName = nameEl ? (nameEl as HTMLElement).innerText.trim() : (link ? link.innerText.trim() : '');
        rawName = rawName
          .split('\n')[0]
          .replace(/^(?:View|See)\s+/i, '')
          .replace(/’s\s+profile.*$/i, '')
          .replace(/\b1st\b/i, '')
          .replace(/\b2nd\b/i, '')
          .trim();

        // If name couldn't be extracted, extract from URL or componentkey
        let profileHref = link ? link.href : '';
        if (profileHref && !profileHref.startsWith('http')) {
          profileHref = 'https://www.linkedin.com' + profileHref;
        }
        if (!profileHref && extractedSlugFromKey) {
          profileHref = `https://www.linkedin.com/in/${encodeURIComponent(extractedSlugFromKey)}/`;
        }

        let vanity = extractedSlugFromKey;
        if (!vanity && profileHref) {
          const match = profileHref.match(/\/in\/([a-zA-Z0-9_%-]+)/i);
          if (match && match[1]) {
            vanity = decodeURIComponent(match[1]).replace(/\/$/, '');
          }
        }

        if (!rawName && vanity) {
          rawName = vanity.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        }

        if (!rawName && !vanity) return;

        // Extract message compose link and URNs
        let messageHref: string | undefined = undefined;
        let recipientUrn: string | undefined = undefined;
        let profileUrn: string | undefined = undefined;

        if (messageBtn) {
          const rawHref = messageBtn.getAttribute('href') || (messageBtn instanceof HTMLAnchorElement ? messageBtn.href : '');
          if (rawHref) {
            messageHref = rawHref.startsWith('http') ? rawHref : `https://www.linkedin.com${rawHref}`;
            try {
              const parsedUrl = new URL(messageHref);
              const rParam = parsedUrl.searchParams.get('recipient');
              const pParam = parsedUrl.searchParams.get('profileUrn');
              if (rParam) recipientUrn = rParam;
              if (pParam) profileUrn = pParam;
            } catch (e) {
              const rMatch = messageHref.match(/[?&]recipient=([^&]+)/i);
              if (rMatch) recipientUrn = decodeURIComponent(rMatch[1]);
              const pMatch = messageHref.match(/[?&]profileUrn=([^&]+)/i);
              if (pMatch) profileUrn = decodeURIComponent(pMatch[1]);
            }
          }
        }

        // Extract connection date/time
        let connectedTimeStr = timeEl ? (timeEl as HTMLElement).innerText.trim() : '';
        if (!connectedTimeStr) {
          const allSpans = Array.from(card.querySelectorAll('span, p, div'));
          for (const s of allSpans) {
            const txt = (s as HTMLElement).innerText.trim();
            if (
              /(?:connected|joined|added|ago|today|yesterday|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?,\s+\d{4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4})/i.test(
                txt
              ) &&
              txt.length < 80
            ) {
              connectedTimeStr = txt;
              break;
            }
          }
        }

        let avatarSrc = avatarEl ? (avatarEl.src || avatarEl.getAttribute('data-delayed-url') || undefined) : undefined;
        if (avatarSrc && (avatarSrc.startsWith('data:image/gif') || avatarSrc.includes('ghost_person'))) {
          avatarSrc = undefined;
        }

        const dedupeKey = (vanity || profileHref || rawName).toLowerCase();
        if (!seen.has(dedupeKey)) {
          seen.add(dedupeKey);
          results.push({
            name: rawName || vanity || 'LinkedIn User',
            vanityName: vanity || undefined,
            headline: headlineEl ? (headlineEl as HTMLElement).innerText.trim() : undefined,
            profileUrl: profileHref || (vanity ? `https://www.linkedin.com/in/${vanity}/` : undefined),
            avatarUrl: avatarSrc,
            connectedTime: connectedTimeStr || undefined,
            messageUrl: messageHref,
            recipientUrn,
            profileUrn,
          });
        }
      });

      return results;
    }, limit);

    const now = new Date();
    const connections: ConnectionListItem[] = scraped.map((item) => {
      const vanity = item.vanityName || (item.profileUrl ? extractVanityName(item.profileUrl) : undefined);
      const isAcceptedToday = isConnectionDateToday(item.connectedTime, now);

      return {
        ...item,
        vanityName: vanity,
        isAcceptedToday,
        connectedDate: item.connectedTime,
      };
    });

    return {
      totalConnectionsCount,
      connections,
    };
  }

  /**
   * Searches for a connection dynamically by name on LinkedIn's Connections page
   * (https://www.linkedin.com/mynetwork/invite-connect/connections/),
   * extracts their profile vanity, profile URL, recipient URN, and message compose link.
   */
  static async searchAndResolveConnectionOnPage(
    page: Page,
    targetName: string,
  ): Promise<ConnectionListItem | null> {
    if (!targetName || !targetName.trim()) return null;
    const cleanTarget = targetName.trim();
    logger.info(`[AcceptedConnections] Dynamically searching for connection "${cleanTarget}" on Connections page...`);

    const curUrl = page.url();
    if (!curUrl.includes('/mynetwork/invite-connect/connections/')) {
      await page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/', {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForTimeout(2000);
    }

    const typeaheadSelectors = [
      'input[data-testid="typeahead-input"]',
      'input[placeholder*="Search by name"]',
      '#connectionsListTypeahead_ConnectionsListTypeahead input',
      'input[aria-label*="Search by name"]',
      'input[aria-label*="Search"]',
    ];

    let searchInputFound = false;
    for (const sel of typeaheadSelectors) {
      try {
        const inputLoc = page.locator(sel).first();
        if (await inputLoc.isVisible({ timeout: 2000 }).catch(() => false)) {
          await inputLoc.click({ force: true });
          await page.waitForTimeout(200);
          await inputLoc.fill('');
          await inputLoc.fill(cleanTarget);
          await page.waitForTimeout(1500);
          searchInputFound = true;
          logger.info(`[AcceptedConnections] Typed "${cleanTarget}" into Connections search input (${sel}).`);
          break;
        }
      } catch {}
    }

    if (!searchInputFound) {
      logger.warn('[AcceptedConnections] Could not locate Connections typeahead search input directly.');
    }

    // Wait for filtered results or cards to stabilize
    await page.waitForTimeout(1800);

    // Extract matching card
    const resolved = await page.evaluate((searchQuery) => {
      const qLower = searchQuery.toLowerCase().trim();
      const cardElements = Array.from(
        document.querySelectorAll(
          'div[componentkey*="ConnectionCard"], .mn-connection-card, li.mn-connection-card, div[data-component-type="LazyColumn"] > div, .scaffold-finite-scroll__content li'
        )
      );

      for (const card of cardElements) {
        const componentKeyAttr = card.getAttribute('componentkey') || '';
        const childWithComponentKey = card.querySelector('[componentkey*="ConnectionCard"], [componentkey*="ConnectionCardProfileImage"]');
        const fullComponentKey = componentKeyAttr || (childWithComponentKey ? childWithComponentKey.getAttribute('componentkey') || '' : '');

        let extractedSlug = '';
        const keyMatch = fullComponentKey.match(/(?:ConnectionCard|ConnectionCardProfileImage)_\d+-([a-zA-Z0-9_%-]+)/i);
        if (keyMatch && keyMatch[1]) {
          extractedSlug = decodeURIComponent(keyMatch[1]);
        }

        const link = card.querySelector('a[href*="/in/"]') as HTMLAnchorElement | null;
        const nameEl = card.querySelector('a[href*="/in/"] p, .mn-connection-card__name, h3, strong, a[href*="/in/"] span');
        const headlineEl = card.querySelector('a[href*="/in/"] div p, .mn-connection-card__occupation, p');
        const avatarEl = card.querySelector('img[src*="profile-displayphoto"], img[src*="media.licdn.com"], img') as HTMLImageElement | null;
        const messageBtn = card.querySelector(
          'a[href*="/messaging/compose"], a[href*="/messaging/"], a[aria-label*="Message"], button[aria-label*="Message"]'
        ) as HTMLElement | null;

        let rawName = nameEl ? (nameEl as HTMLElement).innerText.trim() : (link ? link.innerText.trim() : '');
        rawName = rawName.split('\n')[0].replace(/^(?:View|See)\s+/i, '').replace(/’s\s+profile.*$/i, '').trim();

        let profileHref = link ? link.href : '';
        if (profileHref && !profileHref.startsWith('http')) profileHref = 'https://www.linkedin.com' + profileHref;
        if (!profileHref && extractedSlug) profileHref = `https://www.linkedin.com/in/${encodeURIComponent(extractedSlug)}/`;

        let vanity = extractedSlug;
        if (!vanity && profileHref) {
          const match = profileHref.match(/\/in\/([a-zA-Z0-9_%-]+)/i);
          if (match && match[1]) vanity = decodeURIComponent(match[1]).replace(/\/$/, '');
        }

        let messageHref: string | undefined = undefined;
        let recipientUrn: string | undefined = undefined;
        let profileUrn: string | undefined = undefined;

        if (messageBtn) {
          const rawHref = messageBtn.getAttribute('href') || (messageBtn instanceof HTMLAnchorElement ? messageBtn.href : '');
          if (rawHref) {
            messageHref = rawHref.startsWith('http') ? rawHref : `https://www.linkedin.com${rawHref}`;
            const rMatch = messageHref.match(/[?&]recipient=([^&]+)/i);
            if (rMatch) recipientUrn = decodeURIComponent(rMatch[1]);
            const pMatch = messageHref.match(/[?&]profileUrn=([^&]+)/i);
            if (pMatch) profileUrn = decodeURIComponent(pMatch[1]);
          }
        }

        const nameMatches = rawName && (rawName.toLowerCase().includes(qLower) || qLower.includes(rawName.toLowerCase()));
        const vanityMatches = vanity && (vanity.toLowerCase().includes(qLower) || qLower.includes(vanity.toLowerCase()));

        if (nameMatches || vanityMatches || cardElements.length === 1) {
          return {
            name: rawName || searchQuery,
            vanityName: vanity || undefined,
            headline: headlineEl ? (headlineEl as HTMLElement).innerText.trim() : undefined,
            profileUrl: profileHref || (vanity ? `https://www.linkedin.com/in/${vanity}/` : undefined),
            avatarUrl: avatarEl ? avatarEl.src : undefined,
            messageUrl: messageHref,
            recipientUrn,
            profileUrn,
          };
        }
      }

      return null;
    }, cleanTarget);

    if (resolved) {
      logger.info(`[AcceptedConnections] Resolved connection "${cleanTarget}" -> Vanity: ${resolved.vanityName || 'none'}, Profile: ${resolved.profileUrl || 'none'}, URN: ${resolved.recipientUrn || 'none'}`);
      return resolved;
    }

    logger.warn(`[AcceptedConnections] Could not find matching card on Connections page for "${cleanTarget}".`);
    return null;
  }

  /**
   * Standalone helper to resolve a connection's vanity, profile URL, and compose link
   * by searching for them on LinkedIn Connections page and auto-saving to DB.
   */
  static async resolveConnectionByName(
    user: LinkedInTestUser,
    targetName: string,
    headless: boolean = true,
  ): Promise<ConnectionListItem | null> {
    await ConnectionTrackingRepository.initTable();
    const { browser, page } = await this.createBrowserContext(user, headless);

    try {
      const resolved = await this.searchAndResolveConnectionOnPage(page, targetName);
      if (resolved && (resolved.vanityName || resolved.profileUrl)) {
        await ConnectionTrackingRepository.upsertContact({
          sender_user_id: user.id,
          recipient_name: resolved.name || targetName,
          recipient_vanity_name: resolved.vanityName || null,
          recipient_profile_url: resolved.profileUrl || (resolved.vanityName ? `https://www.linkedin.com/in/${resolved.vanityName}/` : null),
          recipient_headline: resolved.headline || null,
          status: 'accepted',
          accepted_at: new Date(),
          detected_via: 'connections_diff',
          meta_data: {
            resolvedViaSearch: true,
            recipientUrn: resolved.recipientUrn,
            profileUrn: resolved.profileUrn,
            messageUrl: resolved.messageUrl,
            avatarUrl: resolved.avatarUrl,
          },
        });
      }
      return resolved;
    } catch (err) {
      logger.warn(`[AcceptedConnections] Error resolving connection "${targetName}": ${err}`);
      return null;
    } finally {
      await browser.close();
    }
  }

  /**
   * Method 1 Standalone: Detect accepted connections from Notifications.
   */
  static async detectFromNotifications(
    user: LinkedInTestUser,
    headless: boolean = true,
  ): Promise<{ success: boolean; contacts: AcceptedContactInfo[]; error?: string }> {
    await ConnectionTrackingRepository.initTable();
    const { browser, page } = await this.createBrowserContext(user, headless);

    try {
      const contacts = await this.detectFromNotificationsOnPage(page);

      // Persist detected contacts to DB
      for (const c of contacts) {
        await ConnectionTrackingRepository.markAsAccepted({
          senderUserId: user.id,
          recipientName: c.name,
          recipientVanity: c.vanityName,
          recipientProfileUrl: c.profileUrl,
          recipientHeadline: c.headline,
          detectedVia: 'notification',
          metaData: { snippet: c.snippet, timeText: c.timeText },
        });
      }

      return { success: true, contacts };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[AcceptedConnections] Error detecting from notifications: ${msg}`);
      return { success: false, contacts: [], error: msg };
    } finally {
      await browser.close();
    }
  }

  /**
   * Method 2 Standalone: Detect accepted connections from Sent Invitations diff.
   */
  static async detectFromSentInvitationsDiff(
    user: LinkedInTestUser,
    headless: boolean = true,
  ): Promise<{
    success: boolean;
    currentPending: SentInvitationItem[];
    disappearedContacts: ConnectionTracking[];
    error?: string;
  }> {
    await ConnectionTrackingRepository.initTable();
    const { browser, page } = await this.createBrowserContext(user, headless);

    try {
      const currentPending = await this.scrapeSentInvitationsOnPage(page);

      // Snapshot current pending list into DB
      await ConnectionTrackingRepository.snapshotPendingList(user.id, currentPending);

      // Retrieve all pending contacts currently in DB
      const dbPending = await ConnectionTrackingRepository.getPendingContacts(user.id);
      const visibleNamesSet = new Set(currentPending.map((p) => p.name.toLowerCase()));
      const visibleVanitiesSet = new Set(
        currentPending.filter((p) => p.vanityName).map((p) => (p.vanityName as string).toLowerCase()),
      );

      // Disappeared = contacts in DB with status='pending' that are NOT visible on page
      const disappearedContacts = dbPending.filter((c) => {
        const nameMatch = visibleNamesSet.has(c.recipient_name.toLowerCase());
        const vanityMatch = c.recipient_vanity_name ? visibleVanitiesSet.has(c.recipient_vanity_name.toLowerCase()) : false;
        return !nameMatch && !vanityMatch;
      });

      logger.info(
        `[AcceptedConnections] Sent invitations diff: ${dbPending.length} in DB, ${currentPending.length} visible, ${disappearedContacts.length} disappeared (likely accepted).`,
      );

      return {
        success: true,
        currentPending,
        disappearedContacts,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[AcceptedConnections] Error in sent invitations diff: ${msg}`);
      return { success: false, currentPending: [], disappearedContacts: [], error: msg };
    } finally {
      await browser.close();
    }
  }

  /**
   * Method 3 Standalone: Detect accepted connections from Connections list diff.
   */
  static async detectFromConnectionsDiff(
    user: LinkedInTestUser,
    limit: number = 30,
    headless: boolean = true,
  ): Promise<{
    success: boolean;
    connections: ConnectionListItem[];
    matchedPending: ConnectionTracking[];
    error?: string;
  }> {
    await ConnectionTrackingRepository.initTable();
    const { browser, page } = await this.createBrowserContext(user, headless);

    try {
      const { connections } = await this.scrapeConnectionsListOnPage(page, limit);
      const dbPending = await ConnectionTrackingRepository.getPendingContacts(user.id);

      const pendingMapByName = new Map<string, ConnectionTracking>();
      const pendingMapByVanity = new Map<string, ConnectionTracking>();
      dbPending.forEach((p) => {
        pendingMapByName.set(p.recipient_name.toLowerCase(), p);
        if (p.recipient_vanity_name) {
          pendingMapByVanity.set(p.recipient_vanity_name.toLowerCase(), p);
        }
      });

      const matchedPending: ConnectionTracking[] = [];

      for (const conn of connections) {
        const nameKey = conn.name.toLowerCase();
        const vanityKey = conn.vanityName ? conn.vanityName.toLowerCase() : '';

        const match = (vanityKey ? pendingMapByVanity.get(vanityKey) : undefined) || pendingMapByName.get(nameKey);
        if (match) {
          const updated = await ConnectionTrackingRepository.markAsAccepted({
            senderUserId: user.id,
            recipientName: conn.name,
            recipientVanity: conn.vanityName,
            recipientProfileUrl: conn.profileUrl,
            recipientHeadline: conn.headline,
            detectedVia: 'connections_diff',
            metaData: { connectedTime: conn.connectedTime },
          });
          matchedPending.push(updated);
        }
      }

      logger.info(
        `[AcceptedConnections] Connections list diff: ${connections.length} scraped, ${matchedPending.length} matched pending requests and marked as accepted.`,
      );

      return {
        success: true,
        connections,
        matchedPending,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[AcceptedConnections] Error in connections diff: ${msg}`);
      return { success: false, connections: [], matchedPending: [], error: msg };
    } finally {
      await browser.close();
    }
  }

  /**
   * Snapshots current Sent Invitations list into database.
   */
  static async snapshotSentInvitations(
    user: LinkedInTestUser,
    headless: boolean = true,
  ): Promise<{ success: boolean; count: number; invites: SentInvitationItem[]; error?: string }> {
    await ConnectionTrackingRepository.initTable();
    const { browser, page } = await this.createBrowserContext(user, headless);

    try {
      const invites = await this.scrapeSentInvitationsOnPage(page);
      const count = await ConnectionTrackingRepository.snapshotPendingList(user.id, invites);
      return { success: true, count, invites };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[AcceptedConnections] Error snapshotting sent invitations: ${msg}`);
      return { success: false, count: 0, invites: [], error: msg };
    } finally {
      await browser.close();
    }
  }

  /**
   * Snapshots current Connections list into database.
   */
  static async snapshotCurrentConnections(
    user: LinkedInTestUser,
    limit: number = 50,
    headless: boolean = true,
  ): Promise<{ success: boolean; count: number; connections: ConnectionListItem[]; error?: string }> {
    await ConnectionTrackingRepository.initTable();
    const { browser, page } = await this.createBrowserContext(user, headless);

    try {
      const { connections } = await this.scrapeConnectionsListOnPage(page, limit);
      let count = 0;
      for (const conn of connections) {
        await ConnectionTrackingRepository.upsertContact({
          sender_user_id: user.id,
          recipient_name: conn.name,
          recipient_vanity_name: conn.vanityName,
          recipient_profile_url: conn.profileUrl,
          recipient_headline: conn.headline,
          status: 'accepted',
          accepted_at: new Date(),
          detected_via: 'connections_diff',
          meta_data: { connectedTime: conn.connectedTime, isInitialSnapshot: true },
        });
        count++;
      }
      return { success: true, count, connections };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[AcceptedConnections] Error snapshotting connections: ${msg}`);
      return { success: false, count: 0, connections: [], error: msg };
    } finally {
      await browser.close();
    }
  }

  /**
   * Orchestrates the 3-method detection in a single browser session:
   * 1. Scrapes Notifications for explicit "X accepted your invitation"
   * 2. Scrapes Sent Invitations to detect disappeared requests
   * 3. Scrapes Connections list to match newly formed 1st degree connections
   * Deduplicates, updates DB, and returns consolidated results.
   */
  static async runFullDetection(
    user: LinkedInTestUser,
    options: {
      headless?: boolean;
      connectionsLimit?: number;
    } = {},
  ): Promise<FullDetectionResult> {
    const timestamp = new Date().toISOString();
    const isHeadless = options.headless !== undefined ? options.headless : true;
    const connectionsLimit = options.connectionsLimit || 30;

    await ConnectionTrackingRepository.initTable();

    logger.info(`[AcceptedConnections] Starting full 3-method detection for user: ${user.username} (ID: ${user.id})`);

    const { browser, page } = await this.createBrowserContext(user, isHeadless);

    const newlyDetectedMap = new Map<string, AcceptedContactInfo>();
    const details = {
      notificationsFound: [] as AcceptedContactInfo[],
      sentDiffDisappeared: [] as { name: string; vanityName?: string; profileUrl?: string }[],
      connectionsFound: [] as ConnectionListItem[],
    };

    try {
      // ── Method 1: Notifications Page ──────────────────────────────────────
      try {
        logger.info('[AcceptedConnections] Step 1/3: Checking Notifications...');
        const notifResults = await this.detectFromNotificationsOnPage(page);
        details.notificationsFound = notifResults;

        for (const item of notifResults) {
          const key = (item.vanityName || item.name).toLowerCase();
          newlyDetectedMap.set(key, item);

          await ConnectionTrackingRepository.markAsAccepted({
            senderUserId: user.id,
            recipientName: item.name,
            recipientVanity: item.vanityName,
            recipientProfileUrl: item.profileUrl,
            recipientHeadline: item.headline,
            detectedVia: 'notification',
            metaData: { snippet: item.snippet, timeText: item.timeText },
          });
        }
      } catch (errNotif) {
        logger.warn(`[AcceptedConnections] Method 1 (Notifications) encountered an issue: ${errNotif}`);
      }

      // ── Method 2: Sent Invitations Diff ────────────────────────────────────
      try {
        logger.info('[AcceptedConnections] Step 2/3: Checking Sent Invitations...');
        const currentPending = await this.scrapeSentInvitationsOnPage(page);
        const dbPendingBefore = await ConnectionTrackingRepository.getPendingContacts(user.id);

        // Snapshot current pending list
        await ConnectionTrackingRepository.snapshotPendingList(user.id, currentPending);

        const visibleNames = new Set(currentPending.map((p) => p.name.toLowerCase()));
        const visibleVanities = new Set(
          currentPending.filter((p) => p.vanityName).map((p) => (p.vanityName as string).toLowerCase()),
        );

        // Check which items disappeared
        for (const p of dbPendingBefore) {
          const nameMatch = visibleNames.has(p.recipient_name.toLowerCase());
          const vanityMatch = p.recipient_vanity_name ? visibleVanities.has(p.recipient_vanity_name.toLowerCase()) : false;

          if (!nameMatch && !vanityMatch) {
            details.sentDiffDisappeared.push({
              name: p.recipient_name,
              vanityName: p.recipient_vanity_name || undefined,
              profileUrl: p.recipient_profile_url || undefined,
            });

            const key = (p.recipient_vanity_name || p.recipient_name).toLowerCase();
            if (!newlyDetectedMap.has(key)) {
              newlyDetectedMap.set(key, {
                name: p.recipient_name,
                vanityName: p.recipient_vanity_name || undefined,
                profileUrl: p.recipient_profile_url || undefined,
                headline: p.recipient_headline || undefined,
                detectedVia: 'sent_diff',
                snippet: 'Disappeared from Sent Invitations queue (accepted or withdrawn)',
              });

              // Mark as accepted via sent_diff
              await ConnectionTrackingRepository.markAsAccepted({
                senderUserId: user.id,
                recipientName: p.recipient_name,
                recipientVanity: p.recipient_vanity_name,
                recipientProfileUrl: p.recipient_profile_url,
                recipientHeadline: p.recipient_headline,
                detectedVia: 'sent_diff',
              });
            }
          }
        }
      } catch (errSent) {
        logger.warn(`[AcceptedConnections] Method 2 (Sent Invitations) encountered an issue: ${errSent}`);
      }

      // ── Method 3: Connections List ─────────────────────────────────────────
      try {
        logger.info('[AcceptedConnections] Step 3/3: Checking Connections List...');
        const { connections } = await this.scrapeConnectionsListOnPage(page, connectionsLimit);
        details.connectionsFound = connections;

        const dbPending = await ConnectionTrackingRepository.getPendingContacts(user.id);
        const pendingByName = new Map<string, ConnectionTracking>();
        const pendingByVanity = new Map<string, ConnectionTracking>();

        dbPending.forEach((p) => {
          pendingByName.set(p.recipient_name.toLowerCase(), p);
          if (p.recipient_vanity_name) {
            pendingByVanity.set(p.recipient_vanity_name.toLowerCase(), p);
          }
        });

        for (const conn of connections) {
          const nameKey = conn.name.toLowerCase();
          const vanityKey = conn.vanityName ? conn.vanityName.toLowerCase() : '';
          const match = (vanityKey ? pendingByVanity.get(vanityKey) : undefined) || pendingByName.get(nameKey);

          if (match) {
            const key = (conn.vanityName || conn.name).toLowerCase();
            if (!newlyDetectedMap.has(key)) {
              newlyDetectedMap.set(key, {
                name: conn.name,
                vanityName: conn.vanityName,
                profileUrl: conn.profileUrl,
                headline: conn.headline,
                detectedVia: 'connections_diff',
                snippet: `Connected: ${conn.connectedTime || 'Recently'}`,
              });
            }

            await ConnectionTrackingRepository.markAsAccepted({
              senderUserId: user.id,
              recipientName: conn.name,
              recipientVanity: conn.vanityName,
              recipientProfileUrl: conn.profileUrl,
              recipientHeadline: conn.headline,
              detectedVia: 'connections_diff',
              metaData: { connectedTime: conn.connectedTime },
            });
          }
        }
      } catch (errConn) {
        logger.warn(`[AcceptedConnections] Method 3 (Connections List) encountered an issue: ${errConn}`);
      }

      // ── Fetch updated records and stats from MySQL ──────────────────────────
      const allAccepted = await ConnectionTrackingRepository.getAcceptedContacts(user.id);
      const currentPending = await ConnectionTrackingRepository.getPendingContacts(user.id);
      const stats = await ConnectionTrackingRepository.getStats(user.id);

      const newlyAcceptedArray = Array.from(newlyDetectedMap.values());

      logger.info(
        `[AcceptedConnections] Full detection completed! Found ${newlyAcceptedArray.length} acceptances across all methods. Total accepted in DB: ${allAccepted.length}.`,
      );

      return {
        success: true,
        senderUsername: user.username,
        senderUserId: user.id,
        totalNewlyDetected: newlyAcceptedArray.length,
        newlyAcceptedContacts: newlyAcceptedArray,
        allAcceptedInDb: allAccepted,
        currentPendingInDb: currentPending,
        stats,
        details,
        timestamp,
        message: `Successfully detected ${newlyAcceptedArray.length} acceptances across Notifications, Sent Diff, and Connections list.`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`[AcceptedConnections] Error during full detection: ${msg}`);
      return {
        success: false,
        senderUsername: user.username,
        senderUserId: user.id,
        totalNewlyDetected: 0,
        newlyAcceptedContacts: [],
        allAcceptedInDb: [],
        currentPendingInDb: [],
        stats: { total: 0, accepted: 0, pending: 0, withdrawn: 0, rejected: 0 },
        details,
        timestamp,
        error: msg,
      };
    } finally {
      await browser.close();
    }
  }

  /**
   * Dedicated Flow: Scans LinkedIn Connections (/mynetwork/invite-connect/connections/),
   * Notifications (/notifications/?filter=CONNECTIONS), and Grow (/mynetwork/grow/),
   * dynamically aggregates all connections accepted today, deduplicates by vanity/name,
   * persists all records to MySQL, and returns the full list.
   */
  static async detectAcceptedTodayFromConnectionsPage(
    user: LinkedInTestUser,
    options: { limit?: number; headless?: boolean } = {},
  ): Promise<ConnectionsTodayResult> {
    const limit = options.limit || 60;
    const headless = options.headless !== undefined ? options.headless : true;

    await ConnectionTrackingRepository.initTable();
    const { browser, page } = await this.createBrowserContext(user, headless);

    try {
      logger.info(`[AcceptedConnections] Detecting connections accepted today for "${user.username}" across Connections, Notifications, and Grow sources...`);

      // ── Source 1: LinkedIn Connections List Page ────────────────────────────
      let connectionsListResult = { totalConnectionsCount: undefined as string | undefined, connections: [] as ConnectionListItem[] };
      try {
        connectionsListResult = await this.scrapeConnectionsListOnPage(page, limit);
      } catch (errConn) {
        logger.warn(`[AcceptedConnections] Error scraping connections page: ${errConn}`);
      }

      // ── Source 2: Notifications Page ────────────────────────────────────────
      let notifContacts: AcceptedContactInfo[] = [];
      try {
        notifContacts = await this.detectFromNotificationsOnPage(page);
      } catch (errNotif) {
        logger.warn(`[AcceptedConnections] Error scraping notifications: ${errNotif}`);
      }

      // ── Source 3: Grow / MyNetwork Invitations Banner ────────────────────────
      let growContacts: AcceptedContactInfo[] = [];
      try {
        growContacts = await this.detectFromGrowPageOnPage(page);
      } catch (errGrow) {
        logger.warn(`[AcceptedConnections] Error scraping grow page: ${errGrow}`);
      }

      // ── Aggregate and Deduplicate across all sources ─────────────────────────
      const consolidatedMap = new Map<string, ConnectionListItem>();

      // 1. Add all Connections from connections page
      for (const conn of connectionsListResult.connections) {
        const vanityKey = conn.vanityName ? conn.vanityName.toLowerCase().trim() : '';
        const nameKey = conn.name ? conn.name.toLowerCase().trim() : '';
        const key = vanityKey || nameKey;
        if (key) {
          consolidatedMap.set(key, conn);
        }
      }

      // 2. Add / merge Notifications
      const now = new Date();
      for (const notif of notifContacts) {
        const vanityKey = notif.vanityName ? notif.vanityName.toLowerCase().trim() : '';
        const nameKey = notif.name ? notif.name.toLowerCase().trim() : '';
        const key = vanityKey || nameKey;

        if (key && !consolidatedMap.has(key)) {
          const isToday = notif.timeText ? isConnectionDateToday(notif.timeText, now) : true;
          consolidatedMap.set(key, {
            name: notif.name,
            vanityName: notif.vanityName,
            profileUrl: notif.profileUrl,
            headline: notif.headline || 'LinkedIn Connection',
            connectedTime: notif.timeText || 'Today',
            connectedDate: notif.timeText || 'Today',
            isAcceptedToday: isToday,
            messageUrl: notif.profileUrl,
          });
        } else if (key && consolidatedMap.has(key)) {
          const existing = consolidatedMap.get(key)!;
          if (!existing.isAcceptedToday) {
            existing.isAcceptedToday = true;
            if (!existing.connectedTime) existing.connectedTime = notif.timeText || 'Today';
          }
        }
      }

      // 3. Add / merge Grow invitations
      for (const grow of growContacts) {
        const vanityKey = grow.vanityName ? grow.vanityName.toLowerCase().trim() : '';
        const nameKey = grow.name ? grow.name.toLowerCase().trim() : '';
        const key = vanityKey || nameKey;

        if (key && !consolidatedMap.has(key)) {
          consolidatedMap.set(key, {
            name: grow.name,
            vanityName: grow.vanityName,
            profileUrl: grow.profileUrl,
            headline: grow.headline || 'LinkedIn Connection',
            connectedTime: 'Today',
            connectedDate: 'Today',
            isAcceptedToday: true,
            messageUrl: grow.profileUrl,
          });
        } else if (key && consolidatedMap.has(key)) {
          const existing = consolidatedMap.get(key)!;
          existing.isAcceptedToday = true;
        }
      }

      const allConsolidated = Array.from(consolidatedMap.values());
      const acceptedToday = allConsolidated.filter((c) => c.isAcceptedToday);

      logger.info(
        `[AcceptedConnections] Aggregation complete: ${allConsolidated.length} total connections scanned (${connectionsListResult.totalConnectionsCount || 'unknown'}), ${acceptedToday.length} verified accepted today.`
      );

      // Auto-persist accepted contacts into MySQL connection_tracking
      let persistedCount = 0;
      for (const conn of acceptedToday) {
        try {
          await ConnectionTrackingRepository.markAsAccepted({
            senderUserId: user.id,
            recipientName: conn.name,
            recipientVanity: conn.vanityName,
            recipientProfileUrl: conn.profileUrl,
            recipientHeadline: conn.headline,
            detectedVia: 'connections_diff',
            acceptedAt: new Date(),
            metaData: {
              connectedTimeText: conn.connectedTime || 'Connected on ' + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
              avatarUrl: conn.avatarUrl,
              messageUrl: conn.messageUrl,
              acceptedToday: true,
              totalConnectionsOnLinkedIn: connectionsListResult.totalConnectionsCount,
              sourcePage: 'https://www.linkedin.com/mynetwork/invite-connect/connections/',
            },
          });
          persistedCount++;
        } catch (err) {
          logger.warn(`[AcceptedConnections] Could not persist accepted contact ${conn.name}: ${err}`);
        }
      }

      return {
        success: true,
        senderUsername: user.username,
        senderUserId: user.id,
        totalConnectionsOnLinkedIn: connectionsListResult.totalConnectionsCount,
        totalScraped: allConsolidated.length,
        acceptedTodayCount: acceptedToday.length,
        acceptedToday,
        allScraped: allConsolidated,
        persistedCount,
        checkedAt: new Date().toISOString(),
        message: `Successfully detected ${acceptedToday.length} connection(s) accepted today from ${allConsolidated.length} scanned records (Connections + Notifications + Grow).`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[AcceptedConnections] Error detecting connections accepted today: ${msg}`);
      return {
        success: false,
        senderUsername: user.username,
        senderUserId: user.id,
        totalScraped: 0,
        acceptedTodayCount: 0,
        acceptedToday: [],
        allScraped: [],
        persistedCount: 0,
        checkedAt: new Date().toISOString(),
        error: msg,
      };
    } finally {
      await browser.close();
    }
  }
}
