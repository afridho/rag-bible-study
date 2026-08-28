const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = process.env.API_URL || "http://localhost:3300";
// Shared secret sent to the backend so it accepts only proxied requests.
// Must match HOST_SECRET on the afridho-api side.
const API_SECRET = process.env.API_SECRET || "";

// Trust the platform edge (Railway) so req.ip resolves to the real client IP
// from the inbound X-Forwarded-For, rather than the edge's own address.
app.set("trust proxy", true);

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
    // We re-serialize req.body below, so the original content-length no longer
    // matches. Leaving it causes the backend body parser to read a truncated/
    // empty body (query becomes undefined → "Query is required", empty stream).
    // Let fetch recompute it from the new body.
    delete headers["content-length"];

    // Anti-spoof client IP: the backend rate-limiter keys on X-Real-Client-IP.
    // A malicious user could send this header themselves to dodge the limit by
    // rotating fake IPs, so we ALWAYS strip any inbound copy and set it from
    // req.ip (trusted, derived from the platform edge's X-Forwarded-For).
    delete headers["x-real-client-ip"];
    headers["x-real-client-ip"] = req.ip;

    // Shared secret so the backend accepts only proxied traffic. Always strip
    // any inbound copy first so a client can't forge it, then set our own.
    delete headers["x-host-secret"];
    if (API_SECRET) headers["x-host-secret"] = API_SECRET;

    // Abort the upstream request when the client disconnects (Stop button /
    // closed tab), and after a hard timeout so a hung backend can't tie up the
    // proxy connection forever. This propagates the cancellation to the backend,
    // which in turn aborts the LLM stream.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min
    // Abort only when the RESPONSE socket closes (client truly went away). Using
    // req 'close' here is unsafe for streaming: it can fire once the request
    // body is fully received while the SSE response is still streaming, which
    // would abort the upstream and produce an empty stream in production.
    res.on("close", () => controller.abort());

    const fetchOptions = {
        method: req.method,
        headers,
        signal: controller.signal,
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
                    if (controller.signal.aborted) break;
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(value);
                }
            };
            await push();
        }
        if (!res.writableEnded) res.end();
    } catch (err) {
        // Client disconnect / timeout — expected, nothing to report.
        if (controller.signal.aborted || err.name === "AbortError") {
            if (!res.writableEnded) res.end();
            return;
        }
        console.error("[Proxy Error]", err.message);
        if (!res.headersSent) {
            res.status(502).json({
                error: "Bad Gateway",
                message: err.message,
            });
        }
    } finally {
        clearTimeout(timeout);
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
