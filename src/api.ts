import { createClient } from '@supabase/supabase-js';
import type { Application, Input, Metrics } from './model';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export async function request<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  token?: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      typeof error?.detail === 'string'
        ? error.detail
        : `Request failed (${response.status}). Check your connection and try again.`,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const api = {
  list: (token: string) => request<Application[]>('/applications', 'GET', undefined, token),
  create: (input: Input, token: string) =>
    request<Application>('/applications', 'POST', input, token),
  update: (id: string, input: Input, token: string) =>
    request<Application>(`/applications/${id}`, 'PUT', input, token),
  remove: (id: string, token: string) =>
    request<void>(`/applications/${id}`, 'DELETE', undefined, token),
  analytics: (applications: Input[], signal?: AbortSignal) =>
    request<Metrics>('/analytics', 'POST', { applications }, undefined, signal),
};
