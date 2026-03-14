export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isTransientNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  const normalized = message.toLowerCase();

  return (
    normalized.includes('network request failed') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('fetch failed') ||
    normalized.includes('timed out') ||
    normalized.includes('timeout') ||
    normalized.includes('connection refused') ||
    normalized.includes('connection reset') ||
    normalized.includes('connection terminated') ||
    normalized.includes('socket hang up') ||
    normalized.includes('temporary failure')
  );
}

export async function retryAsync<T>(
  task: () => Promise<T>,
  options?: {
    retries?: number;
    delayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
  }
): Promise<T> {
  const retries = Math.max(0, options?.retries ?? 0);
  const delayMs = Math.max(0, options?.delayMs ?? 0);
  const shouldRetry = options?.shouldRetry ?? (() => false);

  let attempt = 0;

  while (true) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error)) {
        throw error;
      }
      attempt += 1;
      if (delayMs > 0) {
        await sleep(delayMs * attempt);
      }
    }
  }
}
