/**
 * Central environment configuration.
 *
 * All environment-dependent URLs are sourced from Vite env vars,
 * never hardcoded. Set these in your root `.env` file before running.
 *
 * HTTP API base URL   → VITE_API_URL
 * WebSocket base URL  → VITE_WS_URL  (derived from VITE_API_URL if absent)
 */

const rawApiUrl = import.meta.env.VITE_API_URL as string | undefined;

if (!rawApiUrl) {
  throw new Error('[Synapse] VITE_API_URL is not set. Please set it in your .env file.');
}

/** HTTP base URL for all REST API calls (no trailing slash). */
export const API_URL: string = rawApiUrl.replace(/\/$/, '');

/**
 * WebSocket base URL.
 * Uses VITE_WS_URL if explicitly set; otherwise derived from VITE_API_URL
 * by replacing the http(s) scheme with ws(s).
 */
export const WS_URL: string = (() => {
  const explicit = import.meta.env.VITE_WS_URL as string | undefined;
  if (explicit) return explicit.replace(/\/$/, '');
  // Derive: http → ws, https → wss
  return API_URL.replace(/^http/, 'ws');
})();
