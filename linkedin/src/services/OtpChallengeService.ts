import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

export interface OtpChallenge {
  userId?: number;
  username: string;
  status: 'waiting_for_otp' | 'otp_received' | 'completed' | 'failed' | 'expired';
  requestedAt: number;
  expiresAt: number;
  resolve?: (otp: string) => void;
  reject?: (err: Error) => void;
}

/**
 * OtpChallengeManager — In-memory registry that bridges browser automation
 * waiting on a LinkedIn SMS checkpoint with the user-facing web UI.
 */
class OtpChallengeManager extends EventEmitter {
  private challenges = new Map<string, OtpChallenge>();

  /**
   * Called by the automation script (Playwright) when an SMS challenge is detected.
   * Returns a promise that resolves when the user submits their OTP from the web UI.
   * Default timeout: 10 minutes (600_000 ms).
   */
  requestOtp(username: string, userId?: number, timeoutMs = 600_000): Promise<string> {
    const key = username.toLowerCase().trim();
    logger.info(`[OtpChallengeService] Registering pending SMS OTP challenge for ${username} (timeout: ${timeoutMs / 1000}s)`);

    // Clean up expired or already completed challenges to avoid stale map entries
    const now = Date.now();
    for (const [existingKey, existingChallenge] of this.challenges.entries()) {
      if (existingChallenge.status !== 'waiting_for_otp' || existingChallenge.expiresAt <= now) {
        this.challenges.delete(existingKey);
      }
    }

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.challenges.has(key)) {
          const item = this.challenges.get(key);
          if (item) {
            item.status = 'expired';
          }
          logger.warn(`[OtpChallengeService] OTP challenge timed out for ${username} after ${timeoutMs / 1000}s`);
          reject(new Error('SMS OTP input timed out after 10 minutes (600 seconds). Please re-run login.'));
          this.challenges.delete(key);
        }
      }, timeoutMs);

      const requestedAt = Date.now();
      const challengeObj: OtpChallenge = {
        userId,
        username,
        status: 'waiting_for_otp',
        requestedAt,
        expiresAt: requestedAt + timeoutMs,
        resolve: (otp: string) => {
          clearTimeout(timer);
          resolve(otp);
        },
        reject: (err: Error) => {
          clearTimeout(timer);
          reject(err);
        },
      };

      this.challenges.set(key, challengeObj);
      this.emit('status_update', { username, userId, status: 'otp_required' });
    });
  }

  /**
   * Retrieves an active challenge by username or userId.
   */
  getChallenge(usernameOrId?: string | number): OtpChallenge | null {
    if (!usernameOrId && usernameOrId !== 0) {
      if (this.challenges.size >= 1) {
        return this.challenges.values().next().value ?? null;
      }
      return null;
    }

    const key = String(usernameOrId).trim().toLowerCase();

    // 1. Direct key match
    if (this.challenges.has(key)) {
      return this.challenges.get(key) || null;
    }

    // 2. Numeric userId match
    if (!isNaN(Number(key))) {
      const id = Number(key);
      for (const c of this.challenges.values()) {
        if (c.userId === id) return c;
      }
    }

    // 3. Username comparison in challenge values
    for (const c of this.challenges.values()) {
      if (c.username.toLowerCase().trim() === key) return c;
    }

    // 4. Fallback if single challenge is waiting
    if (this.challenges.size === 1) {
      return this.challenges.values().next().value ?? null;
    }

    // 5. Fallback: find any active challenge waiting for OTP
    for (const c of this.challenges.values()) {
      if (c.status === 'waiting_for_otp') {
        return c;
      }
    }

    return null;
  }

  /**
   * Called by the HTTP endpoint when user submits the 6-digit OTP from the UI modal.
   */
  submitOtp(usernameOrId: string | number, otp: string): boolean {
    let challenge = this.getChallenge(usernameOrId);
    if (!challenge) {
      // Find ANY challenge waiting for OTP
      for (const c of this.challenges.values()) {
        if (c.status === 'waiting_for_otp' && c.resolve) {
          challenge = c;
          break;
        }
      }
    }

    if (!challenge || challenge.status !== 'waiting_for_otp' || !challenge.resolve) {
      logger.warn(`[OtpChallengeService] No waiting challenge found for "${String(usernameOrId)}"`);
      return false;
    }

    logger.info(`[OtpChallengeService] Submitting received OTP (${otp}) for ${challenge.username} directly to Playwright runner`);
    challenge.status = 'otp_received';
    this.emit('status_update', { username: challenge.username, status: 'authenticating', message: 'Verifying OTP...' });
    challenge.resolve(otp.trim());
    return true;
  }

  /**
   * Cleans up any challenge record.
   */
  clearChallenge(username: string): void {
    this.challenges.delete(username.toLowerCase().trim());
  }
}

export const OtpChallengeService = new OtpChallengeManager();
