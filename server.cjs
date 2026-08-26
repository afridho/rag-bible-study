const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = process.env.API_URL || "http://localhost:3300";

// Proxy /api/verses → backend /api/bible/verses
app.use(
    "/api/verses",
    createProxyMiddleware({
        target: API_URL,
        changeOrigin: true,
        pathRewrite: { "^/api/verses": "/api/bible/verses" },
    }),
);

// Proxy /api → backend /api/bible/bible-study
app.use(
    "/api",
    createProxyMiddleware({
        target: API_URL,
        changeOrigin: true,
        pathRewrite: { "^/api": "/api/bible/bible-study" },
        followRedirects: false,
    }),
);

// Serve static files from Vite build
app.use(express.static(path.join(__dirname, "dist")));

// SPA fallback — only for non-API, non-static requests
app.use((req, res, next) => {
    // Don't serve index.html for API routes (shouldn't reach here, but safety)
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
