import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * A separate HTTP client for everything the counter station does.
 *
 * The shared apiService installs a global interceptor that, on any 401, clears
 * the token and navigates to /admin/login. At a counter that is a bug with
 * teeth: a session that expires during a shift would throw the librarian off
 * the page while it is still holding scans that have not been saved anywhere
 * else. This client has no interceptor, so an expired session surfaces as a
 * message in the status bar and the queue stays where it is.
 */
export const stationClient = axios.create({ baseURL: API_BASE_URL });

stationClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export class SessionExpiredError extends Error {
  constructor() {
    super('Your session has expired. Sign in again to save the scans on this computer.');
    this.name = 'SessionExpiredError';
  }
}

/** Narrow a failure into something the desk can render without guessing. */
export const asStationError = (error: unknown): Error => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 401 || status === 403) return new SessionExpiredError();
  const body = (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return new Error(body?.error || body?.message || (error as Error)?.message || 'Something went wrong');
};
