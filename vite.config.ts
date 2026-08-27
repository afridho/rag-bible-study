import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    // Load .env into a local object. `vite` alone does NOT populate process.env
    // in this config file, so we read the values explicitly here. The "" prefix
    // loads ALL vars (not just VITE_-prefixed ones).
    const env = loadEnv(mode, process.cwd(), "");
    const apiUrl = env.API_URL || "http://localhost:3300";

    // Forward the shared secret to the backend so its host-secret guard accepts
    // dev-proxied requests, mirroring what server.cjs does in production.
    const proxyHeaders = env.API_SECRET
        ? { "X-Host-Secret": env.API_SECRET }
        : undefined;

    return {
        plugins: [react(), tailwindcss()],
        resolve: {
            alias: {
                "@": path.resolve(import.meta.dirname, "./src"),
            },
        },
        server: {
            proxy: {
                "/api/verses": {
                    target: apiUrl,
                    changeOrigin: true,
                    headers: proxyHeaders,
                    rewrite: (path) =>
                        path.replace(/^\/api\/verses/, "/api/bible/verses"),
                },
                "/api": {
                    target: apiUrl,
                    changeOrigin: true,
                    headers: proxyHeaders,
                    rewrite: (path) =>
                        path.replace(/^\/api/, "/api/bible/bible-study"),
                },
            },
        },
    };
});
