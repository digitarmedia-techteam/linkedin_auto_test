import type { Page } from 'playwright';
import { logger } from '../utils/logger.js';
import { NAV_AVATAR_SELECTOR, FEED_SELECTOR } from '../config/constants.js';
import { AuthenticationError } from '../utils/errors.js';
import { OtpChallengeService } from '../services/OtpChallengeService.js';

/**
 * LoginPage — Page Object.
 * Handles navigation and UI interaction only; no business logic.
 *
 * Locators target real LinkedIn login page structure.
 * If LinkedIn presents a CAPTCHA or security challenge, the test will
 * timeout — manual intervention is required.
 */
export class LoginPage {
  constructor(private readonly page: Page) {}

  // ── Locators ──────────────────────────────────────────────────────────────
  // LinkedIn renders inputs inside JS containers (no <form> element).
  // Use accessible label/role locators — they target the visible, interactable elements.
  // LinkedIn renders TWO copies of the form: a hidden one (first in DOM)
  // and the visible one (second). Using .last() targets the visible instance.
  private get usernameInput() { return this.page.getByLabel('Email or phone').last(); }
  // getByLabel('Password').last() resolves to the "Show password" button.
  // Target the password <input> directly by autocomplete attribute.
  private get passwordInput() { return this.page.locator('input[autocomplete="current-password"]').last(); }
  // The Sign in button has NO type="submit" attribute — use role+name.
  private get submitButton() { return this.page.getByRole('button', { name: 'Sign in' }).last(); }
  private get errorBanner() { return this.page.locator('[role="alert"], .error-message').first(); }

  /** Navigate to the login page. */
  async open(user?: { id?: number; username: string }): Promise<void> {
    logger.info('[LoginPage] Navigating to login page.');
    await this.page.goto('/login', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    // Check if already on feed
    if (this.page.url().includes('/feed')) {
      logger.info('[LoginPage] Already authenticated — redirected to feed.');
      return;
    }

    // Race: either LinkedIn redirects to /feed/ (authenticated) or the email input appears
    const result = await Promise.race([
      this.page
        .waitForURL('**/feed/**', { timeout: 15_000 })
        .then(() => 'feed' as const)
        .catch(() => null),
      this.usernameInput
        .waitFor({ state: 'visible', timeout: 15_000 })
        .then(() => 'login' as const)
        .catch(() => null),
    ]);

    if (result === 'feed' || this.page.url().includes('/feed')) {
      logger.info('[LoginPage] Already authenticated — redirected to feed.');
      return;
    }

    const currentUrl = this.page.url();
    if (currentUrl.includes('/checkpoint') || currentUrl.includes('/challenge')) {
      logger.info(
        `[LoginPage] Security challenge detected on navigation (${currentUrl}). Triggering verification flow...`,
      );
      await this.handleSmsVerification(user);
      return;
    }

    if (!result) {
      if (this.page.url().includes('/feed')) return;
      // Re-check username input visibility
      await this.usernameInput.waitFor({ state: 'visible', timeout: 5_000 });
    }
  }

  /**
   * Fill username and password fields and submit.
   * Password is accepted as a parameter but is NEVER logged.
   */
  async login(username: string, password: string): Promise<void> {
    if (this.page.url().includes('/feed')) {
      logger.info('[LoginPage] Already authenticated on feed — skipping form submission.');
      return;
    }

    logger.info('[LoginPage] Filling login form.', { username });

    await this.usernameInput.click();
    await this.usernameInput.fill(username);
    // Tab out of username to trigger blur/validation and commit React state
    await this.page.keyboard.press('Tab');

    await this.passwordInput.click();
    await this.passwordInput.fill(password);
    // Tab out of password to commit value
    await this.page.keyboard.press('Tab');

    await this.page.waitForTimeout(300);
    await this.submitButton.click();
  }

  /**
   * Wait until the application shows a post-login indicator.
   * Throws AuthenticationError on timeout.
   */
  /**
   * Wait until the application shows a post-login indicator or handles a 2FA challenge.
   * Throws AuthenticationError on timeout.
   */
  async waitForSuccessfulLogin(user?: { id?: number; username: string }): Promise<void> {
    if (this.page.url().includes('/feed')) {
      logger.info('[LoginPage] Already on feed — login successful.');
      return;
    }

    logger.info('[LoginPage] Waiting for post-login destination (feed or checkpoint challenge)...');

    // Broad set of challenge and PIN input selectors
    const challengeIndicatorSelector = [
      '#try-another-way',
      'a:has-text("Verify using SMS")',
      'button#two-step-submit-button',
      'input[name="pin"]',
      'input#input__phone_verification_pin',
      'input#input__email_verification_pin',
      'input#two-step-verification-code',
      'input[name="verificationCode"]',
      'input[name="code"]',
      'input[placeholder*="code" i]',
      'input[placeholder*="pin" i]',
      'input[aria-label*="code" i]',
      'input[aria-label*="pin" i]',
      'input[type="tel"]',
      'button:has-text("Submit code")',
      'button:has-text("Verify")',
    ].join(', ');

    // Fast-polling loop: detect feed or challenge in real-time (up to 35 seconds)
    const startTime = Date.now();
    let detectedChallenge = false;

    while (Date.now() - startTime < 35_000) {
      const currentUrl = this.page.url();
      if (currentUrl.includes('/feed')) {
        logger.info('[LoginPage] Redirected directly to feed — login successful.');
        return;
      }

      const isChallengeUrl =
        currentUrl.includes('/checkpoint') ||
        currentUrl.includes('/challenge') ||
        currentUrl.includes('/uas/consumer-login-submit') ||
        currentUrl.includes('/checkpoint/lg/login-submit');

      if (isChallengeUrl) {
        detectedChallenge = true;
        break;
      }

      try {
        const challengeCount = await this.page.locator(challengeIndicatorSelector).count();
        if (challengeCount > 0) {
          detectedChallenge = true;
          break;
        }
      } catch {}

      await this.page.waitForTimeout(600);
    }

    if (detectedChallenge) {
      const currentUrl = this.page.url();
      logger.info(`[LoginPage] Checkpoint/challenge detected at ${currentUrl}. Proceeding to SMS/OTP verification flow...`);
      await this.handleSmsVerification(user);
      return;
    }

    // Fallback: check for nav avatar or feed selector
    try {
      await this.page
        .locator(`${NAV_AVATAR_SELECTOR}, ${FEED_SELECTOR}`)
        .first()
        .waitFor({ state: 'visible', timeout: 10_000 });
    } catch {
      throw new AuthenticationError(
        'Login did not complete within the expected timeout. ' +
          'A CAPTCHA or security challenge may have appeared. ' +
          'Complete the challenge manually and re-run the test.',
      );
    }
  }

  /**
   * Handles the LinkedIn SMS 2-step verification challenge.
   * 1. Finds and clicks <a id="try-another-way">Verify using SMS</a> if present.
   * 2. Prompts the UI for the 6-digit OTP code.
   * 3. Inputs the OTP into the verification code field.
   * 4. Clicks <button id="two-step-submit-button">Submit</button>.
   * 5. Waits for redirect to /feed/.
   */
  async handleSmsVerification(user?: { id?: number; username: string }): Promise<void> {
    const username = user?.username ?? 'user';
    logger.info(`[LoginPage] [${username}] Starting SMS verification handling. Registering OTP challenge immediately...`);

    // Register OTP challenge IMMEDIATELY so the web UI detects waiting_for_otp without any delay
    const otpPromise = OtpChallengeService.requestOtp(username, user?.id, 180_000);

    // Look for "Verify using SMS" button / link if presented
    const tryAnotherWay = this.page.locator(
      '#try-another-way, a#try-another-way, .try_another_way a, a:has-text("Verify using SMS"), button:has-text("Verify using SMS")'
    ).first();

    try {
      if (await tryAnotherWay.isVisible({ timeout: 2500 })) {
        logger.info(`[LoginPage] [${username}] Found "Verify using SMS" button. Clicking it now...`);
        await tryAnotherWay.click();
        await this.page.waitForLoadState('domcontentloaded').catch(() => {});
        await this.page.waitForTimeout(1000);
      } else {
        logger.info(`[LoginPage] [${username}] "Verify using SMS" button not found or already on SMS challenge screen.`);
      }
    } catch (e) {
      logger.warn(`[LoginPage] [${username}] Checking try-another-way: ${(e as Error).message}`);
    }

    try {
      // Step 3: Locate the visible PIN input on the page
      // Explicitly require :visible and exclude hidden inputs like [name="resendUrl"] (#input-resend-pin-url)
      let pinInput = this.page.locator([
        'input:visible#input__phone_verification_pin',
        'input:visible#input__email_verification_pin',
        'input:visible#two-step-verification-code',
        'input:visible[name="pin"]',
        'input:visible[name="verificationCode"]',
        'input:visible[name="code"]',
        'input:visible[type="tel"]',
        'input:visible[inputmode="numeric"]',
        'input:visible[autocomplete*="code"]',
        'input:visible[placeholder*="code" i]',
        'input:visible[placeholder*="pin" i]',
        'input:visible[aria-label*="code" i]',
        'input:visible[aria-label*="pin" i]',
        'input:visible[aria-label*="SMS" i]',
        'input:visible.form__input--text',
        'input:visible[type="text"]:not([name="resendUrl"]):not(#input-resend-pin-url)'
      ].join(', ')).first();

      try {
        await pinInput.waitFor({ state: 'visible', timeout: 20_000 });
        logger.info(`[LoginPage] [${username}] Visible PIN input located.`);
      } catch {
        logger.warn(`[LoginPage] [${username}] Specific PIN selectors not yet visible. Searching for any visible text/tel input...`);
        pinInput = this.page
          .locator('input:visible')
          .filter({
            hasNot: this.page.locator('[type="hidden"], [type="submit"], [type="button"], [type="checkbox"], [name="resendUrl"], #input-resend-pin-url')
          })
          .first();
        await pinInput.waitFor({ state: 'visible', timeout: 15_000 });
        logger.info(`[LoginPage] [${username}] Found visible input on page.`);
      }

      // Step 4: Wait for user to input 6-digit OTP in UI (3-minute window)
      logger.info(`[LoginPage] [${username}] Waiting for user to enter 6-digit OTP in UI (up to 3 minutes)...`);
      const otpCode = await otpPromise;
      logger.info(`[LoginPage] [${username}] Received 6-digit OTP (${otpCode}) from UI. Filling input...`);

      // Step 5: Fill the 6-digit OTP
      await pinInput.click();
      await pinInput.fill(otpCode.trim());
      await this.page.keyboard.press('Tab');
      await this.page.waitForTimeout(400);

      // Step 6: Click the submit button:
      // <button class="form__submit form__submit--stretch" id="two-step-submit-button" aria-label="Submit code" type="submit">Submit</button>
      const submitButton = this.page.locator([
        'button:visible#two-step-submit-button',
        '#two-step-submit-button:visible',
        'button:visible[type="submit"]',
        '.form__action button[type="submit"]:visible',
        'button:visible:has-text("Submit")',
        'button.form__submit:visible'
      ].join(', ')).first();

      await submitButton.waitFor({ state: 'visible', timeout: 10_000 });
      logger.info(`[LoginPage] [${username}] Clicking #two-step-submit-button to submit SMS code...`);
      await submitButton.click();

      // Step 7: Wait for feed redirect
      logger.info(`[LoginPage] [${username}] Waiting for post-verification redirect to feed...`);
      try {
        await this.page.waitForURL('**/feed/**', { timeout: 60_000 });
        logger.info(`[LoginPage] [${username}] Successfully redirected to feed after SMS verification!`);
        OtpChallengeService.clearChallenge(username);
      } catch {
        // Check if on feed regardless of exact URL
        const currentUrl = this.page.url();
        if (currentUrl.includes('/feed')) {
          logger.info(`[LoginPage] [${username}] On feed URL (${currentUrl}). Verification succeeded.`);
          OtpChallengeService.clearChallenge(username);
          return;
        }

        // Check if error message is displayed on challenge page
        const errorMsg = await this.page
          .locator('.form__message--error, [role="alert"], .error-message, .alert-content')
          .first()
          .innerText()
          .catch(() => '');
        if (errorMsg) {
          OtpChallengeService.clearChallenge(username);
          throw new AuthenticationError(`SMS Verification failed: ${errorMsg}`);
        }

        throw new AuthenticationError('SMS verification submitted, but feed did not load in time.');
      }
    } catch (err) {
      OtpChallengeService.clearChallenge(username);
      throw err;
    }
  }

  /** Returns true if an error banner is visible after a login attempt. */
  async hasLoginError(): Promise<boolean> {
    if (this.page.url().includes('/feed')) {
      return false;
    }
    return this.errorBanner.isVisible();
  }

  /** Returns the text content of the error banner (if shown). */
  async getLoginErrorText(): Promise<string> {
    return this.errorBanner.innerText();
  }
}

