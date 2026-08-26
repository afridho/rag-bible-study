import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        proxy: {
            "/api/verses": {
                target: process.env.API_URL || "http://localhost:3300",
                changeOrigin: true,
                rewrite: (path) =>
                    path.replace(/^\/api\/verses/, "/api/bible/verses"),
            },
            "/api": {
                target: process.env.API_URL || "http://localhost:3300",
                changeOrigin: true,
                rewrite: (path) =>
                    path.replace(/^\/api/, "/api/bible/bible-study"),
            },
        },
    },
});
