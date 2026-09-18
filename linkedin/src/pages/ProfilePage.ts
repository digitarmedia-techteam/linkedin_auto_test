import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { logger } from '../utils/logger.js';
import { CONNECT_BUTTON_SELECTOR, PENDING_BADGE_SELECTOR } from '../config/constants.js';
import type { ConnectionStatus } from '../types/profile.types.js';
import { ProfileNotFoundError } from '../utils/errors.js';

/**
 * ProfilePage — Page Object.
 * Handles navigation to a profile page and reading profile information.
 * Business logic lives in ProfileService and ConnectionService.
 */
export class ProfilePage {
  constructor(private readonly page: Page) {}

  // ── Locators (lazy getters) ───────────────────────────────────────────────
  private get profileName() { return this.page.getByTestId('profile-name'); }
  private get profileHeadline() { return this.page.getByTestId('profile-headline'); }
  private get connectionStatusBadge() { return this.page.getByTestId('connection-status'); }
  private get connectButton() { return this.page.locator(CONNECT_BUTTON_SELECTOR); }
  private get pendingBadge() { return this.page.locator(PENDING_BADGE_SELECTOR); }
  private get notFoundIndicator() { return this.page.getByTestId('profile-not-found'); }

  /**
   * Navigate to a profile by its ID in the staging/test environment.
   * Throws ProfileNotFoundError if the profile does not exist.
   */
  async open(profileId: string): Promise<void> {
    logger.info('[ProfilePage] Opening profile.', { profileId });
    await this.page.goto(`/profile/${profileId}`, { waitUntil: 'domcontentloaded' });

    if (await this.notFoundIndicator.isVisible()) {
      throw new ProfileNotFoundError(profileId);
    }

    await expect(this.profileName).toBeVisible({ timeout: 10_000 });
  }

  /** Returns the profile display name. */
  async getProfileName(): Promise<string> {
    const text = await this.profileName.innerText();
    logger.debug('[ProfilePage] Read profile name.', { name: text });
    return text.trim();
  }

  /** Returns the profile headline. */
  async getHeadline(): Promise<string> {
    const text = await this.profileHeadline.innerText();
    return text.trim();
  }

  /**
   * Returns the connection status shown on the profile.
   * Maps the staging UI label to a typed ConnectionStatus value.
   */
  async getConnectionStatus(): Promise<ConnectionStatus> {
    const text = (await this.connectionStatusBadge.innerText()).trim().toLowerCase();

    if (text.includes('connected')) return 'Connected';
    if (text.includes('pending')) return 'Pending';
    if (text.includes('not connected') || text.includes('connect')) return 'NotConnected';
    return 'Unknown';
  }

  /** Returns true if the Connect button is present and clickable. */
  async canConnect(): Promise<boolean> {
    return this.connectButton.isEnabled();
  }

  /**
   * Click the Connect button in the authorized test/staging environment.
   * Does NOT bypass security challenges — if a CAPTCHA or checkpoint
   * appears the test will fail and require manual intervention.
   */
  async clickConnect(): Promise<void> {
    logger.info('[ProfilePage] Clicking Connect button.');
    await expect(this.connectButton).toBeEnabled({ timeout: 5_000 });
    await this.connectButton.click();
  }

  /** Assert that the pending badge is visible after sending a connection request. */
  async assertConnectionIsPending(): Promise<void> {
    logger.info('[ProfilePage] Asserting connection status is Pending.');
    await expect(this.pendingBadge).toBeVisible({ timeout: 10_000 });
  }
}
