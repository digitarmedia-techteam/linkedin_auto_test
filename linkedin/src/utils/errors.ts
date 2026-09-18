/**
 * Custom error hierarchy.
 * Errors include context but NEVER expose secrets (passwords, tokens).
 */

export class AutomationError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    // Maintains correct prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConfigurationError extends AutomationError {}

export class AuthenticationError extends AutomationError {
  constructor(message: string, context?: Record<string, unknown>) {
    // Strip any inadvertent password field from context
    const safeContext = context ? sanitizeContext(context) : undefined;
    super(message, safeContext);
  }
}

export class ProfileNotFoundError extends AutomationError {
  constructor(profileId: string) {
    super(`Profile not found: "${profileId}"`, { profileId });
  }
}

export class ConnectionRequestError extends AutomationError {}

export class AdapterError extends AutomationError {}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SENSITIVE_KEYS = new Set(['password', 'token', 'secret', 'cookie', 'authorization']);

function sanitizeContext(ctx: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(ctx).map(([k, v]) => [k, SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : v]),
  );
}
