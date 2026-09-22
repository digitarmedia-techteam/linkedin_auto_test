import { chromium, type Page, type BrowserContext } from 'playwright';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { LinkedInTestUser, StorageStateData } from '../db/models/TestUser.js';
import { extractVanityName } from './DirectConnectionService.js';
import { ConnectionTrackingRepository } from '../db/repositories/ConnectionTrackingRepository.js';

export interface LinkPreviewCard {
  url: string;
  title?: string;
  domain?: string;
  description?: string;
  imageUrl?: string;
}

export interface MessageAttachment {
  hasAttachment: boolean;
  fileName: string;
  fileType?: string;
  fileSize?: string;
  downloadUrl?: string;
  previewUrl?: string;
}

export interface ThreadMessageDetail {
  id?: string;
  senderName: string;
  senderProfileUrl?: string;
  isSenderVerified?: boolean;
  isCurrentUser: boolean;
  timestamp: string;
  timeRaw?: string;
  text: string;
  linkPreviews: LinkPreviewCard[];
  attachments: MessageAttachment[];
  hasDocument: boolean;
  documentFileName?: string;
}

export interface ReadThreadResult {
  success: boolean;
  threadUrl: string;
  threadId: string;
  participantName: string;
  participantStatus?: string;
  totalMessagesCount: number;
  lastMessage: ThreadMessageDetail | null;
  allMessages: ThreadMessageDetail[];
  quickReplies: string[];
  message?: string;
  error?: string;
  timestamp: string;
}

export interface SendReplyResult {
  success: boolean;
  threadUrl: string;
  threadId: string;
  recipientName?: string;
  replyText: string;
  message?: string;
  error?: string;
}

export interface TrackedConversation {
  order: number; // 1 = most recent, 2, 3, ... 10
  threadId: string; // e.g. "2-ZjdhMThjZGEtZGVjZi00NWM2LTgyN2QtNjc2NWYxZGNmMTk1XzEwMA=="
  threadUrl: string; // "https://www.linkedin.com/messaging/thread/2-Zjdh.../"
  participantName: string;
  participantHeadline?: string;
  participantProfileUrl?: string;
  participantAvatarUrl?: string;
  participantStatus?: string; // 'online' | 'reachable' | 'offline' | 'Active now'
  lastMessageSnippet: string;
  timestamp: string;
  isSentByMe: boolean;
  isViewer: boolean;
  sentBy: 'you' | 'other';
  isUnread: boolean;
  hasAttachment: boolean;
  hasDocument: boolean;
  documentFileName?: string;
  detectedAt: string;
}

export interface TrackRecentConversationsResult {
  success: boolean;
  totalTracked: number;
  conversations: TrackedConversation[];
  activeThreadId?: string;
  activeThreadUrl?: string;
  message?: string;
  error?: string;
  timestamp: string;
}

/**
 * Extracts thread ID from a LinkedIn messaging URL or raw string.
 *
 * Example:
 * https://www.linkedin.com/messaging/thread/2-ZjdhMThjZGEtZGVjZi00NWM2LTgyN2QtNjc2NWYxZGNmMTk1XzEwMA==/
 * -> 2-ZjdhMThjZGEtZGVjZi00NWM2LTgyN2QtNjc2NWYxZGNmMTk1XzEwMA==
 */
export function extractThreadId(input: string): string {
  if (!input || typeof input !== 'string') return '';
  const trimmed = input.trim();

  // Explicitly reject compose/profile URLs or invalid non-thread URLs
  if (
    trimmed.includes('/messaging/compose') ||
    trimmed.includes('profileUrn=') ||
    trimmed.includes('recipient=') ||
    trimmed.includes('interop=') ||
    trimmed.includes('/in/')
  ) {
    return '';
  }

  // 1. Thread URL pattern with explicit 2-... identifier: /messaging/thread/(2-[^/?#]+)
  const urlMatch = trimmed.match(/messaging\/thread\/(2-[a-zA-Z0-9_%-]+={0,2})/i);
  if (urlMatch && urlMatch[1]) {
    return decodeURIComponent(urlMatch[1]).replace(/\/$/, '').trim();
  }

  // 2. Bare 2-... identifier
  const bareMatch = trimmed.match(/^(2-[a-zA-Z0-9_%-]+={0,2})$/i);
  if (bareMatch && bareMatch[1]) {
    return decodeURIComponent(bareMatch[1]).trim();
  }

  // 3. Substring 2-... identifier with at least 8 characters
  const subMatch = trimmed.match(/\b(2-[a-zA-Z0-9_-]{8,}={0,2})\b/);
  if (subMatch && subMatch[1]) {
    return subMatch[1].trim();
  }

  return '';
}

/**
 * Builds the canonical LinkedIn messaging thread URL.
 */
export function buildThreadUrl(threadIdOrUrl: string): string {
  const id = extractThreadId(threadIdOrUrl);
  return id ? `https://www.linkedin.com/messaging/thread/${id}/` : '';
}

export class MessagingService {
  /**
   * Prepares and configures an isolated Playwright browser context with the user's cookies.
   */
  private static async createAuthenticatedContext(
    user: LinkedInTestUser,
    headless: boolean
  ): Promise<{ browser: any; context: BrowserContext; page: Page }> {
    if (!user.storage_state_json && !user.session_cookies_json) {
      throw new Error(
        `User ${user.username} (ID: ${user.id}) does not have an active session saved. Please log in first.`
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
        logger.warn(`[MessagingService] Failed to parse storage_state_json: ${e}`);
      }
    }
    if (cookiesToAdd.length === 0 && user.session_cookies_json) {
      try {
        const parsedCookies = JSON.parse(user.session_cookies_json);
        if (Array.isArray(parsedCookies)) {
          cookiesToAdd = parsedCookies;
        }
      } catch (e) {
        logger.warn(`[MessagingService] Failed to parse session_cookies_json: ${e}`);
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
   * Reads a LinkedIn messaging thread, extracts all messages, and thoroughly
   * analyzes the last message including text, link previews, and attached documents.
   */
  static async readThread(options: {
    user: LinkedInTestUser;
    threadUrlOrId: string;
    headless?: boolean;
  }): Promise<ReadThreadResult> {
    const timestamp = new Date().toISOString();
    const threadId = extractThreadId(options.threadUrlOrId);
    if (!threadId) {
      return {
        success: true,
        threadUrl: options.threadUrlOrId || '',
        threadId: '',
        user: options.user.username,
        messageCount: 0,
        messages: [],
        allMessages: [],
        timestamp,
      };
    }
    const threadUrl = buildThreadUrl(threadId);
    const headless = options.headless !== undefined ? options.headless : true;

    logger.info(`[MessagingService] Reading thread "${threadId}" for user "${options.user.username}"`);

    const { browser, page } = await this.createAuthenticatedContext(options.user, headless);

    // Track Voyager API conversation messages if captured over network
    const capturedApiMessages: any[] = [];
    page.on('response', async (response) => {
      try {
        const url = response.url();
        if (
          (url.includes('/voyager/api/messaging/conversations') ||
            url.includes('/voyager/api/graphql') ||
            url.includes('/voyagerMessagingGraphQL/')) &&
          response.ok() &&
          response.request().resourceType() === 'fetch'
        ) {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('application/json')) {
            const data = await response.json();
            capturedApiMessages.push(data);
          }
        }
      } catch {
        // Ignore network parse issues for unrelated responses
      }
    });

    try {
      await page.goto(threadUrl, { waitUntil: 'domcontentloaded', timeout: 35_000 });
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint')) {
        return {
          success: false,
          threadUrl,
          threadId,
          participantName: '',
          totalMessagesCount: 0,
          lastMessage: null,
          allMessages: [],
          quickReplies: [],
          error: 'Session expired or checkpoint triggered. Redirected to login.',
          timestamp,
        };
      }

      // Wait for messaging container or thread view
      try {
        await page.waitForSelector(
          '.msg-s-message-list, .msg-s-message-list-container, .msg-thread, .msg-conversations-container',
          { timeout: 12_000 }
        );
      } catch {
        logger.warn('[MessagingService] Timed out waiting for standard message list selector, scanning page...');
      }

      await page.waitForTimeout(2000);

      // Scrape thread data directly from page DOM
      const threadData = await page.evaluate(() => {
        // Participant Header
        let participantName = '';
        let participantStatus = '';

        const headerNameEl =
          document.querySelector('.msg-title-bar__title, .msg-entity-lockup__entity-title, h2.msg-entity-lockup__entity-title') ||
          document.querySelector('.msg-thread__link-to-profile') ||
          document.querySelector('.msg-s-message-group__name');

        if (headerNameEl) {
          participantName = (headerNameEl.textContent || '').trim();
        }

        const statusEl = document.querySelector('.msg-title-bar__user-status, .presence-entity__status');
        if (statusEl) {
          participantStatus = (statusEl.textContent || '').trim();
        }

        // Quick replies
        const quickReplies: string[] = [];
        document.querySelectorAll('.msg-s-quick-replies button, button.msg-s-quick-reply-bubble').forEach((btn) => {
          const t = (btn.textContent || '').trim();
          if (t && !quickReplies.includes(t)) quickReplies.push(t);
        });

        // Parse message list items
        const messageItems: any[] = [];
        const messageNodes = document.querySelectorAll(
          '.msg-s-message-list__event, li.msg-s-message-list__event, .msg-s-event-listitem'
        );

        messageNodes.forEach((node, index) => {
          // Sender
          let senderName = '';
          let senderProfileUrl = '';
          let isSenderVerified = false;

          const senderEl = node.closest('.msg-s-message-group')?.querySelector('.msg-s-message-group__name') ||
            node.querySelector('.msg-s-message-group__name') ||
            node.querySelector('a[href*="/in/"]');

          if (senderEl) {
            senderName = (senderEl.textContent || '').trim();
            const link = senderEl.tagName === 'A' ? senderEl : senderEl.querySelector('a');
            if (link) {
              senderProfileUrl = (link as HTMLAnchorElement).href || '';
            }
          }

          if (!senderName) {
            senderName = participantName;
          }

          // Verification badge
          if (node.querySelector('[data-test-icon*="verified"], .artdeco-icon--verified, svg[aria-label*="Verified"]')) {
            isSenderVerified = true;
          }

          // Timestamp
          let timestampStr = '';
          const timeEl = node.querySelector('time') ||
            node.closest('.msg-s-message-group')?.querySelector('time') ||
            node.querySelector('.msg-s-message-group__timestamp');
          if (timeEl) {
            timestampStr = (timeEl.textContent || '').trim();
          }

          // Message Body Text
          let text = '';
          const bodyEl = node.querySelector('.msg-s-event-listitem__body, p.msg-s-event-listitem__body, .msg-s-message-group__message');
          if (bodyEl) {
            text = (bodyEl.textContent || '').trim();
          }

          // Link Previews
          const linkPreviews: any[] = [];
          node.querySelectorAll('.msg-s-event-listitem__link-preview, a.msg-s-event-listitem__link-preview-title, .feed-shared-link-preview').forEach((previewEl) => {
            const linkTag = previewEl.tagName === 'A' ? (previewEl as HTMLAnchorElement) : previewEl.querySelector('a');
            const titleEl = previewEl.querySelector('.msg-s-event-listitem__link-preview-title, h2, h3, strong');
            const domainEl = previewEl.querySelector('.msg-s-event-listitem__link-preview-domain, .msg-s-event-listitem__link-preview-subtitle');
            const snippetEl = previewEl.querySelector('.msg-s-event-listitem__link-preview-snippet, p');
            const imgEl = previewEl.querySelector('img');

            linkPreviews.push({
              url: linkTag ? linkTag.href : '',
              title: titleEl ? (titleEl.textContent || '').trim() : '',
              domain: domainEl ? (domainEl.textContent || '').trim() : '',
              description: snippetEl ? (snippetEl.textContent || '').trim() : '',
              imageUrl: imgEl ? imgEl.src : undefined,
            });
          });

          // Attached Documents & Files
          const attachments: any[] = [];
          node.querySelectorAll(
            '.msg-s-event-listitem__attachment, .msg-s-attachment-container, a[href*="/media/"], a[download], .msg-s-attachment-document, .artdeco-entity-lockup'
          ).forEach((attEl) => {
            const nameEl = attEl.querySelector(
              '.msg-s-attachment__filename, .artdeco-entity-lockup__title, span[title], strong, .msg-s-event-listitem__attachment-filename'
            );
            const sizeEl = attEl.querySelector(
              '.msg-s-attachment__filesize, .artdeco-entity-lockup__caption, .msg-s-event-listitem__attachment-filesize'
            );
            const downloadLink = attEl.tagName === 'A' ? (attEl as HTMLAnchorElement) : attEl.querySelector('a');

            let fileName = nameEl ? (nameEl.textContent || '').trim() : '';
            if (!fileName && downloadLink && downloadLink.getAttribute('download')) {
              fileName = downloadLink.getAttribute('download') || '';
            }

            // Check if it represents an attached document
            if (fileName || downloadLink) {
              const fileTypeMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
              const fileType = fileTypeMatch ? fileTypeMatch[1].toUpperCase() : 'DOCUMENT';

              attachments.push({
                hasAttachment: true,
                fileName: fileName || 'Attached Document',
                fileType,
                fileSize: sizeEl ? (sizeEl.textContent || '').trim() : undefined,
                downloadUrl: downloadLink ? downloadLink.href : undefined,
              });
            }
          });

          const isCurrentUser = node.classList.contains('msg-s-message-list__event--is-viewer') ||
            node.querySelector('.msg-s-message-group--is-viewer') !== null;

          if (text || linkPreviews.length > 0 || attachments.length > 0) {
            messageItems.push({
              index,
              senderName,
              senderProfileUrl,
              isSenderVerified,
              isCurrentUser,
              timestamp: timestampStr,
              text,
              linkPreviews,
              attachments,
              hasDocument: attachments.length > 0,
              documentFileName: attachments[0]?.fileName,
            });
          }
        });

        return {
          participantName,
          participantStatus,
          quickReplies,
          messages: messageItems,
        };
      });

      const allMessages = threadData.messages as ThreadMessageDetail[];
      const lastMessage = allMessages.length > 0 ? allMessages[allMessages.length - 1] : null;

      logger.info(
        `[MessagingService] Read ${allMessages.length} message(s). Last message from: "${lastMessage?.senderName || 'N/A'}"`
      );

      return {
        success: true,
        threadUrl,
        threadId,
        participantName: threadData.participantName,
        participantStatus: threadData.participantStatus,
        totalMessagesCount: allMessages.length,
        lastMessage,
        allMessages,
        quickReplies: threadData.quickReplies,
        timestamp,
      };
    } catch (err: any) {
      logger.error(`[MessagingService] Error reading thread ${threadId}:`, { error: err.message });
      return {
        success: false,
        threadUrl,
        threadId,
        participantName: '',
        totalMessagesCount: 0,
        lastMessage: null,
        allMessages: [],
        quickReplies: [],
        error: err.message,
        timestamp,
      };
    } finally {
      await browser.close();
    }
  }

  /**
   * Sends a reply message to a LinkedIn messaging thread.
   */
  static async sendReply(options: {
    user: LinkedInTestUser;
    threadUrlOrId: string;
    message: string;
    headless?: boolean;
  }): Promise<SendReplyResult> {
    const timestamp = new Date().toISOString();
    const threadId = extractThreadId(options.threadUrlOrId);
    if (!threadId) {
      logger.info(`[MessagingService] sendReply called with non-thread ID "${options.threadUrlOrId}". Delegating to sendMessageToRecipient...`);
      return this.sendMessageToRecipient({
        user: options.user,
        recipientName: options.threadUrlOrId,
        message: options.message,
        headless: options.headless,
      });
    }
    const threadUrl = buildThreadUrl(threadId);
    const replyText = (options.message || '').trim();
    if (!replyText) {
      throw new Error('Reply message cannot be empty.');
    }
    const headless = options.headless !== undefined ? options.headless : true;

    logger.info(`[MessagingService] Sending reply to thread "${threadId}" from user "${options.user.username}"`);

    const { browser, page } = await this.createAuthenticatedContext(options.user, headless);

    try {
      await page.goto(threadUrl, { waitUntil: 'domcontentloaded', timeout: 35_000 });
      await page.waitForTimeout(2500);

      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint')) {
        return {
          success: false,
          threadUrl,
          threadId,
          replyText,
          sentAt: timestamp,
          error: 'Session expired or security checkpoint triggered during navigation.',
        };
      }

      // Locate message compose input in thread
      const candidateInputSelectors = [
        'div.msg-form__contenteditable[contenteditable="true"]',
        'div[role="textbox"][contenteditable="true"]',
        '.msg-form__message-texteditor [contenteditable="true"]',
        'div[aria-label*="Write a message"]',
        'div[data-placeholder*="Write a message"]',
        '.msg-overlay-conversation-bubble [contenteditable="true"]',
        'div[contenteditable="true"][role="textbox"]',
        'div[aria-label*="Write a message…"]',
        'p[data-placeholder*="Write a message"]',
        '.msg-form__message-texteditor div[contenteditable="true"]',
        'div.msg-s-message-composer__editor [contenteditable="true"]',
        'div[contenteditable="true"]',
      ];

      logger.info('[MessagingService] Waiting for message input box in thread (parallel race, 12s)...');

      // Race all candidate selectors in parallel — fastest visible one wins
      const raceResult = await Promise.race(
        candidateInputSelectors.map(sel =>
          page.waitForSelector(sel, { state: 'visible', timeout: 12_000 })
            .then(el => el ? { sel, el } : null)
            .catch(() => null)
        )
      );

      let inputEl: any = raceResult
        ? page.locator(raceResult.sel).first()
        : null;

      if (!inputEl || !(await inputEl.isVisible({ timeout: 500 }).catch(() => false))) {
        throw new Error('Could not locate the LinkedIn message input textbox in thread.');
      }

      // Click to focus and type message
      await inputEl.click({ force: true });
      await page.waitForTimeout(300);

      // Clear any pre-existing text
      await page.keyboard.press('Meta+A');
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Backspace');

      // Insert message using Playwright's keyboard to trigger native input events
      await page.keyboard.type(replyText, { delay: 20 });
      await page.waitForTimeout(600);

      // Lexical / DraftJS state sync via evaluate
      await page.evaluate((text) => {
        const el = document.querySelector(
          'div.msg-form__contenteditable[contenteditable="true"], div[role="textbox"][contenteditable="true"], div[contenteditable="true"]'
        ) as HTMLElement | null;
        if (el) {
          if (!el.innerText.trim()) {
            const p = el.querySelector('p') || el;
            p.textContent = text;
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, replyText);

      await page.waitForTimeout(400);

      // Locate and click the Send button
      const sendButtonSelectors = [
        'button.msg-form__send-button:not([disabled])',
        'button[type="submit"].msg-form__send-button',
        'button.msg-form__send-button',
        'form.msg-form button[type="submit"]',
        'button:has-text("Send"):not([disabled])',
        'button[aria-label="Send"]',
        'button:has-text("Send")',
      ];

      let clickedSend = false;
      for (const sel of sendButtonSelectors) {
        try {
          const btnLoc = page.locator(sel);
          const count = await btnLoc.count();
          for (let i = 0; i < count; i++) {
            const btn = btnLoc.nth(i);
            if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
              await btn.click({ force: true });
              clickedSend = true;
              logger.info(`[MessagingService] Clicked Send button with selector: ${sel}`);
              break;
            }
          }
          if (clickedSend) break;
        } catch {}
      }

      // JS & form submit fallback
      await page.evaluate(() => {
        const btn = document.querySelector('button.msg-form__send-button') as HTMLButtonElement | null;
        if (btn) {
          btn.disabled = false;
          btn.removeAttribute('disabled');
          try { btn.click(); } catch {}
        }
        const form = document.querySelector('form.msg-form') as HTMLFormElement | null;
        if (form) {
          try {
            if (typeof form.requestSubmit === 'function') form.requestSubmit();
            else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          } catch {}
        }
      });

      // Keyboard submit fallback
      await page.keyboard.press('Control+Enter');
      await page.waitForTimeout(200);
      await page.keyboard.press('Enter');

      await page.waitForTimeout(2500);

      logger.info(`[MessagingService] Successfully dispatched reply to thread "${threadId}"`);

      return {
        success: true,
        threadUrl,
        threadId,
        replyText,
        sentAt: new Date().toISOString(),
        message: `Successfully sent reply to thread ${threadId}`,
      };
    } catch (err: any) {
      logger.error(`[MessagingService] Error sending reply to thread ${threadId}:`, { error: err.message });
      return {
        success: false,
        threadUrl,
        threadId,
        replyText,
        sentAt: timestamp,
        error: err.message,
      };
    } finally {
      await browser.close();
    }
  }

  /**
   * Sends a message to a recipient either by threadId OR by recipient vanity/profile URL.
   * If threadId is provided: dispatches to the thread.
   * If recipient vanity/profileUrl is provided: navigates to profile, discovers Message button
   * or direct compose link, handles any overlay/unminimization, types message, and sends.
   */
  /**
   * Universal message dispatcher: sends a message directly to a recipient.
   * Strategies:
   * 1. If threadUrl/threadId is provided -> dispatches via sendReply.
   * 2. If recipientName is provided and profileUrl/vanity is missing or fails ->
   *    Navigates to LinkedIn Connections page (/mynetwork/invite-connect/connections/),
   *    searches for the recipient by name in data-testid="typeahead-input",
   *    locates their connection card, clicks Message, types/pastes message in composer, and clicks Send!
   * 3. If recipientProfileUrl or recipientVanity is provided ->
   *    Navigates to profile, clicks Message button or direct compose link, types, and sends.
   * Auto-updates ConnectionTrackingRepository with resolved metadata and thread ID.
   */
  static async sendMessageToRecipient(options: {
    user: LinkedInTestUser;
    threadUrlOrId?: string;
    recipientVanity?: string;
    recipientProfileUrl?: string;
    recipientName?: string;
    message: string;
    headless?: boolean;
  }): Promise<SendReplyResult> {
    const threadId = options.threadUrlOrId ? extractThreadId(options.threadUrlOrId) : '';
    const message = (options.message || '').trim();
    if (!message) {
      throw new Error('Message text cannot be empty.');
    }

    if (threadId) {
      return this.sendReply({
        user: options.user,
        threadUrlOrId: threadId,
        message,
        headless: options.headless,
      });
    }

    // Lookup in database first if recipient identifiers are partially missing
    let vanity = options.recipientVanity ? extractVanityName(options.recipientVanity) : '';
    let profileUrl = options.recipientProfileUrl || (vanity ? `https://www.linkedin.com/in/${vanity}/` : '');
    const recipientName = (options.recipientName || '').trim();

    if ((!vanity || !profileUrl) && recipientName) {
      try {
        await ConnectionTrackingRepository.initTable();
        const matched = await ConnectionTrackingRepository.findMatchingRows(options.user.id, recipientName);
        if (matched.length > 0) {
          const row = matched[0];
          if (!vanity && row.recipient_vanity_name) vanity = row.recipient_vanity_name;
          if (!profileUrl && row.recipient_profile_url) profileUrl = row.recipient_profile_url;
          if (!profileUrl && vanity) profileUrl = `https://www.linkedin.com/in/${vanity}/`;
        }
      } catch (dbErr) {
        logger.warn(`[MessagingService] DB lookup warning: ${dbErr}`);
      }

      // Check if recipientName itself is a vanity slug
      if (!vanity && !profileUrl && /^[a-zA-Z0-9_%-]+$/.test(recipientName) && (recipientName.includes('-') || recipientName.includes('_'))) {
        vanity = extractVanityName(recipientName) || recipientName;
        profileUrl = `https://www.linkedin.com/in/${encodeURIComponent(vanity)}/`;
      }
    }

    const headless = options.headless !== undefined ? options.headless : true;
    const { browser, page } = await this.createAuthenticatedContext(options.user, headless);

    try {
      // Helper: Expand any minimized chat bubble overlays
      const expandChatOverlays = async () => {
        await page.evaluate(() => {
          const minimizedHeaders = document.querySelectorAll(
            '.msg-overlay-conversation-bubble--is-minimized .msg-overlay-bubble-header, .msg-overlay-bubble-header--is-minimized, .msg-overlay-bubble-header'
          );
          minimizedHeaders.forEach(h => {
            try { (h as HTMLElement).click(); } catch {}
          });
          document.querySelectorAll('.msg-overlay-conversation-bubble--is-minimized').forEach(bubble => {
            bubble.classList.remove('msg-overlay-conversation-bubble--is-minimized');
          });
        });
      };

      // Helper: Wait for typeahead loaders to clear
      const clearTypeaheadLoader = async (timeoutMs = 4000) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          const isBlocked = await page.evaluate(() => {
            const loader = document.querySelector(
              '.msg-connections-typeahead__loader, .msg-connection-typeahead__loader, .artdeco-loader, .msg-form__loader'
            );
            return loader ? window.getComputedStyle(loader).display !== 'none' : false;
          });
          if (!isBlocked) return;
          await page.waitForTimeout(200);
        }
      };

      // Helper: Find visible compose textbox locator
      const findVisibleComposerLocator = async (waitMs = 0) => {
        await expandChatOverlays();
        await clearTypeaheadLoader(2500);

        // Priority selectors — try with native waitForSelector first (fast path)
        const prioritySelectors = [
          'div.msg-form__contenteditable[contenteditable="true"]',
          'div[role="textbox"][contenteditable="true"]',
          '.msg-form__message-texteditor [contenteditable="true"]',
          '.msg-overlay-conversation-bubble [contenteditable="true"]',
          'div[aria-label*="Write a message"]',
          'div[data-placeholder*="Write a message"]',
        ];

        const effectiveWait = Math.max(waitMs, 5000);
        // Race all priority selectors in parallel — return the first one that becomes visible
        const priorityResult = await Promise.race(
          prioritySelectors.map(sel =>
            page.waitForSelector(sel, { state: 'visible', timeout: effectiveWait })
              .then(el => el ? { sel, el } : null)
              .catch(() => null)
          )
        );
        if (priorityResult) {
          const loc = page.locator(priorityResult.sel).first();
          if (await loc.isVisible({ timeout: 500 }).catch(() => false)) return loc;
        }

        // Fallback: broader scan with 600ms per element
        const fallbackSelectors = [
          '.msg-overlay-conversation-bubble div.msg-form__contenteditable[contenteditable="true"]',
          '.msg-overlay-conversation-bubble div[role="textbox"][contenteditable="true"]',
          'div.msg-s-message-composer__editor [contenteditable="true"]',
          'div[aria-label*="Write a message…"]',
          'div[contenteditable="true"]',
          'textarea.msg-form__textarea',
        ];

        for (const sel of fallbackSelectors) {
          try {
            const loc = page.locator(sel);
            const count = await loc.count();
            for (let i = 0; i < count; i++) {
              const el = loc.nth(i);
              if (await el.isVisible({ timeout: 600 }).catch(() => false)) {
                return el;
              }
            }
          } catch {}
        }
        return null;
      };

      // Helper: Type and click Send in composer
      const typeAndSendMessageInComposer = async (composerLoc: any): Promise<{ sent: boolean; threadId: string | null }> => {
        logger.info('[MessagingService] Message composer located. Focusing and typing message...');
        await composerLoc.click({ force: true });
        await page.waitForTimeout(300);

        // Clear existing draft
        await page.keyboard.press('Meta+A');
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');

        // Type message natively
        await page.keyboard.type(message, { delay: 15 });
        await page.waitForTimeout(600);

        // React Lexical / DraftJS state sync
        await page.evaluate((text) => {
          const editors = document.querySelectorAll(
            'div.msg-form__contenteditable[contenteditable="true"], div[role="textbox"][contenteditable="true"], .msg-form__message-texteditor [contenteditable="true"], div[contenteditable="true"]'
          );
          editors.forEach(el => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.offsetParent !== null) {
              if (!htmlEl.innerText.trim()) {
                const p = htmlEl.querySelector('p') || htmlEl;
                p.textContent = text;
              }
              htmlEl.dispatchEvent(new Event('input', { bubbles: true }));
              htmlEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
        }, message);

        await page.waitForTimeout(500);

        // Click Send button
        logger.info('[MessagingService] Clicking Send button...');
        const sendButtonSelectors = [
          'button.msg-form__send-button:not([disabled])',
          '.msg-overlay-conversation-bubble button.msg-form__send-button:not([disabled])',
          'button[type="submit"].msg-form__send-button',
          '.msg-overlay-conversation-bubble button.msg-form__send-button',
          'button.msg-form__send-button',
          'form.msg-form button[type="submit"]',
          'button:has-text("Send"):not([disabled])',
          'button[aria-label="Send"]',
          'button:has-text("Send")',
        ];

        let clickedSend = false;
        for (const sel of sendButtonSelectors) {
          try {
            const btnLoc = page.locator(sel);
            const count = await btnLoc.count();
            for (let i = 0; i < count; i++) {
              const btn = btnLoc.nth(i);
              if (await btn.isVisible({ timeout: 400 }).catch(() => false)) {
                await btn.click({ force: true });
                clickedSend = true;
                logger.info(`[MessagingService] Clicked Send button with selector: ${sel}`);
                break;
              }
            }
            if (clickedSend) break;
          } catch {}
        }

        // Form submit fallback
        await page.evaluate(() => {
          const btns = document.querySelectorAll('button.msg-form__send-button, form.msg-form button[type="submit"]');
          btns.forEach(b => {
            const btn = b as HTMLButtonElement;
            btn.disabled = false;
            btn.removeAttribute('disabled');
            try { btn.click(); } catch {}
          });
          const forms = document.querySelectorAll('form.msg-form');
          forms.forEach(f => {
            const form = f as HTMLFormElement;
            try {
              if (typeof form.requestSubmit === 'function') form.requestSubmit();
              else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            } catch {}
          });
        });

        // Keyboard submit fallback
        await page.keyboard.press('Control+Enter');
        await page.waitForTimeout(200);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2500);

        // Capture thread ID from page URL or overlay DOM
        const detectedThreadId = await page.evaluate(() => {
          // 1. Direct href in links
          const links = Array.from(document.querySelectorAll('a[href*="/messaging/thread/"]'));
          for (const l of links) {
            const href = (l as HTMLAnchorElement).href || '';
            const m = href.match(/thread\/(2-[A-Za-z0-9_\-=%]+)/);
            if (m) return m[1];
          }
          // 2. Data attributes on bubble or form
          const elements = Array.from(document.querySelectorAll('[data-entity-urn*="conversation"], [data-thread-id], [data-conversation-id], form[action*="thread"]'));
          for (const el of elements) {
            const attr = el.getAttribute('data-entity-urn') || el.getAttribute('data-thread-id') || el.getAttribute('data-conversation-id') || el.getAttribute('action') || '';
            const m = attr.match(/(?:conversation:|thread\/|urn:li:msg_conversation:|urn:li:fsd_conversation:)(2-[A-Za-z0-9_\-=%]+)/);
            if (m) return m[1];
          }
          return null;
        });

        const threadId = detectedThreadId || extractThreadId(page.url()) || null;
        return {
          sent: true,
          threadId,
        };
      };

      let messageSuccessfullySent = false;
      let sentThreadId: string | null = null;
      let resolvedRecipientName = recipientName || vanity || 'LinkedIn Connection';
      let resolvedProfileUrl = profileUrl;

      // ── STRATEGY 1: Flow via Connections Page Search (if profileUrl missing or direct) ────
      if (!profileUrl && recipientName) {
        logger.info(`[MessagingService] No profile URL provided for "${recipientName}". Using Connections Page Search Flow...`);
        await page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/', {
          waitUntil: 'domcontentloaded',
          timeout: 35_000,
        });
        await page.waitForTimeout(2000);

        const typeaheadSelectors = [
          'input[data-testid="typeahead-input"]',
          'input[placeholder*="Search by name"]',
          '#connectionsListTypeahead_ConnectionsListTypeahead input',
          'input[aria-label*="Search by name"]',
        ];

        let typedSearch = false;
        for (const sel of typeaheadSelectors) {
          try {
            const inp = page.locator(sel).first();
            if (await inp.isVisible({ timeout: 2000 }).catch(() => false)) {
              await inp.click({ force: true });
              await inp.fill('');
              await inp.fill(recipientName);
              await page.waitForTimeout(1800);
              typedSearch = true;
              logger.info(`[MessagingService] Typed "${recipientName}" into Connections search.`);
              break;
            }
          } catch {}
        }

        // Locate connection card and click Message
        const cardInfo = await page.evaluate((target) => {
          const tLower = target.toLowerCase().trim();
          const cards = Array.from(document.querySelectorAll('div[componentkey*="ConnectionCard"], .mn-connection-card, li.mn-connection-card, div[data-component-type="LazyColumn"] > div'));
          for (const c of cards) {
            const text = (c as HTMLElement).innerText || '';
            const keyAttr = c.getAttribute('componentkey') || '';
            const msgBtn = c.querySelector('a[href*="/messaging/compose"], a[aria-label*="Message"], button[aria-label*="Message"]') as HTMLElement | null;
            const profileLink = c.querySelector('a[href*="/in/"]') as HTMLAnchorElement | null;
            if (text.toLowerCase().includes(tLower) || keyAttr.toLowerCase().includes(tLower) || cards.length === 1) {
              const msgHref = msgBtn ? (msgBtn.getAttribute('href') || (msgBtn as HTMLAnchorElement).href) : null;
              const profHref = profileLink ? profileLink.href : null;
              return {
                found: true,
                messageHref: msgHref,
                profileHref: profHref,
                componentKey: keyAttr,
              };
            }
          }
          return { found: false };
        }, recipientName);

        if (cardInfo.found && cardInfo.profileHref) {
          resolvedProfileUrl = cardInfo.profileHref;
          vanity = extractVanityName(cardInfo.profileHref) || vanity;
        }

        // Click the Message button on the filtered card
        let clickedMsgOnConnections = false;
        const msgButtons = page.locator(
          'a[href*="/messaging/compose"], a[aria-label*="Send a message"], button[aria-label*="Message"], a.message-anywhere-button'
        );
        const btnCount = await msgButtons.count();
        if (btnCount > 0) {
          const btn = msgButtons.first();
          if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await btn.click({ force: true });
            clickedMsgOnConnections = true;
            logger.info('[MessagingService] Clicked Message button on Connections card.');
          }
        }

        if (!clickedMsgOnConnections && cardInfo.messageHref) {
          const fullCompose = cardInfo.messageHref.startsWith('http') ? cardInfo.messageHref : `https://www.linkedin.com${cardInfo.messageHref}`;
          logger.info(`[MessagingService] Navigating directly to compose link: ${fullCompose}`);
          await page.goto(fullCompose, { waitUntil: 'domcontentloaded', timeout: 35_000 });
        }

        await page.waitForTimeout(1500);
        const composer = await findVisibleComposerLocator(12000);
        if (composer) {
          const res = await typeAndSendMessageInComposer(composer);
          if (res.sent) {
            messageSuccessfullySent = true;
            sentThreadId = res.threadId;
          }
        }
      }

      // ── STRATEGY 2: Direct Profile Navigation (if profileUrl known) ────────
      if (!messageSuccessfullySent && resolvedProfileUrl) {
        logger.info(`[MessagingService] Navigating to profile "${resolvedProfileUrl}" to send message...`);
        await page.goto(resolvedProfileUrl, { waitUntil: 'domcontentloaded', timeout: 35_000 });
        await page.waitForTimeout(2500);

        const currentUrl = page.url();
        if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint')) {
          return {
            success: false,
            threadUrl: resolvedProfileUrl,
            threadId: '',
            recipientName: resolvedRecipientName,
            replyText: message,
            error: 'Session expired or security checkpoint triggered. Please log in again.',
          };
        }

        // Check if there is already an existing thread href
        const existingThreadHref = await page.evaluate(() => {
          const a = document.querySelector('a[href*="/messaging/thread/"]') as HTMLAnchorElement | null;
          return a ? a.href : null;
        });

        if (existingThreadHref) {
          const detectedId = extractThreadId(existingThreadHref);
          if (detectedId) {
            logger.info(`[MessagingService] Detected existing thread ${detectedId} on profile.`);
            await browser.close();
            return this.sendMessageToRecipient({
              ...options,
              threadUrlOrId: detectedId,
            });
          }
        }

        // Click Message button on profile
        const profileMsgSelectors = [
          'main a[href*="/messaging/compose/"]',
          '.pv-top-card a[href*="/messaging/compose/"]',
          'a[href*="/messaging/compose/"]',
          'main a:has(svg#send-privately-medium)',
          'a:has(svg#send-privately-medium)',
          'main button:has-text("Message")',
          '.pv-top-card button:has-text("Message")',
          'button[aria-label*="Message"]',
          'a[aria-label*="Message"]',
        ];

        let clicked = false;
        for (const sel of profileMsgSelectors) {
          try {
            const btn = await page.waitForSelector(sel, { timeout: 2000 });
            if (btn) {
              await btn.scrollIntoViewIfNeeded();
              await btn.click({ force: true });
              clicked = true;
              logger.info(`[MessagingService] Clicked Message button on profile: ${sel}`);
              break;
            }
          } catch {}
        }

        if (!clicked) {
          // Direct compose URL fallback
          const directComposeUrl = vanity
            ? `https://www.linkedin.com/messaging/compose/?recipient=${encodeURIComponent(vanity)}`
            : '';
          if (directComposeUrl) {
            logger.info(`[MessagingService] Navigating to direct compose URL: ${directComposeUrl}`);
            await page.goto(directComposeUrl, { waitUntil: 'domcontentloaded', timeout: 35_000 });
          }
        }

        // Wait up to 12s for the messaging overlay/composer to appear after clicking Message
        await page.waitForTimeout(1500);
        let composer = await findVisibleComposerLocator(12000);

        if (composer) {
          const res = await typeAndSendMessageInComposer(composer);
          if (res.sent) {
            messageSuccessfullySent = true;
            sentThreadId = res.threadId;
          }
        }
      }

      // ── STRATEGY 3: Connections Page fallback ──────────────────────────────
      // Always try this if message was not yet sent and we have a recipient name.
      if (!messageSuccessfullySent && recipientName) {
        logger.info(`[MessagingService] Connections page fallback for "${recipientName}"...`);
        await page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/', {
          waitUntil: 'domcontentloaded',
          timeout: 35_000,
        });
        await page.waitForTimeout(2000);

        const typeaheadInputSelectors = [
          'input[data-testid="typeahead-input"]',
          'input[placeholder*="Search by name"]',
          'input[aria-label*="Search"]',
          '#connectionsListTypeahead_ConnectionsListTypeahead input',
        ];

        let searchInp = null;
        for (const sel of typeaheadInputSelectors) {
          const candidate = page.locator(sel).first();
          if (await candidate.isVisible({ timeout: 2000 }).catch(() => false)) {
            searchInp = candidate;
            break;
          }
        }

        if (searchInp) {
          await searchInp.click({ force: true });
          await searchInp.fill('');
          await searchInp.fill(recipientName);
          await page.waitForTimeout(2000);

          // Dismiss typeahead loader before clicking
          await clearTypeaheadLoader(4000);

          const msgBtnSelectors = [
            'a[href*="/messaging/compose"]',
            'a[aria-label*="Send a message"]',
            'button[aria-label*="Message"]',
            'a.message-anywhere-button',
          ];

          let clickedMsg = false;
          for (const sel of msgBtnSelectors) {
            const btn = page.locator(sel).first();
            if (await btn.isVisible({ timeout: 2500 }).catch(() => false)) {
              await btn.click({ force: true });
              clickedMsg = true;
              logger.info(`[MessagingService] Connections-page fallback: clicked Message btn (${sel}).`);
              break;
            }
          }

          if (clickedMsg) {
            await page.waitForTimeout(1500);
            const composer = await findVisibleComposerLocator(12000);
            if (composer) {
              const res = await typeAndSendMessageInComposer(composer);
              if (res.sent) {
                messageSuccessfullySent = true;
                sentThreadId = res.threadId;
              }
            }
          }
        }
      }

      // ── STRATEGY 4: Direct Compose URL with Vanity fallback ──────────────
      if (!messageSuccessfullySent && vanity) {
        const directComposeUrl = `https://www.linkedin.com/messaging/compose/?recipient=${encodeURIComponent(vanity)}`;
        logger.info(`[MessagingService] Strategy 4: Navigating to direct compose URL: ${directComposeUrl}`);
        await page.goto(directComposeUrl, { waitUntil: 'domcontentloaded', timeout: 35_000 });
        await page.waitForTimeout(2000);

        const composer = await findVisibleComposerLocator(15000);
        if (composer) {
          const res = await typeAndSendMessageInComposer(composer);
          if (res.sent) {
            messageSuccessfullySent = true;
            sentThreadId = res.threadId;
          }
        }
      }

      if (!messageSuccessfullySent) {
        throw new Error(`Could not open active message composer for "${resolvedRecipientName}". Please verify that this user is a 1st-degree connection.`);
      }

      const finalThreadUrl = sentThreadId
        ? `https://www.linkedin.com/messaging/thread/${sentThreadId}/`
        : (resolvedProfileUrl || page.url());

      // Persist / update contact in database
      try {
        await ConnectionTrackingRepository.initTable();
        await ConnectionTrackingRepository.upsertContact({
          sender_user_id: options.user.id,
          recipient_name: resolvedRecipientName,
          recipient_vanity_name: vanity || null,
          recipient_profile_url: resolvedProfileUrl || (vanity ? `https://www.linkedin.com/in/${vanity}/` : null),
          status: 'accepted',
          accepted_at: new Date(),
          detected_via: 'message_send',
          meta_data: {
            threadId: sentThreadId || undefined,
            threadUrl: finalThreadUrl,
            lastSentMessage: message,
            lastMessageSentAt: new Date().toISOString(),
          },
        });
      } catch (dbErr) {
        logger.warn(`[MessagingService] Could not update DB after send: ${dbErr}`);
      }

      logger.info(`[MessagingService] Message successfully dispatched to "${resolvedRecipientName}". Thread: ${sentThreadId || 'active'}`);

      return {
        success: true,
        threadUrl: finalThreadUrl,
        threadId: sentThreadId || '',
        recipientName: resolvedRecipientName,
        replyText: message,
        message: `Successfully sent message to ${resolvedRecipientName}.`,
      };
    } catch (err: any) {
      logger.error(`[MessagingService] Error sending message to "${options.recipientName || profileUrl}":`, { error: err.message });
      return {
        success: false,
        threadUrl: profileUrl || '',
        threadId: '',
        recipientName: options.recipientName || vanity,
        replyText: message,
        error: err.message,
      };
    } finally {
      await browser.close();
    }
  }


  /**
   * Dynamically tracks and processes the top N recent conversations from LinkedIn Messaging (defaults to 10).
   * Navigates to the messaging inbox, scrolls and inspects each conversation card in the list,
   * detects the SPA URL transitions to extract dynamic thread IDs (2-...),
   * inspects the participant name, profile link, headline, presence status, last message, sender direction,
   * unread status, and any attached documents, and returns the top 10 chats in exact chronological order.
   */
  static async trackAndProcessRecentConversations(options: {
    user: LinkedInTestUser;
    limit?: number;
    headless?: boolean;
  }): Promise<TrackRecentConversationsResult> {
    const timestamp = new Date().toISOString();
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 30);
    const headless = options.headless !== undefined ? options.headless : true;

    logger.info(`[MessagingService] Tracking top ${limit} recent conversations for user "${options.user.username}"...`);

    const { browser, page } = await this.createAuthenticatedContext(options.user, headless);

    try {
      logger.info('[MessagingService] Navigating to LinkedIn Messaging inbox...');
      await page.goto('https://www.linkedin.com/messaging/', {
        waitUntil: 'domcontentloaded',
        timeout: 35_000,
      });
      await page.waitForTimeout(2500);

      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint')) {
        return {
          success: false,
          totalTracked: 0,
          conversations: [],
          error: 'Session expired or checkpoint triggered during inbox navigation.',
          timestamp,
        };
      }

      // Wait for conversation list to appear
      const listSelector = [
        '.msg-conversations-container__conversations-list',
        'ul.msg-conversations-container__conversations-list',
        'ul.msg-conversations-list',
        'li.msg-conversation-listitem',
      ].join(', ');

      try {
        await page.waitForSelector(listSelector, { timeout: 15_000 });
        logger.info('[MessagingService] Conversation list loaded successfully.');
      } catch {
        logger.warn('[MessagingService] Conversation list selector wait timed out, continuing scan...');
      }

      await page.waitForTimeout(1500);

      // Scroll sidebar progressively to un-occlude virtual list items up to limit
      for (let s = 0; s < 4; s++) {
        await page.evaluate(() => {
          const listScrollContainers = document.querySelectorAll(
            '.scaffold-layout__list.msg__list, .msg-conversations-container--inbox-shortcuts, ul.msg-conversations-container__conversations-list, .scaffold-layout__list'
          );
          listScrollContainers.forEach(el => {
            try {
              el.scrollBy(0, 400);
              el.scrollTop += 400;
            } catch {}
          });
        });
        await page.waitForTimeout(600);
      }

      // First pass: extract all available conversation card previews directly from the sidebar DOM
      const initialPreviews = await page.evaluate((maxCount) => {
        const items = Array.from(
          document.querySelectorAll('ul.msg-conversations-container__conversations-list > li.msg-conversation-listitem, li.msg-conversation-listitem, .msg-conversation-card')
        );

        const results: Array<{
          index: number;
          name: string;
          avatarUrl?: string;
          presenceStatus?: string;
          snippet: string;
          time: string;
          isSentByMe: boolean;
          isUnread: boolean;
          hasAttachment: boolean;
          cardThreadId?: string;
          cardProfileHref?: string;
        }> = [];

        items.forEach((el, index) => {
          if (results.length >= maxCount) return;

          const nameEl = el.querySelector(
            '.msg-conversation-listitem__participant-names span, .msg-conversation-listitem__participant-names, h3, .artdeco-entity-lockup__title'
          );
          const snippetEl = el.querySelector(
            '.msg-conversation-card__message-snippet, p.msg-conversation-card__message-snippet, p, .msg-conversation-listitem__message-snippet'
          );
          const timeEl = el.querySelector('time, .msg-conversation-listitem__time-stamp');
          const imgEl = el.querySelector('img.presence-entity__image, img.msg-facepile-grid__img, img') as HTMLImageElement | null;
          const statusOnline = el.querySelector('.presence-indicator--is-online');
          const statusReachable = el.querySelector('.presence-indicator--is-reachable');
          const linkEl = (el.querySelector('a[href*="/messaging/thread/"], a[href*="/in/"]') || (el.matches('a') ? el : null)) as HTMLAnchorElement | null;

          const name = (nameEl?.textContent || imgEl?.alt || '').replace(/\s+/g, ' ').trim();
          const snippet = (snippetEl?.textContent || '').replace(/\s+/g, ' ').trim();
          const time = (timeEl?.textContent || '').replace(/\s+/g, ' ').trim();

          const isSentByMe = snippet.startsWith('You:') || snippet.startsWith('You sent') || /^You\b/i.test(snippet);
          const isUnread = el.querySelector('.msg-conversation-card__unread-count, .t-bold') !== null;
          const hasAttachment = el.querySelector('[data-test-icon*="attachment"], svg[aria-label*="attachment"]') !== null ||
            snippet.toLowerCase().includes('attachment') || snippet.toLowerCase().includes('gif');

          let presenceStatus = 'offline';
          if (statusOnline) presenceStatus = 'online';
          else if (statusReachable) presenceStatus = 'reachable';

          let cardThreadId = '';
          const href = linkEl?.href || '';
          const threadMatch = href.match(/messaging\/thread\/(2-[a-zA-Z0-9_%-]+={0,2})/i);
          if (threadMatch) {
            cardThreadId = decodeURIComponent(threadMatch[1]);
          }

          if (name || snippet || cardThreadId) {
            results.push({
              index,
              name: name || 'LinkedIn User',
              avatarUrl: imgEl ? (imgEl.src || imgEl.getAttribute('data-delayed-url') || undefined) : undefined,
              presenceStatus,
              snippet,
              time: time || 'Recent',
              isSentByMe,
              isUnread,
              hasAttachment,
              cardThreadId: cardThreadId || undefined,
              cardProfileHref: href && href.includes('/in/') ? href : undefined,
            });
          }
        });

        return results;
      }, limit);

      logger.info(`[MessagingService] Scanned ${initialPreviews.length} conversation preview cards from inbox sidebar.`);

      const trackedConversations: TrackedConversation[] = [];
      const seenThreadIds = new Set<string>();

      // Locate clickable conversation card locators
      const conversationCardSelector = [
        'ul.msg-conversations-container__conversations-list > li.msg-conversation-listitem',
        'li.msg-conversation-listitem',
        '.msg-conversation-card',
      ].join(', ');

      const totalLocators = await page.locator(conversationCardSelector).count();
      const numToClick = Math.min(Math.max(initialPreviews.length, totalLocators), limit);

      for (let i = 0; i < numToClick; i++) {
        try {
          const preview = initialPreviews[i] || {
            name: 'LinkedIn User',
            snippet: '',
            time: 'Recent',
            isSentByMe: false,
            isUnread: false,
            hasAttachment: false,
            presenceStatus: 'offline',
          };

          const itemLocator = page.locator(conversationCardSelector).nth(i);
          const previousUrl = page.url();

          logger.info(`[MessagingService] Inspecting conversation #${i + 1}/${numToClick}: "${preview.name}"...`);

          // Click conversation item to trigger LinkedIn SPA URL transition
          try {
            if (await itemLocator.isVisible({ timeout: 1500 }).catch(() => false)) {
              await itemLocator.scrollIntoViewIfNeeded().catch(() => {});
              await itemLocator.click({ timeout: 2000 }).catch(() => {});
            }
          } catch {}

          // Wait for SPA URL to update to /messaging/thread/2-... or details pane to update
          try {
            await page.waitForFunction(
              (prev) => {
                const u = window.location.href;
                return (u.includes('/messaging/thread/2-') || u.includes('/messaging/thread/')) && u !== prev;
              },
              previousUrl,
              { timeout: 3500 }
            );
          } catch {
            // URL might already match active thread
          }

          await page.waitForTimeout(800);

          const activeUrl = page.url();
          let detectedThreadId = extractThreadId(activeUrl) || preview.cardThreadId || '';

          // If not in URL, check detail pane data attributes and event urns
          if (!detectedThreadId) {
            detectedThreadId = await page.evaluate(() => {
              const eventNodes = document.querySelectorAll('[data-event-urn*="2-"], [data-entity-urn*="2-"], a[href*="/messaging/thread/2-"]');
              for (const n of eventNodes) {
                const attr = n.getAttribute('data-event-urn') || n.getAttribute('data-entity-urn') || (n as HTMLAnchorElement).href || '';
                const m = attr.match(/(2-[a-zA-Z0-9_%-]+={0,2})/);
                if (m) return m[1];
              }
              return '';
            });
          }

          // Fallback thread ID generation based on index if LinkedIn SPA is in base view
          if (!detectedThreadId) {
            detectedThreadId = preview.cardThreadId || `thread-item-${i + 1}`;
          }

          if (seenThreadIds.has(detectedThreadId) && detectedThreadId.startsWith('2-')) {
            continue;
          }
          seenThreadIds.add(detectedThreadId);

          // Deep inspect the active detail pane for full participant info & attached documents
          const chatDetails = await page.evaluate(() => {
            const headerEl = document.querySelector(
              '.msg-title-bar__title, .msg-entity-lockup__entity-title, h2.msg-entity-lockup__entity-title, .msg-entity-lockup h2'
            );
            const participantName = (headerEl?.textContent || '').replace(/\s+/g, ' ').trim();

            const statusEl = document.querySelector('.msg-entity-lockup__presence-status, .msg-title-bar__user-status');
            const presenceStatusText = (statusEl?.textContent || '').replace(/\s+/g, ' ').trim();

            const profileLinkEl = document.querySelector(
              '.msg-title-bar a[href*="/in/"], .msg-thread__link-to-profile, .msg-entity-lockup a[href*="/in/"], .artdeco-entity-lockup__title a[href*="/in/"], a.msg-thread__profile-link, a[href*="/in/"]'
            ) as HTMLAnchorElement | null;
            const participantProfileUrl = profileLinkEl ? profileLinkEl.href : undefined;

            const headlineEl = document.querySelector(
              '.artdeco-entity-lockup__subtitle div[title], .artdeco-entity-lockup__subtitle, .msg-entity-lockup__entity-info'
            );
            const participantHeadline = headlineEl ? (headlineEl.getAttribute('title') || (headlineEl as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim() : undefined;

            const detailAvatarEl = document.querySelector(
              '.msg-title-bar img, .msg-s-profile-card img, .msg-entity-lockup img'
            ) as HTMLImageElement | null;
            const detailAvatarUrl = detailAvatarEl ? (detailAvatarEl.src || undefined) : undefined;

            const lastEventEl = document.querySelector(
              '.msg-s-message-list__event:last-child, li.msg-s-message-list__event:last-child'
            );
            const lastBodyEl = lastEventEl?.querySelector('.msg-s-event-listitem__body, p.msg-s-event-listitem__body') ||
              document.querySelector('.msg-s-event-listitem:last-child .msg-s-event-listitem__body');
            const lastMessageText = (lastBodyEl?.textContent || '').replace(/\s+/g, ' ').trim();

            let hasDoc = false;
            let docName: string | undefined = undefined;

            if (lastEventEl) {
              const docEl = lastEventEl.querySelector(
                '.msg-s-attachment__filename, .artdeco-entity-lockup__title, span[title], .msg-s-event-listitem__attachment-filename'
              );
              if (docEl) {
                const text = (docEl.textContent || '').trim();
                if (text && (/\.[a-zA-Z0-9]+$/i.test(text) || text.includes('.'))) {
                  hasDoc = true;
                  docName = text;
                }
              }
            }

            return {
              participantName,
              participantProfileUrl,
              participantHeadline,
              detailAvatarUrl,
              presenceStatusText,
              lastMessageText,
              hasDocument: hasDoc,
              documentFileName: docName,
            };
          });

          const finalParticipantName = chatDetails.participantName || preview.name || 'LinkedIn User';
          const finalProfileUrl = chatDetails.participantProfileUrl || preview.cardProfileHref || undefined;
          const finalAvatarUrl = chatDetails.detailAvatarUrl || preview.avatarUrl || undefined;
          const finalHeadline = chatDetails.participantHeadline || undefined;
          const finalLastMessage = chatDetails.lastMessageText || preview.snippet || '';
          const hasDocument = chatDetails.hasDocument || preview.hasAttachment;
          const documentFileName = chatDetails.documentFileName;

          const isSentByMe = preview.isSentByMe || finalLastMessage.startsWith('You:') || finalLastMessage.startsWith('You sent') || /^You\b/i.test(finalLastMessage);
          const sentBy: 'you' | 'other' = isSentByMe ? 'you' : 'other';

          const tracked: TrackedConversation = {
            order: trackedConversations.length + 1,
            threadId: detectedThreadId,
            threadUrl: detectedThreadId.startsWith('2-')
              ? `https://www.linkedin.com/messaging/thread/${detectedThreadId}/`
              : `https://www.linkedin.com/messaging/`,
            participantName: finalParticipantName,
            participantHeadline: finalHeadline,
            participantProfileUrl: finalProfileUrl,
            participantAvatarUrl: finalAvatarUrl,
            participantStatus: chatDetails.presenceStatusText || preview.presenceStatus || 'offline',
            lastMessageSnippet: finalLastMessage,
            timestamp: preview.time || 'Recent',
            isSentByMe,
            isViewer: isSentByMe,
            sentBy,
            isUnread: preview.isUnread,
            hasAttachment: hasDocument,
            hasDocument,
            documentFileName,
            detectedAt: new Date().toISOString(),
          };

          trackedConversations.push(tracked);
          logger.info(
            `[MessagingService] Tracked #${tracked.order}: ID="${tracked.threadId}", Name="${tracked.participantName}", SentBy="${tracked.sentBy}", LastMsg="${tracked.lastMessageSnippet.slice(0, 30)}..."`
          );

          if (trackedConversations.length >= limit) {
            break;
          }
        } catch (err: any) {
          logger.warn(`[MessagingService] Error processing conversation index ${i}: ${err.message}`);
        }
      }

      logger.info(`[MessagingService] Successfully tracked top ${trackedConversations.length} conversation(s).`);

      const activeThreadId = extractThreadId(page.url());

      return {
        success: true,
        totalTracked: trackedConversations.length,
        conversations: trackedConversations,
        activeThreadId: activeThreadId || undefined,
        activeThreadUrl: activeThreadId ? `https://www.linkedin.com/messaging/thread/${activeThreadId}/` : undefined,
        message: `Successfully detected and processed top ${trackedConversations.length} conversations dynamically.`,
        timestamp,
      };
    } catch (err: any) {
      logger.error('[MessagingService] Failed to track recent conversations:', { error: err.message });
      return {
        success: false,
        totalTracked: 0,
        conversations: [],
        error: err.message,
        timestamp,
      };
    } finally {
      await browser.close();
    }
  }

  /**
   * Generates a client-side JavaScript snippet that can be injected into any browser
   * running LinkedIn Messaging. Hooks HTML5 History API (pushState/replaceState) and
   * popstate events to automatically detect URL changes without full page reload,
   * extract the dynamic thread ID (2-...), and maintain the top 10 conversations.
   */
  static getClientSideObserverCode(): string {
    return `
(function initLinkedInConversationTracker() {
  const MAX_TRACKED = 10;
  window.__linkedInTrackedChats = window.__linkedInTrackedChats || [];

  function extractThreadId(url) {
    if (!url) return null;
    const match = url.match(/messaging\\/thread\\/(2-[^/?#]+)/i) ||
                  url.match(/messaging\\/thread\\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]).replace(/\\/$/, '') : null;
  }

  function handleUrlChange(newUrl) {
    const threadId = extractThreadId(newUrl);
    if (!threadId) return;

    // Wait slightly for DOM to update active conversation headers
    setTimeout(() => {
      const activeItem = document.querySelector('.msg-conversation-card--active, [aria-selected="true"], .msg-conversation-listitem');
      const headerEl = document.querySelector('.msg-title-bar__title, .msg-entity-lockup__entity-title, h2.msg-entity-lockup__entity-title');
      const participantName = (headerEl?.textContent || activeItem?.querySelector('.msg-conversation-listitem__participant-names')?.textContent || 'LinkedIn User').trim();

      const lastMsgEl = document.querySelector('.msg-s-message-list__event:last-child .msg-s-event-listitem__body')
        || activeItem?.querySelector('.msg-conversation-card__message-snippet');
      const snippet = (lastMsgEl?.textContent || '').trim();

      const docEl = document.querySelector('.msg-s-attachment__filename, .artdeco-entity-lockup__title');
      const docName = (docEl?.textContent || '').trim();

      const profileLinkEl = document.querySelector('.msg-title-bar a[href*="/in/"], .msg-thread__link-to-profile');
      const profileUrl = profileLinkEl ? profileLinkEl.href : undefined;

      const avatarEl = document.querySelector('.msg-title-bar img, .msg-conversation-card--active img');
      const avatarUrl = avatarEl ? avatarEl.src : undefined;

      const isSentByMe = snippet.startsWith('You:') || snippet.startsWith('You sent') || /^You\\b/i.test(snippet);

      const convo = {
        order: 1,
        threadId,
        threadUrl: 'https://www.linkedin.com/messaging/thread/' + threadId + '/',
        participantName,
        participantProfileUrl: profileUrl,
        participantAvatarUrl: avatarUrl,
        lastMessageSnippet: snippet,
        isSentByMe,
        isViewer: isSentByMe,
        sentBy: isSentByMe ? 'you' : 'other',
        hasAttachment: Boolean(docName) || snippet.toLowerCase().includes('attachment'),
        hasDocument: Boolean(docName),
        documentFileName: docName || undefined,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        detectedAt: new Date().toISOString()
      };

      // Maintain top 10 in LRU order: remove if duplicate, unshift to top
      window.__linkedInTrackedChats = window.__linkedInTrackedChats.filter(c => c.threadId !== threadId);
      window.__linkedInTrackedChats.unshift(convo);
      if (window.__linkedInTrackedChats.length > MAX_TRACKED) {
        window.__linkedInTrackedChats = window.__linkedInTrackedChats.slice(0, MAX_TRACKED);
      }
      window.__linkedInTrackedChats.forEach((c, idx) => { c.order = idx + 1; });

      console.log('🔔 [LinkedIn Tracker] Detected Chat (' + window.__linkedInTrackedChats.length + '/' + MAX_TRACKED + '):', convo);
      window.dispatchEvent(new CustomEvent('linkedin:chat_changed', { detail: { active: convo, list: window.__linkedInTrackedChats } }));
    }, 400);
  }

  // 1. Hook history.pushState (SPA navigation)
  const origPush = history.pushState;
  history.pushState = function(...args) {
    const res = origPush.apply(this, args);
    handleUrlChange(window.location.href);
    return res;
  };

  // 2. Hook history.replaceState
  const origReplace = history.replaceState;
  history.replaceState = function(...args) {
    const res = origReplace.apply(this, args);
    handleUrlChange(window.location.href);
    return res;
  };

  // 3. Listen to popstate (back/forward)
  window.addEventListener('popstate', () => handleUrlChange(window.location.href));

  // 4. Click delegation on conversation cards
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.closest('.msg-conversation-listitem, .msg-conversation-card, a[href*="/messaging/thread/"]')) {
      setTimeout(() => handleUrlChange(window.location.href), 350);
    }
  }, true);

  // Initial check
  handleUrlChange(window.location.href);
  console.log('✅ LinkedIn Dynamic Conversation Tracker initialized! Type window.__linkedInTrackedChats in console to view.');
})();
`;
  }
}
