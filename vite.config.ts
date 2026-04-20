import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendHttp = (env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
  const backendWs = backendHttp.replace(/^http/, "ws");

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      // Proxy /ws and /api to the backend so the browser sees a single origin.
      // Critical for cookie-based auth on WebSockets: SameSite=Lax cookies
      // don't reliably flow cross-port, so we route WS through the dev server
      // (same origin as the SPA) and Vite forwards the upgrade to the backend
      // with all headers (including Cookie) preserved.
      proxy: {
        "/ws": {
          target: backendWs,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
        "/api": {
          target: backendHttp,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      css: false,
    },
  };
});
