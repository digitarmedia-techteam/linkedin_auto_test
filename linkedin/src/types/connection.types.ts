/** Connection-related types. */

import type { ConnectionStatus } from './profile.types.js';

export interface ConnectionRequest {
  readonly profileId: string;
  readonly profileName: string;
  readonly status: ConnectionStatus;
  readonly requestedAt: Date;
}

export interface ConnectionRequestResult {
  readonly success: boolean;
  readonly request: ConnectionRequest | null;
  readonly errorMessage: string | null;
}
