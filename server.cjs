const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = process.env.API_URL || "http://localhost:3300";

// Parse JSON bodies for proxy forwarding
app.use("/api", express.json());

// Proxy /api/verses/* → backend /api/bible/verses/*
app.all("/api/verses/{*splat}", async (req, res) => {
    const splat = Array.isArray(req.params.splat)
        ? req.params.splat.join("/")
        : req.params.splat;
    const targetPath = `/api/bible/verses/${splat}`;
    await proxyRequest(req, res, targetPath);
});

// Proxy /api/* → backend /api/bible/bible-study/*
app.all("/api/{*splat}", async (req, res) => {
    const splat = Array.isArray(req.params.splat)
        ? req.params.splat.join("/")
        : req.params.splat;
    const targetPath = `/api/bible/bible-study/${splat}`;
    await proxyRequest(req, res, targetPath);
});

async function proxyRequest(req, res, targetPath) {
    // Preserve the original query string (?lesson=3&page=1...). The route splat
    // only captures the path, so without this every query param would be dropped
    // and backend filters (lesson/section/version/search) would silently no-op.
    const qsIndex = req.originalUrl.indexOf("?");
    const queryString = qsIndex >= 0 ? req.originalUrl.slice(qsIndex) : "";
    const url = `${API_URL}${targetPath}${queryString}`;
    const headers = { ...req.headers };

    // Remove hop-by-hop headers
    delete headers.host;
    delete headers.connection;

    const fetchOptions = {
        method: req.method,
        headers,
    };

    if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
        fetchOptions.body = JSON.stringify(req.body);
    }

    try {
        console.log(`[Proxy] ${req.method} ${url}`);
        const response = await fetch(url, fetchOptions);

        // Forward status and headers
        res.status(response.status);
        for (const [key, value] of response.headers.entries()) {
            if (
                key.toLowerCase() !== "transfer-encoding" &&
                key.toLowerCase() !== "connection"
            ) {
                res.setHeader(key, value);
            }
        }

        // Stream the response body
        if (response.body) {
            const reader = response.body.getReader();
            const push = async () => {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        res.end();
                        break;
                    }
                    res.write(value);
                }
            };
            await push();
        } else {
            res.end();
        }
    } catch (err) {
        console.error("[Proxy Error]", err.message);
        if (!res.headersSent) {
            res.status(502).json({
                error: "Bad Gateway",
                message: err.message,
            });
        }
    }
}

// Serve static files from Vite build
app.use(express.static(path.join(__dirname, "dist")));

// SPA fallback
app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
