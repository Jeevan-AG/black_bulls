// ─── Vantix Network Bridge — Transparent MITM Interception Daemon ────────────
// Sits at the network/OS layer and intercepts outbound AI requests transparently.
// Extracts OS user identity (kernel/OS level) without requiring login.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const http = require("http");
const https = require("https");
const net = require("net");
const tls = require("tls");
const stream = require("stream");
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
  // OpenAI
  "api.openai.com",
  // Anthropic
  "api.anthropic.com",
  // Google Gemini / Vertex / Cloud Code / Antigravity IDE
  "generativelanguage.googleapis.com",
  "daily-cloudcode-pa.googleapis.com",
  "cloudcode-pa.googleapis.com",
  "businessaicode.googleapis.com",
  "aiplatform.googleapis.com",
  "cloudaicompanion.googleapis.com",
  // Groq
  "api.groq.com",
  // Together AI
  "api.together.xyz",
  // Mistral & Codestral
  "api.mistral.ai",
  "codestral.mistral.ai",
  // Cohere
  "api.cohere.com",
  "api.cohere.ai",
  // DeepSeek
  "api.deepseek.com",
  // Perplexity
  "api.perplexity.ai",
  // OpenRouter & Voyage & HuggingFace
  "openrouter.ai",
  "api.openrouter.ai",
  "api.voyageai.com",
  "api-inference.huggingface.co",
  // Desktop IDEs & AI Coding Agents
  // Kiro / Amazon Q Developer / CodeWhisperer / Bedrock
  "q.us-east-1.amazonaws.com",
  "q.eu-central-1.amazonaws.com",
  "q-fips.us-gov-east-1.amazonaws.com",
  "q-fips.us-gov-west-1.amazonaws.com",
  "codewhisperer.us-east-1.amazonaws.com",
  "codewhispererstreamingservice.us-east-1.amazonaws.com",
  "app.kiro.dev",
  "api.kiro.dev",
  "kiro.dev",
  // Cursor
  "cursor.com",
  "api.cursor.com",
  "api2.cursor.com",
  "agent.cursor.com",
  "api.cursor.sh",
  "api2.cursor.sh",
  "repo42.cursor.sh",
  // Windsurf / Codeium
  "codeium.com",
  "api.codeium.com",
  "windsurf.codeium.com",
  "server.codeium.com",
  "windsurf.ai",
  "api.windsurf.ai",
  // GitHub Copilot
  "api.githubcopilot.com",
  "copilot-proxy.githubusercontent.com",
  // Supermaven & Tabnine
  "api.supermaven.com",
  "api.tabnine.com",
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

// Prevent any socket teardown or unhandled stream errors from crashing the proxy daemon
process.on("uncaughtException", (err) => {
  if (err.code === "EPIPE" || err.code === "ECONNRESET" || err.message?.includes("ended by the other party")) {
    return;
  }
  console.error("[Vantix-Bridge] Handled unhandled error:", err.message);
});
process.on("unhandledRejection", (err) => {
  console.error("[Vantix-Bridge] Handled rejection:", err?.message || err);
});

/**
 * Checks if a hostname matches any monitored AI platform.
 */
function isAiDomain(host) {
  if (!host) return false;
  const cleanHost = host.split(":")[0].toLowerCase();
  
  // NEVER intercept non-AI internal services: authentication, telemetry, crash reporting, updates
  if (
    cleanHost.includes("auth.") ||
    cleanHost.includes("telemetry.") ||
    cleanHost.includes("download.") ||
    cleanHost.includes("crashpad") ||
    cleanHost.includes("sso.") ||
    cleanHost.includes("identity.") ||
    cleanHost.includes("metrics.") ||
    cleanHost === "oauth2.googleapis.com" ||
    cleanHost === "accounts.google.com"
  ) {
    return false;
  }
  
  if (AI_DOMAINS.some((domain) => cleanHost === domain || cleanHost.endsWith("." + domain)) ||
      WEB_AI_DOMAINS.some((domain) => cleanHost === domain || cleanHost.endsWith("." + domain))) {
    return true;
  }

  // AWS AI services (Amazon Q, CodeWhisperer, Bedrock)
  if (cleanHost.endsWith(".amazonaws.com")) {
    if (
      cleanHost.startsWith("q.") ||
      cleanHost.startsWith("q-fips.") ||
      cleanHost.includes(".q.") ||
      cleanHost.includes("codewhisperer") ||
      cleanHost.includes("bedrock")
    ) {
      return true;
    }
  }

  // Google AI / Cloud Code / Antigravity IDE endpoints
  if (cleanHost.endsWith(".googleapis.com")) {
    if (
      cleanHost.includes("cloudcode") ||
      cleanHost.includes("businessaicode") ||
      cleanHost.includes("generativelanguage") ||
      cleanHost.includes("aiplatform") ||
      cleanHost.includes("cloudaicompanion")
    ) {
      return true;
    }
  }

  // Cursor endpoints
  if (
    cleanHost.endsWith(".cursor.sh") ||
    cleanHost.endsWith(".cursor.com") ||
    cleanHost === "cursor.sh" ||
    cleanHost === "cursor.com"
  ) {
    return true;
  }

  // Windsurf / Codeium endpoints
  if (
    cleanHost.endsWith(".codeium.com") ||
    cleanHost.endsWith(".windsurf.ai") ||
    cleanHost === "codeium.com" ||
    cleanHost === "windsurf.ai"
  ) {
    return true;
  }

  // GitHub Copilot endpoints
  if (
    cleanHost.includes("githubcopilot.com") ||
    cleanHost.includes("copilot-proxy")
  ) {
    return true;
  }

  return false;
}

function isWebAiDomain(host) {
  if (!host) return false;
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
      attachInterceptedHttpStream(tlsSocket, hostname, targetPort);
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
 * Universal extractor and injector for AI prompt payloads across all providers:
 * OpenAI, Anthropic, Kiro / Amazon Q, Google Gemini, Bedrock, Mistral, Cohere, LangChain.
 */
function extractPromptFromJson(json) {
  if (!json || typeof json !== "object") return { text: "", replace: null };

  // 1. OpenAI / Anthropic format: messages: [{ role, content }]
  if (Array.isArray(json.messages) && json.messages.length > 0) {
    const lastMsg = json.messages[json.messages.length - 1];
    if (typeof lastMsg.content === "string") {
      return {
        text: lastMsg.content,
        replace: (sanitized) => { lastMsg.content = sanitized; }
      };
    } else if (Array.isArray(lastMsg.content)) {
      const textPart = lastMsg.content.find(p => p && (p.type === "text" || typeof p.text === "string"));
      if (textPart && typeof textPart.text === "string") {
        return {
          text: textPart.text,
          replace: (sanitized) => { textPart.text = sanitized; }
        };
      }
    }
  }

  // 2. Kiro / Amazon Q Developer format: conversationState.currentMessage.userInputMessage.content
  if (json.conversationState?.currentMessage?.userInputMessage?.content) {
    const uim = json.conversationState.currentMessage.userInputMessage;
    if (typeof uim.content === "string") {
      return {
        text: uim.content,
        replace: (sanitized) => { uim.content = sanitized; }
      };
    }
  }

  // 3. Direct message object
  if (json.message && typeof json.message === "object") {
    if (typeof json.message.content === "string") {
      return {
        text: json.message.content,
        replace: (sanitized) => { json.message.content = sanitized; }
      };
    } else if (Array.isArray(json.message.content)) {
      const textPart = json.message.content.find(p => p && (p.type === "text" || typeof p.text === "string"));
      if (textPart && typeof textPart.text === "string") {
        return {
          text: textPart.text,
          replace: (sanitized) => { textPart.text = sanitized; }
        };
      }
    }
  }

  // 4. Direct prompt: { prompt: "..." }
  if (typeof json.prompt === "string") {
    return {
      text: json.prompt,
      replace: (sanitized) => { json.prompt = sanitized; }
    };
  }

  // 5. Google Gemini format: contents: [{ role: "user", parts: [{ text: "..." }] }]
  if (Array.isArray(json.contents) && json.contents.length > 0) {
    const lastContent = json.contents[json.contents.length - 1];
    if (Array.isArray(lastContent.parts)) {
      const textPart = lastContent.parts.find(p => p && typeof p.text === "string");
      if (textPart) {
        return {
          text: textPart.text,
          replace: (sanitized) => { textPart.text = sanitized; }
        };
      }
    }
  }

  // 6. Common SDK fields: inputText, input, query, utterance
  for (const field of ["inputText", "input", "query", "utterance"]) {
    if (typeof json[field] === "string") {
      return {
        text: json[field],
        replace: (sanitized) => { json[field] = sanitized; }
      };
    }
  }

  // 7. Recursive fallback: find largest string payload in JSON
  let targetObj = null;
  let targetKey = null;
  let longestStr = "";
  function walk(obj) {
    if (!obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string" && v.length > longestStr.length) {
        longestStr = v;
        targetObj = obj;
        targetKey = k;
      } else if (typeof v === "object") {
        walk(v);
      }
    }
  }
  walk(json);
  if (targetObj && targetKey && longestStr.length > 0) {
    return {
      text: longestStr,
      replace: (sanitized) => { targetObj[targetKey] = sanitized; }
    };
  }

  return { text: "", replace: null };
}

/**
 * Decodes HTTP chunked or AWS-chunked payloads into a contiguous buffer.
 */
function decodeChunkedBody(buf) {
  try {
    let chunks = [];
    let pos = 0;
    while (pos < buf.length) {
      const lineEnd = buf.indexOf("\r\n", pos);
      if (lineEnd === -1) break;
      const sizeStr = buf.slice(pos, lineEnd).toString("ascii").split(";")[0].trim();
      const chunkSize = parseInt(sizeStr, 16);
      if (isNaN(chunkSize)) break;
      if (chunkSize === 0) break; // 0-size chunk marks end of stream
      pos = lineEnd + 2;
      if (pos + chunkSize > buf.length) {
        chunks.push(buf.slice(pos));
        break;
      }
      chunks.push(buf.slice(pos, pos + chunkSize));
      pos += chunkSize;
      if (pos + 2 <= buf.length && buf[pos] === 0x0d && buf[pos + 1] === 0x0a) {
        pos += 2;
      }
    }
    return chunks.length > 0 ? Buffer.concat(chunks) : buf;
  } catch (e) {
    return buf;
  }
}

/**
 * Attaches a robust, keep-alive-aware HTTP stream parser to an intercepted TLS socket.
 * Handles Content-Length buffering, Transfer-Encoding: chunked, and Expect: 100-continue.
 */
function attachInterceptedHttpStream(tlsSocket, hostname, targetPort) {
  tlsSocket.on("error", () => {});
  let buffer = Buffer.alloc(0);
  let inFlight = false;

  function tryProcessBuffer() {
    if (inFlight || buffer.length === 0 || tlsSocket.destroyed) return;

    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return; // Keep waiting for headers

    const headerStr = buffer.slice(0, headerEnd).toString("utf8");
    const isWeb = isWebAiDomain(hostname);

    // If client requested Expect: 100-continue, acknowledge immediately so client writes body in 0ms
    if (/expect:\s*100-continue/i.test(headerStr)) {
      try {
        if (!tlsSocket.destroyed && tlsSocket.writable) {
          tlsSocket.write("HTTP/1.1 100 Continue\r\n\r\n");
        }
      } catch (e) {}
    }

    // FAST-PATH: Web AI (ChatGPT, Claude, etc.) unmanaged browser check on headers
    if (isWeb) {
      const hasExt =
        /x-vantix-extension:\s*active/i.test(headerStr) ||
        /x-vantix-source:\s*browser-guard/i.test(headerStr) ||
        headerStr.includes("vantix_guard=active");
      if (!hasExt) {
        // Unmanaged browser: Block IMMEDIATELY (<1ms) without waiting for body!
        const currentReq = buffer;
        buffer = Buffer.alloc(0);
        inFlight = true;
        processInterceptedAiRequest(currentReq, hostname, targetPort, tlsSocket, () => {
          inFlight = false;
          tryProcessBuffer();
        });
        return;
      }
    }

    const firstLine = headerStr.split("\r\n")[0];
    const method = (firstLine.split(" ")[0] || "GET").toUpperCase();

    // GET / HEAD / DELETE / OPTIONS have no request body
    if (method === "GET" || method === "HEAD" || method === "DELETE" || method === "OPTIONS") {
      const reqLen = headerEnd + 4;
      const currentReq = buffer.slice(0, reqLen);
      buffer = buffer.slice(reqLen);
      inFlight = true;
      processInterceptedAiRequest(currentReq, hostname, targetPort, tlsSocket, () => {
        inFlight = false;
        tryProcessBuffer();
      });
      return;
    }

    // Method is POST / PUT / PATCH
    const clMatch = headerStr.match(/content-length:\s*(\d+)/i);
    const isChunked = /transfer-encoding:\s*chunked/i.test(headerStr);
    const isAwsChunked = /content-encoding:\s*.*aws-chunked/i.test(headerStr);
    const decodedClMatch = headerStr.match(/x-amz-decoded-content-length:\s*(\d+)/i);

    if (clMatch) {
      const expectedBody = parseInt(clMatch[1], 10);
      const totalExpected = headerEnd + 4 + expectedBody;
      if (buffer.length < totalExpected) {
        return; // Keep buffering until full body arrives
      }
      const currentReq = buffer.slice(0, totalExpected);
      buffer = buffer.slice(totalExpected);
      inFlight = true;
      processInterceptedAiRequest(currentReq, hostname, targetPort, tlsSocket, () => {
        inFlight = false;
        tryProcessBuffer();
      });
      return;
    }

    if (isChunked || isAwsChunked) {
      const bodyBuf = buffer.slice(headerEnd + 4);
      const endIdx = bodyBuf.indexOf("\r\n0\r\n\r\n");
      const altEndIdx = bodyBuf.indexOf("0\r\n\r\n");
      if (endIdx !== -1) {
        const totalReqLen = headerEnd + 4 + endIdx + 7;
        const currentReq = buffer.slice(0, totalReqLen);
        buffer = buffer.slice(totalReqLen);
        inFlight = true;
        processInterceptedAiRequest(currentReq, hostname, targetPort, tlsSocket, () => {
          inFlight = false;
          tryProcessBuffer();
        });
        return;
      } else if (altEndIdx === 0) {
        const totalReqLen = headerEnd + 4 + 5;
        const currentReq = buffer.slice(0, totalReqLen);
        buffer = buffer.slice(totalReqLen);
        inFlight = true;
        processInterceptedAiRequest(currentReq, hostname, targetPort, tlsSocket, () => {
          inFlight = false;
          tryProcessBuffer();
        });
        return;
      }
      if (decodedClMatch) {
        const expectedDecoded = parseInt(decodedClMatch[1], 10);
        if (bodyBuf.length >= expectedDecoded && (bodyBuf.includes("0\r\n") || bodyBuf.length > expectedDecoded + 512)) {
          const currentReq = buffer;
          buffer = Buffer.alloc(0);
          inFlight = true;
          processInterceptedAiRequest(currentReq, hostname, targetPort, tlsSocket, () => {
            inFlight = false;
            tryProcessBuffer();
          });
          return;
        }
      }
      return; // Keep buffering chunked stream
    }

    // Default fallback: process current buffer
    const currentReq = buffer;
    buffer = Buffer.alloc(0);
    inFlight = true;
    processInterceptedAiRequest(currentReq, hostname, targetPort, tlsSocket, () => {
      inFlight = false;
      tryProcessBuffer();
    });
  }

  tlsSocket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    tryProcessBuffer();
  });
}

/**
 * Processes decrypted AI request, applies 7-step pipeline, forwards, and restores.
 */
function processInterceptedAiRequest(rawBuffer, hostname, port, clientTlsSocket, onFinished) {
  const identity = getSystemIdentity();
  const rawStr = rawBuffer.toString("utf8");
  const headerEnd = rawStr.indexOf("\r\n\r\n");
  if (headerEnd === -1) {
    if (isWebAiDomain(hostname)) {
      clientTlsSocket.destroy();
      if (typeof onFinished === "function") onFinished();
      return;
    }
    forwardRawToUpstream(rawBuffer, hostname, port, clientTlsSocket, onFinished);
    return;
  }

  const headerPart = rawStr.slice(0, headerEnd);
  let bodyPart = rawStr.slice(headerEnd + 4);
  const bodyBuf = rawBuffer.slice(headerEnd + 4);

  // Parse HTTP method and path
  const firstLine = headerPart.split("\r\n")[0];
  const parts = firstLine.split(" ");
  const method = (parts[0] || "GET").toUpperCase();
  const reqPath = parts[1] || "/";

  const cleanHost = hostname.split(":")[0].toLowerCase();
  const isWeb = isWebAiDomain(cleanHost);

  // Enforce Browser Guard for web AI interfaces (ChatGPT, Claude, Gemini)
  if (isWeb) {
    const headers = parseHeaders(headerPart);
    const hasExtensionHeader =
      headers["x-vantix-extension"] === "active" ||
      headers["x-vantix-source"] === "browser-guard";

    const hasExtensionCookie =
      Boolean(headers["cookie"] && headers["cookie"].includes("vantix_guard=active"));

    const hasGuardExtension = hasExtensionHeader || hasExtensionCookie;

    if (!hasGuardExtension) {
      console.log(`\n[Vantix-Bridge] ⛔ UNMANAGED ACCESS BLOCKED: ${hostname} (User: ${identity.user}@${identity.host}) — Missing Browser Guard Extension`);
      stats.interceptedPrompts++;

      // 1. Deliver 403 Forbidden block page IMMEDIATELY (<1ms latency)
      const blockHtml = getUnmanagedBlockHtml(hostname, identity);
      const resHeaders =
        "HTTP/1.1 403 Forbidden\r\n" +
        "Content-Type: text/html; charset=utf-8\r\n" +
        `Content-Length: ${Buffer.byteLength(blockHtml)}\r\n` +
        "Connection: close\r\n" +
        "Cache-Control: no-cache, no-store, must-revalidate\r\n" +
        "\r\n";

      try {
        clientTlsSocket.removeAllListeners("data");
        if (!clientTlsSocket.destroyed && clientTlsSocket.writable) {
          clientTlsSocket.write(resHeaders + blockHtml);
          clientTlsSocket.end();
        }
      } catch (err) {}

      // Broadcast alert to admin dashboard in real-time
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
      } catch (e) {}

      // Asynchronous cloud sync in background (non-blocking)
      setImmediate(() => {
        try {
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
      });

      if (typeof onFinished === "function") onFinished();
      return;
    }

    // Has extension: forward directly to upstream so extension's DOM protection can monitor prompts
    forwardRawToUpstream(rawBuffer, hostname, port, clientTlsSocket, onFinished);
    return;
  }

  // ── Non-web AI (Desktop IDEs: Kiro, Cursor, Copilot, Antigravity, SDK calls, curl, etc.) ──

  // GET / HEAD / OPTIONS / DELETE — never contain prompt payloads, forward cleanly and keep socket alive
  if (method !== "POST" && method !== "PUT" && method !== "PATCH") {
    forwardCleanHttpToUpstream(headerPart, bodyBuf, hostname, port, clientTlsSocket, onFinished);
    return;
  }

  const reqHeaders = parseHeaders(headerPart);
  const isChunkedReq = /chunked/i.test(reqHeaders["transfer-encoding"] || "");
  const isAwsChunkedReq = /aws-chunked/i.test(reqHeaders["content-encoding"] || "");

  if (isChunkedReq || isAwsChunkedReq) {
    const decoded = decodeChunkedBody(bodyBuf);
    bodyPart = decoded.toString("utf8");
  }

  // Universal Prompt Extraction
  let parsedJson = null;
  let promptText = "";

  try {
    parsedJson = JSON.parse(bodyPart);
    const extracted = extractPromptFromJson(parsedJson);
    promptText = extracted.text;
  } catch (e) {}

  if (!promptText && bodyPart && bodyPart.trim().length > 0) {
    promptText = bodyPart.trim();
  }

  if (!promptText || promptText.length < 3) {
    forwardCleanHttpToUpstream(headerPart, bodyBuf, hostname, port, clientTlsSocket, onFinished);
    return;
  }

  console.log(`\n[Vantix-Bridge] ⚡ INTERCEPTED AI REQUEST: [${hostname}] User: [${identity.user}@${identity.host}]`);
  console.log(`[Vantix-Bridge] Prompt: "${promptText.slice(0, 90).replace(/\n/g, " ")}..."`);

  // Run 3-Sublayer Detection Engine on prompt text and full body
  let detection = analyzePrompt(promptText);
  if ((!detection.detections || detection.detections.length === 0) && bodyPart && bodyPart !== promptText) {
    const bodyDetection = analyzePrompt(bodyPart);
    if (bodyDetection.detections && bodyDetection.detections.length > 0) {
      detection = bodyDetection;
    }
  }

  const sessionId = `bridge-${Date.now()}`;
  stats.interceptedPrompts++;

  // If clean prompt (no sensitive data detected), direct wire-speed passthrough without unhooking socket
  if (!detection.detections || detection.detections.length === 0) {
    console.log(`[Vantix-Bridge] ✓ Clean prompt (no sensitive data detected) — forwarding directly to ${hostname}`);

    setImmediate(() => {
      try {
        const sessionResult = sessionGraph.updateSessionGraph(identity.user, identity.email, detection);
        ws.broadcastDetection({
          originalPrompt: promptText.slice(0, 500),
          sanitizedPrompt: promptText.slice(0, 500),
          restoredResponse: "",
          riskScore: 0,
          detections: [],
          combinations: [],
          contextScore: 0,
          actionTaken: "pass",
          sessionCoverage: sessionResult.coverageMap || {},
          sessionRiskScore: sessionResult.riskScore || 0,
          promptCount: sessionResult.promptCount || 1,
          anomalyTriggered: false,
          anomalyReport: "",
          user: identity.user,
          host: identity.host,
          interceptSource: "network-layer-bridge",
          timestamp: new Date().toISOString(),
        });
      } catch (e) {}
    });

    forwardCleanHttpToUpstream(headerPart, bodyBuf, hostname, port, clientTlsSocket, onFinished);
    return;
  }

  const credentialCount = detection.detections.filter((d) => d.category === "CREDENTIAL").length;
  const isMassiveCredentialDump = credentialCount > 3;
  const isSevereInjection = detection.detections.some(
    (d) => d.category === "PROMPT_INJECTION" && d.isolationRisk >= 95
  );

  const shouldHardBlock = isMassiveCredentialDump || isSevereInjection;

  // ── RULE 1: HARD BLOCK ONLY ON MASSIVE CREDENTIAL LEAKS (>3) OR SEVERE INJECTIONS ──
  if (shouldHardBlock) {
    console.log(`[Vantix-Bridge] ⛔ MASSIVE CREDENTIAL EXPOSURE HARD-BLOCKED (${credentialCount} credentials detected)`);

    let sessionResult = { coverageMap: {}, riskScore: detection.overallRisk, promptCount: 1, anomalyTriggered: true, anomalyReport: "" };
    try {
      sessionResult = sessionGraph.updateSessionGraph(identity.user, identity.email, detection);
    } catch (e) {}

    const blockMsg = `[VANTIX AI FIREWALL] Request blocked: Massive credential exposure detected (${credentialCount} secrets). Outbound transmission halted by enterprise DLP policy.`;

    try {
      ws.broadcastDetection({
        originalPrompt: promptText.slice(0, 500),
        sanitizedPrompt: "[HARD_BLOCKED_BY_FIREWALL]",
        restoredResponse: "",
        riskScore: detection.overallRisk,
        detections: detection.detections,
        combinations: detection.combinations,
        contextScore: detection.contextScore,
        actionTaken: "hard_block",
        sessionCoverage: sessionResult.coverageMap || {},
        sessionRiskScore: sessionResult.riskScore || detection.overallRisk,
        promptCount: sessionResult.promptCount || 1,
        anomalyTriggered: true,
        anomalyReport: `CRITICAL SECURITY BLOCK: Employee attempted to send ${credentialCount} exposed credentials to ${hostname}. Connection terminated by Layer 1 Firewall.`,
        user: identity.user,
        host: identity.host,
        interceptSource: "network-layer-bridge",
        timestamp: new Date().toISOString(),
      });

      fetch("https://vantix-backend-7gcw.onrender.com/api/vantix/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Vantix-User": identity.user,
          "X-Vantix-Host": identity.host,
          "X-Vantix-Source": "network-layer-bridge",
        },
        body: JSON.stringify({
          prompt: promptText.slice(0, 500),
          userId: identity.user,
          user: identity.user,
          host: identity.host,
          sessionId: `bridge-block-${Date.now()}`,
        }),
      }).catch(() => {});
    } catch (e) {}

    const errorJson = JSON.stringify({
      error: {
        message: blockMsg,
        type: "vantix_security_violation",
        code: "MASSIVE_CREDENTIAL_EXPOSURE_BLOCKED",
        param: null,
      },
      message: blockMsg,
    });

    const res = [
      "HTTP/1.1 403 Forbidden",
      "Content-Type: application/json; charset=utf-8",
      `Content-Length: ${Buffer.byteLength(errorJson)}`,
      "Connection: close",
      "\r\n",
    ].join("\r\n") + errorJson;

    try {
      clientTlsSocket.removeAllListeners("data");
      if (!clientTlsSocket.destroyed && clientTlsSocket.writable) {
        clientTlsSocket.write(res);
        clientTlsSocket.end();
      }
    } catch (err) {}
    if (typeof onFinished === "function") onFinished();
    return;
  }

  // ── RULE 2: TEE SILENT REDACTION FOR CREDENTIALS (<=3), PII & CONFIDENTIAL DATA ──
  const tokenTable = tee.createTokenTable(sessionId, detection.detections, bodyPart);
  let sanitizedBody = bodyPart;
  if (tokenTable && tokenTable.size > 0) {
    for (const [placeholder, realVal] of tokenTable.entries()) {
      sanitizedBody = sanitizedBody.split(realVal).join(placeholder);
    }
  }

  console.log(`[Vantix-Bridge] 🛡 TEE Sanitized (${detection.detections.length} sensitive tokens redacted seamlessly)`);
  stats.redactedTokens += detection.detections.length;

  let sanitizedPromptSnippet = promptText;
  if (tokenTable && tokenTable.size > 0) {
    for (const [placeholder, realVal] of tokenTable.entries()) {
      sanitizedPromptSnippet = sanitizedPromptSnippet.split(realVal).join(placeholder);
    }
  }

  // Build clean outgoing headers for upstream
  const outgoingHeaders = parseHeaders(headerPart);
  delete outgoingHeaders["transfer-encoding"];
  delete outgoingHeaders["content-encoding"];
  delete outgoingHeaders["expect"];
  delete outgoingHeaders["x-amz-trailer"];
  delete outgoingHeaders["accept-encoding"];
  outgoingHeaders["content-length"] = String(Buffer.byteLength(sanitizedBody));
  outgoingHeaders["accept-encoding"] = "identity"; // Uncompressed for real-time streaming restoration
  if (outgoingHeaders["x-amz-decoded-content-length"]) {
    outgoingHeaders["x-amz-decoded-content-length"] = String(Buffer.byteLength(sanitizedBody));
  }
  if (outgoingHeaders["x-amz-content-sha256"] && outgoingHeaders["x-amz-content-sha256"].includes("STREAMING")) {
    outgoingHeaders["x-amz-content-sha256"] = "UNSIGNED-PAYLOAD";
  }

  // Forward sanitized prompt to genuine AI endpoint over TLS
  const upstreamReq = https.request(
    {
      hostname,
      port: port || 443,
      path: reqPath,
      method,
      headers: outgoingHeaders,
    },
    (upstreamRes) => {
      // Forward status and headers to client immediately
      const resHeaders = {};
      for (const [k, v] of Object.entries(upstreamRes.headers)) {
        const lk = k.toLowerCase();
        if (lk === "content-length" || lk === "content-encoding") continue;
        resHeaders[k] = v;
      }
      resHeaders["transfer-encoding"] = "chunked";

      try {
        if (!clientTlsSocket.destroyed && clientTlsSocket.writable) {
          clientTlsSocket.write(`HTTP/1.1 ${upstreamRes.statusCode} ${upstreamRes.statusMessage || "OK"}\r\n`);
          for (const [k, v] of Object.entries(resHeaders)) {
            if (Array.isArray(v)) {
              for (const val of v) clientTlsSocket.write(`${k}: ${val}\r\n`);
            } else {
              clientTlsSocket.write(`${k}: ${v}\r\n`);
            }
          }
          clientTlsSocket.write("\r\n");
        }
      } catch (e) {}

      let totalResponseText = "";

      upstreamRes.on("data", (chunk) => {
        // Reset timeout on every chunk received
        upstreamReq.setTimeout(120000);

        let chunkToSend = chunk;
        if (tokenTable && tokenTable.size > 0) {
          try {
            // Restore placeholders in chunk
            let chunkStr = chunk.toString("latin1");
            let modified = false;
            for (const [placeholder, realVal] of tokenTable.entries()) {
              if (chunkStr.includes(placeholder)) {
                chunkStr = chunkStr.split(placeholder).join(realVal);
                modified = true;
              }
            }
            if (modified) {
              chunkToSend = Buffer.from(chunkStr, "latin1");
            }
          } catch (e) {}
        }

        if (totalResponseText.length < 500) {
          totalResponseText += chunk.toString("utf8").slice(0, 500 - totalResponseText.length);
        }

        // Stream chunk in HTTP chunked transfer format
        try {
          if (!clientTlsSocket.destroyed && clientTlsSocket.writable) {
            const hexLen = chunkToSend.length.toString(16);
            clientTlsSocket.write(`${hexLen}\r\n`);
            clientTlsSocket.write(chunkToSend);
            clientTlsSocket.write("\r\n");
          }
        } catch (e) {}
      });

      upstreamRes.on("end", () => {
        try {
          if (!clientTlsSocket.destroyed && clientTlsSocket.writable) {
            clientTlsSocket.write("0\r\n\r\n");
          }
        } catch (e) {}

        // Broadcast to Admin Dashboard via WebSocket (non-blocking)
        setImmediate(() => {
          try {
            const sessionResult = sessionGraph.updateSessionGraph(identity.user, identity.email, detection);

            ws.broadcastDetection({
              originalPrompt: promptText.slice(0, 500),
              sanitizedPrompt: sanitizedPromptSnippet.slice(0, 500),
              restoredResponse: totalResponseText,
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

            fetch("https://vantix-backend-7gcw.onrender.com/api/vantix/chat", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Vantix-User": identity.user,
                "X-Vantix-Host": identity.host,
                "X-Vantix-Source": "network-layer-bridge",
              },
              body: JSON.stringify({
                prompt: promptText.slice(0, 500),
                userId: identity.user,
                user: identity.user,
                host: identity.host,
                sessionId,
              }),
            }).catch(() => {});
          } catch (wsErr) {}
        });

        tee.destroySession(sessionId);
        if (typeof onFinished === "function") onFinished();
      });

      upstreamRes.on("error", (err) => {
        try {
          if (!clientTlsSocket.destroyed) clientTlsSocket.destroy();
        } catch (e) {}
        if (typeof onFinished === "function") onFinished();
      });
    }
  );

  upstreamReq.setTimeout(120000, () => {
    console.error(`[Vantix-Bridge] Upstream request timeout after 120s to ${hostname}`);
    upstreamReq.destroy(new Error("Request timeout after 120s"));
  });

  upstreamReq.on("error", (err) => {
    console.error(`[Vantix-Bridge] Upstream request error to ${hostname}: ${err.message}`);
    try {
      if (!clientTlsSocket.destroyed && clientTlsSocket.writable) {
        const errBody = JSON.stringify({ error: { message: `Vantix proxy error: ${err.message}`, type: "proxy_error" } });
        clientTlsSocket.write("HTTP/1.1 502 Bad Gateway\r\n");
        clientTlsSocket.write("Content-Type: application/json\r\n");
        clientTlsSocket.write(`Content-Length: ${Buffer.byteLength(errBody)}\r\n`);
        clientTlsSocket.write("Connection: close\r\n\r\n");
        clientTlsSocket.write(errBody);
        clientTlsSocket.end();
      }
    } catch (e) {}
    if (typeof onFinished === "function") onFinished();
  });

  if (sanitizedBody) {
    upstreamReq.write(sanitizedBody);
  }
  upstreamReq.end();
}

function forwardCleanHttpToUpstream(headerPart, bodyBuf, hostname, port, clientTlsSocket, onFinished) {
  if (clientTlsSocket.destroyed) {
    if (typeof onFinished === "function") onFinished();
    return;
  }

  const firstLine = headerPart.split("\r\n")[0];
  const parts = firstLine.split(" ");
  const method = (parts[0] || "GET").toUpperCase();
  const reqPath = parts[1] || "/";
  const reqHeaders = parseHeaders(headerPart);

  delete reqHeaders["expect"];
  delete reqHeaders["accept-encoding"];
  reqHeaders["accept-encoding"] = "identity";

  if (bodyBuf && bodyBuf.length > 0) {
    delete reqHeaders["transfer-encoding"];
    reqHeaders["content-length"] = String(bodyBuf.length);
  }

  const upstreamReq = https.request(
    {
      hostname,
      port: port || 443,
      path: reqPath,
      method,
      headers: reqHeaders,
    },
    (upstreamRes) => {
      const resHeaders = {};
      for (const [k, v] of Object.entries(upstreamRes.headers)) {
        const lk = k.toLowerCase();
        if (lk === "content-length" || lk === "content-encoding") continue;
        resHeaders[k] = v;
      }
      resHeaders["transfer-encoding"] = "chunked";

      try {
        if (!clientTlsSocket.destroyed && clientTlsSocket.writable) {
          clientTlsSocket.write(`HTTP/1.1 ${upstreamRes.statusCode} ${upstreamRes.statusMessage || "OK"}\r\n`);
          for (const [k, v] of Object.entries(resHeaders)) {
            if (Array.isArray(v)) {
              for (const val of v) clientTlsSocket.write(`${k}: ${val}\r\n`);
            } else {
              clientTlsSocket.write(`${k}: ${v}\r\n`);
            }
          }
          clientTlsSocket.write("\r\n");
        }
      } catch (e) {}

      upstreamRes.on("data", (chunk) => {
        try {
          if (!clientTlsSocket.destroyed && clientTlsSocket.writable) {
            const hexLen = chunk.length.toString(16);
            clientTlsSocket.write(`${hexLen}\r\n`);
            clientTlsSocket.write(chunk);
            clientTlsSocket.write("\r\n");
          }
        } catch (e) {}
      });

      upstreamRes.on("end", () => {
        try {
          if (!clientTlsSocket.destroyed && clientTlsSocket.writable) {
            clientTlsSocket.write("0\r\n\r\n");
          }
        } catch (e) {}
        if (typeof onFinished === "function") onFinished();
      });

      upstreamRes.on("error", (err) => {
        try {
          if (!clientTlsSocket.destroyed) clientTlsSocket.destroy();
        } catch (e) {}
        if (typeof onFinished === "function") onFinished();
      });
    }
  );

  upstreamReq.setTimeout(120000, () => {
    upstreamReq.destroy(new Error("Request timeout after 120s"));
  });

  upstreamReq.on("error", (err) => {
    try {
      if (!clientTlsSocket.destroyed && clientTlsSocket.writable) {
        const errJson = JSON.stringify({ error: { message: `Vantix upstream error: ${err.message}` } });
        clientTlsSocket.write("HTTP/1.1 502 Bad Gateway\r\n");
        clientTlsSocket.write("Content-Type: application/json\r\n");
        clientTlsSocket.write(`Content-Length: ${Buffer.byteLength(errJson)}\r\n`);
        clientTlsSocket.write("Connection: close\r\n\r\n");
        clientTlsSocket.write(errJson);
        clientTlsSocket.end();
      }
    } catch (e) {}
    if (typeof onFinished === "function") onFinished();
  });

  if (bodyBuf && bodyBuf.length > 0) {
    upstreamReq.write(bodyBuf);
  }
  upstreamReq.end();
}

function forwardRawToUpstream(rawBuffer, hostname, port, clientTlsSocket, onFinished) {
  if (clientTlsSocket.destroyed) {
    if (typeof onFinished === "function") onFinished();
    return;
  }
  try {
    clientTlsSocket.pause();
    clientTlsSocket.removeAllListeners("data");
  } catch (e) {}

  const upstreamSocket = tls.connect(
    {
      port: port || 443,
      host: hostname,
      servername: hostname,
      rejectUnauthorized: true,
    },
    () => {
      if (clientTlsSocket.destroyed) {
        upstreamSocket.destroy();
        if (typeof onFinished === "function") onFinished();
        return;
      }
      upstreamSocket.write(rawBuffer);
      upstreamSocket.pipe(clientTlsSocket);
      clientTlsSocket.pipe(upstreamSocket);
      try {
        clientTlsSocket.resume();
      } catch (e) {}
    }
  );
  upstreamSocket.on("error", () => {
    if (!clientTlsSocket.destroyed) clientTlsSocket.destroy();
    if (typeof onFinished === "function") onFinished();
  });
  clientTlsSocket.on("error", () => {
    if (!upstreamSocket.destroyed) upstreamSocket.destroy();
    if (typeof onFinished === "function") onFinished();
  });
  upstreamSocket.on("close", () => {
    if (typeof onFinished === "function") onFinished();
  });
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
          attachInterceptedHttpStream(tlsSocket, targetHost, targetPort);
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

      // ── AI traffic: Intercept TLS to verify Browser Guard Extension presence ──

      // ── AI traffic: MITM intercept (Unmanaged browser or Desktop AI IDE) ──
      console.log(`\n[Vantix] ⚡ SYSTEM-WIDE INTERCEPT: ${sni} (user: ${getSystemIdentity().user})`);
      stats.interceptedPrompts++;

      // Create a duplex bridge to replay firstChunk and forward all stream events
      const duplex = new stream.Duplex({
        read(size) {},
        write(chunk, encoding, callback) {
          if (!clientSocket.destroyed && clientSocket.writable) {
            try {
              clientSocket.write(chunk, encoding, callback);
            } catch (err) {
              callback();
            }
          } else {
            callback();
          }
        },
      });

      duplex.on("error", () => {});
      clientSocket.on("error", () => {});

      // Forward subsequent TLS handshake and encrypted HTTP data to duplex
      clientSocket.on("data", (chunk) => {
        duplex.push(chunk);
      });
      clientSocket.on("end", () => {
        duplex.push(null);
      });
      clientSocket.on("close", () => {
        duplex.destroy();
      });
      duplex.on("finish", () => {
        if (!clientSocket.destroyed && clientSocket.writable) {
          try {
            clientSocket.end();
          } catch (e) {}
        }
      });

      duplex.push(firstChunk);

      const hostCert = getCertForHost(sni);
      const tlsServer = new tls.Server({
        key: hostCert.key,
        cert: hostCert.cert,
        ALPNProtocols: ["http/1.1"],
      });

      tlsServer.on("error", () => {});
      tlsServer.emit("connection", duplex);

      tlsServer.on("secureConnection", (tlsSocket) => {
        attachInterceptedHttpStream(tlsSocket, sni, 443);
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
