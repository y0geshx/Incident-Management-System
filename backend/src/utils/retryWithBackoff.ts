export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 100,
    maxDelayMs = 2000,
    factor = 2,
  } = options;

  let attempt = 0;
  let delay = initialDelayMs;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt >= maxAttempts) {
        break;
      }

      // Add small jitter to avoid retry storms under transient outages.
      const jitter = Math.floor(Math.random() * 50);
      await sleep(Math.min(delay + jitter, maxDelayMs));
      delay = Math.min(delay * factor, maxDelayMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Operation failed after retries");
}
