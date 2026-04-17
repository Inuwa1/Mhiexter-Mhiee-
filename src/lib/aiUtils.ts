import { GoogleGenAI } from '@google/genai';

const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000; // 1 second

export async function callAiWithRetry<T>(
  apiCall: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = INITIAL_DELAY
): Promise<T> {
  try {
    return await apiCall();
  } catch (error: any) {
    // Check if error is 429, 500, or network-level (status 0)
    const isRetryable = 
      error?.status === 429 || 
      error?.status === 500 || 
      error?.status === 0 ||
      error?.message?.includes('RESOURCE_EXHAUSTED') ||
      error?.message?.includes('xhr error') ||
      error?.message?.includes('Http response');

    if (isRetryable && retries > 0) {
      console.warn(`Retryable error encountered (${error?.status || 'unknown'}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callAiWithRetry(apiCall, retries - 1, delay * 2);
    }
    throw error;
  }
}

export async function* streamAiWithRetry<T>(
  streamFactory: () => Promise<AsyncGenerator<T, void, unknown>>,
  retries = MAX_RETRIES,
  delay = INITIAL_DELAY
): AsyncGenerator<T, void, unknown> {
  let currentRetries = retries;
  let currentDelay = delay;

  while (true) {
    try {
      const stream = await streamFactory();
      yield* stream;
      return;
    } catch (error: any) {
      const isRetryable = 
        error?.status === 429 || 
        error?.status === 500 || 
        error?.status === 0 ||
        error?.message?.includes('RESOURCE_EXHAUSTED') ||
        error?.message?.includes('xhr error') ||
        error?.message?.includes('Http response');

      if (isRetryable && currentRetries > 0) {
        console.warn(`Retryable error encountered during stream (${error?.status || 'unknown'}), retrying in ${currentDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        currentRetries--;
        currentDelay *= 2;
        continue;
      }
      throw error;
    }
  }
}
