import { test as setup } from '@playwright/test';
import { AuthenticationService } from '../../src/services/AuthenticationService.js';
import { TestUserRepository } from '../../src/db/repositories/TestUserRepository.js';
import type { LinkedInTestUser } from '../../src/db/models/TestUser.js';
import { logger } from '../../src/utils/logger.js';

/**
 * Global setup: authenticate and save Playwright storage state.
 *
 * Reads test users from MySQL table `linkedin_test_users` where `login_try = 1`.
 * - If saved session exists in DB, validates and reuses it (no credentials input needed).
 * - If session is missing or expired, performs login and saves session back to DB table.
 * - If multiple users have `login_try = 1`, ensures each target user is authenticated.
 */
setup('authenticate and save state for target users', async ({ browser, context }) => {
  setup.setTimeout(180_000); // 3 min — allows time if manual CAPTCHA/MFA is needed
  logger.info('[setup] Starting global auth setup with DB-backed users.');

  let targetUsers: LinkedInTestUser[] = [];
  try {
    targetUsers = await TestUserRepository.getUsersToLogin();
    logger.info(`[setup] Found ${String(targetUsers.length)} user(s) in DB with login_try = 1`);
  } catch (err) {
    logger.warn('[setup] Could not query DB for users, falling back to default', {
      error: (err as Error).message,
    });
  }

  if (targetUsers.length === 0) {
    // Fallback: single user from env
    const authService = new AuthenticationService(context);
    await authService.ensureAuthenticated();
  } else {
    // Authenticate primary user in main test context
    const primaryUser = targetUsers[0];
    logger.info(`[setup] Authenticating primary user: ${primaryUser.username}`);
    const primaryAuthService = new AuthenticationService(context);
    await primaryAuthService.ensureAuthenticated(primaryUser);

    // If multiple users have login_try = 1, authenticate the remaining users in isolated contexts
    for (let i = 1; i < targetUsers.length; i++) {
      const user = targetUsers[i];

      logger.info(
        `[setup] Authenticating additional target user ${String(i + 1)}/${String(targetUsers.length)}: ${user.username}`,
      );
      const extraContext = await browser.newContext();
      try {
        const extraAuthService = new AuthenticationService(extraContext);
        await extraAuthService.ensureAuthenticated(user);
      } finally {
        await extraContext.close();
      }
    }
  }

  logger.info('[setup] All target users with login_try = 1 processed. Tests may now reuse session.');
});
