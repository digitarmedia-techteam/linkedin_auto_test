/** Profile-related types. */

export interface Profile {
  readonly id: string;
  readonly name: string;
  readonly headline: string;
  readonly connectionStatus: ConnectionStatus;
}

export type ConnectionStatus = 'Connected' | 'Pending' | 'NotConnected' | 'Unknown';

export interface ProfileSummary {
  readonly id: string;
  readonly expectedName: string;
  readonly expectedStatus: string;
}
