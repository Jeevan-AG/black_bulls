// ─── Vantix Backend — Main Server ────────────────────────────────────────────
// Entry point. Run with:
//   node server.js          (production)
//   npm run dev             (development — auto-restarts via nodemon)
//
// Architecture:
//   1. dotenv loads .env into process.env
//   2. connectDB() connects Mongoose to MongoDB
//   3. Express middleware (CORS, JSON body parser, request logger)
//   4. Routes: auth, users, analytics, rules, violations, reports
//   5. Vantix Core: /api/vantix — AI Proxy Gateway (7-step pipeline)
//   6. WebSocket telemetry server attached to HTTP server
//   7. 404 handler + central error handler
// ─────────────────────────────────────────────────────────────────────────────

const path       = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") }); // must be first — loads .env before anything else reads process.env

const http       = require("http");
const express    = require("express");
const cors       = require("cors");
const morgan     = require("morgan");
const connectDB  = require("./config/db");
const { errorHandler } = require("./middleware/errorHandler");
const { attachWebSocket } = require("./engines/wsServer");

// ── Connect to MongoDB ────────────────────────────────────────────────────────
connectDB();

// ── Start Jobs ───────────────────────────────────────────────────────────────
require("./jobs/inactivityChecker")();

// ── Create Express app ────────────────────────────────────────────────────────
const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────

// CORS — allow all in dev, or restricted origins via CORS_ORIGIN in prod
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map(o => o.trim())
  : "*";

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Parse JSON & URL-encoded request bodies (supports large document dumps & logs)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// HTTP request logger — "dev" format: METHOD /path STATUS ms
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check — GET / → "Vantix API running"
app.get("/", (req, res) => {
  res.json({
    status:  "ok",
    message: "Vantix Silent AI Data Firewall — API running",
    version: "2.0.0",
    engines: ["industrialDetector", "teeEnclave", "sessionGraph", "wsServer"],
  });
});

// ─── Existing Routes (preserved — zero breaking changes) ─────────────────────

// Authentication logic
app.use("/api/auth", require("./routes/auth"));

// Admin Endpoints
app.use("/api/users", require("./routes/users"));
app.use("/api/analytics", require("./routes/analytics"));
app.use("/api/activity", require("./routes/activity"));
app.use("/api/reports", require("./routes/reports"));

// Detection rules (managed by admin dashboard)
app.use("/api/rules", require("./routes/rules"));

// Custom flagged keywords/patterns — lightweight, in-memory, no MongoDB/auth
// required. Polled by the browser extension's background worker.
app.use("/api/custom-rules", require("./routes/customRules"));

// Presidio integration (legacy — kept for backward compatibility)
app.use("/api/scan", require("./routes/scan"));
app.use("/api/check", require("./routes/scan"));

// Violation log (legacy — kept for backward compatibility)
app.use("/api/violations", require("./routes/violations"));

// ─── Vantix Core — AI Proxy Gateway ─────────────────────────────────────────
// The heart of Vantix: 7-step silent pipeline
//   POST /api/vantix/chat         — Process a prompt through the full pipeline
//   GET  /api/vantix/session-graph — D3 visualization data for admin dashboard
//   POST /api/vantix/reset        — Reset session graph for demo replay
//   GET  /api/vantix/attestation  — TEE attestation report
//   GET  /api/vantix/health       — Engine health check
app.use("/api/vantix", require("./routes/proxy"));
app.use("/", require("./routes/proxy"));

// ── 404 handler — unknown routes ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error:   `Route not found: ${req.method} ${req.path}`,
  });
});

// ── Central error handler (must be after all routes) ─────────────────────────
app.use(errorHandler);

// ── Start HTTP server + WebSocket ────────────────────────────────────────────
const PORT = parseInt(process.env.PORT) || 5000;

// Create raw HTTP server so we can attach WebSocket to the same port
const server = http.createServer(app);

// Attach WebSocket telemetry server
attachWebSocket(server);

server.listen(PORT, "0.0.0.0", () => {
  console.log("═════════════════════════════════════════════════════════════");
  console.log("  VANTIX — Silent AI Data Firewall");
  console.log("═════════════════════════════════════════════════════════════");
  console.log(`  HTTP Server:     http://localhost:${PORT}`);
  console.log(`  WebSocket:       ws://localhost:${PORT}/ws/vantix`);
  console.log("─────────────────────────────────────────────────────────────");
  console.log("  Core Engine Routes:");
  console.log(`  POST   /api/vantix/chat          — 7-step AI pipeline`);
  console.log(`  GET    /api/vantix/session-graph  — D3 visualization data`);
  console.log(`  POST   /api/vantix/reset          — Reset demo session`);
  console.log(`  GET    /api/vantix/attestation    — TEE attestation report`);
  console.log(`  GET    /api/vantix/health         — Engine health check`);
  console.log("─────────────────────────────────────────────────────────────");
  console.log("  Legacy Routes (preserved):");
  console.log(`  /api/auth, /api/users, /api/analytics, /api/rules`);
  console.log(`  /api/violations, /api/reports, /api/scan`);
  console.log("═════════════════════════════════════════════════════════════");

  // ── System-Wide Transparent Proxy (iptables REDIRECT mode) ──────────────
  // When started with VANTIX_TRANSPARENT=1, we also start a transparent
  // MITM proxy on port 8443 in this same process. Because it shares the
  // Node.js event loop + module cache, ws.broadcastDetection() works
  // instantly — intercepted prompts light up the admin dashboard in real time.
  if (process.env.VANTIX_TRANSPARENT === "1") {
    const PROXY_PORT = parseInt(process.env.VANTIX_PROXY_PORT) || 8443;
    const { createTransparentProxy } = require("../vantix-bridge/bridgeProxy");
    const transparentProxy = createTransparentProxy({ port: PROXY_PORT });
    transparentProxy.start(() => {
      console.log("─────────────────────────────────────────────────────────────");
      console.log("  SYSTEM-WIDE TRANSPARENT INTERCEPTION: ACTIVE ✓");
      console.log(`  Transparent Proxy: 0.0.0.0:${PROXY_PORT}`);
      console.log("  All AI API traffic on this machine is being inspected.");
      console.log("═════════════════════════════════════════════════════════════");
    });
  }
});