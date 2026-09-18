import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { logger } from '../utils/logger.js';
import { NAV_AVATAR_SELECTOR, FEED_SELECTOR } from '../config/constants.js';

/**
 * FeedPage — Page Object.
 * Represents the main home/feed screen that appears after login.
 */
export class FeedPage {
  constructor(private readonly page: Page) {}

  private get feedContainer() { return this.page.locator(FEED_SELECTOR).first(); }
  private get navAvatar() { return this.page.locator(NAV_AVATAR_SELECTOR).first(); }

  /** Assert that the feed is visible (confirms successful authentication). */
  async assertIsVisible(): Promise<void> {
    logger.info('[FeedPage] Asserting feed page is visible.');
    const indicator = this.feedContainer.or(this.navAvatar);
    await expect(indicator).toBeVisible({ timeout: 15_000 });
  }

  /** Returns true if the feed is currently displayed. */
  async isVisible(): Promise<boolean> {
    const url = this.page.url();
    // If on a login, authwall, or checkpoint page, the feed is definitely NOT visible
    if (
      url.includes('/login') ||
      url.includes('/checkpoint') ||
      url.includes('/authwall') ||
      url.includes('/uas/login')
    ) {
      return false;
    }

    if (url.includes('/feed')) {
      return true;
    }

    const visible =
      (await this.feedContainer.isVisible().catch(() => false)) ||
      (await this.navAvatar.isVisible().catch(() => false));
    return visible;
  }

  /** Navigate to the feed / home page. */
  async open(): Promise<void> {
    logger.info('[FeedPage] Navigating to feed page.');
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
  }
}
