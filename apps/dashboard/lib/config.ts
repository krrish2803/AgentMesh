const rawBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8005').replace(/\/+$/, '');

export const API_BASE_URL = rawBase;

export const WS_BASE_URL = rawBase.replace(/^http/, 'ws');

export const WS_EVENTS_URL = `${WS_BASE_URL}/ws/events`;

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
