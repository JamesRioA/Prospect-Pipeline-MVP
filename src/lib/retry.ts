export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 1000;

export async function withRetry<T>(
  primaryFn: () => Promise<T>,
  fallbackValue: T,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    onRetry,
  } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await primaryFn();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const isRateLimit = message.includes('429');
      const isServerError = /^5\d{2}/.test(message);
      const isLastAttempt = attempt === maxAttempts;

      if (isLastAttempt || (!isRateLimit && !isServerError)) {
        console.error(
          `[withRetry] All ${attempt} attempt(s) exhausted, returning fallback`,
          { error: message }
        );
        return fallbackValue;
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      onRetry?.(attempt, error);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return fallbackValue;
}
