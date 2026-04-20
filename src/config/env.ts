/**
 * Central environment configuration.
 *
 * Dev: both HTTP and WS are forced to *same-origin* so the browser sends
 *      SameSite=Lax cookies without hesitation. Vite's dev server proxies
 *      `/api` and `/ws` to the real backend (see vite.config.ts), using
 *      VITE_API_URL as the upstream target. The SPA itself never calls
 *      the backend directly in dev.
 * Prod: VITE_API_URL / VITE_WS_URL are required and used verbatim.
 *
 * HTTP API base URL   → VITE_API_URL
 * WebSocket base URL  → VITE_WS_URL (derived from VITE_API_URL if absent)
 */

const rawApiUrl = import.meta.env.VITE_API_URL as string | undefined;
const rawWsUrl = import.meta.env.VITE_WS_URL as string | undefined;

function sameOriginHttp(): string {
    if (typeof window === "undefined") return "";
    return `${window.location.protocol}//${window.location.host}`;
}

function sameOriginWs(): string {
    if (typeof window === "undefined") return "";
    const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${scheme}//${window.location.host}`;
}

/** HTTP base URL for all REST API calls (no trailing slash). */
export const API_URL: string = (() => {
    // Dev: always same-origin — Vite proxies `/api` → VITE_API_URL.
    // This keeps the cookie jar single-origin so auth works on WS too.
    if (import.meta.env.DEV) return sameOriginHttp();
    if (!rawApiUrl) {
        throw new Error("[Synapse] VITE_API_URL is not set. Please set it in your .env file.");
    }
    return rawApiUrl.replace(/\/$/, "");
})();

/**
 * WebSocket base URL.
 * Dev: same-origin (routed through Vite's `/ws` proxy → cookies flow).
 * Prod: VITE_WS_URL if set, otherwise derived from VITE_API_URL by swapping scheme.
 */
export const WS_URL: string = (() => {
    if (import.meta.env.DEV) return sameOriginWs();
    if (rawWsUrl) return rawWsUrl.replace(/\/$/, "");
    return API_URL.replace(/^http/, "ws");
})();

if (import.meta.env.DEV && typeof window !== "undefined") {
    // Help debug transport config in the browser console.
    // eslint-disable-next-line no-console
    console.log("[env] API_URL =", API_URL, "| WS_URL =", WS_URL);
}
