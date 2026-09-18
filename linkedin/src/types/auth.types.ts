/** Authentication-related types. */

export interface Credentials {
  readonly username: string;
  /** Never log this value. */
  readonly password: string;
}

export interface AuthState {
  readonly isAuthenticated: boolean;
  readonly username: string | null;
  readonly sessionExpiresAt: Date | null;
}

export type AuthResult =
  | { success: true; state: AuthState }
  | { success: false; reason: string };
