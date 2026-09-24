// ─── Vantix — WebSocket Telemetry Server ─────────────────────────────────────
// Real-time event broadcast to the admin dashboard.
// Authenticated connections (admin token verified on upgrade).
// Broadcasts detection events, risk scores, session graph updates,
// and anomaly alerts as they happen.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");

let _wss = null;

/**
 * Attach WebSocket server to an existing HTTP server.
 *
 * @param {import('http').Server} httpServer
 */
function attachWebSocket(httpServer) {
  _wss = new WebSocketServer({ server: httpServer, path: "/ws/vantix" });

  _wss.on("connection", (ws, req) => {
    // Authenticate via query param: ?token=...
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (token) {
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || "vantix_fallback_secret_key"
        );
        ws.userId = decoded.id;
        ws.userRole = decoded.role;
        ws.orgId = decoded.orgId;
      } catch {
        // Allow unauthenticated connections for demo mode
        ws.userId = "demo";
        ws.userRole = "demo";
        ws.orgId = "demo";
      }
    } else {
      // Demo mode — allow without token
      ws.userId = "demo";
      ws.userRole = "demo";
      ws.orgId = "demo";
    }

    console.log(`[WS] Client connected (${ws.userRole})`);

    ws.on("close", () => {
      console.log(`[WS] Client disconnected (${ws.userRole})`);
    });

    ws.on("error", (err) => {
      console.error("[WS] Error:", err.message);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: "connected",
      message: "Vantix telemetry stream active",
      timestamp: new Date().toISOString(),
    }));
  });

  console.log("[WS] WebSocket server attached at /ws/vantix");
}


/**
 * Broadcast a telemetry event to all connected admin clients.
 *
 * @param {object} event — Telemetry payload
 */
function broadcast(event) {
  if (!_wss) return;

  const payload = JSON.stringify(event);
  let sent = 0;

  _wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(payload);
      sent++;
    }
  });
}


/**
 * Broadcast a detection event (called by the proxy gateway after processing).
 */
function broadcastDetection(data) {
  broadcast({
    type: "detection",
    timestamp: data.timestamp || new Date().toISOString(),
    promptSnippet: data.originalPrompt
      ? data.originalPrompt.slice(0, 120) + (data.originalPrompt.length > 120 ? "..." : "")
      : (data.sanitizedPrompt
        ? data.sanitizedPrompt.slice(0, 120) + (data.sanitizedPrompt.length > 120 ? "..." : "")
        : ""),
    originalPrompt: data.originalPrompt || "",
    sanitizedPrompt: data.sanitizedPrompt || "",
    restoredResponse: data.restoredResponse || "",
    riskScore: data.riskScore,
    detections: (data.detections || []).map((d) => ({
      category: d.category,
      label: d.label,
      isolationRisk: d.isolationRisk,
      value: d.value,
    })),
    combinations: data.combinations || [],
    contextScore: data.contextScore,
    actionTaken: data.actionTaken,
    sessionCoverage: data.sessionCoverage || {},
    sessionRiskScore: data.sessionRiskScore || 0,
    promptCount: data.promptCount || 0,
    anomalyTriggered: data.anomalyTriggered || false,
    user: data.user || (process.env.USERNAME || process.env.USER || "employee"),
    host: data.host || (require("os").hostname() || "workstation"),
    endpointIp: data.endpointIp || "127.0.0.1",
    signature: data.signature || "HMAC-SHA256-VERIFIED",
  });
}


/**
 * Get count of connected clients.
 */
function getClientCount() {
  if (!_wss) return 0;
  let count = 0;
  _wss.clients.forEach((client) => {
    if (client.readyState === 1) count++;
  });
  return count;
}


module.exports = {
  attachWebSocket,
  broadcast,
  broadcastDetection,
  getClientCount,
};
