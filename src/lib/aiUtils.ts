import { GoogleGenAI } from '@google/genai';

const MAX_RETRIES = 3;
const INITIAL_DELAY = 1500;

let currentKeyIndex = 0;

export function getApiKey(): string {
  // 1. Check window object
  const winKey = typeof window !== 'undefined' ? (window as any).GEMINI_API_KEY : null;
  if (winKey && winKey !== 'MISSING_KEY' && winKey.trim()) return winKey.trim();

  // 2. Check localStorage
  const localKey = typeof localStorage !== 'undefined' ? localStorage.getItem('geminiApiKey') : null;
  if (localKey && localKey !== 'MISSING_KEY' && localKey.trim()) return localKey.trim();

  // 3. Check rotating keys
  const customKeys = (import.meta.env.VITE_GEMINI_API_KEYS || "")
    .split(',')
    .map((k: string) => k.trim())
    .filter((k: string) => k && k !== 'MISSING_KEY');
  if (customKeys.length > 0) {
    const key = customKeys[currentKeyIndex % customKeys.length];
    currentKeyIndex++;
    return key;
  }

  // 4. Check primary VITE env key
  const primaryKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (primaryKey && primaryKey !== 'MISSING_KEY' && primaryKey.trim()) {
    return primaryKey.trim();
  }

  return "";
}

function isAuthOrKeyError(status: any, message: string): boolean {
  return (
    status === 401 ||
    status === 403 ||
    status === 'PERMISSION_DENIED' ||
    message.includes('API key not valid') ||
    message.includes('API_KEY_INVALID') ||
    message.includes('unregistered callers') ||
    message.includes('PERMISSION_DENIED') ||
    message.includes('MISSING_API_KEY')
  );
}

export async function callAiWithRetry<T>(
  apiCall: (apiKey: string) => Promise<T>,
  retries = MAX_RETRIES,
  delay = INITIAL_DELAY
): Promise<T> {
  const key = getApiKey();
  if (!key) {
    throw new Error("MISSING_API_KEY: Gemini API Key is missing. Please add your key in Settings.");
  }

  try {
    return await apiCall(key);
  } catch (error: any) {
    const status = error?.status || error?.error?.code || error?.error?.status || (typeof error?.error === 'string' ? error.error : null);
    const message = error?.message || error?.error?.message || (typeof error === 'string' ? error : "");
    
    // Auth and missing key errors should NEVER be retried
    if (isAuthOrKeyError(status, message)) {
      throw error;
    }

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
    const key = getApiKey();
    if (!key) {
      throw new Error("MISSING_API_KEY: Gemini API Key is missing. Please add your key in Settings.");
    }

    try {
      const stream = await streamFactory(key);
      yield* stream;
      return;
    } catch (error: any) {
      const status = error?.status || error?.error?.code || error?.error?.status || (typeof error?.error === 'string' ? error.error : null);
      const message = error?.message || error?.error?.message || (typeof error === 'string' ? error : "");

      // Do NOT retry missing or invalid API keys
      if (isAuthOrKeyError(status, message)) {
        throw error;
      }

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
