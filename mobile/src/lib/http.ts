import Constants from 'expo-constants';

const devHost = Constants.expoConfig?.hostUri?.split(':')[0] || (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL || `http://${devHost}:3000/v1`
).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export class ApiClient {
  constructor(private readonly getToken: () => Promise<string | null>) {}

  async request<T>(path: string, method: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const token = await this.getToken();
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timeout = setTimeout(abort, 15000);
    try {
      const response = await fetch(`${API_BASE_URL}/${path.replace(/^\//, '')}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = Array.isArray(payload?.message) ? payload.message.join('. ') : payload?.message;
        throw new ApiError(message || 'Something went wrong. Please try again.', response.status);
      }
      return payload as T;
    } catch (error) {
      if (error instanceof ApiError || signal?.aborted) throw error;
      throw new ApiError('Could not connect. Please check your connection and try again.', 0);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }

  get<T>(path: string, signal?: AbortSignal) { return this.request<T>(path, 'GET', undefined, signal); }
  post<T>(path: string, body?: unknown) { return this.request<T>(path, 'POST', body); }
  patch<T>(path: string, body: unknown) { return this.request<T>(path, 'PATCH', body); }
  put<T>(path: string, body?: unknown) { return this.request<T>(path, 'PUT', body); }
  delete<T>(path: string) { return this.request<T>(path, 'DELETE'); }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
