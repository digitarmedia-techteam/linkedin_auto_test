import type { NetworkingAdapter } from './NetworkingAdapter.js';
import type { Profile, ConnectionStatus } from '../types/profile.types.js';
import type { ConnectionRequest } from '../types/connection.types.js';
import { AdapterError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * OfficialApiNetworkingAdapter — stub for an officially authorized API.
 *
 * ─── IMPORTANT ────────────────────────────────────────────────────────────
 * This adapter is intentionally LEFT AS A STUB.
 *
 * It must ONLY be used with an officially supported, authorized integration.
 *
 * DO NOT:
 *   • call undocumented or private API endpoints
 *   • reverse-engineer session tokens from browser cookies
 *   • scrape data behind authentication without explicit authorization
 *   • bypass rate limits imposed by the service
 *
 * Replace the TODO sections below with calls to the authorized API SDK /
 * REST endpoints once an integration has been formally approved.
 * ──────────────────────────────────────────────────────────────────────────
 */
export class OfficialApiNetworkingAdapter implements NetworkingAdapter {
  constructor(
    private readonly _apiBaseUrl: string,
    private readonly _apiKey: string, // injected from env, never hard-coded
  ) {}

  async authenticate(): Promise<void> {
    // TODO: Implement authorized OAuth / API-key handshake.
    // The apiKey is sourced from environment variables only.
    logger.info('[OfficialApiAdapter] authenticate() — stub, not yet implemented.');
    throw new AdapterError(
      'OfficialApiNetworkingAdapter is not yet implemented. ' +
        'Integrate an officially authorized API before enabling this adapter.',
    );
  }

  async getProfile(_profileId: string): Promise<Profile> {
    // TODO: GET /v2/people/{profileId} using the authorized API.
    throw new AdapterError('OfficialApiNetworkingAdapter.getProfile() not implemented.');
  }

  async sendConnectionRequest(_profileId: string): Promise<ConnectionRequest> {
    // TODO: POST /v2/connections using the authorized API.
    throw new AdapterError(
      'OfficialApiNetworkingAdapter.sendConnectionRequest() not implemented.',
    );
  }

  async getConnectionStatus(_profileId: string): Promise<ConnectionStatus> {
    // TODO: GET /v2/connections?profileId={profileId} using the authorized API.
    throw new AdapterError(
      'OfficialApiNetworkingAdapter.getConnectionStatus() not implemented.',
    );
  }
}
