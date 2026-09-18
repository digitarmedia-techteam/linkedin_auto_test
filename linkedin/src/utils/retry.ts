import { logger } from './logger.js';

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3 */
  maxAttempts?: number;
  /** Base delay in ms before first retry; doubles each attempt. Default: 500 */
  baseDelayMs?: number;
  /** Optional label for logging. */
  label?: string;
  /** Predicate to decide whether to retry on a given error. Default: always retry. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

/**
 * Generic retry helper with exponential back-off.
 * Do NOT use aggressive retries against external services.
 * maxAttempts is capped at 5 to prevent runaway loops.
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxAttempts = Math.min(options?.maxAttempts ?? 3, 5);
  const baseDelayMs = options?.baseDelayMs ?? 500;
  const label = options?.label ?? 'operation';
  const shouldRetry = options?.shouldRetry ?? (() => true);

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !shouldRetry(error, attempt)) {
        logger.error(`[retry] "${label}" failed after ${attempt} attempt(s).`, {
          attempt,
          maxAttempts,
          error: error instanceof Error ? error.message : String(error),
        });
        break;
      }

      const delay = baseDelayMs * 2 ** (attempt - 1);
      logger.warn(`[retry] "${label}" attempt ${attempt} failed — retrying in ${delay}ms.`, {
        attempt,
        delay,
      });
      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
