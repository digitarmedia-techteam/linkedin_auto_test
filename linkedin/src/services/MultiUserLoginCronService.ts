import { chromium, type Browser } from 'playwright';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { TestUserRepository } from '../db/repositories/TestUserRepository.js';
import { LoggedInDetailsRepository } from '../db/repositories/LoggedInDetailsRepository.js';
import type { LinkedInTestUser, StorageStateData } from '../db/models/TestUser.js';
import type { LoggedInDetail, LoggedInDetailInput } from '../db/models/LoggedInDetail.js';
import { LoginPage } from '../pages/LoginPage.js';
import { FeedPage } from '../pages/FeedPage.js';

export interface UserCronResult {
  userId: number;
  username: string;
  status: 'success' | 'failed' | 'skipped';
  loginType: 'reused_existing_session' | 'fresh_login';
  cookiesCount: number;
  localStorageKeysCount: number;
  sessionStorageKeysCount: number;
  secretKeysFound: string[];
  totalDetailsUpserted: number;
  error?: string;
}

export interface CronExecutionResult {
  success: boolean;
  message: string;
  timestamp: string;
  totalTargetUsers: number;
  successfulLogins: number;
  failedLogins: number;
  results: UserCronResult[];
}

const SECRET_COOKIE_NAMES = ['li_at', 'JSESSIONID', 'bcookie', 'bscookie', 'liap', 'li_rm', 'dfpfpt'];

export const MultiUserLoginCronService = {
  /**
   * Executes the cron login task for all active test users where login_try = 1.
   * Each user is processed in a completely separate, isolated browser context.
   */
  async runCron(targetUserId?: number): Promise<CronExecutionResult> {
    const timestamp = new Date().toISOString();
    logger.info(`[CronService] Triggered cron login execution at ${timestamp}`);

    // Ensure database tables exist
    await TestUserRepository.initTable();
    await LoggedInDetailsRepository.initTable();

    // Fetch target users
    let users: LinkedInTestUser[] = [];
    if (targetUserId) {
      const single = await TestUserRepository.getUserById(targetUserId);
      if (single && single.status === 'active') {
        users = [single];
      }
    } else {
      users = await TestUserRepository.getUsersToLogin();
    }

    if (users.length === 0) {
      logger.warn('[CronService] No active test users with login_try = 1 found');
      return {
        success: true,
        message: 'No users found with login_try = 1',
        timestamp,
        totalTargetUsers: 0,
        successfulLogins: 0,
        failedLogins: 0,
        results: [],
      };
    }

    logger.info(`[CronService] Found ${String(users.length)} target user(s) with login_try = 1 to authenticate`);

    const browser = await chromium.launch({
      headless: config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const results: UserCronResult[] = [];

    try {
      // Process each user sequentially in an isolated browser context
      for (const user of users) {
        logger.info(`[CronService] >>> Processing User ID ${String(user.id)} (${user.username})`);
        const userResult = await this.authenticateUserInIsolatedContext(browser, user);
        results.push(userResult);
      }
    } finally {
      await browser.close();
    }

    const successfulLogins = results.filter((r) => r.status === 'success').length;
    const failedLogins = results.filter((r) => r.status === 'failed').length;

    logger.info(
      `[CronService] Cron completed: ${String(successfulLogins)} succeeded, ${String(failedLogins)} failed out of ${String(users.length)} users`,
    );

    return {
      success: failedLogins === 0,
      message: `Completed processing ${String(users.length)} users. Succeeded: ${String(successfulLogins)}, Failed: ${String(failedLogins)}`,
      timestamp,
      totalTargetUsers: users.length,
      successfulLogins,
      failedLogins,
      results,
    };
  },

  /**
   * Directly authenticates a single user (and captures all details)
   * with custom options (headless mode, forceFresh, etc.).
   */
  async loginAndCaptureUser(
    user: LinkedInTestUser,
    options?: { headless?: boolean; forceFresh?: boolean },
  ): Promise<{
    userResult: UserCronResult;
    details: LoggedInDetail[];
    secrets: Record<string, string>;
  }> {
    // Ensure database tables exist
    await TestUserRepository.initTable();
    await LoggedInDetailsRepository.initTable();

    const isHeadless = options?.headless !== undefined ? options.headless : config.headless;
    logger.info(`[CronService] Launching browser for direct login (headless = ${String(isHeadless)})`);

    const browser = await chromium.launch({
      headless: isHeadless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const userResult = await this.authenticateUserInIsolatedContext(browser, user, {
        forceFresh: options?.forceFresh ?? true,
      });

      const details = await LoggedInDetailsRepository.getDetailsByUserId(user.id);
      const secrets = await LoggedInDetailsRepository.getSecretTokens(user.id);

      return {
        userResult,
        details,
        secrets,
      };
    } finally {
      await browser.close();
    }
  },

  /**
   * Authenticates an individual user in a distinct browser context
   * and extracts all cookies, localStorage, sessionStorage, and secret keys.
   */
  async authenticateUserInIsolatedContext(
    browser: Browser,
    user: LinkedInTestUser,
    options?: { forceFresh?: boolean },
  ): Promise<UserCronResult> {
    // Isolated environment for this user
    const context = await browser.newContext({
      baseURL: config.baseUrl,
      userAgent: user.user_agent ?? undefined,
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();
    page.setDefaultTimeout(240_000); // 4 minutes to allow 3-minute OTP entry
    page.setDefaultNavigationTimeout(240_000);
    const loginPage = new LoginPage(page);
    const feedPage = new FeedPage(page);

    let loginType: 'reused_existing_session' | 'fresh_login' = 'fresh_login';

    try {
      let sessionValid = false;

      // 1. Try reusing existing session from DB (unless forceFresh is specified)
      if (!options?.forceFresh && user.storage_state_json) {
        try {
          const parsed = JSON.parse(user.storage_state_json) as StorageStateData;
          if (parsed.cookies && parsed.cookies.length > 0) {
            await context.addCookies(parsed.cookies);
            logger.info(`[CronService] [User ${String(user.id)}] Injected saved DB cookies → validating on feed`);

            await page.goto('/feed', { waitUntil: 'domcontentloaded', timeout: 25_000 });
            await Promise.race([
              page.waitForURL('**/feed/**', { timeout: 8_000 }).catch(() => null),
              feedPage.assertIsVisible().catch(() => null),
            ]);

            const currentUrl = page.url();
            const feedVisible = await feedPage.isVisible();
            if (currentUrl.includes('/feed') || feedVisible) {
              sessionValid = true;
              loginType = 'reused_existing_session';
              logger.info(`[CronService] [User ${String(user.id)}] Session valid! Reused without re-login.`);
            }
          }
        } catch (err) {
          logger.warn(`[CronService] [User ${String(user.id)}] Could not validate existing session`, {
            error: (err as Error).message,
          });
        }
      }

      // 2. Perform fresh login if session is invalid or missing
      if (!sessionValid) {
        logger.info(`[CronService] [User ${String(user.id)}] Performing fresh login for ${user.username}`);
        await loginPage.open(user);
        await loginPage.login(user.username, user.password);
        await loginPage.waitForSuccessfulLogin(user);
        loginType = 'fresh_login';
        logger.info(`[CronService] [User ${String(user.id)}] Fresh login completed successfully.`);
      }

      // 3. Extract all context information, cookies, localStorage, sessionStorage, and secret keys
      const cookies = await context.cookies();
      const storageState = (await context.storageState()) as StorageStateData;
      const userAgent = await page.evaluate<string>('navigator.userAgent');
      const currentUrl = page.url();

      const localStorageMap = await page.evaluate<Record<string, string>>(`(() => {
        const out = {};
        try {
          for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k !== null) {
              out[k] = window.localStorage.getItem(k) || '';
            }
          }
        } catch (e) {}
        return out;
      })()`);

      const sessionStorageMap = await page.evaluate<Record<string, string>>(`(() => {
        const out = {};
        try {
          for (let i = 0; i < window.sessionStorage.length; i++) {
            const k = window.sessionStorage.key(i);
            if (k !== null) {
              out[k] = window.sessionStorage.getItem(k) || '';
            }
          }
        } catch (e) {}
        return out;
      })()`);

      // 4. Transform into key-value records for loggedin_details
      const detailsToUpsert: LoggedInDetailInput[] = [];
      const secretKeysFound: string[] = [];

      // A. Individual Cookies
      for (const cookie of cookies) {
        const isSecret = SECRET_COOKIE_NAMES.includes(cookie.name);
        if (isSecret) {
          secretKeysFound.push(cookie.name);
        }

        detailsToUpsert.push({
          user_id: user.id,
          data_category: 'cookie',
          data_key: `cookie:${cookie.name}`,
          data_value: cookie.value,
          is_secret: isSecret,
          extra_metadata: {
            domain: cookie.domain,
            path: cookie.path,
            expires: cookie.expires,
            httpOnly: cookie.httpOnly,
            secure: cookie.secure,
            sameSite: cookie.sameSite,
          },
        });
      }

      // B. Dedicated Secret Key entries for primary auth tokens
      const liAt = cookies.find((c) => c.name === 'li_at');
      if (liAt) {
        detailsToUpsert.push({
          user_id: user.id,
          data_category: 'secret_key',
          data_key: 'secret:li_at',
          data_value: liAt.value,
          is_secret: true,
          extra_metadata: { expires: liAt.expires, domain: liAt.domain },
        });
      }

      const jsessionId = cookies.find((c) => c.name === 'JSESSIONID');
      if (jsessionId) {
        // Clean quotes from JSESSIONID if present: e.g. "ajax:12345" -> ajax:12345
        const cleanCsrf = jsessionId.value.replace(/^"|"$/g, '');
        detailsToUpsert.push({
          user_id: user.id,
          data_category: 'secret_key',
          data_key: 'secret:csrf_token',
          data_value: cleanCsrf,
          is_secret: true,
        });
      }

      // C. Local Storage key-value pairs
      for (const [key, value] of Object.entries(localStorageMap)) {
        detailsToUpsert.push({
          user_id: user.id,
          data_category: 'local_storage',
          data_key: `local_storage:${key}`,
          data_value: value,
          is_secret: false,
        });
      }

      // D. Session Storage key-value pairs
      for (const [key, value] of Object.entries(sessionStorageMap)) {
        detailsToUpsert.push({
          user_id: user.id,
          data_category: 'session_storage',
          data_key: `session_storage:${key}`,
          data_value: value,
          is_secret: false,
        });
      }

      // E. Aggregated full state bundles
      detailsToUpsert.push({
        user_id: user.id,
        data_category: 'full_state',
        data_key: 'all_cookies_json',
        data_value: JSON.stringify(cookies),
        is_secret: true,
      });

      detailsToUpsert.push({
        user_id: user.id,
        data_category: 'full_state',
        data_key: 'all_local_storage_json',
        data_value: JSON.stringify(localStorageMap),
        is_secret: false,
      });

      detailsToUpsert.push({
        user_id: user.id,
        data_category: 'full_state',
        data_key: 'all_session_storage_json',
        data_value: JSON.stringify(sessionStorageMap),
        is_secret: false,
      });

      detailsToUpsert.push({
        user_id: user.id,
        data_category: 'full_state',
        data_key: 'playwright_storage_state',
        data_value: JSON.stringify(storageState),
        is_secret: true,
      });

      // F. Session Metadata
      detailsToUpsert.push({
        user_id: user.id,
        data_category: 'session_meta',
        data_key: 'user_agent',
        data_value: userAgent,
        is_secret: false,
      });

      detailsToUpsert.push({
        user_id: user.id,
        data_category: 'session_meta',
        data_key: 'current_url',
        data_value: currentUrl,
        is_secret: false,
      });

      detailsToUpsert.push({
        user_id: user.id,
        data_category: 'session_meta',
        data_key: 'last_login_at',
        data_value: new Date().toISOString(),
        is_secret: false,
      });

      // 5. Upsert all details into loggedin_details table
      await LoggedInDetailsRepository.batchUpsertDetails(detailsToUpsert);

      // 6. Update linkedin_test_users with session success
      await TestUserRepository.saveUserSession(user.id, storageState, userAgent);

      logger.info(
        `[CronService] [User ${String(user.id)}] Successfully saved ${String(detailsToUpsert.length)} keys into loggedin_details`,
      );

      return {
        userId: user.id,
        username: user.username,
        status: 'success',
        loginType,
        cookiesCount: cookies.length,
        localStorageKeysCount: Object.keys(localStorageMap).length,
        sessionStorageKeysCount: Object.keys(sessionStorageMap).length,
        secretKeysFound,
        totalDetailsUpserted: detailsToUpsert.length,
      };
    } catch (err) {
      const errorMsg = (err as Error).message;
      logger.error(`[CronService] [User ${String(user.id)}] Login failed: ${errorMsg}`);
      await TestUserRepository.recordLoginFailure(user.id, 'failed', errorMsg);

      return {
        userId: user.id,
        username: user.username,
        status: 'failed',
        loginType,
        cookiesCount: 0,
        localStorageKeysCount: 0,
        sessionStorageKeysCount: 0,
        secretKeysFound: [],
        totalDetailsUpserted: 0,
        error: errorMsg,
      };
    } finally {
      // Close context to free resources and ensure isolation
      await context.close();
    }
  },

  /**
   * Validates whether a user's stored session in the database is currently active and valid.
   * Performs a fast timestamp check, and optionally a headless browser check against LinkedIn feed.
   */
  async validateUserSession(
    user: LinkedInTestUser,
    options?: { deepCheck?: boolean; headless?: boolean },
  ): Promise<{
    isValid: boolean;
    reason?: string;
    user: LinkedInTestUser;
    sessionMeta?: {
      cookiesCount: number;
      liAtExpires?: number | null;
      lastLoginAt?: Date | null;
    };
  }> {
    if (!user.storage_state_json) {
      return { isValid: false, reason: 'no_stored_session', user };
    }

    let parsedState: StorageStateData;
    try {
      parsedState = JSON.parse(user.storage_state_json) as StorageStateData;
    } catch {
      return { isValid: false, reason: 'corrupted_session_json', user };
    }

    const cookies = parsedState.cookies ?? [];
    const liAt = cookies.find((c) => c.name === 'li_at');
    if (!liAt || !liAt.value) {
      return { isValid: false, reason: 'missing_li_at_token', user };
    }

    // Fast check: cookie expiration timestamp
    if (typeof liAt.expires === 'number' && liAt.expires > 0) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (liAt.expires <= nowSeconds) {
        logger.info(`[CronService] [User ${String(user.id)}] Stored li_at token expired at ${new Date(liAt.expires * 1000).toISOString()}`);
        await TestUserRepository.updateSessionStatus(user.id, 'expired', 'Session cookie has expired');
        return { isValid: false, reason: 'session_cookie_expired', user };
      }
    }

    // If deepCheck is false, fast check passed
    if (options?.deepCheck === false) {
      return {
        isValid: true,
        user,
        sessionMeta: {
          cookiesCount: cookies.length,
          liAtExpires: liAt.expires ?? null,
          lastLoginAt: user.last_login_at,
        },
      };
    }

    // Deep check: launch lightweight headless context to confirm feed redirect
    logger.info(`[CronService] [User ${String(user.id)}] Performing deep session validation on LinkedIn feed...`);
    const browser = await chromium.launch({
      headless: options?.headless !== undefined ? options.headless : true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const context = await browser.newContext({
        baseURL: config.baseUrl,
        userAgent: user.user_agent ?? undefined,
      });
      await context.addCookies(cookies);

      const page = await context.newPage();
      const feedPage = new FeedPage(page);

      await page.goto('/feed', { waitUntil: 'domcontentloaded', timeout: 25_000 });
      await Promise.race([
        page.waitForURL('**/feed/**', { timeout: 8_000 }).catch(() => null),
        feedPage.assertIsVisible().catch(() => null),
      ]);

      const currentUrl = page.url();
      const feedVisible = await feedPage.isVisible();

      if (currentUrl.includes('/checkpoint') || currentUrl.includes('/challenge')) {
        logger.warn(`[CronService] [User ${String(user.id)}] Security checkpoint encountered during validation`);
        await TestUserRepository.updateSessionStatus(user.id, 'checkpoint', 'Security challenge or checkpoint detected');
        await context.close();
        return { isValid: false, reason: 'checkpoint', user };
      }

      if (
        currentUrl.includes('/login') ||
        currentUrl.includes('/authwall') ||
        currentUrl.includes('/uas/login') ||
        currentUrl.includes('/signup')
      ) {
        logger.info(`[CronService] [User ${String(user.id)}] LinkedIn redirected to login — session invalid/expired`);
        await TestUserRepository.updateSessionStatus(user.id, 'expired', 'Session invalidated by LinkedIn');
        await context.close();
        return { isValid: false, reason: 'session_rejected', user };
      }

      if (currentUrl.includes('/feed') || feedVisible) {
        logger.info(`[CronService] [User ${String(user.id)}] Session valid! Confirmed access to feed.`);
        await TestUserRepository.updateSessionStatus(user.id, 'success');
        await context.close();
        return {
          isValid: true,
          user,
          sessionMeta: {
            cookiesCount: cookies.length,
            liAtExpires: liAt.expires ?? null,
            lastLoginAt: user.last_login_at,
          },
        };
      }

      await context.close();
      return { isValid: false, reason: 'unexpected_page_state', user };
    } catch (err) {
      logger.warn(`[CronService] [User ${String(user.id)}] Error during session validation: ${(err as Error).message}`);
      return { isValid: false, reason: (err as Error).message, user };
    } finally {
      await browser.close();
    }
  },
};
