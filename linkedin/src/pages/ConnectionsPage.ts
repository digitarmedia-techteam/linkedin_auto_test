import type { Page } from 'playwright';
import { logger } from '../utils/logger.js';
import type { ConnectionRequest } from '../types/connection.types.js';

/**
 * ConnectionsPage — Page Object.
 * Reads sent and pending connection requests from the staging/test environment.
 */
export class ConnectionsPage {
  constructor(private readonly page: Page) {}

  private get sentRequestsList() { return this.page.getByTestId('sent-requests-list'); }
  private get pendingRequestsList() { return this.page.getByTestId('pending-requests-list'); }

  async open(): Promise<void> {
    logger.info('[ConnectionsPage] Navigating to connections page.');
    await this.page.goto('/connections', { waitUntil: 'domcontentloaded' });
    await this.sentRequestsList.or(this.pendingRequestsList).waitFor({
      state: 'visible',
      timeout: 10_000,
    });
  }

  /** Returns all sent connection requests shown in the staging UI. */
  async getSentRequests(): Promise<ConnectionRequest[]> {
    logger.info('[ConnectionsPage] Reading sent requests.');
    return this.parseRequestRows(this.sentRequestsList, 'Pending');
  }

  /** Returns all pending (received) connection requests shown in the staging UI. */
  async getPendingRequests(): Promise<ConnectionRequest[]> {
    logger.info('[ConnectionsPage] Reading pending requests.');
    return this.parseRequestRows(this.pendingRequestsList, 'Pending');
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async parseRequestRows(
    list: ReturnType<Page['getByTestId']>,
    defaultStatus: ConnectionRequest['status'],
  ): Promise<ConnectionRequest[]> {
    const rows = list.locator('[data-testid="connection-row"]');
    const count = await rows.count();
    const results: ConnectionRequest[] = [];

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const profileId = (await row.getAttribute('data-profile-id')) ?? `unknown-${i}`;
      const profileName = await row.getByTestId('connection-name').innerText();

      results.push({
        profileId,
        profileName: profileName.trim(),
        status: defaultStatus,
        requestedAt: new Date(),
      });
    }

    return results;
  }
}
