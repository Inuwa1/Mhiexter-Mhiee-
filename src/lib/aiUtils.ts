import { GoogleGenAI } from '@google/genai';

const MAX_RETRIES = 5;
const INITIAL_DELAY = 2000; // 2 seconds

let currentKeyIndex = 0;

function getApiKey(): string {
  const customKeys = (import.meta.env.VITE_GEMINI_API_KEYS || "").split(',').filter(Boolean);
  const primaryKey = (window as any).GEMINI_API_KEY || (import.meta.env.VITE_GEMINI_API_KEY || "");
  
  const allKeys = [...customKeys];
  if (primaryKey && !allKeys.includes(primaryKey)) {
    allKeys.unshift(primaryKey);
  }

  if (allKeys.length === 0) return "";
  
  const key = allKeys[currentKeyIndex % allKeys.length];
  currentKeyIndex++;
  return key;
}

export async function callAiWithRetry<T>(
  apiCall: (apiKey: string) => Promise<T>,
  retries = MAX_RETRIES,
  delay = INITIAL_DELAY
): Promise<T> {
  try {
    const key = getApiKey();
    return await apiCall(key);
  } catch (error: any) {
    // Check if error is 429, 500, or network-level
    const status = error?.status || error?.error?.code || error?.error?.status || (typeof error?.error === 'string' ? error.error : null);
    const message = error?.message || error?.error?.message || (typeof error === 'string' ? error : "");
    
    const isRetryable = 
      status === 429 || 
      status === 500 || 
      status === 408 ||
      status === 502 ||
      status === 503 ||
      status === 504 ||
      status === 'RESOURCE_EXHAUSTED' ||
      message.includes('RESOURCE_EXHAUSTED') ||
      message.includes('429') ||
      message.includes('quota exceeded') ||
      message.includes('rate limit') ||
      message.includes('xhr error') ||
      message.includes('Http response') ||
      message.includes('fetch') ||
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('deadline exceeded');

    if (isRetryable && retries > 0) {
      console.warn(`Retryable error encountered (${error?.status || 'unknown'}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callAiWithRetry(apiCall, retries - 1, delay * 2);
    }
    throw error;
  }
}

export async function* streamAiWithRetry<T>(
  streamFactory: (apiKey: string) => Promise<AsyncGenerator<T, void, unknown>>,
  retries = MAX_RETRIES,
  delay = INITIAL_DELAY
): AsyncGenerator<T, void, unknown> {
  let currentRetries = retries;
  let currentDelay = delay;

  while (true) {
    try {
      const key = getApiKey();
      const stream = await streamFactory(key);
      yield* stream;
      return;
    } catch (error: any) {
      const status = error?.status || error?.error?.code || error?.error?.status || (typeof error?.error === 'string' ? error.error : null);
      const message = error?.message || error?.error?.message || (typeof error === 'string' ? error : "");

      const isRetryable = 
        status === 429 || 
        status === 500 || 
        status === 408 ||
        status === 502 ||
        status === 503 ||
        status === 504 ||
        status === 'RESOURCE_EXHAUSTED' ||
        message.includes('RESOURCE_EXHAUSTED') ||
        message.includes('429') ||
        message.includes('quota exceeded') ||
        message.includes('rate limit') ||
        message.includes('xhr error') ||
        message.includes('Http response') ||
        message.includes('fetch') ||
        message.includes('network') ||
        message.includes('connection') ||
        message.includes('deadline exceeded');

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
