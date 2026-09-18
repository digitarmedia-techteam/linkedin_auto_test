/**
 * Application-wide constants.
 * Do NOT put environment-specific values here — use env.ts for those.
 */

/** Path to the saved Playwright authentication state (excluded from Git). */
export const AUTH_STATE_PATH = 'storage/auth.json';

/** Maximum number of retries for flaky network operations. */
export const MAX_RETRY_ATTEMPTS = 3;

/** Base delay (ms) between retry attempts (exponential back-off). */
export const RETRY_BASE_DELAY_MS = 500;

/** Selector for the global navigation avatar / user menu — used to confirm login. */
export const NAV_AVATAR_SELECTOR =
  '[data-testid="nav-avatar"], .global-nav__me-photo, button:has-text("Me"), nav button:has-text("Me")';

/** Selector for the main feed container — used to confirm login. */
export const FEED_SELECTOR =
  '[data-testid="feed-container"], .feed-shared-update-v2, .scaffold-layout__main, button:has-text("Start a post")';

/** Connection button data-testid on profile pages. */
export const CONNECT_BUTTON_SELECTOR = '[data-testid="connect-button"]';

/** "Pending" badge selector shown after a connection request is sent. */
export const PENDING_BADGE_SELECTOR = '[data-testid="connection-status-pending"]';
