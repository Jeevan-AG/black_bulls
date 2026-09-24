// ─── Vantix Network Bridge — Transparent MITM Interception Daemon ────────────
// Sits at the network/OS layer and intercepts outbound AI requests transparently.
// Extracts OS user identity (kernel/OS level) without requiring login.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const http = require("http");
const https = require("https");
const net = require("net");
const tls = require("tls");
const url = require("url");
const os = require("os");
const path = require("path");

const { getCertForHost, getOrCreateRootCa } = require("./certManager");

// Import detection & TEE engines directly for ultra-low latency (<5ms)
const { analyzePrompt } = require("../vantix-backend/engines/industrialDetector");
const tee = require("../vantix-backend/engines/teeEnclave");
const ws = require("../vantix-backend/engines/wsServer");
const sessionGraph = require("../vantix-backend/engines/sessionGraph");

// Target AI API domains to intercept (all other web traffic passes through untouched)
const AI_DOMAINS = [
  "api.openai.com",
  "api.anthropic.com",
  "generativelanguage.googleapis.com",
  "api.groq.com",
  "api.together.xyz",
  "api.mistral.ai",
  "api.cohere.com",
  "api.deepseek.com",
  "api.perplexity.ai",
];

const WEB_AI_DOMAINS = [
  "chatgpt.com",
  "chat.openai.com",
  "openai.com",
  "claude.ai",
  "anthropic.com",
  "gemini.google.com",
  "perplexity.ai",
  "deepseek.com",
  "chat.deepseek.com",
  "copilot.microsoft.com",
  "grok.com",
  "x.ai",
  "meta.ai",
  "poe.com",
];

const DEFAULT_PORT = 8443;
const BACKEND_ENDPOINT = process.env.VANTIX_BACKEND_URL || "http://127.0.0.1:5000";

let stats = {
  interceptedPrompts: 0,
  redactedTokens: 0,
  activeConnections: 0,
  startedAt: new Date().toISOString(),
};

/**
 * Checks if a hostname matches any monitored AI platform.
 */
function isAiDomain(host) {
  const cleanHost = host.split(":")[0].toLowerCase();
  return AI_DOMAINS.some((domain) => cleanHost === domain || cleanHost.endsWith("." + domain)) ||
         WEB_AI_DOMAINS.some((domain) => cleanHost === domain || cleanHost.endsWith("." + domain));
}

function isWebAiDomain(host) {
  const cleanHost = host.split(":")[0].toLowerCase();
  return WEB_AI_DOMAINS.some((domain) => cleanHost === domain || cleanHost.endsWith("." + domain));
}

/**
 * Resolves local OS/kernel user identity automatically.
 */
function getSystemIdentity() {
  let username = process.env.USER || process.env.USERNAME || "employee";
  try {
    username = os.userInfo().username || username;
  } catch (e) {}

  return {
    user: username,
    host: os.hostname(),
    platform: os.platform(),
    email: `${username}@${os.hostname().toLowerCase().replace(/[^a-z0-9]/g, "")}.corp`,
  };
}

/**
 * Creates the MITM Proxy Server.
 */
function createBridgeServer(options = {}) {
  const port = options.port || DEFAULT_PORT;
  getOrCreateRootCa(); // Ensure CA exists

  const server = http.createServer((req, res) => {
    // Direct HTTP request handling (e.g. forward proxy or drop-in)
    handleHttpRequest(req, res);
  });

  // Handle HTTPS CONNECT tunneling
  server.on("connect", (req, clientSocket, head) => {
    const targetHost = req.url;
    const [hostname, targetPortStr] = targetHost.split(":");
    const targetPort = parseInt(targetPortStr) || 443;

    if (!isAiDomain(hostname)) {
      // Non-AI traffic: Direct transparent TCP pass-through (zero inspection overhead)
      const serverSocket = net.connect(targetPort, hostname, () => {
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        serverSocket.write(head);
        serverSocket.pipe(clientSocket);
        clientSocket.pipe(serverSocket);
      });

      serverSocket.on("error", (err) => {
        clientSocket.destroy();
      });
      clientSocket.on("error", () => {
        serverSocket.destroy();
      });
      return;
    }

    // AI Traffic: Intercept TLS handshake with dynamic host certificate!
    console.log(`\n[Vantix-Bridge] ⚡ Intercepting AI traffic to: ${hostname}:${targetPort}`);
    stats.interceptedPrompts++;

    clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");

    const hostCert = getCertForHost(hostname);

    const tlsServer = new tls.Server({
      key: hostCert.key,
      cert: hostCert.cert,
      ALPNProtocols: ["http/1.1"],
    });

    tlsServer.emit("connection", clientSocket);

    tlsServer.on("secureConnection", (tlsSocket) => {
      // Parse plain HTTPS request inside the decrypted tunnel
      let buffer = Buffer.alloc(0);

      tlsSocket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        const headerEnd = buffer.indexOf("\r\n\r\n");
        if (headerEnd === -1) return;

        // Process request once headers are complete
        processInterceptedAiRequest(buffer, hostname, targetPort, tlsSocket);
      });
    });

    tlsServer.on("error", (err) => {
      // Normal when clients close connection
    });
  });

  return {
    server,
    start: (cb) => server.listen(port, "127.0.0.1", cb),
    stop: (cb) => server.close(cb),
    getPort: () => port,
    getStats: () => ({ ...stats }),
  };
}

/**
 * Processes decrypted AI request, applies 7-step pipeline, forwards, and restores.
 */
function processInterceptedAiRequest(rawBuffer, hostname, port, clientTlsSocket) {
  const identity = getSystemIdentity();
  const rawStr = rawBuffer.toString("utf8");
  const headerEnd = rawStr.indexOf("\r\n\r\n");
  const headerPart = rawStr.slice(0, headerEnd);
  const bodyPart = rawStr.slice(headerEnd + 4);

  // Parse HTTP method and path
  const firstLine = headerPart.split("\r\n")[0];
  const [method, reqPath] = firstLine.split(" ");

  // Extract prompt text from JSON payload
  let promptText = "";
  let parsedJson = null;

  try {
    parsedJson = JSON.parse(bodyPart);
    if (Array.isArray(parsedJson.messages)) {
      const lastMsg = parsedJson.messages[parsedJson.messages.length - 1];
      promptText = typeof lastMsg.content === "string" ? lastMsg.content : JSON.stringify(lastMsg.content);
    } else if (parsedJson.prompt) {
      promptText = parsedJson.prompt;
    }
  } catch (e) {
    // Non-JSON or streaming chunk, pass forward directly
  }

  const cleanHost = hostname.split(":")[0].toLowerCase();
  const isWeb = isWebAiDomain(cleanHost);

  // Enforce Browser Guard for web AI interfaces (ChatGPT, Claude, Gemini)
  if (isWeb) {
    const headers = parseHeaders(headerPart);
    const hasGuardExtension = headers["x-vantix-extension"] === "active" || headers["x-vantix-source"] === "browser-guard";

    if (!hasGuardExtension) {
      console.log(`\n[Vantix-Bridge] ⛔ UNMANAGED ACCESS BLOCKED: ${hostname} (User: ${identity.user}@${identity.host}) — Missing Browser Guard Extension`);
      stats.interceptedPrompts++;

      try {
        ws.broadcastDetection({
          originalPrompt: `[UNMANAGED ACCESS BLOCKED] User attempted to open ${hostname} without Vantix Browser Guard`,
          sanitizedPrompt: "[POLICY_VIOLATION_BLOCKED]",
          restoredResponse: "",
          riskScore: 90,
          detections: [{ category: "UNMANAGED_AI_ACCESS", value: hostname, severity: "CRITICAL" }],
          combinations: [],
          contextScore: 90,
          actionTaken: "hard_block",
          sessionCoverage: {},
          sessionRiskScore: 90,
          promptCount: 1,
          anomalyTriggered: true,
          anomalyReport: `Direct browser navigation to ${hostname} was blocked at Layer 1. The employee has not activated the Vantix Browser Guard extension.`,
          user: identity.user,
          host: identity.host,
          interceptSource: "network-layer-unmanaged-block",
          timestamp: new Date().toISOString(),
        });

        fetch("https://vantix-backend-7gcw.onrender.com/api/vantix/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Vantix-User": identity.user,
            "X-Vantix-Host": identity.host,
            "X-Vantix-Source": "network-unmanaged-block",
          },
          body: JSON.stringify({
            prompt: `[UNMANAGED WEB AI ACCESS BLOCKED] Attempted connection to ${hostname} without Vantix Browser Guard.`,
            userId: identity.user,
            user: identity.user,
            host: identity.host,
            sessionId: `unmanaged-${Date.now()}`,
          }),
        }).catch(() => {});
      } catch (e) {}

      const blockHtml = getUnmanagedBlockHtml(hostname, identity);
      const resHeaders = [
        "HTTP/1.1 403 Forbidden",
        "Content-Type: text/html; charset=utf-8",
        `Content-Length: ${Buffer.byteLength(blockHtml)}`,
        "Connection: close",
        "\r\n",
      ].join("\r\n");

      clientTlsSocket.write(resHeaders + blockHtml);
      clientTlsSocket.end();
      return;
    }

    // Has extension: forward directly to upstream so extension's DOM protection can monitor prompts
    forwardRawToUpstream(rawBuffer, hostname, port, clientTlsSocket);
    return;
  }

  if (!promptText) {
    // Not a prompt payload — forward directly to upstream
    forwardRawToUpstream(rawBuffer, hostname, port, clientTlsSocket);
    return;
  }

  console.log(`[Vantix-Bridge] User: [${identity.user}@${identity.host}]`);
  console.log(`[Vantix-Bridge] Intercepted Prompt: "${promptText.slice(0, 80)}..."`);

  // Run 3-Sublayer Detection Engine
  const detection = analyzePrompt(promptText);
  const sessionId = `bridge-${Date.now()}`;

  let sanitizedPrompt = promptText;
  let tokenTable = new Map();

  if (detection.detections.length > 0) {
    tokenTable = tee.createTokenTable(sessionId, detection.detections);
    sanitizedPrompt = tee.sanitizePrompt(promptText, tokenTable);
    console.log(`[Vantix-Bridge] 🛡 TEE Sanitized (${detection.detections.length} sensitive tokens redacted)`);
    stats.redactedTokens += detection.detections.length;
  }

  // Update request JSON with sanitized prompt
  if (parsedJson && parsedJson.messages) {
    parsedJson.messages[parsedJson.messages.length - 1].content = sanitizedPrompt;
  } else if (parsedJson && parsedJson.prompt) {
    parsedJson.prompt = sanitizedPrompt;
  }

  const modifiedBody = JSON.stringify(parsedJson);

  // Forward to real AI endpoint over genuine HTTPS
  const upstreamReq = https.request(
    {
      hostname,
      port,
      path: reqPath,
      method,
      headers: {
        ...parseHeaders(headerPart),
        "content-length": Buffer.byteLength(modifiedBody),
        "accept-encoding": "identity", // Disable gzip for instant token restoration
      },
    },
    (upstreamRes) => {
      let resData = "";
      upstreamRes.on("data", (chunk) => {
        resData += chunk.toString("utf8");
      });

      upstreamRes.on("end", () => {
        // Restore real tokens in AI response
        let restoredResponse = resData;
        try {
          const aiJson = JSON.parse(resData);
          if (aiJson.choices && aiJson.choices[0]?.message?.content) {
            const rawAiText = aiJson.choices[0].message.content;
            aiJson.choices[0].message.content = tee.restoreResponse(sessionId, rawAiText);
            restoredResponse = JSON.stringify(aiJson);
          }
        } catch (e) {
          restoredResponse = tee.restoreResponse(sessionId, resData);
        }

        tee.destroySession(sessionId);

        // Broadcast to Admin Dashboard via WebSocket
        try {
          const sessionResult = sessionGraph.updateSessionGraph(identity.user, identity.email, detection);

          ws.broadcastDetection({
            originalPrompt: promptText,
            sanitizedPrompt,
            restoredResponse: (typeof restoredResponse === "string" ? restoredResponse.slice(0, 500) : ""),
            riskScore: detection.overallRisk,
            detections: detection.detections,
            combinations: detection.combinations,
            contextScore: detection.contextScore,
            actionTaken: detection.overallRisk >= 30 ? "silent_redact" : "pass",
            sessionCoverage: sessionResult.coverageMap,
            sessionRiskScore: sessionResult.riskScore,
            promptCount: sessionResult.promptCount,
            anomalyTriggered: sessionResult.anomalyTriggered,
            anomalyReport: sessionResult.anomalyReport,
            user: identity.user,
            host: identity.host,
            interceptSource: "network-layer-bridge",
            timestamp: new Date().toISOString(),
          });

          // Dual-sync to Cloud Render so cloud Vercel dashboard updates in real-time
          fetch("https://vantix-backend-7gcw.onrender.com/api/vantix/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Vantix-User": identity.user,
              "X-Vantix-Host": identity.host,
              "X-Vantix-Source": "network-layer-bridge",
            },
            body: JSON.stringify({
              prompt: promptText,
              userId: identity.user,
              user: identity.user,
              host: identity.host,
              sessionId,
            }),
          }).catch(() => {});
        } catch (wsErr) {
          // Non-blocking
        }

        // Return restored response to client
        const headersToSend = { ...upstreamRes.headers };
        delete headersToSend["content-length"];
        delete headersToSend["content-encoding"];

        clientTlsSocket.write(`HTTP/1.1 ${upstreamRes.statusCode} ${upstreamRes.statusMessage}\r\n`);
        for (const [k, v] of Object.entries(headersToSend)) {
          clientTlsSocket.write(`${k}: ${v}\r\n`);
        }
        clientTlsSocket.write(`Content-Length: ${Buffer.byteLength(restoredResponse)}\r\n\r\n`);
        clientTlsSocket.write(restoredResponse);
        clientTlsSocket.end();
      });
    }
  );

  upstreamReq.on("error", (err) => {
    clientTlsSocket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
    clientTlsSocket.end();
  });

  upstreamReq.write(modifiedBody);
  upstreamReq.end();
}

function forwardRawToUpstream(rawBuffer, hostname, port, clientTlsSocket) {
  const upstreamSocket = tls.connect(port, hostname, () => {
    upstreamSocket.write(rawBuffer);
    upstreamSocket.pipe(clientTlsSocket);
    clientTlsSocket.pipe(upstreamSocket);
  });
  upstreamSocket.on("error", () => clientTlsSocket.destroy());
  clientTlsSocket.on("error", () => upstreamSocket.destroy());
}

function parseHeaders(headerStr) {
  const headers = {};
  const lines = headerStr.split("\r\n").slice(1);
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      headers[line.slice(0, colonIdx).toLowerCase().trim()] = line.slice(colonIdx + 1).trim();
    }
  }
  delete headers["host"];
  delete headers["proxy-connection"];
  return headers;
}

function handleHttpRequest(req, res) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "Vantix Network Bridge Active", port: DEFAULT_PORT }));
}

function getUnmanagedBlockHtml(hostname, identity) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vantix — AI Access Blocked</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0b0f19; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .card { background: #111827; border: 1px solid #1e293b; border-radius: 18px; max-width: 540px; width: 100%; padding: 44px 36px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7); text-align: center; }
    .shield { width: 72px; height: 72px; margin: 0 auto 24px; border-radius: 50%; background: rgba(239, 68, 68, 0.12); border: 2px solid #ef4444; display: flex; align-items: center; justify-content: center; color: #ef4444; }
    h1 { font-size: 22px; font-weight: 700; color: #f87171; margin-bottom: 12px; letter-spacing: -0.02em; }
    p { font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px; }
    .meta-box { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 14px 18px; text-align: left; font-size: 13px; margin-bottom: 28px; }
    .meta-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .meta-row:last-child { margin-bottom: 0; }
    .meta-lbl { color: #64748b; }
    .meta-val { color: #38bdf8; font-weight: 500; font-family: monospace; }
    .btn { display: inline-block; background: #06b6d4; color: #020617; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; transition: all 0.2s; }
    .btn:hover { background: #22d3ee; }
  </style>
</head>
<body>
  <div class="card">
    <div class="shield">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    </div>
    <h1>UNMANAGED AI ACCESS BLOCKED</h1>
    <p>Access to <strong>${hostname}</strong> was intercepted by <strong>Vantix Enterprise AI Firewall</strong>. Corporate security policy strictly requires the <strong>Vantix Browser Guard</strong> extension before interacting with public AI models.</p>
    <div class="meta-box">
      <div class="meta-row"><span class="meta-lbl">Target Platform:</span><span class="meta-val">${hostname}</span></div>
      <div class="meta-row"><span class="meta-lbl">Machine / User:</span><span class="meta-val">${identity.user} on ${identity.host}</span></div>
      <div class="meta-row"><span class="meta-lbl">Enforcement:</span><span class="meta-val">Layer 1 Network Proxy (8443)</span></div>
      <div class="meta-row"><span class="meta-lbl">Policy Status:</span><span class="meta-val" style="color: #ef4444;">Extension Not Detected</span></div>
    </div>
    <a href="https://vantix-beta.vercel.app/downloads/vantix-browser-guard.zip" class="btn">Download & Install Vantix Browser Guard</a>
  </div>
</body>
</html>`;
}


// ─── Transparent Proxy (System-Wide iptables REDIRECT mode) ─────────────────
// When iptables redirects port 443 → 8443, connections arrive here as raw TLS.
// We parse SNI to determine the intended hostname, intercept AI traffic, and
// transparently passthrough everything else.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Parse SNI (Server Name Indication) from TLS ClientHello.
 * Returns the hostname string or null if not found.
 */
function parseSNI(buf) {
  try {
    if (!buf || buf.length < 11 || buf[0] !== 0x16) return null; // Not TLS Handshake
    let offset = 5; // Skip TLS record header: ContentType(1)+Version(2)+Length(2)
    if (offset >= buf.length || buf[offset] !== 0x01) return null; // Not ClientHello
    offset += 4; // Handshake type(1) + length(3)
    offset += 2; // Client version
    offset += 32; // Random
    if (offset >= buf.length) return null;
    const sidLen = buf[offset]; offset += 1 + sidLen; // Session ID
    if (offset + 2 > buf.length) return null;
    const csLen = buf.readUInt16BE(offset); offset += 2 + csLen; // Cipher suites
    if (offset >= buf.length) return null;
    const cmLen = buf[offset]; offset += 1 + cmLen; // Compression methods
    if (offset + 2 > buf.length) return null;
    const extTotalLen = buf.readUInt16BE(offset); offset += 2;
    const extEnd = Math.min(offset + extTotalLen, buf.length);
    while (offset + 4 <= extEnd) {
      const extType = buf.readUInt16BE(offset);
      const extLen = buf.readUInt16BE(offset + 2);
      offset += 4;
      if (extType === 0x0000 && offset + 5 <= buf.length) { // SNI extension
        offset += 2; // Server name list length
        const nameType = buf[offset]; offset += 1;
        if (offset + 2 > buf.length) return null;
        const nameLen = buf.readUInt16BE(offset); offset += 2;
        if (nameType === 0 && offset + nameLen <= buf.length) {
          return buf.slice(offset, offset + nameLen).toString("ascii");
        }
        return null;
      }
      offset += extLen;
    }
  } catch (e) { /* SNI parse failed — non-fatal */ }
  return null;
}

/**
 * Creates a transparent MITM proxy for system-wide AI traffic interception.
 * Designed to work with iptables: iptables -t nat -A OUTPUT -p tcp --dport 443
 *   -m owner ! --uid-owner 0 -j REDIRECT --to-port 8443
 *
 * Flow:
 *   1. Receives redirected TLS connections from any app on the system
 *   2. Parses SNI to determine intended hostname
 *   3. AI domains → MITM (generate cert, decrypt, inspect, sanitize, forward, restore)
 *   4. Non-AI domains → transparent raw TCP passthrough (zero overhead)
 */
function createTransparentProxy(options = {}) {
  const port = options.port || DEFAULT_PORT;
  getOrCreateRootCa();

  const server = net.createServer((clientSocket) => {
    let dataHandler;
    clientSocket.once("data", dataHandler = (firstChunk) => {
      if (!firstChunk || firstChunk.length < 5) {
        clientSocket.destroy();
        return;
      }

      // ── Mode 1: HTTP CONNECT Tunneling (Windows, macOS, curl -x, explicit proxy) ──
      const chunkStr = firstChunk.toString("utf8");
      if (chunkStr.startsWith("CONNECT ")) {
        const match = chunkStr.match(/^CONNECT\s+([^:\s]+)(?::(\d+))?/i);
        if (!match) {
          clientSocket.destroy();
          return;
        }
        const targetHost = match[1];
        const targetPort = parseInt(match[2]) || 443;

        if (!isAiDomain(targetHost)) {
          // Non-AI traffic: Direct passthrough
          const upstream = net.connect(targetPort, targetHost, () => {
            clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
            clientSocket.pipe(upstream);
            upstream.pipe(clientSocket);
          });
          upstream.on("error", () => clientSocket.destroy());
          clientSocket.on("error", () => upstream.destroy());
          return;
        }

        // AI traffic via CONNECT: Intercept TLS handshake
        console.log(`\n[Vantix] ⚡ CONNECT INTERCEPT: ${targetHost}:${targetPort}`);
        stats.interceptedPrompts++;
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");

        const hostCert = getCertForHost(targetHost);
        const tlsServer = new tls.Server({
          key: hostCert.key,
          cert: hostCert.cert,
          ALPNProtocols: ["http/1.1"],
        });

        tlsServer.emit("connection", clientSocket);

        tlsServer.on("secureConnection", (tlsSocket) => {
          let buffer = Buffer.alloc(0);
          tlsSocket.on("data", (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);
            const headerEnd = buffer.indexOf("\r\n\r\n");
            if (headerEnd === -1) return;

            const headerStr = buffer.slice(0, headerEnd).toString("utf8");
            const clMatch = headerStr.match(/content-length:\s*(\d+)/i);
            if (clMatch) {
              const expected = parseInt(clMatch[1]);
              const received = buffer.length - (headerEnd + 4);
              if (received < expected) return;
            }

            processInterceptedAiRequest(buffer, targetHost, targetPort, tlsSocket);
          });
        });

        tlsServer.on("error", () => {});
        return;
      }

      // ── Mode 2: Transparent TLS Handshake (Linux iptables REDIRECT mode) ──
      // Must be a TLS record (0x16 = Handshake)
      if (firstChunk[0] !== 0x16) {
        clientSocket.destroy();
        return;
      }

      const sni = parseSNI(firstChunk);
      if (!sni) {
        clientSocket.destroy();
        return;
      }

      if (!isAiDomain(sni)) {
        // ── Non-AI traffic: transparent raw passthrough ──────────────────
        const upstream = net.connect(443, sni, () => {
          upstream.write(firstChunk);
          clientSocket.pipe(upstream);
          upstream.pipe(clientSocket);
        });
        upstream.on("error", () => clientSocket.destroy());
        clientSocket.on("error", () => upstream.destroy());
        return;
      }

      // ── AI traffic: MITM intercept ──────────────────────────────────
      console.log(`\n[Vantix] ⚡ SYSTEM-WIDE INTERCEPT: ${sni} (user: ${getSystemIdentity().user})`);
      stats.interceptedPrompts++;

      // Put ClientHello back for TLS server to process
      clientSocket.unshift(firstChunk);

      const hostCert = getCertForHost(sni);
      const tlsServer = new tls.Server({
        key: hostCert.key,
        cert: hostCert.cert,
        ALPNProtocols: ["http/1.1"],
      });

      tlsServer.emit("connection", clientSocket);

      tlsServer.on("secureConnection", (tlsSocket) => {
        let buffer = Buffer.alloc(0);
        tlsSocket.on("data", (chunk) => {
          buffer = Buffer.concat([buffer, chunk]);
          const headerEnd = buffer.indexOf("\r\n\r\n");
          if (headerEnd === -1) return;

          // Wait for full body if Content-Length is present
          const headerStr = buffer.slice(0, headerEnd).toString("utf8");
          const clMatch = headerStr.match(/content-length:\s*(\d+)/i);
          if (clMatch) {
            const expected = parseInt(clMatch[1]);
            const received = buffer.length - (headerEnd + 4);
            if (received < expected) return; // Keep buffering
          }

          processInterceptedAiRequest(buffer, sni, 443, tlsSocket);
        });
      });

      tlsServer.on("error", () => { /* normal on client disconnect */ });
    });

    clientSocket.on("error", () => { /* normal */ });
  });

  return {
    server,
    start: (cb) => server.listen(port, "0.0.0.0", cb),
    stop: (cb) => server.close(cb),
    getPort: () => port,
    getStats: () => ({ ...stats }),
  };
}


module.exports = {
  createBridgeServer,
  createTransparentProxy,
  parseSNI,
  DEFAULT_PORT,
  getSystemIdentity,
  isAiDomain,
};
