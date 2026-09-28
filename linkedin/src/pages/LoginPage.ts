import type { Page, Locator } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
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
  currentUser?: { id?: number; username: string };

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

  /** Dismisses any cookie consent or GDPR banner presented on European or remote cloud servers. */
  async dismissCookieBanner(): Promise<void> {
    const cookieBtn = this.page.locator([
      'button[data-control-name="ga-cookie-consent-accept"]',
      'button:has-text("Accept cookies")',
      'button:has-text("Accept")',
      'button:has-text("Agree & Join")',
      '#artdeco-global-alert-container button',
      '.cookie-policy button',
      '.artdeco-global-alert__action button',
    ].join(', ')).first();
    try {
      if (await cookieBtn.isVisible({ timeout: 1000 })) {
        logger.info('[LoginPage] Cookie/GDPR consent banner detected. Dismissing it...');
        await cookieBtn.click({ timeout: 1500 }).catch(() => {});
        await this.page.waitForTimeout(300);
      }
    } catch {}
  }

  /** Captures a full-page diagnostic screenshot to screenshots/ for remote troubleshooting. */
  async captureDiagnosticScreenshot(label: string): Promise<string | null> {
    try {
      const dir = path.join(process.cwd(), 'screenshots');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const filename = `${label}-${Date.now()}.png`;
      const filepath = path.join(dir, filename);
      await this.page.screenshot({ path: filepath, fullPage: true });
      logger.info(`[LoginPage] Diagnostic screenshot captured: ${filepath}`);
      return filepath;
    } catch (err) {
      logger.warn(`[LoginPage] Could not capture screenshot: ${(err as Error).message}`);
      return null;
    }
  }

  /** Navigate to the login page. */
  async open(user?: { id?: number; username: string }): Promise<void> {
    if (user) this.currentUser = user;
    logger.info('[LoginPage] Navigating to login page.');
    await this.page.goto('/login', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    await this.dismissCookieBanner();

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
  async login(username: string, password: string, user?: { id?: number; username: string }): Promise<void> {
    if (user) {
      this.currentUser = user;
    } else if (!this.currentUser) {
      this.currentUser = { username };
    }

    if (this.page.url().includes('/feed')) {
      logger.info('[LoginPage] Already authenticated on feed — skipping form submission.');
      return;
    }

    logger.info('[LoginPage] Filling login form.', { username });

    await this.dismissCookieBanner();

    await this.usernameInput.click();
    await this.usernameInput.fill(username);
    // Tab out of username to trigger blur/validation and commit React state
    await this.page.keyboard.press('Tab');

    await this.passwordInput.click();
    await this.passwordInput.fill(password);
    // Tab out of password to commit value
    await this.page.keyboard.press('Tab');

    await this.page.waitForTimeout(300);
    try {
      await this.submitButton.click({ timeout: 5000 });
    } catch {
      logger.info('[LoginPage] Submit button click timed out, pressing Enter on password field...');
      await this.passwordInput.press('Enter');
    }
  }

  /**
   * Wait until the application shows a post-login indicator or handles a 2FA challenge.
   * Throws AuthenticationError on timeout.
   */
  async waitForSuccessfulLogin(user?: { id?: number; username: string }): Promise<void> {
    if (user) this.currentUser = user;
    const effectiveUser = user || this.currentUser;

    if (this.page.url().includes('/feed')) {
      logger.info('[LoginPage] Already on feed — login successful! No verification or OTP search needed.');
      return;
    }

    logger.info('[LoginPage] Waiting for post-login destination (feed or checkpoint challenge)...');

    // Priority 1: Fast-check if LinkedIn directly redirects to feed
    try {
      await this.page.waitForURL((url) => url.pathname.includes('/feed'), { timeout: 6000 });
      logger.info('[LoginPage] Redirected directly to feed — login successful! No verification or OTP search needed.');
      return;
    } catch {
      // Not on feed within 6s, proceed to polling check
    }

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
        logger.info('[LoginPage] Redirected directly to feed — login successful! No verification or OTP search needed.');
        return;
      }

      // Check feed selector visibility directly
      try {
        const feedElem = this.page.locator(`${NAV_AVATAR_SELECTOR}, ${FEED_SELECTOR}`).first();
        if (await feedElem.isVisible({ timeout: 150 })) {
          logger.info('[LoginPage] Feed UI element detected — login successful! No verification or OTP search needed.');
          return;
        }
      } catch {}

      // ACTUAL challenge URLs only (exclude intermediate form submit endpoints)
      const isActualChallengeUrl =
        currentUrl.includes('/checkpoint/challenge') ||
        currentUrl.includes('/checkpoint/challengesV2') ||
        currentUrl.includes('/uas/challenge') ||
        (currentUrl.includes('/challenge/') && !currentUrl.includes('/login-submit'));

      if (isActualChallengeUrl) {
        if (this.page.url().includes('/feed')) {
          logger.info('[LoginPage] Feed reached — login successful! No verification needed.');
          return;
        }
        detectedChallenge = true;
        break;
      }

      try {
        if (!this.page.url().includes('/feed')) {
          const challengeCount = await this.page.locator(challengeIndicatorSelector).count();
          if (challengeCount > 0) {
            if (this.page.url().includes('/feed')) {
              logger.info('[LoginPage] Feed reached — login successful! No verification needed.');
              return;
            }
            detectedChallenge = true;
            break;
          }
        }

        // Check for inline error banners (wrong password, account locked, etc.)
        const errorBanner = this.page.locator(
          '#error-for-username, #error-for-password, .alert-content, .form__label--error, div[alert-type="error"], div[data-id="sign-in-form__alert"]'
        ).first();
        if (await errorBanner.isVisible({ timeout: 150 }).catch(() => false)) {
          const errMsg = (await errorBanner.innerText().catch(() => '')).trim();
          if (errMsg) {
            const shot = await this.captureDiagnosticScreenshot(`login-error-${effectiveUser?.username || 'user'}`);
            logger.error(`[LoginPage] Login error on page: "${errMsg}". Screenshot: ${shot}`);
            throw new AuthenticationError(`LinkedIn login failed: ${errMsg}`);
          }
        }
      } catch (e) {
        if ((e as Error).message.includes('login failed:')) throw e;
      }

      await this.page.waitForTimeout(600);
    }

    if (this.page.url().includes('/feed')) {
      logger.info('[LoginPage] Redirected directly to feed — login successful! No verification or OTP search needed.');
      return;
    }

    if (detectedChallenge) {
      const currentUrl = this.page.url();
      if (currentUrl.includes('/feed')) {
        logger.info('[LoginPage] Redirected directly to feed — login successful! No verification or OTP search needed.');
        return;
      }
      logger.info(`[LoginPage] Checkpoint/challenge detected at ${currentUrl}. Proceeding to SMS/OTP verification flow...`);
      await this.handleSmsVerification(effectiveUser);
      return;
    }

    // Fallback: check for nav avatar or feed selector
    try {
      await this.page
        .locator(`${NAV_AVATAR_SELECTOR}, ${FEED_SELECTOR}`)
        .first()
        .waitFor({ state: 'visible', timeout: 10_000 });
    } catch (err) {
      if ((err as Error).message.includes('CAPTCHA')) throw err;
      const shot = await this.captureDiagnosticScreenshot(`login-timeout-${effectiveUser?.username || 'user'}`);
      const currentUrl = this.page.url();
      logger.error(`[LoginPage] Post-login wait failed (URL: ${currentUrl}). Screenshot saved to: ${shot}`);
      throw new AuthenticationError(
        `Login did not complete within expected timeout (URL: ${currentUrl}). Screenshot saved to ${shot || 'screenshots/'}. If running on an Ubuntu cloud server, a residential proxy is required to avoid LinkedIn bot blocks.`,
      );
    }
  }

  /**
   * Directly locates the visible OTP / PIN input element on LinkedIn's challenge screen.
   * Checks both main page and iframes across all known LinkedIn PIN selectors.
   */
  async findOtpPinInput(timeoutMs = 6000): Promise<Locator | null> {
    const PIN_SELECTORS = [
      'input:visible#input__phone_verification_pin',
      'input:visible#input__email_verification_pin',
      'input:visible#two-step-verification-code',
      'input:visible[name="pin"]',
      'input:visible[name="verificationCode"]',
      'input:visible[name="code"]',
      'input:visible[name="security-code"]',
      'input:visible#security-code',
      'input:visible[id*="pin" i]',
      'input:visible[id*="otp" i]',
      'input:visible[id*="code" i]',
      'input:visible[id*="verification" i]',
      'input:visible[type="tel"]',
      'input:visible[inputmode="numeric"]',
      'input:visible[autocomplete*="code"]',
      'input:visible[placeholder*="code" i]',
      'input:visible[placeholder*="pin" i]',
      'input:visible[aria-label*="code" i]',
      'input:visible[aria-label*="pin" i]',
      'input:visible[aria-label*="SMS" i]',
      'input:visible[aria-label*="verification" i]',
      'input:visible.form__input--text',
      'input:visible[type="text"]:not([name="resendUrl"]):not(#input-resend-pin-url):not([type="hidden"])',
    ];

    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      // 1. Direct combined selector on main page
      const primary = this.page.locator(PIN_SELECTORS.join(', ')).first();
      try {
        if (await primary.isVisible({ timeout: 250 })) {
          return primary;
        }
      } catch {}

      // 2. Generic visible text/tel/number input excluding buttons/hidden
      try {
        const generic = this.page
          .locator('input:visible')
          .filter({
            hasNot: this.page.locator('[type="hidden"], [type="submit"], [type="button"], [type="checkbox"], [name="resendUrl"], #input-resend-pin-url'),
          })
          .first();
        if (await generic.isVisible({ timeout: 250 })) {
          return generic;
        }
      } catch {}

      // 3. Search within iframes (if LinkedIn renders challenge inside an iframe)
      for (const frame of this.page.frames()) {
        if (frame === this.page.mainFrame()) continue;
        try {
          const frameInput = frame.locator(PIN_SELECTORS.join(', ')).first();
          if (await frameInput.isVisible({ timeout: 200 })) {
            return frameInput;
          }
        } catch {}
      }

      await this.page.waitForTimeout(250);
    }

    return null;
  }

  /**
   * Directly locates the submit/verify button for the OTP challenge.
   */
  async findOtpSubmitButton(): Promise<Locator | null> {
    const SUBMIT_SELECTORS = [
      'button:visible#two-step-submit-button',
      '#two-step-submit-button:visible',
      'button:visible[type="submit"]',
      'button[type="submit"]:visible',
      '.form__action button[type="submit"]:visible',
      'button:visible:has-text("Submit")',
      'button:visible:has-text("Verify")',
      'button:visible:has-text("Continue")',
      'button.form__submit:visible',
      'input:visible[type="submit"]',
    ];

    const mainBtn = this.page.locator(SUBMIT_SELECTORS.join(', ')).first();
    try {
      if (await mainBtn.isVisible({ timeout: 500 })) {
        return mainBtn;
      }
    } catch {}

    // Check frames
    for (const frame of this.page.frames()) {
      if (frame === this.page.mainFrame()) continue;
      try {
        const frameBtn = frame.locator(SUBMIT_SELECTORS.join(', ')).first();
        if (await frameBtn.isVisible({ timeout: 200 })) {
          return frameBtn;
        }
      } catch {}
    }

    return null;
  }

  /**
   * Triggers the submit action directly after OTP is entered.
   * Tries clicking the submit button first, and also presses Enter on the PIN input.
   */
  async triggerOtpSubmit(pinInput: Locator, username: string): Promise<void> {
    const submitButton = await this.findOtpSubmitButton();
    if (submitButton) {
      try {
        logger.info(`[LoginPage] [${username}] Directly clicking challenge submit button...`);
        await submitButton.click({ timeout: 4000 });
        return;
      } catch (err) {
        logger.warn(`[LoginPage] [${username}] Click on submit button threw: ${(err as Error).message}. Falling back to Enter key.`);
      }
    }

    logger.info(`[LoginPage] [${username}] Directly pressing Enter on PIN input to submit...`);
    try {
      await pinInput.press('Enter');
    } catch (err) {
      logger.warn(`[LoginPage] [${username}] Enter key press threw: ${(err as Error).message}`);
    }
  }

  /**
   * Handles the LinkedIn SMS 2-step verification challenge.
   * 1. Finds and clicks <a id="try-another-way">Verify using SMS</a> if present.
   * 2. If not found or already on SMS challenge screen, directly finds input section of OTP.
   * 3. Waits up to 10 minutes for OTP.
   * 4. As soon as user enters OTP, immediately fills input and triggers submit directly without waiting for default timeout.
   * 5. Waits for redirect to /feed/.
   */
  async handleSmsVerification(user?: { id?: number; username: string }): Promise<void> {
    if (user) {
      this.currentUser = user;
    }
    const username = user?.username ?? this.currentUser?.username ?? 'user';
    const userId = user?.id ?? this.currentUser?.id;

    // Check if directly redirected to feed — skip verification and OTP search entirely
    if (this.page.url().includes('/feed')) {
      logger.info(`[LoginPage] [${username}] Directly redirected to feed — login successful! No verification or OTP search needed.`);
      return;
    }

    // Fast-check feed element visibility
    try {
      const feedElem = this.page.locator(`${NAV_AVATAR_SELECTOR}, ${FEED_SELECTOR}`).first();
      if (await feedElem.isVisible({ timeout: 400 })) {
        logger.info(`[LoginPage] [${username}] Feed UI confirmed visible — skipping SMS challenge.`);
        return;
      }
    } catch {}

    logger.info(`[LoginPage] [${username}] Starting SMS verification handling. Registering OTP challenge immediately...`);

    // 10-minute timeout window (600,000 ms) - but triggers submit immediately upon OTP entry
    const OTP_TIMEOUT_MS = 600_000;
    const otpPromise = OtpChallengeService.requestOtp(username, userId, OTP_TIMEOUT_MS);

    // Look for "Verify using SMS" button / link if presented
    const tryAnotherWay = this.page.locator(
      '#try-another-way, a#try-another-way, .try_another_way a, a:has-text("Verify using SMS"), button:has-text("Verify using SMS")'
    ).first();

    try {
      if (this.page.url().includes('/feed')) {
        logger.info(`[LoginPage] [${username}] Feed reached — skipping try-another-way search.`);
        return;
      }
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

    if (this.page.url().includes('/feed')) {
      logger.info(`[LoginPage] [${username}] Redirected to feed — skipping OTP input search.`);
      OtpChallengeService.clearChallenge(username);
      return;
    }

    try {
      // Step 3: Immediately and directly find input section of OTP on the page
      logger.info(`[LoginPage] [${username}] Directly finding OTP/PIN input section...`);
      let pinInput = await this.findOtpPinInput(8000);
      if (pinInput) {
        logger.info(`[LoginPage] [${username}] Directly located OTP/PIN input section on page.`);
      } else {
        logger.warn(`[LoginPage] [${username}] OTP/PIN input not immediately found; will continue monitoring while awaiting OTP.`);
      }

      // Step 4: Wait for user to enter OTP (up to 10 minutes)
      // When user enters OTP, immediately trigger submit without waiting for default timeout
      logger.info(`[LoginPage] [${username}] Waiting for OTP code (up to 10 minutes). Once entered, submit will trigger directly...`);

      let pollActive = true;
      const pageDirectWatcher = new Promise<{ source: 'page_feed' | 'page_filled'; code?: string }>((resolve) => {
        const interval = setInterval(async () => {
          if (!pollActive) {
            clearInterval(interval);
            return;
          }
          try {
            const currentUrl = this.page.url();
            if (currentUrl.includes('/feed')) {
              clearInterval(interval);
              pollActive = false;
              resolve({ source: 'page_feed' });
              return;
            }

            if (!pinInput) {
              pinInput = await this.findOtpPinInput(300);
            }

            if (pinInput) {
              const val = await pinInput.inputValue().catch(() => '');
              if (val && val.trim().length >= 6) {
                clearInterval(interval);
                pollActive = false;
                resolve({ source: 'page_filled', code: val.trim() });
                return;
              }
            }
          } catch {}
        }, 600);
      });

      const outcome = await Promise.race([
        otpPromise.then((code) => ({ source: 'ui' as const, code })),
        pageDirectWatcher,
      ]).finally(() => {
        pollActive = false;
      });

      if (outcome.source === 'page_feed') {
        logger.info(`[LoginPage] [${username}] Direct redirect to feed detected! Verification succeeded.`);
        OtpChallengeService.clearChallenge(username);
        return;
      }

      if (outcome.source === 'ui') {
        const otpCode = outcome.code;
        logger.info(`[LoginPage] [${username}] Received OTP (${otpCode}) from UI. Directly filling input and triggering submit...`);

        if (!pinInput) {
          pinInput = await this.findOtpPinInput(6000);
        }

        if (!pinInput) {
          throw new AuthenticationError('Could not locate OTP input field to fill verification code.');
        }

        await pinInput.click();
        await pinInput.fill(otpCode.trim());
        await this.page.keyboard.press('Tab');
        await this.page.waitForTimeout(200);

        // Step 6: Trigger submit directly!
        await this.triggerOtpSubmit(pinInput, username);
      } else if (outcome.source === 'page_filled') {
        logger.info(`[LoginPage] [${username}] OTP detected as filled directly on page. Triggering submit directly...`);
        if (!pinInput) {
          pinInput = await this.findOtpPinInput(3000);
        }
        if (pinInput) {
          await this.triggerOtpSubmit(pinInput, username);
        }
      }

      // Step 7: Wait for post-verification redirect to feed
      logger.info(`[LoginPage] [${username}] Waiting for post-verification redirect to feed...`);
      try {
        await this.page.waitForURL('**/feed/**', { timeout: 60_000 });
        logger.info(`[LoginPage] [${username}] Successfully redirected to feed after SMS verification!`);
        OtpChallengeService.clearChallenge(username);
      } catch {
        const currentUrl = this.page.url();
        if (currentUrl.includes('/feed')) {
          logger.info(`[LoginPage] [${username}] On feed URL (${currentUrl}). Verification succeeded.`);
          OtpChallengeService.clearChallenge(username);
          return;
        }

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

