import type { Page } from '@playwright/test';
import { ProfilePage } from '../pages/ProfilePage.js';
import { ConnectionsPage } from '../pages/ConnectionsPage.js';
import type { NetworkingAdapter } from '../adapters/NetworkingAdapter.js';
import type { ConnectionRequest } from '../types/connection.types.js';
import type { ConnectionStatus } from '../types/profile.types.js';
import { logger } from '../utils/logger.js';
import { retry } from '../utils/retry.js';

/**
 * ConnectionService — Service Layer.
 * Orchestrates sending connection requests and reading status.
 * Uses the adapter for data and the POM for UI assertions.
 */
export class ConnectionService {
  private readonly profilePage: ProfilePage;
  private readonly connectionsPage: ConnectionsPage;

  constructor(
    page: Page,
    private readonly adapter: NetworkingAdapter,
  ) {
    this.profilePage = new ProfilePage(page);
    this.connectionsPage = new ConnectionsPage(page);
  }

  /**
   * Send a connection request to a profile.
   * Clicks the UI button in the staging environment and returns the request record.
   *
   * NOTE: This method WILL NOT bypass security challenges (CAPTCHAs, checkpoints).
   * If such a challenge appears, the test fails and requires manual intervention.
   */
  async sendConnectionRequest(profileId: string): Promise<ConnectionRequest> {
    logger.info('[ConnectionService] Sending connection request.', { profileId });

    const request = await this.adapter.sendConnectionRequest(profileId);

    // Also trigger the UI action so Playwright captures any visual state changes
    if (await this.profilePage.canConnect()) {
      await this.profilePage.clickConnect();
    }

    logger.info('[ConnectionService] Connection request sent.', { profileId, status: request.status });
    return request;
  }

  /**
   * Get the current connection status for a profile.
   * Retries up to 3 times to account for eventual-consistency in staging.
   */
  async getRequestStatus(profileId: string): Promise<ConnectionStatus> {
    logger.info('[ConnectionService] Checking connection status.', { profileId });
    return retry(
      () => this.adapter.getConnectionStatus(profileId),
      { label: `getConnectionStatus(${profileId})`, maxAttempts: 3 },
    );
  }

  /** Fetch all sent connection requests from the connections page. */
  async getSentRequests(): Promise<ConnectionRequest[]> {
    await this.connectionsPage.open();
    return this.connectionsPage.getSentRequests();
  }
}
