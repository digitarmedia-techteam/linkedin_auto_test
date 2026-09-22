import { chromium } from '@playwright/test';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { LinkedInTestUser, StorageStateData } from '../db/models/TestUser.js';
import { ConnectionTrackingRepository } from '../db/repositories/ConnectionTrackingRepository.js';

export interface DirectConnectionResult {
  success: boolean;
  status: 'sent' | 'already_connected' | 'already_pending' | 'weekly_limit' | 'not_found' | 'failed';
  vanityName: string;
  targetUrl: string;
  preloadUrl: string;
  senderUsername: string;
  recipientName?: string;
  recipientHeadline?: string;
  noteIncluded: boolean;
  message: string;
  timestamp: string;
}

export interface ConnectionStatusCheckResult {
  success: boolean;
  status: 'already_connected' | 'already_pending' | 'not_connected' | 'not_found' | 'failed';
  isConnected: boolean;
  isPending: boolean;
  canConnect: boolean;
  recipientName: string;
  recipientHeadline: string;
  vanityName: string;
  targetUrl: string;
  profileUrl: string;
  senderUsername: string;
  message: string;
  timestamp: string;
  error?: string;
}

/**
 * Extracts clean vanity name from a LinkedIn profile URL or handle.
 *
 * Examples:
 * - https://www.linkedin.com/in/john-doe-1234/ -> john-doe-1234
 * - https://linkedin.com/in/jane-doe?miniProfileUrn=... -> jane-doe
 * - in/alex-smith -> alex-smith
 * - alex-smith -> alex-smith
 */
export function extractVanityName(input: string): string {
  if (!input || typeof input !== 'string') return '';
  const trimmed = input.trim();

  // Pattern: in/{vanityName} or /in/{vanityName}
  const inMatch = trimmed.match(/(?:^|\/|\.)linkedin\.com\/in\/([a-zA-Z0-9_%-]+)/i);
  if (inMatch && inMatch[1]) {
    return decodeURIComponent(inMatch[1]).replace(/\/.*$/, '').trim();
  }

  // Pattern: in/username
  const shortMatch = trimmed.match(/(?:^|\/)in\/([a-zA-Z0-9_%-]+)/i);
  if (shortMatch && shortMatch[1]) {
    return decodeURIComponent(shortMatch[1]).replace(/\/.*$/, '').trim();
  }

  // Handle if full URL without in/ or raw vanity name
  return trimmed
    .replace(/^https?:\/\/[^/]+\/?/i, '')
    .replace(/^in\//i, '')
    .replace(/\?.*$/, '')
    .replace(/\/.*$/, '')
    .trim();
}

export class DirectConnectionService {
  /**
   * Helper to launch an isolated browser context with user's stored cookies.
   */
  private static async createBrowserContext(user: LinkedInTestUser, headless: boolean = true) {
    if (!user.storage_state_json && !user.session_cookies_json) {
      throw new Error(
        `User ${user.username} (ID: ${user.id}) does not have an active session saved in the database. Please log in first.`,
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
        logger.warn(`[DirectConnection] Failed to parse storage_state_json: ${e}`);
      }
    }
    if (cookiesToAdd.length === 0 && user.session_cookies_json) {
      try {
        const parsedCookies = JSON.parse(user.session_cookies_json);
        if (Array.isArray(parsedCookies)) {
          cookiesToAdd = parsedCookies;
        }
      } catch (e) {
        logger.warn(`[DirectConnection] Failed to parse session_cookies_json: ${e}`);
      }
    }

    const context = await browser.newContext({
      baseURL: config.baseUrl,
      userAgent: user.user_agent ?? undefined,
      viewport: { width: 1280, height: 850 },
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
   * Verifies whether the target user is already connected with the current sender
   * by inspecting local database subscription/history first, and live LinkedIn profile page.
   */
  static async checkConnectionStatus(options: {
    user: LinkedInTestUser;
    targetUrlOrVanity: string;
    headless?: boolean;
    skipDbCheck?: boolean;
  }): Promise<ConnectionStatusCheckResult> {
    const timestamp = new Date().toISOString();
    const { user, targetUrlOrVanity } = options;
    const isHeadless = options.headless !== undefined ? options.headless : true;

    const vanityName = extractVanityName(targetUrlOrVanity);
    if (!vanityName) {
      throw new Error('Could not extract a valid LinkedIn vanity name or profile URL from input.');
    }

    const profileUrl = `https://www.linkedin.com/in/${encodeURIComponent(vanityName)}/`;
    logger.info(`[DirectConnection] Checking connection status for "${vanityName}" (Sender: ${user.username})...`);

    // ── Pre-check 1: Check Database Records (Subscription / Tracking) ───────
    if (!options.skipDbCheck && user.id) {
      try {
        await ConnectionTrackingRepository.initTable();
        const existingRows = await ConnectionTrackingRepository.findMatchingRows(
          user.id,
          vanityName,
          vanityName,
          profileUrl,
        );

        const acceptedRow = existingRows.find((r) => r.status === 'accepted');
        if (acceptedRow) {
          logger.info(
            `[DirectConnection] DB Match: "${vanityName}" is ALREADY CONNECTED (in database subscription/records).`,
          );
          return {
            success: true,
            status: 'already_connected',
            isConnected: true,
            isPending: false,
            canConnect: false,
            recipientName: acceptedRow.recipient_name || vanityName,
            recipientHeadline: acceptedRow.recipient_headline || '',
            vanityName,
            targetUrl: targetUrlOrVanity,
            profileUrl,
            senderUsername: user.username,
            message: `Already in your subscription: ${acceptedRow.recipient_name || vanityName} is already connected with you on LinkedIn.`,
            timestamp,
          };
        }

        const pendingRow = existingRows.find((r) => r.status === 'pending');
        if (pendingRow) {
          logger.info(
            `[DirectConnection] DB Match: Connection request to "${vanityName}" is ALREADY PENDING in records.`,
          );
          return {
            success: true,
            status: 'already_pending',
            isConnected: false,
            isPending: true,
            canConnect: false,
            recipientName: pendingRow.recipient_name || vanityName,
            recipientHeadline: pendingRow.recipient_headline || '',
            vanityName,
            targetUrl: targetUrlOrVanity,
            profileUrl,
            senderUsername: user.username,
            message: `Connection request to ${pendingRow.recipient_name || vanityName} is already pending in your records.`,
            timestamp,
          };
        }
      } catch (dbErr) {
        logger.warn('[DirectConnection] Could not query database during pre-flight check:', dbErr);
      }
    }

    // ── Pre-check 2: Live LinkedIn Profile DOM Inspection ────────────────────
    const { browser, page } = await this.createBrowserContext(user, isHeadless);

    try {
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 35_000 });
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      if (
        currentUrl.includes('/login') ||
        currentUrl.includes('/checkpoint') ||
        currentUrl.includes('/authwall') ||
        currentUrl.includes('/uas/login')
      ) {
        return {
          success: false,
          status: 'failed',
          isConnected: false,
          isPending: false,
          canConnect: false,
          recipientName: '',
          recipientHeadline: '',
          vanityName,
          targetUrl: targetUrlOrVanity,
          profileUrl,
          senderUsername: user.username,
          message: 'Sender session is no longer active. LinkedIn redirected to login/checkpoint.',
          timestamp,
          error: 'SESSION_EXPIRED',
        };
      }

      // Check if profile is not found or unavailable
      const isUnavailable = await page
        .locator('h1:has-text("Page not found"), h1:has-text("This profile is not available"), .profile-unavailable')
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      if (isUnavailable) {
        return {
          success: false,
          status: 'not_found',
          isConnected: false,
          isPending: false,
          canConnect: false,
          recipientName: '',
          recipientHeadline: '',
          vanityName,
          targetUrl: targetUrlOrVanity,
          profileUrl,
          senderUsername: user.username,
          message: `LinkedIn profile for "${vanityName}" could not be found or is unavailable.`,
          timestamp,
        };
      }

      // Extract profile details and check comprehensive DOM signals
      const profileData = await page.evaluate(() => {
        const nameEl = document.querySelector(
          'h1.text-heading-xlarge, h1.inline, main h1, .pv-text-details__left-panel h1, .ph5 h1',
        );
        const headlineEl = document.querySelector(
          'div.text-body-medium, .pv-text-details__left-panel .text-body-medium, div[data-generated-suggestion-target]',
        );

        const recipientName = nameEl ? (nameEl as HTMLElement).innerText.trim() : '';
        const recipientHeadline = headlineEl ? (headlineEl as HTMLElement).innerText.trim() : '';

        // 1. Check distance badges (1st degree connection)
        const distBadges = Array.from(
          document.querySelectorAll(
            '.dist-value, .distance-badge, span.distance-badge, .pv-top-card--list .distance-badge, .artdeco-entity-lockup__badge, .artdeco-entity-lockup__degree, span.artdeco-entity-lockup__degree',
          ),
        );
        const has1stDistBadge = distBadges.some((el) => {
          const t = (el as HTMLElement).innerText.trim().toLowerCase();
          return t.includes('1st') || /\b1st\b/i.test(t);
        });

        // Visually hidden labels like "1st degree connection"
        const hiddenSpans = Array.from(
          document.querySelectorAll('span.visually-hidden, span.visually-hidden-text, span.a11y-text'),
        );
        const has1stHidden = hiddenSpans.some((s) => (s as HTMLElement).innerText.toLowerCase().includes('1st degree'));

        // Top card text block search
        const topCardEl = document.querySelector('.pv-top-card, main section, .pv-text-details__left-panel, .msg-s-profile-card');
        const topCardText = topCardEl ? topCardEl.textContent || '' : '';
        const has1stInTopCard =
          /\b1st\s+degree\s+connection\b/i.test(topCardText) ||
          /·\s*1st\b/i.test(topCardText) ||
          topCardText.includes('1st degree connection');

        // 2. Action buttons & links
        const actionElements = Array.from(
          document.querySelectorAll('button, a, div[role="button"]'),
        ) as HTMLElement[];

        const hasPendingButton = actionElements.some((b) => {
          const text = (b.innerText || '').toLowerCase();
          const aria = (b.getAttribute('aria-label') || '').toLowerCase();
          return (
            text.includes('pending') ||
            aria.includes('pending') ||
            text.includes('invitation sent') ||
            aria.includes('invitation sent')
          );
        });

        const hasDirectConnectButton = actionElements.some((b) => {
          const text = (b.innerText || '').toLowerCase();
          const aria = (b.getAttribute('aria-label') || '').toLowerCase();
          const href = (b.getAttribute('href') || '').toLowerCase();
          return (
            (text === 'connect' || aria.includes('invite') || aria.includes('connect')) &&
            !aria.includes('remove') &&
            !aria.includes('message') &&
            !href.includes('/messaging/')
          );
        });

        const hasDirectMessageLinkOrButton = actionElements.some((b) => {
          const text = (b.innerText || '').toLowerCase();
          const aria = (b.getAttribute('aria-label') || '').toLowerCase();
          const href = (b.getAttribute('href') || '').toLowerCase();
          const hasLock = Boolean(b.querySelector('.artdeco-button__icon--lock, [type="lock-icon"]'));
          const hasSendPrivatelySvg = Boolean(b.querySelector('#send-privately-medium'));
          return (
            (text === 'message' || aria.startsWith('message') || href.includes('/messaging/compose') || hasSendPrivatelySvg) &&
            !hasLock &&
            !aria.includes('inmail')
          );
        });

        return {
          recipientName,
          recipientHeadline,
          has1stDistBadge,
          has1stHidden,
          has1stInTopCard,
          hasPendingButton,
          hasDirectConnectButton,
          hasDirectMessageLinkOrButton,
        };
      });

      let isConnected =
        profileData.has1stDistBadge || profileData.has1stHidden || profileData.has1stInTopCard;
      let isPending = profileData.hasPendingButton;
      let canConnect = profileData.hasDirectConnectButton;

      // If not yet 100% conclusive, check the "More actions" dropdown
      const moreBtn = page.locator([
        'button[aria-label*="More actions"]:visible',
        'div.pvs-profile-actions button:has-text("More"):visible',
        'main button:has-text("More"):visible',
      ].join(', ')).first();

      if (await moreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        try {
          await moreBtn.click();
          await page.waitForTimeout(500);

          const hasRemoveConnection = await page
            .locator('div[role="menuitem"]:has-text("Remove Connection"), div:has-text("Remove Connection"), button:has-text("Remove Connection")')
            .isVisible({ timeout: 1500 })
            .catch(() => false);

          if (hasRemoveConnection) {
            isConnected = true;
          }

          const dropdownConnect = await page
            .locator('div[role="menuitem"]:has-text("Connect"), div[role="button"]:has-text("Connect"), button:has-text("Connect")')
            .isVisible({ timeout: 1500 })
            .catch(() => false);

          if (dropdownConnect) {
            canConnect = true;
          }

          // Close dropdown
          await page.keyboard.press('Escape');
          await page.waitForTimeout(200);
        } catch {
          // ignore dropdown click error
        }
      }

      // If they have direct Message button/link (no lock) and NO connect button anywhere, they are 1st degree
      if (!canConnect && !isPending && profileData.hasDirectMessageLinkOrButton) {
        isConnected = true;
      }

      const cleanName = profileData.recipientName || vanityName;
      const cleanHeadline = profileData.recipientHeadline || '';

      if (isConnected) {
        logger.info(`[DirectConnection] Result: "${vanityName}" (${cleanName}) is ALREADY CONNECTED (1st Degree).`);
        try {
          if (user.id) {
            await ConnectionTrackingRepository.markAsAccepted({
              senderUserId: user.id,
              recipientName: cleanName,
              recipientVanity: vanityName,
              recipientProfileUrl: profileUrl,
              recipientHeadline: cleanHeadline || null,
              detectedVia: 'profile_check',
            });
          }
        } catch (dbErr) {
          logger.warn('[DirectConnection] Could not update database for accepted connection:', dbErr);
        }

        return {
          success: true,
          status: 'already_connected',
          isConnected: true,
          isPending: false,
          canConnect: false,
          recipientName: cleanName,
          recipientHeadline: cleanHeadline,
          vanityName,
          targetUrl: targetUrlOrVanity,
          profileUrl,
          senderUsername: user.username,
          message: `Already Connected: You and ${cleanName} are already 1st degree connections on LinkedIn.`,
          timestamp,
        };
      }

      if (isPending) {
        logger.info(`[DirectConnection] Result: Connection request to "${vanityName}" (${cleanName}) is ALREADY PENDING.`);
        try {
          if (user.id) {
            await ConnectionTrackingRepository.upsertContact({
              sender_user_id: user.id,
              recipient_name: cleanName,
              recipient_vanity_name: vanityName,
              recipient_profile_url: profileUrl,
              recipient_headline: cleanHeadline || null,
              status: 'pending',
              detected_via: 'profile_check',
            });
          }
        } catch (dbErr) {
          logger.warn('[DirectConnection] Could not update database for pending status:', dbErr);
        }

        return {
          success: true,
          status: 'already_pending',
          isConnected: false,
          isPending: true,
          canConnect: false,
          recipientName: cleanName,
          recipientHeadline: cleanHeadline,
          vanityName,
          targetUrl: targetUrlOrVanity,
          profileUrl,
          senderUsername: user.username,
          message: `Connection request to ${cleanName} is already pending awaiting their response.`,
          timestamp,
        };
      }

      logger.info(`[DirectConnection] Result: "${vanityName}" (${cleanName}) is NOT CONNECTED (canConnect: ${String(canConnect)}).`);
      return {
        success: true,
        status: 'not_connected',
        isConnected: false,
        isPending: false,
        canConnect: true,
        recipientName: cleanName,
        recipientHeadline: cleanHeadline,
        vanityName,
        targetUrl: targetUrlOrVanity,
        profileUrl,
        senderUsername: user.username,
        message: `Ready to connect: ${cleanName} is not connected with you.`,
        timestamp,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[DirectConnection] Error checking connection status: ${msg}`);
      return {
        success: false,
        status: 'failed',
        isConnected: false,
        isPending: false,
        canConnect: false,
        recipientName: '',
        recipientHeadline: '',
        vanityName,
        targetUrl: targetUrlOrVanity,
        profileUrl,
        senderUsername: user.username,
        message: `Error verifying connection status: ${msg}`,
        timestamp,
        error: msg,
      };
    } finally {
      await browser.close();
    }
  }

  /**
   * Sends a direct LinkedIn connection request.
   * STRICTLY performs dynamic live pre-flight verification on the target profile first!
   * If already connected or pending, immediately aborts without sending any invite or note.
   */
  static async sendConnectionInvite(options: {
    user: LinkedInTestUser;
    targetUrlOrVanity: string;
    note?: string;
    headless?: boolean;
  }): Promise<DirectConnectionResult> {
    const timestamp = new Date().toISOString();
    const { user, targetUrlOrVanity, note } = options;
    const isHeadless = options.headless !== undefined ? options.headless : true;

    const vanityName = extractVanityName(targetUrlOrVanity);
    if (!vanityName) {
      throw new Error('Could not extract a valid LinkedIn vanity name or profile URL from input.');
    }

    const profileUrl = `https://www.linkedin.com/in/${encodeURIComponent(vanityName)}/`;
    const preloadUrl = `https://www.linkedin.com/preload/custom-invite/?vanityName=${encodeURIComponent(vanityName)}`;
    const hasNote = Boolean(note && note.trim().length > 0);

    logger.info(`[DirectConnection] [Sender: ${user.username}] Initiating connect flow to vanity: "${vanityName}"`);

    // ── STEP 1: Strict Live Pre-Flight Verification on Profile ─────────────
    logger.info(`[DirectConnection] Running live pre-flight check on profile ${profileUrl}...`);
    const statusCheck = await this.checkConnectionStatus({
      user,
      targetUrlOrVanity,
      headless: isHeadless,
    });

    if (statusCheck.status === 'already_connected') {
      logger.warn(
        `[DirectConnection] ABORTED: Target "${vanityName}" (${statusCheck.recipientName}) is ALREADY CONNECTED. No request or note will be sent.`,
      );
      return {
        success: false,
        status: 'already_connected',
        vanityName,
        targetUrl: targetUrlOrVanity,
        preloadUrl,
        senderUsername: user.username,
        recipientName: statusCheck.recipientName,
        recipientHeadline: statusCheck.recipientHeadline,
        noteIncluded: false,
        message: `Already Connected: You are already connected with ${statusCheck.recipientName || vanityName} (1st degree connection). No invitation sent.`,
        timestamp,
      };
    }

    if (statusCheck.status === 'already_pending') {
      logger.warn(
        `[DirectConnection] ABORTED: Connection request to "${vanityName}" (${statusCheck.recipientName}) is ALREADY PENDING.`,
      );
      return {
        success: false,
        status: 'already_pending',
        vanityName,
        targetUrl: targetUrlOrVanity,
        preloadUrl,
        senderUsername: user.username,
        recipientName: statusCheck.recipientName,
        recipientHeadline: statusCheck.recipientHeadline,
        noteIncluded: false,
        message: `Connection request to ${statusCheck.recipientName || vanityName} is already pending awaiting response.`,
        timestamp,
      };
    }

    if (!statusCheck.success && statusCheck.status === 'failed') {
      return {
        success: false,
        status: 'failed',
        vanityName,
        targetUrl: targetUrlOrVanity,
        preloadUrl,
        senderUsername: user.username,
        noteIncluded: false,
        message: statusCheck.message || 'Session expired or pre-flight check failed.',
        timestamp,
      };
    }

    // ── STEP 2: Launch Browser to Execute Connect Flow ──────────────────────
    logger.info(`[DirectConnection] Pre-flight verified: Not connected. Launching browser to send invite...`);
    const { browser, context, page } = await this.createBrowserContext(user, isHeadless);

    try {
      // 1. Navigate to profile page
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 35_000 });
      await page.waitForTimeout(2000);

      // Locate Connect button on profile action bar
      const primaryConnectBtn = page.locator([
        `button[aria-label*="Invite ${vanityName} to connect"]:visible`,
        `button[aria-label*="Invite"]:has-text("Connect"):visible`,
        'button.pvs-profile-actions__action:has-text("Connect"):visible',
        'div.pvs-profile-actions button:has-text("Connect"):visible',
        'main button:has-text("Connect"):visible',
      ].join(', ')).first();

      let clickedConnect = false;

      if (await primaryConnectBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
        logger.info('[DirectConnection] Found primary Connect button on profile. Clicking...');
        await primaryConnectBtn.click();
        clickedConnect = true;
      } else {
        // Check "More actions" dropdown
        logger.info('[DirectConnection] Primary Connect button not visible directly. Checking "More actions" dropdown...');
        const moreBtn = page.locator([
          'button[aria-label*="More actions"]:visible',
          'div.pvs-profile-actions button:has-text("More"):visible',
          'main button:has-text("More"):visible',
        ].join(', ')).first();

        if (await moreBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
          await moreBtn.click();
          await page.waitForTimeout(600);

          const dropdownConnectBtn = page.locator([
            'div[role="menuitem"]:has-text("Connect"):visible',
            'div[role="button"]:has-text("Connect"):visible',
            'button:has-text("Connect"):visible',
          ].join(', ')).first();

          if (await dropdownConnectBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            logger.info('[DirectConnection] Found Connect inside More dropdown. Clicking...');
            await dropdownConnectBtn.click();
            clickedConnect = true;
          }
        }
      }

      // If button not found on profile, fallback to preload URL only as last resort
      if (!clickedConnect) {
        logger.info(`[DirectConnection] Trying preload URL as fallback: ${preloadUrl}`);
        await page.goto(preloadUrl, { waitUntil: 'domcontentloaded', timeout: 25_000 });
        await page.waitForTimeout(2000);
      }

      // ── STEP 3: Handle Note and Modal Submission ────────────────────────────
      await page.waitForTimeout(1000);

      // Check weekly invitation limit
      const limitReached = await page
        .locator('text="You’ve reached the weekly invitation limit", text="weekly invitation limit", text="reached the weekly limit"')
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      if (limitReached) {
        logger.warn(`[DirectConnection] Weekly invitation limit reached for account ${user.username}`);
        return {
          success: false,
          status: 'weekly_limit',
          vanityName,
          targetUrl: targetUrlOrVanity,
          preloadUrl,
          senderUsername: user.username,
          recipientName: statusCheck.recipientName,
          recipientHeadline: statusCheck.recipientHeadline,
          noteIncluded: false,
          message: `LinkedIn weekly invitation limit reached for account ${user.username}. Try again next week or use another account.`,
          timestamp,
        };
      }

      const modalLocator = page.locator('.artdeco-modal, [role="dialog"], #send-invite-modal').first();
      const addNoteBtnLocator = page.locator([
        'button[aria-label*="Add a note"]:visible',
        'button:has-text("Add a note"):visible',
        '.artdeco-modal button:has-text("Add a note"):visible',
      ].join(', ')).first();

      const noteTextareaLocator = page.locator([
        'textarea[name="message"]:visible',
        'textarea#custom-message:visible',
        'textarea[aria-label*="note"]:visible',
        '.artdeco-modal textarea:visible',
      ].join(', ')).first();

      const sendBtnLocator = page.locator([
        'button[aria-label*="Send invitation"]:visible',
        'button[aria-label*="Send now"]:visible',
        'button:has-text("Send invitation"):visible',
        'button:has-text("Send now"):visible',
        '.artdeco-modal button.artdeco-button--primary:has-text("Send"):visible',
        '.artdeco-modal button:has-text("Send"):visible',
      ].join(', ')).first();

      const sendWithoutNoteBtn = page.locator([
        'button:has-text("Send without a note"):visible',
        'button[aria-label*="Send without a note"]:visible',
      ].join(', ')).first();

      logger.info(`[DirectConnection] Handling invitation submission (Note provided: ${String(hasNote)})...`);

      if (hasNote && note) {
        if (await addNoteBtnLocator.isVisible({ timeout: 4000 }).catch(() => false)) {
          logger.info('[DirectConnection] Clicking "Add a note" button...');
          await addNoteBtnLocator.click();
          await page.waitForTimeout(600);
        }

        if (await noteTextareaLocator.isVisible({ timeout: 5000 }).catch(() => false)) {
          logger.info(`[DirectConnection] Filling custom note (${note.trim().length} chars)...`);
          await noteTextareaLocator.click();
          await noteTextareaLocator.fill(note.trim());
          await page.waitForTimeout(400);
        }

        logger.info('[DirectConnection] Clicking Send invitation button...');
        await sendBtnLocator.waitFor({ state: 'visible', timeout: 8000 });
        await sendBtnLocator.click();
      } else {
        if (await sendWithoutNoteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          logger.info('[DirectConnection] Clicking "Send without a note"...');
          await sendWithoutNoteBtn.click();
        } else if (await sendBtnLocator.isVisible({ timeout: 4000 }).catch(() => false)) {
          logger.info('[DirectConnection] Clicking "Send"...');
          await sendBtnLocator.click();
        }
      }

      await page.waitForTimeout(2500);

      const toastSuccess = await page
        .locator('.artdeco-toast-item, [role="alert"]:has-text("Invitation sent"), [role="alert"]:has-text("sent")')
        .isVisible({ timeout: 4000 })
        .catch(() => false);

      const modalStillOpen = await modalLocator.isVisible({ timeout: 1500 }).catch(() => false);

      logger.info(
        `[DirectConnection] Connect submission completed! (Toast: ${String(toastSuccess)}, Modal closed: ${String(!modalStillOpen)})`,
      );

      await context.close();

      return {
        success: true,
        status: 'sent',
        vanityName,
        targetUrl: targetUrlOrVanity,
        preloadUrl,
        senderUsername: user.username,
        recipientName: statusCheck.recipientName,
        recipientHeadline: statusCheck.recipientHeadline,
        noteIncluded: hasNote,
        message: `Connection request sent successfully to ${statusCheck.recipientName || vanityName}${hasNote ? ' with personalized note' : ''}!`,
        timestamp,
      };
    } catch (err) {
      const errorMsg = (err as Error).message;
      logger.error(`[DirectConnection] Failed to send invite to ${vanityName}: ${errorMsg}`);
      return {
        success: false,
        status: 'failed',
        vanityName,
        targetUrl: targetUrlOrVanity,
        preloadUrl,
        senderUsername: user.username,
        recipientName: statusCheck.recipientName,
        recipientHeadline: statusCheck.recipientHeadline,
        noteIncluded: hasNote,
        message: `Error sending invite: ${errorMsg}`,
        timestamp,
      };
    } finally {
      await browser.close();
    }
  }
}
