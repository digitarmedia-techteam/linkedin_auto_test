import type { Page } from '@playwright/test';
import { ProfilePage } from '../pages/ProfilePage.js';
import type { NetworkingAdapter } from '../adapters/NetworkingAdapter.js';
import type { Profile } from '../types/profile.types.js';
import { logger } from '../utils/logger.js';

/**
 * ProfileService — Service Layer.
 * Business logic for profile retrieval and navigation.
 * Depends on both the POM (for UI assertions) and an adapter (for data).
 */
export class ProfileService {
  private readonly profilePage: ProfilePage;

  constructor(
    page: Page,
    private readonly adapter: NetworkingAdapter,
  ) {
    this.profilePage = new ProfilePage(page);
  }

  /** Navigate to a profile page in the staging environment. */
  async openProfile(profileId: string): Promise<void> {
    logger.info('[ProfileService] Opening profile.', { profileId });
    await this.profilePage.open(profileId);
  }

  /**
   * Retrieve full profile data.
   * Uses the adapter so the source can be mock, staging, or official API.
   */
  async getProfile(profileId: string): Promise<Profile> {
    logger.info('[ProfileService] Fetching profile data.', { profileId });
    return this.adapter.getProfile(profileId);
  }

  /**
   * Read the profile name directly from the current UI page.
   * Useful for verifying that the correct profile is loaded.
   */
  async getProfileNameFromPage(): Promise<string> {
    return this.profilePage.getProfileName();
  }

  /** Read the headline directly from the current UI page. */
  async getHeadlineFromPage(): Promise<string> {
    return this.profilePage.getHeadline();
  }
}
