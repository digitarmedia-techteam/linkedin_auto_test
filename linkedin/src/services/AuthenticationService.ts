import type { Browser, BrowserContext, Page } from 'playwright';
import { LoginPage } from '../pages/LoginPage.js';
import { FeedPage } from '../pages/FeedPage.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AUTH_STATE_PATH } from '../config/constants.js';
import { TestUserRepository } from '../db/repositories/TestUserRepository.js';
import type {
  LinkedInTestUser,
  StorageStateData,
  StorageStateCookie,
} from '../db/models/TestUser.js';
import { existsSync, readFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * AuthenticationService — Service Layer.
 * Owns business logic for login, database-backed test user selection, and session lifecycle.
 *
 * Implements:
 * 1. Checks MySQL database table `linkedin_test_users` for users marked with `login_try = 1`.
 * 2. If saved storage state/cookies exist in the database, injects them and validates session.
 *    If valid: skips login entirely ("next time not need to input anything").
 * 3. If session is missing or expired, performs fresh login using credentials from the DB record.
 * 4. After reaching feed, persists storageState, cookies, li_at token, and metadata back into the DB table.
 */
export class AuthenticationService {
  private loginPage!: LoginPage;
  private feedPage!: FeedPage;
  private page!: Page;
  private pageReady: Promise<void>;

  constructor(private readonly context: BrowserContext) {
    this.pageReady = this.initPage();
  }

  private async initPage(): Promise<void> {
    const existing = this.context.pages().at(0);
    this.page = existing ?? (await this.context.newPage());
    this.loginPage = new LoginPage(this.page);
    this.feedPage = new FeedPage(this.page);
  }

  /**
   * Main authentication orchestration method.
   *
   * @param targetUser Optional specific user from `linkedin_test_users`.
   *                   If omitted, automatically loads active user(s) where `login_try = 1`.
   */
  async ensureAuthenticated(targetUser?: LinkedInTestUser): Promise<boolean> {
    await this.pageReady;

    // 1. Resolve user from database or fallback to env
    const user = targetUser ?? (await this.resolveTargetUser());
    logger.info(`[AuthService] Target user for authentication: ${user.username} (login_try = ${String(user.login_try)})`);

    // 2. Try restoring session from DB storage_state_json first
    if (user.storage_state_json) {
      logger.info(`[AuthService] Found saved session in DB for ${user.username} → restoring into browser context`);
      await this.restoreStateFromJson(user.storage_state_json);

      const isValid = await this.validateSession();
      if (isValid) {
        logger.info(`[AuthService] Session valid for ${user.username} → SKIPPING login (no input needed)`);
        if (user.id) {
          try {
            const state = JSON.parse(user.storage_state_json) as StorageStateData;
            await TestUserRepository.saveUserSession(user.id, state);
          } catch {
            // non-blocking
          }
        }
        await this.syncLocalAuthState(user.storage_state_json);
        return true;
      }

      logger.info(`[AuthService] DB session for ${user.username} expired/invalid → proceeding to fresh login`);
    } else if (AuthenticationService.hasSavedState()) {
      // Fallback: Check local storage/auth.json
      logger.info('[AuthService] Local session found in file → validating');
      await this.restoreStateFromLocalFile();

      const isValid = await this.validateSession();
      if (isValid) {
        logger.info('[AuthService] Local file session valid → skipping login');
        return true;
      }
      logger.info('[AuthService] Local session expired → proceeding to fresh login');
    } else {
      logger.info(`[AuthService] No saved session found for ${user.username} → starting fresh login`);
    }

    // 3. Perform fresh login flow using user credentials
    try {
      await this.login(user.username, user.password);

      // 4. Extract storage state and persist into MySQL linkedin_test_users
      const storageState = await this.context.storageState();
      let userAgent: string | undefined;
      try {
        userAgent = await this.page.evaluate<string>('navigator.userAgent');
      } catch {
        // non-blocking
      }

      if (user.id) {
        await TestUserRepository.saveUserSession(user.id, storageState, userAgent);
        logger.info(`[AuthService] Successfully persisted session to DB table linkedin_test_users for user ${user.username}`);
      }

      // Also persist to local file for compatibility
      await this.saveState();
      return true;
    } catch (err) {
      if (user.id) {
        await TestUserRepository.recordLoginFailure(
          user.id,
          'failed',
          (err as Error).message,
        );
      }
      throw err;
    }
  }

  /**
   * Resolves the user to authenticate:
   * First looks in MySQL for active user with `login_try = 1`.
   * If none found or DB unavailable, falls back to config from .env.
   */
  private async resolveTargetUser(): Promise<LinkedInTestUser> {
    try {
      const candidates = await TestUserRepository.getUsersToLogin();
      if (candidates.length > 0) {
        return candidates[0];
      }
      logger.warn('[AuthService] No users with login_try = 1 found in DB. Falling back to env credentials.');
    } catch (err) {
      logger.warn('[AuthService] Could not fetch target user from DB, falling back to env.', {
        error: (err as Error).message,
      });
    }

    return {
      id: 0,
      username: config.username,
      password: config.password,
      login_try: 1,
      status: 'active',
      storage_state_json: null,
      session_cookies_json: null,
      li_at_token: null,
      user_agent: null,
      two_factor_secret: null,
      proxy: null,
      last_login_at: null,
      last_login_status: 'never_attempted',
      last_error: null,
      login_count: 0,
      meta_data: { fallback: true },
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  /**
   * Authenticates all users that have `login_try = 1` in the database.
   * Useful when multiple users are configured and need their sessions primed.
   */
  static async authenticateAllTargetUsers(browser: Browser): Promise<LinkedInTestUser[]> {
    const targetUsers = await TestUserRepository.getUsersToLogin();
    logger.info(`[AuthService] Found ${String(targetUsers.length)} user(s) with login_try = 1`);

    for (const user of targetUsers) {
      logger.info(`[AuthService] Authenticating target user: ${user.username} (ID: ${String(user.id)})`);
      const context = await browser.newContext();
      try {
        const auth = new AuthenticationService(context);
        await auth.ensureAuthenticated(user);
      } finally {
        await context.close();
      }
    }

    return targetUsers;
  }

  /**
   * Injects cookies and origins from a JSON storage state string into browser context.
   */
  private async restoreStateFromJson(storageStateJson: string): Promise<void> {
    try {
      const state = JSON.parse(storageStateJson) as StorageStateData;
      if (state.cookies && Array.isArray(state.cookies) && state.cookies.length > 0) {
        await this.context.addCookies(state.cookies);
      }
    } catch (err) {
      logger.warn('[AuthService] Could not parse DB storage_state_json', {
        error: (err as Error).message,
      });
    }
  }

  /**
   * Injects saved storageState cookies from local file into the browser context.
   */
  private async restoreStateFromLocalFile(): Promise<void> {
    try {
      if (existsSync(AUTH_STATE_PATH)) {
        const raw = readFileSync(AUTH_STATE_PATH, 'utf-8');
        await this.restoreStateFromJson(raw);
      }
    } catch (err) {
      logger.warn('[AuthService] Could not restore saved cookies from local file.', {
        error: (err as Error).message,
      });
    }
  }

  /**
   * Syncs the DB session state string into the local file storage/auth.json.
   */
  private async syncLocalAuthState(storageStateJson: string): Promise<void> {
    try {
      mkdirSync(dirname(AUTH_STATE_PATH), { recursive: true });
      const fs = await import('fs/promises');
      await fs.writeFile(AUTH_STATE_PATH, storageStateJson, 'utf-8');
    } catch {
      // non-critical
    }
  }

  /**
   * Validates whether the active context has access to the authenticated LinkedIn Feed.
   */
  async validateSession(): Promise<boolean> {
    await this.pageReady;

    try {
      await this.page.goto('/feed', {
        waitUntil: 'domcontentloaded',
        timeout: 25_000,
      });

      await Promise.race([
        this.page.waitForURL('**/feed/**', { timeout: 8_000 }).catch(() => null),
        this.feedPage.assertIsVisible().catch(() => null),
      ]);

      const currentUrl = this.page.url();
      logger.info(`[AuthService] Session check at URL: ${currentUrl}`);

      if (currentUrl.includes('/checkpoint') || currentUrl.includes('/challenge')) {
        logger.info(
          '[AuthService] Security challenge / CAPTCHA detected. Please complete the verification in the browser window (waiting up to 120s)...',
        );
        try {
          await this.page.waitForURL('**/feed/**', { timeout: 120_000 });
          logger.info('[AuthService] Challenge resolved — redirected to feed.');
          await this.saveState();
          return true;
        } catch {
          return false;
        }
      }

      if (
        currentUrl.includes('/login') ||
        currentUrl.includes('/authwall') ||
        currentUrl.includes('/uas/login') ||
        currentUrl.includes('/signup')
      ) {
        return false;
      }

      if (currentUrl.includes('/feed')) {
        return true;
      }

      const feedVisible = await this.feedPage.isVisible();
      if (feedVisible) {
        return true;
      }

      const cookies = await this.context.cookies();
      const hasLiAt = cookies.some((c) => c.name === 'li_at');
      return hasLiAt && !currentUrl.includes('/login');
    } catch (err) {
      logger.warn('[AuthService] Error occurred during session validation.', {
        error: (err as Error).message,
      });
      return false;
    }
  }

  /**
   * Perform a full UI login flow using specified credentials (or fallback to env).
   */
  async login(username?: string, password?: string): Promise<void> {
    await this.pageReady;
    const loginUser = username ?? config.username;
    const loginPass = password ?? config.password;

    logger.info('[AuthService] Starting login flow.', { username: loginUser });
    await this.loginPage.open();
    await this.loginPage.login(loginUser, loginPass);
    await this.loginPage.waitForSuccessfulLogin();
    logger.info('[AuthService] Login completed successfully.', { username: loginUser });
  }

  /**
   * Returns true if the current context appears to be authenticated on the feed.
   */
  async isAuthenticated(): Promise<boolean> {
    await this.pageReady;
    const result = await this.feedPage.isVisible();
    logger.info('[AuthService] Authentication check.', { isAuthenticated: result });
    return result;
  }

  /**
   * Save current browser context's storage state to storage/auth.json.
   */
  async saveState(): Promise<void> {
    try {
      mkdirSync(dirname(AUTH_STATE_PATH), { recursive: true });
      await this.context.storageState({ path: AUTH_STATE_PATH });
      logger.info('Login successful → session persisted to disk', { path: AUTH_STATE_PATH });
    } catch (err) {
      logger.error('[AuthService] Failed to save authentication state to disk.', {
        error: (err as Error).message,
      });
      throw err;
    }
  }

  /**
   * Checks if local auth state exists and has an unexpired li_at cookie.
   */
  static hasSavedState(): boolean {
    if (!existsSync(AUTH_STATE_PATH)) {
      return false;
    }
    try {
      const raw = readFileSync(AUTH_STATE_PATH, 'utf-8');
      const state = JSON.parse(raw) as StorageStateData;
      if (!state.cookies || !Array.isArray(state.cookies) || state.cookies.length === 0) {
        return false;
      }
      const liAt = state.cookies.find((c: StorageStateCookie) => c.name === 'li_at');
      if (!liAt) {
        return false;
      }
      if (typeof liAt.expires === 'number' && liAt.expires > 0) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (liAt.expires <= nowSeconds) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }
}
