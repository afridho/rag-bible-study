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
    }),
);

// Serve static files from Vite build
app.use(express.static(path.join(__dirname, "dist")));

// SPA fallback
app.use((req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
