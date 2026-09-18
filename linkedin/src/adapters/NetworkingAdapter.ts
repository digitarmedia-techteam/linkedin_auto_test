import type { Profile, ConnectionStatus } from '../types/profile.types.js';
import type { ConnectionRequest } from '../types/connection.types.js';

/**
 * NetworkingAdapter — Interface.
 *
 * All network interactions are isolated behind this interface.
 * Tests use MockNetworkingAdapter by default.
 * Production integration uses OfficialApiNetworkingAdapter.
 *
 * This boundary ensures no private/undocumented endpoints are called
 * during automated testing.
 */
export interface NetworkingAdapter {
  /** Authenticate with the backend (staging, mock, or official API). */
  authenticate(): Promise<void>;

  /** Fetch a profile by its ID. */
  getProfile(profileId: string): Promise<Profile>;

  /**
   * Send a connection request to the profile.
   * Returns the created ConnectionRequest record.
   */
  sendConnectionRequest(profileId: string): Promise<ConnectionRequest>;

  /** Returns the current connection status for a profile. */
  getConnectionStatus(profileId: string): Promise<ConnectionStatus>;
}
