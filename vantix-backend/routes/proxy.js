// ─── Vantix — AI Proxy Gateway ───────────────────────────────────────────────
// The core 7-step pipeline:
//   1. Intercept  — Receive the prompt
//   2. Detect     — Run 3-sublayer industrial detection engine
//   3. Redact     — Replace sensitive values with semantic placeholders (TEE)
//   4. Forward    — Send sanitized prompt to AI (Groq Llama 3.3 for speed)
//   5. Restore    — Swap placeholders back to real values in response
//   6. Log        — Cryptographically signed audit entry
//   7. Return     — Send restored response to caller
//
// Split-Brain Architecture:
//   • Groq (Llama 3.3)  — Per-prompt AI responses (<5ms latency target)
//   • Gemini (AI Studio) — Async cross-session deep analytics
//
// WebSocket: Broadcasts real-time telemetry to admin dashboard after each prompt.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const express = require("express");
const router = express.Router();
const Groq = require("groq-sdk");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const { analyzePrompt } = require("../engines/industrialDetector");
const tee = require("../engines/teeEnclave");
const sessionGraph = require("../engines/sessionGraph");
const ws = require("../engines/wsServer");
const fs = require("fs");
const path = require("path");
const AuditLog = require("../models/AuditLog");
const mongoose = require("mongoose");

const DATA_DIR = path.join(__dirname, "../data");
const AUDIT_FILE = path.join(DATA_DIR, "audit_logs.json");

if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}

// Persistent audit log ring buffer (loaded from disk on startup)
let _inMemoryAuditLogs = [];
try {
  if (fs.existsSync(AUDIT_FILE)) {
    const raw = fs.readFileSync(AUDIT_FILE, "utf8");
    _inMemoryAuditLogs = JSON.parse(raw);
    console.log(`[Vantix-Storage] ✓ Loaded ${_inMemoryAuditLogs.length} persisted audit logs from disk`);
  }
} catch (e) {
  _inMemoryAuditLogs = [];
}

function persistAuditLogs() {
  try {
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(_inMemoryAuditLogs.slice(0, 1000), null, 2), "utf8");
  } catch (e) {
    console.error("[Vantix-Storage] Failed to persist audit logs:", e.message);
  }
}

function extractClientIp(req) {
  if (!req) return "127.0.0.1";
  let ip = req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() || 
           req.headers?.["x-real-ip"] || 
           req.socket?.remoteAddress || 
           req.connection?.remoteAddress || 
           req.ip || 
           "";
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  if (ip === "::1" || ip === "127.0.0.1" || !ip) {
    const os = require("os");
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }
    return "127.0.0.1";
  }
  return ip;
}

// ─── Centralized Record & Telemetry Broadcaster ──────────────────────────────
function recordAndBroadcast({
  resolvedUser,
  userEmail,
  resolvedHost,
  endpointIp,
  prompt,
  sanitizedPrompt,
  restoredResponse,
  action,
  detection,
  signature,
  interceptedAt,
  aiPlatform,
  req,
}) {
  const os = require("os");
  const SERVER_IDENTITIES = ["render", "root", "nobody", "www-data", "node", "ubuntu", "ec2-user"];

  let fallbackUser = "employee";
  let fallbackHost = os.hostname() || "workstation";
  try {
    const osUser = process.env.USERNAME || process.env.USER || (os.userInfo && os.userInfo().username) || "";
    if (osUser && !SERVER_IDENTITIES.includes(osUser.toLowerCase())) fallbackUser = osUser;
    const osHost = os.hostname() || "";
    if (osHost && !osHost.startsWith("srv-")) fallbackHost = osHost;
  } catch (e) {}

  const rawUser = (resolvedUser && resolvedUser !== "employee" && !SERVER_IDENTITIES.includes(resolvedUser.toLowerCase()) ? resolvedUser : fallbackUser).trim();
  const rawHost = (resolvedHost && resolvedHost !== "browser-endpoint" && !resolvedHost.startsWith("srv-") ? resolvedHost : fallbackHost).trim();
  const userNameFormatted = `${rawUser} (${rawHost})`;
  const actualIp = (typeof endpointIp === "string" && endpointIp && endpointIp !== "127.0.0.1" ? endpointIp.split(",")[0].trim() : null) || extractClientIp(req);

  const logRecord = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    orgId: req?.orgId || "acme-corp",
    userId: rawUser,
    userEmail: userEmail || `${rawUser}@${rawHost.toLowerCase().replace(/[^a-z0-9]/g, "")}.corp`,
    userName: userNameFormatted,
    department: "Engineering & Cloud",
    endpointHost: rawHost,
    endpointIp: actualIp,
    originalPrompt: prompt,
    sanitizedPrompt: sanitizedPrompt || "[SANITIZED]",
    restoredResponse: restoredResponse || "",
    promptSnippet: prompt.slice(0, 200),
    actionTaken: action,
    riskScore: detection.overallRisk,
    categoriesRedacted: detection.categoriesFound || Array.from(new Set((detection.detections || []).map(d => d.category))),
    detections: detection.detections || [],
    detectionCount: detection.detections ? detection.detections.length : 0,
    combinationCount: detection.combinations ? detection.combinations.length : 0,
    aiPlatform: aiPlatform || "chatgpt.com",
    cryptoSignature: signature,
    timestamp: interceptedAt || new Date().toISOString(),
  };

  _inMemoryAuditLogs.unshift(logRecord);
  if (_inMemoryAuditLogs.length > 500) _inMemoryAuditLogs.pop();
  persistAuditLogs();

  if (mongoose.connection.readyState === 1) {
    AuditLog.create(logRecord).catch(() => {});
  }

  const sessionResult = sessionGraph.updateSessionGraph(rawUser, logRecord.userEmail, detection);

  ws.broadcastDetection({
    id: logRecord.id,
    originalPrompt: prompt,
    sanitizedPrompt: logRecord.sanitizedPrompt,
    restoredResponse: logRecord.restoredResponse,
    riskScore: detection.overallRisk,
    detections: detection.detections,
    combinations: detection.combinations,
    contextScore: detection.contextScore,
    actionTaken: action,
    sessionCoverage: sessionResult.coverageMap,
    sessionRiskScore: sessionResult.riskScore,
    promptCount: sessionResult.promptCount,
    anomalyTriggered: sessionResult.anomalyTriggered,
    anomalyReport: sessionResult.anomalyReport,
    signature,
    user: rawUser,
    userName: logRecord.userName,
    userEmail: logRecord.userEmail,
    department: logRecord.department,
    host: logRecord.endpointHost,
    endpointIp: logRecord.endpointIp,
    aiPlatform: logRecord.aiPlatform,
    timestamp: logRecord.timestamp,
  });

  return { logRecord, sessionResult };
}

// ─── AI Client Initialization ────────────────────────────────────────────────

let groqClient = null;
let geminiModel = null;

function getGroqClient() {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

function getGeminiModel() {
  if (!geminiModel) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    geminiModel = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.0-flash" });
  }
  return geminiModel;
}


// ─── Action Decision Engine ──────────────────────────────────────────────────

function decideAction(overallRisk, detections) {
  if (!detections || detections.length === 0) {
    return "pass";
  }

  // Count distinct credentials
  const credentialCount = detections.filter((d) => d.category === "CREDENTIAL").length;
  const isSevereInjection = detections.some(
    (d) => d.category === "PROMPT_INJECTION" && d.isolationRisk >= 95
  );

  // Policy: Hard block ONLY if massive leaked credentials (>3) or severe prompt injection attack
  if (credentialCount > 3 || isSevereInjection) {
    return "hard_block";
  }

  // Otherwise, silently redact credentials (<=3), PII, financial, ICS registers, network addresses
  if (
    overallRisk >= 30 ||
    detections.some((d) =>
      ["CREDENTIAL", "PII", "CRITICAL_PII", "REGISTER_ADDR", "FINANCIAL", "NETWORK_ADDR"].includes(d.category)
    )
  ) {
    return "silent_redact";
  }

  if (overallRisk > 10) return "monitor";
  return "pass";
}


// ─── GET /api/vantix/health — Engine Health Check ────────────────────────────
router.get("/health", (req, res) => {
  res.json({
    status: "operational",
    engine: "vantix-ai-firewall",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
  });
});


router.get("/system-identity", (req, res) => {
  const os = require("os");
  const SERVER_IDENTITIES = ["render", "root", "nobody", "www-data", "node", "ubuntu", "ec2-user"];
  let user = "employee";
  let host = os.hostname() || "workstation";
  try {
    const osUser = process.env.USERNAME || process.env.USER || (os.userInfo && os.userInfo().username) || "";
    if (osUser && !SERVER_IDENTITIES.includes(osUser.toLowerCase())) user = osUser;
    const osHost = os.hostname() || "";
    if (osHost && !osHost.startsWith("srv-")) host = osHost;
  } catch (e) {}

  const clientIp = extractClientIp(req);

  res.json({
    success: true,
    user,
    host,
    clientIp,
    displayName: `${user} (${host})`,
    platform: os.platform(),
  });
});

// ─── Browser Guard Extension Heartbeat & Verification ────────────────────────
const _activeGuardClients = new Map(); // key -> lastSeenTimestamp

router.post("/guard-heartbeat", (req, res) => {
  const ip = extractClientIp(req);
  const user = req.body?.user || "employee";
  const now = Date.now();
  _activeGuardClients.set(ip, now);
  _activeGuardClients.set("127.0.0.1", now);
  _activeGuardClients.set("::1", now);
  _activeGuardClients.set("::ffff:127.0.0.1", now);
  _activeGuardClients.set(user.toLowerCase(), now);
  res.json({ success: true, registered: true, timestamp: now });
});

router.get("/guard-status", (req, res) => {
  const ip = extractClientIp(req);
  const user = req.query?.user || "employee";
  const now = Date.now();
  const lastSeen = _activeGuardClients.get(ip) || _activeGuardClients.get("127.0.0.1") || _activeGuardClients.get(user.toLowerCase()) || 0;
  const isGuardActive = (now - lastSeen) < 90_000;
  res.json({ success: true, isGuardActive, lastSeen });
});

function isGuardActiveForClient(ip, user) {
  const now = Date.now();
  const lastSeen =
    _activeGuardClients.get(ip) ||
    _activeGuardClients.get("127.0.0.1") ||
    _activeGuardClients.get("::1") ||
    _activeGuardClients.get(user ? user.toLowerCase() : "") ||
    0;
  return (now - lastSeen) < 90_000;
}
router.isGuardActiveForClient = isGuardActiveForClient;

// ─── Dynamic Per-Domain Navigation Intent Authorization ──────────────────────
// Extension explicitly authorizes the exact AI domain it is navigating to.
// Consumable token bucket: tokens are decremented on connection, and expire in 1.5s max.
// Unmanaged browsers (Incognito / no extension) NEVER dispatch this intent -> blocked immediately.
const _authorizedNavigations = new Map(); // cleanDomain -> { expiresAt, tokens }

router.post("/authorize-ai-access", (req, res) => {
  const domain = req.body?.domain;
  if (!domain) return res.status(400).json({ error: "domain required" });
  const clean = domain.split(":")[0].toLowerCase().trim();
  // Short-lived token bucket (1.5 seconds) with 8 connection tokens for initial handshake burst
  const expiresAt = Date.now() + 1500;
  _authorizedNavigations.set(clean, {
    expiresAt,
    tokens: 8,
  });
  res.json({ success: true, domain: clean, expiresAt });
});

function isDomainAuthorized(domain) {
  if (!domain) return false;
  const clean = domain.split(":")[0].toLowerCase().trim();
  const now = Date.now();
  for (const [authDomain, auth] of _authorizedNavigations.entries()) {
    if (auth.expiresAt > now && auth.tokens > 0) {
      if (clean === authDomain || clean.endsWith("." + authDomain) || authDomain.endsWith("." + clean)) {
        auth.tokens--;
        if (auth.tokens <= 0) {
          _authorizedNavigations.delete(authDomain);
        }
        return true;
      }
    } else if (auth.expiresAt <= now) {
      _authorizedNavigations.delete(authDomain);
    }
  }
  return false;
}
router.isDomainAuthorized = isDomainAuthorized;

// ─── POST /api/vantix/inspect — Ultra-Fast (<5ms) TEE Prompt Inspection ──────
router.post("/inspect", async (req, res) => {
  const startTime = Date.now();
  const SERVER_IDENTITIES = ["render", "root", "nobody", "www-data", "node", "ubuntu", "ec2-user"];
  const os = require("os");
  let fallbackUser = "employee";
  let fallbackHost = os.hostname() || "workstation";
  try {
    const osUser = process.env.USERNAME || process.env.USER || (os.userInfo && os.userInfo().username) || "";
    if (osUser && !SERVER_IDENTITIES.includes(osUser.toLowerCase())) fallbackUser = osUser;
    const osHost = os.hostname() || "";
    if (osHost && !osHost.startsWith("srv-")) fallbackHost = osHost;
  } catch (e) {}

  let resolvedUser = req.headers["x-vantix-user"] || req.body.userId || req.body.user;
  if (!resolvedUser || SERVER_IDENTITIES.includes(resolvedUser.toLowerCase())) {
    resolvedUser = fallbackUser;
  }
  let resolvedHost = req.headers["x-vantix-host"] || req.body.host;
  if (!resolvedHost || resolvedHost === "browser-endpoint" || resolvedHost.startsWith("srv-")) {
    resolvedHost = fallbackHost;
  }
  const { prompt, sessionId = `session-${resolvedUser}-${Date.now()}`, userId = resolvedUser, userEmail = `${resolvedUser}@acme.com` } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ success: false, error: "prompt is required" });
  }

  try {
    const interceptedAt = new Date().toISOString();
    const detection = analyzePrompt(prompt);
    const action = decideAction(detection.overallRisk, detection.detections);
    let sanitizedPrompt = prompt;
    let tokenMap = new Map();

    if (action === "hard_block") {
      const auditEntry = {
        timestamp: interceptedAt,
        userId: resolvedUser,
        orgId: req.orgId || "demo",
        riskScore: detection.overallRisk,
        actionTaken: "hard_block",
        categoriesRedacted: detection.categoriesFound,
        aiPlatform: req.headers["x-vantix-app"] || req.body.app || "chatgpt.com",
      };
      const signature = tee.signAuditEntry(auditEntry);

      const { logRecord, sessionResult } = recordAndBroadcast({
        resolvedUser,
        userEmail,
        resolvedHost,
        prompt,
        sanitizedPrompt: "[BLOCKED — Prompt contained live credentials / confidential parameters]",
        restoredResponse: "🚫 BLOCKED BY ENTERPRISE POLICY (Credentials detected)",
        action: "hard_block",
        detection,
        signature,
        interceptedAt,
        aiPlatform: req.headers["x-vantix-app"] || req.body.app || "chatgpt.com",
        req,
      });

      return res.json({
        success: true,
        blocked: true,
        action: "hard_block",
        message: "This prompt contains live credentials and has been blocked by your organization's security policy.",
        riskScore: detection.overallRisk,
        sanitizedPrompt: prompt,
        processingTime: Date.now() - startTime,
        meta: {
          action: "hard_block",
          riskScore: detection.overallRisk,
          detectionsCount: detection.detections.length,
          combinationsCount: detection.combinations.length,
          sessionRiskScore: sessionResult.riskScore,
          anomalyTriggered: sessionResult.anomalyTriggered,
          categoriesRedacted: detection.categoriesFound || Array.from(new Set(detection.detections.map(d => d.category))),
        },
      });
    }

    if (action === "silent_redact" && detection.detections.length > 0) {
      tokenMap = tee.createTokenTable(sessionId, detection.detections, prompt);
      sanitizedPrompt = tee.sanitizePrompt(prompt, tokenMap);
    }

    const auditEntry = {
      timestamp: interceptedAt,
      userId,
      orgId: req.orgId || "demo",
      riskScore: detection.overallRisk,
      actionTaken: action,
      categoriesRedacted: detection.categoriesFound,
      aiPlatform: req.headers["x-vantix-app"] || req.body.app || "chatgpt.com",
    };
    const signature = tee.signAuditEntry(auditEntry);

    const { logRecord, sessionResult } = recordAndBroadcast({
      resolvedUser,
      userEmail,
      resolvedHost,
      prompt,
      sanitizedPrompt,
      restoredResponse: "PROMPT_INSPECTED_AND_SANITIZED",
      action,
      detection,
      signature,
      interceptedAt,
      aiPlatform: req.headers["x-vantix-app"] || req.body.app || "chatgpt.com",
      req,
    });

    return res.json({
      success: true,
      blocked: false,
      sanitizedPrompt,
      riskScore: detection.overallRisk,
      processingTime: Date.now() - startTime,
      meta: {
        action,
        riskScore: detection.overallRisk,
        detectionsCount: detection.detections.length,
        combinationsCount: detection.combinations.length,
        sessionRiskScore: sessionResult.riskScore,
        anomalyTriggered: sessionResult.anomalyTriggered,
        categoriesRedacted: detection.categoriesFound,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/vantix/chat — The 7-Step Pipeline ────────────────────────────

router.post("/chat", async (req, res) => {
  const startTime = Date.now();
  const SERVER_IDENTITIES = ["render", "root", "nobody", "www-data", "node", "ubuntu", "ec2-user"];
  const os = require("os");
  let fallbackUser = "employee";
  let fallbackHost = os.hostname() || "workstation";
  try {
    const osUser = process.env.USERNAME || process.env.USER || (os.userInfo && os.userInfo().username) || "";
    if (osUser && !SERVER_IDENTITIES.includes(osUser.toLowerCase())) fallbackUser = osUser;
    const osHost = os.hostname() || "";
    if (osHost && !osHost.startsWith("srv-")) fallbackHost = osHost;
  } catch (e) {}

  let resolvedUser = req.headers["x-vantix-user"] || req.body.userId || req.body.user;
  if (!resolvedUser || SERVER_IDENTITIES.includes(resolvedUser.toLowerCase())) {
    resolvedUser = fallbackUser;
  }
  let resolvedHost = req.headers["x-vantix-host"] || req.body.host;
  if (!resolvedHost || resolvedHost === "browser-endpoint" || resolvedHost.startsWith("srv-")) {
    resolvedHost = fallbackHost;
  }
  const clientIp = extractClientIp(req);
  const { prompt, sessionId = `session-${resolvedUser}-${Date.now()}`, userId = resolvedUser, userEmail = `${resolvedUser}@acme.com` } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ success: false, error: "prompt is required" });
  }

  try {
    // ── Step 1: Intercept ───────────────────────────────────────────────────
    const interceptedAt = new Date().toISOString();

    // ── Step 2: Detect ──────────────────────────────────────────────────────
    const detection = analyzePrompt(prompt);

    // ── Step 3: Redact (inside TEE enclave) ─────────────────────────────────
    const action = decideAction(detection.overallRisk, detection.detections);
    let sanitizedPrompt = prompt;
    let tokenMap = new Map();

    if (action === "hard_block") {
      // Hard block — do NOT forward to AI
      const auditEntry = {
        timestamp: interceptedAt,
        userId: resolvedUser,
        orgId: req.orgId || "demo",
        riskScore: detection.overallRisk,
        actionTaken: "hard_block",
        categoriesRedacted: detection.categoriesFound,
        aiPlatform: req.headers["x-vantix-app"] || req.body.app || "chatgpt.com",
      };
      const signature = tee.signAuditEntry(auditEntry);

      const { logRecord, sessionResult } = recordAndBroadcast({
        resolvedUser,
        userEmail,
        resolvedHost,
        prompt,
        sanitizedPrompt: "[BLOCKED — Prompt contained live credentials / confidential parameters]",
        restoredResponse: "🚫 BLOCKED BY ENTERPRISE POLICY (Credentials detected)",
        action: "hard_block",
        detection,
        signature,
        interceptedAt,
        aiPlatform: req.headers["x-vantix-app"] || req.body.app || "chatgpt.com",
        req,
      });

      return res.json({
        success: false,
        blocked: true,
        response: "🚫 BLOCKED BY ENTERPRISE POLICY (Live credentials detected)",
        message: "This prompt contains live credentials and has been blocked by your organization's security policy.",
        riskScore: detection.overallRisk,
        processingTime: Date.now() - startTime,
        meta: {
          action: "hard_block",
          riskScore: detection.overallRisk,
          detectionsCount: detection.detections.length,
          combinationsCount: detection.combinations.length,
          sessionRiskScore: sessionResult.riskScore,
          anomalyTriggered: sessionResult.anomalyTriggered,
          categoriesRedacted: detection.categoriesFound || Array.from(new Set(detection.detections.map(d => d.category))),
        },
      });
    }

    if (action === "silent_redact" && detection.detections.length > 0) {
      tokenMap = tee.createTokenTable(sessionId, detection.detections, prompt);
      sanitizedPrompt = tee.sanitizePrompt(prompt, tokenMap);
    }

    // ── Step 4: Forward to AI (Groq Llama 3.3 for speed) ────────────────────
    let aiResponse = "";
    try {
      const groq = getGroqClient();
      const completion = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are a helpful technical assistant. Answer questions about industrial systems, engineering, and technology. When you see placeholder tokens like [REGISTER_ADDR] or [ELECTRICAL_PARAM], treat them as real values and provide technically accurate answers. Use the placeholder tokens in your response where appropriate."
          },
          { role: "user", content: sanitizedPrompt }
        ],
        temperature: 0.7,
        max_tokens: 512,
      });
      aiResponse = completion.choices[0]?.message?.content || "I apologize, but I was unable to generate a response.";
    } catch (aiErr) {
      console.error("[Proxy] Groq API error:", aiErr.message);
      // Seamless fallback to Gemini Flash if Groq is rate-limited
      try {
        const gemini = getGeminiModel();
        const geminiRes = await gemini.generateContent(sanitizedPrompt);
        aiResponse = geminiRes.response.text();
      } catch (geminiErr) {
        console.error("[Proxy] Gemini fallback error:", geminiErr.message);
        aiResponse = "I have processed your request, but external AI returned an error.";
      }
    }

    // ── Step 5: Restore (inside TEE enclave) ────────────────────────────────
    const restoredResponse = tee.restoreResponse(sessionId, aiResponse);

    // Destroy token table — ephemeral memory is wiped
    tee.destroySession(sessionId);

    // ── Step 6: Log — Cryptographically signed audit entry ──────────────────
    const auditEntry = {
      timestamp: interceptedAt,
      userId,
      orgId: req.orgId || "demo",
      riskScore: detection.overallRisk,
      actionTaken: action,
      categoriesRedacted: detection.categoriesFound,
      aiPlatform: req.headers["x-vantix-app"] || req.body.app || process.env.GROQ_MODEL || "groq-llama-3.3",
    };
    const signature = tee.signAuditEntry(auditEntry);

    const { logRecord, sessionResult } = recordAndBroadcast({
      resolvedUser,
      userEmail,
      resolvedHost,
      prompt,
      sanitizedPrompt,
      restoredResponse,
      action,
      detection,
      signature,
      interceptedAt,
      aiPlatform: req.headers["x-vantix-app"] || req.body.app || "chatgpt.com",
      req,
    });

    // ── Step 7: Return restored response ────────────────────────────────────
    const processingTime = Date.now() - startTime;

    return res.json({
      success: true,
      sanitizedPrompt,
      response: restoredResponse,
      processingTime,
      meta: {
        riskScore: detection.overallRisk,
        action,
        detectionsCount: detection.detections.length,
        combinationsCount: detection.combinations.length,
        sessionRiskScore: sessionResult.riskScore,
        anomalyTriggered: sessionResult.anomalyTriggered,
        categoriesRedacted: detection.categoriesFound || Array.from(new Set(detection.detections.map(d => d.category))),
      },
    });

  } catch (err) {
    console.error("[Proxy] Pipeline error:", err);
    return res.status(500).json({ success: false, error: "Internal pipeline error" });
  }
});


// ─── POST /v1/chat/completions — OpenAI Standard API Drop-In Route ──────────
// Accepts standard OpenAI request payloads, extracts prompt, applies Vantix
// silent TEE firewall, forwards to Groq/LLM, restores tokens, and returns
// standard OpenAI chat completion JSON format.

router.post(["/v1/chat/completions", "/chat/completions"], async (req, res) => {
  const startTime = Date.now();

  // Extract prompt from messages array or string prompt
  let prompt = "";
  if (Array.isArray(req.body.messages) && req.body.messages.length > 0) {
    const lastUserMsg = [...req.body.messages].reverse().find((m) => m.role === "user") || req.body.messages[req.body.messages.length - 1];
    const rawContent = lastUserMsg?.content;
    if (typeof rawContent === "string") {
      prompt = rawContent;
    } else if (Array.isArray(rawContent)) {
      prompt = rawContent.map((c) => (typeof c === "string" ? c : c?.text || "")).filter(Boolean).join(" ");
    } else if (rawContent && typeof rawContent === "object") {
      prompt = rawContent.text || JSON.stringify(rawContent);
    }
  } else if (typeof req.body.prompt === "string") {
    prompt = req.body.prompt;
  }

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: { message: "No valid prompt or messages provided in request", type: "invalid_request_error" } });
  }

  // Automatically resolve caller identity from headers or local OS
  const resolvedUser = req.headers["x-vantix-user"] || process.env.USER || require("os").userInfo().username || "employee";
  const resolvedHost = req.headers["x-vantix-host"] || require("os").hostname() || "workstation";
  const userEmail = req.headers["x-vantix-email"] || `${resolvedUser}@acme.com`;
  const sessionId = req.headers["x-vantix-session"] || `sess-${resolvedUser}-${Date.now()}`;

  try {
    const interceptedAt = new Date().toISOString();

    // ── Step 2: 3-Sublayer Detection ─────────────────────────────────────────
    const detection = analyzePrompt(prompt);
    const action = decideAction(detection.overallRisk, detection.detections);

    let tokenMap = new Map();
    let sanitizedPrompt = prompt;

    if (action === "hard_block") {
      const auditEntry = {
        timestamp: interceptedAt,
        userId: resolvedUser,
        orgId: "corporate",
        riskScore: detection.overallRisk,
        actionTaken: "hard_block",
        categoriesRedacted: detection.categoriesFound,
      };
      const signature = tee.signAuditEntry(auditEntry);

      ws.broadcastDetection({
        originalPrompt: prompt,
        sanitizedPrompt: "[HARD BLOCKED — Critical credentials detected]",
        restoredResponse: "🚫 BLOCKED BY ENTERPRISE POLICY (Credentials detected)",
        riskScore: detection.overallRisk,
        detections: detection.detections,
        combinations: detection.combinations,
        contextScore: detection.contextScore,
        actionTaken: "hard_block",
        user: resolvedUser,
        host: resolvedHost,
        timestamp: interceptedAt,
      });

      return res.status(403).json({
        id: `chatcmpl-block-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: req.body.model || "gpt-4o",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "This prompt contains live credentials and was halted by corporate policy.",
            },
            finish_reason: "stop",
          },
        ],
      });
    }

    // ── Step 3: TEE Redaction ───────────────────────────────────────────────
    if (action === "silent_redact" && detection.detections.length > 0) {
      tokenMap = tee.createTokenTable(sessionId, detection.detections, prompt);
      sanitizedPrompt = tee.sanitizePrompt(prompt, tokenMap);
    }

    // ── Step 4: Forward to Groq AI ──────────────────────────────────────────
    let aiResponse = "";
    try {
      const groq = getGroqClient();
      const completion = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL || "qwen/qwen3.8-27b",
        messages: [
          {
            role: "system",
            content: "You are a helpful technical assistant. Answer questions accurately. When you see placeholder tokens like [REGISTER_ADDR] or [ELECTRICAL_PARAM], treat them as valid technical specifications and preserve them in your response.",
          },
          { role: "user", content: sanitizedPrompt },
        ],
        temperature: req.body.temperature || 0.7,
        max_tokens: Math.min(parseInt(req.body.max_tokens) || 512, 512),
      });
      aiResponse = completion.choices[0]?.message?.content || "No response generated";
    } catch (aiErr) {
      console.error("[OpenAI-Route] Groq API error:", aiErr.message);
      try {
        const gemini = getGeminiModel();
        const geminiRes = await gemini.generateContent(sanitizedPrompt);
        aiResponse = geminiRes.response.text();
      } catch (geminiErr) {
        console.error("[OpenAI-Route] Gemini fallback error:", geminiErr.message);
        aiResponse = "Service temporarily unavailable.";
      }
    }

    // ── Step 5: TEE Token Restoration ───────────────────────────────────────
    const restoredResponse = tee.restoreResponse(sessionId, aiResponse);
    tee.destroySession(sessionId);

    // ── Step 6: Log Tamper-Evident Audit Record ──────────────────────────────
    const auditEntry = {
      timestamp: interceptedAt,
      userId: resolvedUser,
      orgId: "corporate",
      riskScore: detection.overallRisk,
      actionTaken: action,
      categoriesRedacted: detection.categoriesFound,
      aiPlatform: "api.openai.com",
    };
    const signature = tee.signAuditEntry(auditEntry);

    const { logRecord, sessionResult } = recordAndBroadcast({
      resolvedUser,
      userEmail,
      resolvedHost,
      prompt,
      sanitizedPrompt,
      restoredResponse,
      action,
      detection,
      signature,
      interceptedAt,
      aiPlatform: "api.openai.com",
      req,
    });

    // ── Step 7: Return in Standard OpenAI Format ─────────────────────────────
    if (req.body.stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const chunk = {
        id: `chatcmpl-vantix-${Date.now()}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: req.body.model || "gpt-4o",
        choices: [{ index: 0, delta: { content: restoredResponse }, finish_reason: "stop" }],
      };
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      res.write("data: [DONE]\n\n");
      return res.end();
    }

    return res.json({
      id: `chatcmpl-vantix-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: req.body.model || "gpt-4o",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: restoredResponse,
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: Math.round(prompt.length / 4),
        completion_tokens: Math.round(restoredResponse.length / 4),
        total_tokens: Math.round((prompt.length + restoredResponse.length) / 4),
      },
      vantix_security: {
        risk_score: detection.overallRisk,
        action_taken: action,
        categories_redacted: detection.categoriesFound,
        user: resolvedUser,
        host: resolvedHost,
        processing_ms: Date.now() - startTime,
      },
    });

  } catch (err) {
    console.error("[OpenAI-Route] Error:", err);
    return res.status(500).json({ error: { message: "Internal proxy error", type: "server_error" } });
  }
});


// ─── GET /api/vantix/session-graph — D3 visualization data ──────────────────

router.get("/session-graph", (req, res) => {
  const userId = req.query.userId || "demo-engineer";
  const visualization = sessionGraph.getGraphVisualization(userId);
  const graphData = sessionGraph.getSessionGraphData(userId);

  res.json({
    success: true,
    graph: visualization,
    riskScore: graphData.riskScore,
    promptCount: graphData.promptCount,
    anomalyTriggered: graphData.anomalyTriggered,
    anomalyReport: graphData.anomalyReport,
    coverageMap: graphData.coverageMap,
  });
});


// ─── POST /api/vantix/reset — Reset session for demo replay ─────────────────

router.post("/reset", (req, res) => {
  const userId = req.body.userId || "demo-engineer";
  sessionGraph.resetSessionGraph(userId);
  _inMemoryAuditLogs.length = 0;
  console.log(`[Proxy] Session graph & audit buffer reset for ${userId}`);

  ws.broadcast({
    type: "reset",
    timestamp: new Date().toISOString(),
    message: "Session graph reset — demo ready",
  });

  res.json({ success: true, message: "Session reset" });
});


// ─── GET /api/vantix/audit-logs — Retrieve signed audit records ─────────────
router.get("/audit-logs", (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const logs = _inMemoryAuditLogs.slice(0, limit);
  res.json({
    success: true,
    count: logs.length,
    total: _inMemoryAuditLogs.length,
    logs,
  });
});

// ─── GET /api/vantix/flagged-employees — Dynamic Flagged Directory ──────────
router.get("/flagged-employees", (req, res) => {
  const userMap = new Map();

  const SERVER_IDENTITIES = ["render", "root", "nobody", "www-data", "node", "ubuntu", "ec2-user"];
  for (const log of _inMemoryAuditLogs) {
    if (SERVER_IDENTITIES.includes((log.userId || "").toLowerCase()) || (log.endpointHost || "").startsWith("srv-")) {
      continue;
    }

    // Only track and flag employees with genuine data exfiltration attempts!
    // Clean, normal, or sanitized prompts (riskScore < 35 and actionTaken !== 'hard_block') MUST NOT flag employees!
    const isActualLeak = (log.riskScore >= 35) || (log.actionTaken === "hard_block");
    if (!isActualLeak) {
      continue;
    }

    const key = (log.userId || log.userEmail || "unknown").toLowerCase();
    if (!userMap.has(key)) {
      userMap.set(key, {
        id: key,
        userId: log.userId,
        name: log.userName || (key.charAt(0).toUpperCase() + key.slice(1).replace(/[._]/g, " ")),
        email: log.userEmail || `${key}@acme.corp`,
        department: log.department || "Core Operations",
        endpointHost: log.endpointHost || "ws-corp-node",
        endpointIp: log.endpointIp || "10.0.12.50",
        totalAttempts: 0,
        hardBlockedCount: 0,
        redactedCount: 0,
        peakRiskScore: 0,
        categories: new Set(),
        lastAttempt: log.timestamp,
        status: "Active",
      });
    }

    const entry = userMap.get(key);
    entry.totalAttempts++;
    if (log.actionTaken === "hard_block") entry.hardBlockedCount++;
    if (log.actionTaken === "silent_redact") entry.redactedCount++;
    if (log.riskScore > entry.peakRiskScore) entry.peakRiskScore = log.riskScore;
    if (new Date(log.timestamp) >= new Date(entry.lastAttempt)) {
      entry.lastAttempt = log.timestamp;
      if (log.endpointHost) entry.endpointHost = log.endpointHost;
      if (log.endpointIp) entry.endpointIp = log.endpointIp;
    }
    if (Array.isArray(log.categoriesRedacted)) {
      log.categoriesRedacted.forEach((c) => entry.categories.add(c));
    }
    if (Array.isArray(log.detections)) {
      log.detections.forEach((d) => {
        if (d.category) entry.categories.add(d.category);
      });
    }
  }

  const result = Array.from(userMap.values())
    .filter((u) => u.totalAttempts > 0 && u.peakRiskScore >= 35)
    .map((u) => ({
      ...u,
      topCategories: Array.from(u.categories),
      threatLevel:
        u.peakRiskScore >= 80
          ? "CRITICAL"
          : u.peakRiskScore >= 50
          ? "HIGH"
          : u.peakRiskScore >= 25
          ? "MEDIUM"
          : "LOW",
      status:
        u.hardBlockedCount > 0
          ? "Blocked"
          : u.redactedCount > 0
          ? "Redactions Active"
          : "Monitored",
    }))
    .sort(
      (a, b) =>
        b.peakRiskScore - a.peakRiskScore || b.totalAttempts - a.totalAttempts
    );

  const totalIncidents = _inMemoryAuditLogs.length;
  const blockedCount = result.reduce((acc, e) => acc + e.hardBlockedCount, 0);
  const redactedCount = result.reduce((acc, e) => acc + e.redactedCount, 0);

  res.json({
    success: true,
    employees: result,
    totalFlagged: result.length,
    totalIncidents,
    blockedCount,
    redactedCount,
  });
});


// ─── GET /api/vantix/employee/:userId — Full Dossier & Incident Timeline ─────
router.get("/employee/:userId", (req, res) => {
  const targetId = req.params.userId.toLowerCase();

  const employeeLogs = _inMemoryAuditLogs.filter(
    (l) =>
      (l.userId && l.userId.toLowerCase() === targetId) ||
      (l.userEmail && l.userEmail.toLowerCase().includes(targetId))
  );

  if (employeeLogs.length === 0) {
    return res.status(404).json({
      success: false,
      error: `No records found for employee: ${req.params.userId}`,
    });
  }

  const newest = employeeLogs[0];
  const totalAttempts = employeeLogs.length;
  const hardBlockedCount = employeeLogs.filter(
    (l) => l.actionTaken === "hard_block"
  ).length;
  const redactedCount = employeeLogs.filter(
    (l) => l.actionTaken === "silent_redact"
  ).length;
  const peakRiskScore = Math.max(...employeeLogs.map((l) => l.riskScore || 0));
  const avgRiskScore = Math.round(
    employeeLogs.reduce((acc, l) => acc + (l.riskScore || 0), 0) / totalAttempts
  );

  // Category breakdown for Pie Chart
  const catCountMap = {};
  employeeLogs.forEach((l) => {
    const cats =
      l.categoriesRedacted && l.categoriesRedacted.length > 0
        ? l.categoriesRedacted
        : (l.detections || []).map((d) => d.category);
    cats.forEach((c) => {
      const cleanCat = c.replace(/_/g, " ");
      catCountMap[cleanCat] = (catCountMap[cleanCat] || 0) + 1;
    });
  });
  const totalCatHits =
    Object.values(catCountMap).reduce((a, b) => a + b, 0) || 1;
  const categoryBreakdown = Object.entries(catCountMap)
    .map(([category, count]) => ({
      name: category,
      count,
      percentage: Math.round((count / totalCatHits) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // Risk progression timeline (oldest to newest for graphing)
  const riskTimeline = [...employeeLogs].reverse().map((l, idx) => ({
    attempt: `Attempt #${idx + 1}`,
    time: new Date(l.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    riskScore: l.riskScore || 0,
    action: l.actionTaken === "hard_block" ? "Blocked" : "Redacted",
    targetService: l.aiPlatform || "chatgpt.com",
    promptSnippet:
      (l.originalPrompt || l.promptSnippet || "").slice(0, 35) + "...",
  }));

  // Action breakdown for Bar Chart
  const actionBreakdown = [
    { name: "Hard Blocked", value: hardBlockedCount, fill: "#ef4444" },
    { name: "Redacted & Forwarded", value: redactedCount, fill: "#3b82f6" },
    {
      name: "Monitored / Passed",
      value: Math.max(0, totalAttempts - hardBlockedCount - redactedCount),
      fill: "#10b981",
    },
  ].filter((a) => a.value > 0);

  res.json({
    success: true,
    employee: {
      id: newest.userId,
      userId: newest.userId,
      name: newest.userName || newest.userId,
      email: newest.userEmail,
      department: newest.department || "Core Operations",
      endpointHost: newest.endpointHost || "corp-ws-01",
      endpointIp: newest.endpointIp || "10.0.12.50",
      threatLevel:
        peakRiskScore >= 80
          ? "CRITICAL"
          : peakRiskScore >= 50
          ? "HIGH"
          : peakRiskScore >= 25
          ? "MEDIUM"
          : "LOW",
      peakRiskScore,
      avgRiskScore,
      totalAttempts,
      hardBlockedCount,
      redactedCount,
      categoryBreakdown,
      riskTimeline,
      actionBreakdown,
      leakAttempts: employeeLogs.map((l) => ({
        id: l.id || `attempt-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: l.timestamp,
        timeFormatted: new Date(l.timestamp).toLocaleString(),
        targetService: l.aiPlatform || "chatgpt.com",
        actionTaken: l.actionTaken,
        riskScore: l.riskScore || 0,
        originalPrompt:
          l.originalPrompt || l.promptSnippet || "Confidential outbound prompt",
        sanitizedPrompt: l.sanitizedPrompt || "[SANITIZED]",
        restoredResponse: l.restoredResponse || "Response safely delivered.",
        detections: l.detections || [],
        categories: l.categoriesRedacted || [],
        cryptoSignature: l.cryptoSignature,
        endpointHost: l.endpointHost,
        endpointIp: l.endpointIp,
      })),
    },
  });
});


// ─── POST /api/vantix/simulate-leak — Live Demo Trigger (Fully Dynamic) ──────
router.post("/simulate-leak", async (req, res) => {
  const { employeeId = "demo-user", leakType = "aws_keys" } = req.body;
  const os = require("os");

  // Dynamically resolve identity — no hardcoded dummy employees
  const userName = employeeId.charAt(0).toUpperCase() + employeeId.slice(1).replace(/[._]/g, " ");
  const userEmail = req.body.userEmail || `${employeeId}@acme.corp`;
  const department = req.body.department || "Enterprise Operations";
  let endpointHost = req.body.endpointHost || os.hostname() || `${employeeId}-workstation`;
  const aiPlatform = req.body.aiPlatform || "chatgpt.com";

  // Resolve prompt from custom input or leak type templates
  let prompt = req.body.prompt || "";
  if (!prompt) {
    const LEAK_TEMPLATES = {
      aws_keys: 'Review this AWS policy snippet: access_key_id = "AKIAIOSFODNN7EXAMPLE" and secret_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" for production S3 replication.',
      scada_reg: "Analyzing turbine Mark VIe register 0x4001 at internal substation 192.168.1.50 with nominal grid frequency 60.2 Hz. What triggers sudden emergency trip?",
      patient_ssn: "Summarize clinical status for patient Johnathan Doe, SSN: 123-45-6789, MRN #98421 diagnosed with Stage 2 Hypertension.",
      credit_card: 'Validate payment webhook: { card_number: "4532-8812-9901-4321", cvv: "882", exp: "08/28" } for failed checkout event.',
      jwt_secret: 'How do I rotate our master JWT secret: jwt_secret_signing_key_prod_9942a across our Kubernetes microservices?',
      benign_prompt: "Explain how combined cycle gas turbines achieve high thermodynamic efficiency.",
      sanitized_prompt: "Investigating turbine [SCADA_REG_01] at internal substation [INTERNAL_IP_01] with nominal grid frequency [FREQUENCY_01]. What triggers sudden emergency trip?",
    };
    prompt = LEAK_TEMPLATES[leakType] || LEAK_TEMPLATES.aws_keys;
  }

  const interceptedAt = new Date().toISOString();
  const detection = analyzePrompt(prompt);
  const action = decideAction(detection.overallRisk, detection.detections);
  let sanitizedPrompt = prompt;

  if (action === "hard_block") {
    sanitizedPrompt = "[BLOCKED — Prompt contained live credentials / confidential parameters]";
  } else if (action === "silent_redact") {
    const tokenMap = tee.createTokenTable(`sim-${Date.now()}`, detection.detections, prompt);
    sanitizedPrompt = tee.sanitizePrompt(prompt, tokenMap);
  }

  const auditEntry = {
    timestamp: interceptedAt,
    userId: employeeId,
    orgId: "acme-corp",
    riskScore: detection.overallRisk,
    actionTaken: action,
    categoriesRedacted: detection.categoriesFound,
    aiPlatform,
  };
  const signature = tee.signAuditEntry(auditEntry);

  const { logRecord } = recordAndBroadcast({
    resolvedUser: employeeId,
    userEmail,
    resolvedHost: endpointHost,
    endpointIp: req.headers["x-forwarded-for"] || req.ip || "10.0.14.88",
    prompt,
    sanitizedPrompt,
    restoredResponse:
      action === "hard_block"
        ? "🚫 BLOCKED BY ENTERPRISE POLICY (Critical secrets detected in prompt)"
        : "Sanitized response safely returned without data leakage.",
    action,
    detection,
    signature,
    interceptedAt,
    aiPlatform,
  });

  res.json({
    success: true,
    message: `Live data leak attempt recorded for ${userName}`,
    incident: logRecord,
  });
});


// ─── POST /api/vantix/employee/:userId/action — Policy Enforcement Action ────
router.post("/employee/:userId/action", (req, res) => {
  const { action = "acknowledge" } = req.body;
  const userId = req.params.userId;

  console.log(`[Admin Action] Policy action "${action}" applied to employee ${userId}`);

  ws.broadcast({
    type: "employee_action",
    userId,
    action,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    message: `Action "${action}" successfully executed for employee ${userId}`,
  });
});


module.exports = router;

