import type { NetworkingAdapter } from './NetworkingAdapter.js';
import type { Profile, ConnectionStatus } from '../types/profile.types.js';
import type { ConnectionRequest } from '../types/connection.types.js';
import { ProfileNotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * MockNetworkingAdapter — in-memory adapter used by all automated tests.
 *
 * No real HTTP calls are made. Data is loaded from test-data/ JSON files
 * at construction time and mutated in-memory during a test run.
 *
 * This is the DEFAULT adapter (NETWORKING_ADAPTER=mock).
 */
export class MockNetworkingAdapter implements NetworkingAdapter {
  private authenticated = false;

  /** In-memory profile store. Seed via constructor for flexibility. */
  private readonly profiles: Map<string, Profile>;

  /** Tracks sent requests for assertions. */
  private readonly sentRequests: Map<string, ConnectionRequest> = new Map();

  constructor(seedProfiles: Profile[] = []) {
    this.profiles = new Map(seedProfiles.map((p) => [p.id, p]));

    // Default seed profiles for smoke tests
    if (this.profiles.size === 0) {
      this.seed();
    }
  }

  async authenticate(): Promise<void> {
    logger.info('[MockAdapter] authenticate() called — no-op in mock mode.');
    this.authenticated = true;
  }

  async getProfile(profileId: string): Promise<Profile> {
    this.assertAuthenticated();
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new ProfileNotFoundError(profileId);
    }
    logger.debug('[MockAdapter] getProfile', { profileId });
    return { ...profile };
  }

  async sendConnectionRequest(profileId: string): Promise<ConnectionRequest> {
    this.assertAuthenticated();
    const profile = await this.getProfile(profileId);

    const request: ConnectionRequest = {
      profileId,
      profileName: profile.name,
      status: 'Pending',
      requestedAt: new Date(),
    };

    this.sentRequests.set(profileId, request);

    // Mutate the profile to reflect new status
    this.profiles.set(profileId, { ...profile, connectionStatus: 'Pending' });

    logger.info('[MockAdapter] sendConnectionRequest', { profileId, status: 'Pending' });
    return request;
  }

  async getConnectionStatus(profileId: string): Promise<ConnectionStatus> {
    this.assertAuthenticated();
    const request = this.sentRequests.get(profileId);
    if (request) return request.status;

    const profile = this.profiles.get(profileId);
    return profile?.connectionStatus ?? 'Unknown';
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private assertAuthenticated(): void {
    if (!this.authenticated) {
      throw new Error('[MockAdapter] Not authenticated. Call authenticate() first.');
    }
  }

  private seed(): void {
    const defaults: Profile[] = [
      {
        id: 'test-profile-001',
        name: 'Test User One',
        headline: 'Software Engineer at Acme Corp',
        connectionStatus: 'NotConnected',
      },
      {
        id: 'test-profile-002',
        name: 'Test User Two',
        headline: 'Product Manager at Beta Inc',
        connectionStatus: 'Connected',
      },
    ];

    for (const p of defaults) {
      this.profiles.set(p.id, p);
    }
  }
}
