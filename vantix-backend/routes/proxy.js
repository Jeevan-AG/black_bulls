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
const AuditLog = require("../models/AuditLog");
const mongoose = require("mongoose");

// Fast in-memory audit ring buffer (survives offline DB during live demos)
const _inMemoryAuditLogs = [];

// ─── Seed Realistic Corporate Incidents ───────────────────────────────────────
function seedCorporateIncidents() {
  if (_inMemoryAuditLogs.length > 0) return;

  const now = Date.now();
  const sampleIncidents = [
    {
      id: "inc-sc-01",
      orgId: "acme-corp",
      userId: "sarah.chen",
      userName: "Sarah Chen",
      userEmail: "sarah.chen@acme.corp",
      department: "Cloud Infrastructure & DevOps",
      endpointHost: "sarah-macbook-pro.corp.internal",
      endpointIp: "10.0.12.44",
      aiPlatform: "chatgpt.com",
      actionTaken: "hard_block",
      riskScore: 96,
      categoriesRedacted: ["AWS_CREDENTIAL", "SECRET_KEY"],
      detections: [
        { category: "CREDENTIAL", matchedText: "AKIAIOSFODNN7EXAMPLE", isolationRisk: 95, description: "Live AWS Access Key ID" },
        { category: "CREDENTIAL", matchedText: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", isolationRisk: 96, description: "AWS Secret Access Key" }
      ],
      originalPrompt: "Here is our Terraform IAM policy for production S3 access: provider \"aws\" { access_key = \"AKIAIOSFODNN7EXAMPLE\", secret_key = \"wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\", region = \"us-east-1\" }. How do I restrict bucket acl?",
      sanitizedPrompt: "[BLOCKED — Prompt contained live AWS production credentials]",
      restoredResponse: "🚫 BLOCKED BY ENTERPRISE POLICY: Live AWS credentials detected in prompt.",
      timestamp: new Date(now - 12 * 60 * 1000).toISOString(),
    },
    {
      id: "inc-sc-02",
      orgId: "acme-corp",
      userId: "sarah.chen",
      userName: "Sarah Chen",
      userEmail: "sarah.chen@acme.corp",
      department: "Cloud Infrastructure & DevOps",
      endpointHost: "sarah-macbook-pro.corp.internal",
      endpointIp: "10.0.12.44",
      aiPlatform: "claude.ai",
      actionTaken: "hard_block",
      riskScore: 88,
      categoriesRedacted: ["DATABASE_CREDENTIAL", "INTERNAL_HOST"],
      detections: [
        { category: "CREDENTIAL", matchedText: "postgres://admin_root:SuperSecr3t2026!@prod-rds.internal", isolationRisk: 90, description: "Postgres Master DB Connection String" }
      ],
      originalPrompt: "Troubleshooting database migration timeout for postgres://admin_root:SuperSecr3t2026!@prod-rds.internal:5432/core_users. What connection pool settings prevent connection exhaustion?",
      sanitizedPrompt: "[BLOCKED — Database master connection URI detected]",
      restoredResponse: "🚫 BLOCKED BY ENTERPRISE POLICY: Production database credentials cannot be shared with external AI.",
      timestamp: new Date(now - 45 * 60 * 1000).toISOString(),
    },
    {
      id: "inc-at-01",
      orgId: "acme-corp",
      userId: "alex.turner",
      userName: "Alex Turner",
      userEmail: "alex.turner@acme.corp",
      department: "SCADA & Industrial Automation",
      endpointHost: "alex-industrial-ws01",
      endpointIp: "192.168.1.105",
      aiPlatform: "chatgpt.com",
      actionTaken: "silent_redact",
      riskScore: 78,
      categoriesRedacted: ["SCADA_REGISTER", "INTERNAL_IP", "GRID_FREQUENCY"],
      detections: [
        { category: "SCADA_OT", matchedText: "0x4001", isolationRisk: 80, description: "Turbine Mark VIe governor register" },
        { category: "INTERNAL_NETWORK", matchedText: "192.168.1.50", isolationRisk: 65, description: "Substation internal IP" }
      ],
      originalPrompt: "Investigating turbine Mark VIe register 0x4001 at internal substation 192.168.1.50 with nominal grid frequency 60.2 Hz. What triggers sudden emergency trip?",
      sanitizedPrompt: "Investigating turbine [SCADA_REG_01] at internal substation [INTERNAL_IP_01] with nominal grid frequency [FREQUENCY_01]. What triggers sudden emergency trip?",
      restoredResponse: "When register 0x4001 (governor speed reference) exceeds trip threshold at 192.168.1.50 with 60.2 Hz frequency, the primary interlock triggers an overspeed trip signal.",
      timestamp: new Date(now - 25 * 60 * 1000).toISOString(),
    },
    {
      id: "inc-at-02",
      orgId: "acme-corp",
      userId: "alex.turner",
      userName: "Alex Turner",
      userEmail: "alex.turner@acme.corp",
      department: "SCADA & Industrial Automation",
      endpointHost: "alex-industrial-ws01",
      endpointIp: "192.168.1.105",
      aiPlatform: "claude.ai",
      actionTaken: "silent_redact",
      riskScore: 68,
      categoriesRedacted: ["PLC_ADDRESS", "MODBUS_TAG"],
      detections: [
        { category: "SCADA_OT", matchedText: "PLC-MODBUS-TAG-8821", isolationRisk: 70, description: "Modbus Holding Register Tag" }
      ],
      originalPrompt: "Explain PLC-MODBUS-TAG-8821 holding register rollover behavior under continuous Modbus TCP polling from SCADA master node.",
      sanitizedPrompt: "Explain [MODBUS_TAG_01] holding register rollover behavior under continuous Modbus TCP polling from SCADA master node.",
      restoredResponse: "For PLC-MODBUS-TAG-8821 holding registers, 16-bit registers roll over from 65535 to 0 unless configured as 32-bit unsigned double words.",
      timestamp: new Date(now - 80 * 60 * 1000).toISOString(),
    },
    {
      id: "inc-mv-01",
      orgId: "acme-corp",
      userId: "marcus.vance",
      userName: "Marcus Vance",
      userEmail: "marcus.vance@acme.corp",
      department: "Clinical & Health Informatics",
      endpointHost: "marcus-dell-latitude",
      endpointIp: "10.0.18.22",
      aiPlatform: "chatgpt.com",
      actionTaken: "hard_block",
      riskScore: 92,
      categoriesRedacted: ["HIPAA_PII", "SSN", "PATIENT_RECORD"],
      detections: [
        { category: "PII", matchedText: "123-45-6789", isolationRisk: 95, description: "Social Security Number (SSN)" },
        { category: "PII", matchedText: "Johnathan Doe MRN #98421", isolationRisk: 88, description: "Medical Record Number & Patient Identity" }
      ],
      originalPrompt: "Draft clinical discharge summary for patient Johnathan Doe, SSN: 123-45-6789, MRN #98421. Admitted with acute hypertensive crisis, prescribed Lisinopril 20mg daily.",
      sanitizedPrompt: "[BLOCKED — Protected Health Information (PHI) / SSN detected]",
      restoredResponse: "🚫 BLOCKED BY ENTERPRISE POLICY: HIPAA violation risk. Social Security Number and patient identifiable records cannot be processed by public AI.",
      timestamp: new Date(now - 35 * 60 * 1000).toISOString(),
    },
    {
      id: "inc-er-01",
      orgId: "acme-corp",
      userId: "elena.rostova",
      userName: "Elena Rostova",
      userEmail: "elena.rostova@acme.corp",
      department: "Fintech & Payment Gateway",
      endpointHost: "elena-fintech-node",
      endpointIp: "10.0.8.19",
      aiPlatform: "api.openai.com",
      actionTaken: "hard_block",
      riskScore: 89,
      categoriesRedacted: ["PCI_CARD_NUMBER", "FINANCIAL_DATA"],
      detections: [
        { category: "FINANCIAL", matchedText: "4532-8812-9901-4321", isolationRisk: 92, description: "PCI-DSS Visa Primary Account Number" }
      ],
      originalPrompt: "Validate webhook JSON payload parser for failed Stripe charge: { card: \"4532-8812-9901-4321\", cvv: \"882\", exp: \"08/28\", holder: \"Robert Sterling\" }",
      sanitizedPrompt: "[BLOCKED — Unencrypted payment card data detected]",
      restoredResponse: "🚫 BLOCKED BY ENTERPRISE POLICY: PCI-DSS compliance enforcement. Credit card account numbers are strictly barred from AI transmission.",
      timestamp: new Date(now - 55 * 60 * 1000).toISOString(),
    },
    {
      id: "inc-dk-01",
      orgId: "acme-corp",
      userId: "david.kim",
      userName: "David Kim",
      userEmail: "david.kim@acme.corp",
      department: "Core Backend Platform",
      endpointHost: "david-thinkpad-x1",
      endpointIp: "10.0.14.77",
      aiPlatform: "gemini.google.com",
      actionTaken: "silent_redact",
      riskScore: 74,
      categoriesRedacted: ["API_SECRET_KEY", "JWT_SECRET"],
      detections: [
        { category: "CREDENTIAL", matchedText: "jwt_secret_signing_key_prod_9942a", isolationRisk: 78, description: "Production JWT Signing Key" }
      ],
      originalPrompt: "How do I implement RS256 token rotation in Node.js when migrating from HMAC secret \"jwt_secret_signing_key_prod_9942a\" without dropping active user sessions?",
      sanitizedPrompt: "How do I implement RS256 token rotation in Node.js when migrating from HMAC secret \"[JWT_SECRET_01]\" without dropping active user sessions?",
      restoredResponse: "To rotate from jwt_secret_signing_key_prod_9942a to RS256 smoothly, support verification using both keys during a transition grace period.",
      timestamp: new Date(now - 110 * 60 * 1000).toISOString(),
    }
  ];

  for (const inc of sampleIncidents) {
    const auditEntry = {
      timestamp: inc.timestamp,
      userId: inc.userId,
      orgId: inc.orgId,
      riskScore: inc.riskScore,
      actionTaken: inc.actionTaken,
      categoriesRedacted: inc.categoriesRedacted,
      aiPlatform: inc.aiPlatform,
    };
    inc.cryptoSignature = tee.signAuditEntry(auditEntry);
    inc.promptSnippet = inc.originalPrompt.slice(0, 200);
    inc.detectionCount = inc.detections.length;
    inc.combinationCount = 0;
    _inMemoryAuditLogs.push(inc);
  }
}

// Seed on startup
seedCorporateIncidents();

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
  const usernameClean = (resolvedUser || "mohammed").trim();
  const userNameFormatted = usernameClean.includes(".") 
    ? usernameClean.split(".").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ")
    : usernameClean.charAt(0).toUpperCase() + usernameClean.slice(1);

  const inferredDept = usernameClean.includes("chen") ? "Cloud Infrastructure & DevOps"
    : usernameClean.includes("turner") ? "SCADA & Industrial Automation"
    : usernameClean.includes("vance") ? "Clinical & Health Informatics"
    : usernameClean.includes("rostova") ? "Fintech & Payments"
    : usernameClean.includes("kim") ? "Core Backend Platform"
    : usernameClean.includes("eng") ? "Engineering & Architecture"
    : usernameClean.includes("sec") ? "Security Operations"
    : "Systems & Infrastructure";

  const logRecord = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    orgId: req?.orgId || "acme-corp",
    userId: usernameClean,
    userEmail: userEmail || `${usernameClean}@acme.corp`,
    userName: userNameFormatted,
    department: inferredDept,
    endpointHost: resolvedHost || `${usernameClean}-workstation`,
    endpointIp: endpointIp || (req && (req.headers["x-forwarded-for"] || req.ip || req.connection?.remoteAddress)) || "10.0.14.88",
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
  if (_inMemoryAuditLogs.length > 250) _inMemoryAuditLogs.pop();

  if (mongoose.connection.readyState === 1) {
    AuditLog.create(logRecord).catch(() => {});
  }

  const sessionResult = sessionGraph.updateSessionGraph(usernameClean, logRecord.userEmail, detection);

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
    user: usernameClean,
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
  // If overallRisk is 0 or no detections, always pass
  if (!overallRisk || overallRisk === 0 || !detections || detections.length === 0) {
    return "pass";
  }

  // Check for critical hard-block items (live credentials, private keys, financial cards, SSN)
  const hasCriticalSecrets = detections.some(
    (d) =>
      (d.category === "CREDENTIAL" && d.isolationRisk >= 85) ||
      (d.category === "FINANCIAL" && d.isolationRisk >= 80) ||
      (d.category === "PII" && d.isolationRisk >= 80)
  );

  if (hasCriticalSecrets && overallRisk >= 85) return "hard_block";
  if (overallRisk >= 35) return "silent_redact";
  if (overallRisk > 10) return "monitor";
  return "pass";
}


// ─── POST /api/vantix/chat — The 7-Step Pipeline ────────────────────────────

router.post("/chat", async (req, res) => {
  const startTime = Date.now();
  const resolvedUser = req.headers["x-vantix-user"] || req.body.userId || process.env.USER || require("os").userInfo().username || "mohammed";
  const resolvedHost = req.headers["x-vantix-host"] || req.body.host || require("os").hostname() || "mohammed-Latitude-5400";
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
      tokenMap = tee.createTokenTable(sessionId, detection.detections);
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
      tokenMap = tee.createTokenTable(sessionId, detection.detections);
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

// ─── GET /api/vantix/flagged-employees — Dynamic Flagged Directory ──────────
router.get("/flagged-employees", (req, res) => {
  seedCorporateIncidents();
  const userMap = new Map();

  for (const log of _inMemoryAuditLogs) {
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
  seedCorporateIncidents();
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


// ─── POST /api/vantix/simulate-leak — Live Demo Trigger for Any Employee ─────
router.post("/simulate-leak", async (req, res) => {
  const { employeeId = "sarah.chen", leakType = "aws_keys" } = req.body;

  let prompt = "";
  let userEmail = "";
  let userName = "";
  let department = "";
  let endpointHost = "";
  let aiPlatform = req.body.aiPlatform || "chatgpt.com";

  if (employeeId === "sarah.chen") {
    userName = "Sarah Chen";
    userEmail = "sarah.chen@acme.corp";
    department = "Cloud Infrastructure & DevOps";
    endpointHost = "sarah-macbook-pro.corp.internal";
    prompt =
      req.body.prompt ||
      "Review this AWS policy snippet: access_key_id = AKIAIOSFODNN7EXAMPLE and secret_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY for S3 backup.";
  } else if (employeeId === "alex.turner") {
    userName = "Alex Turner";
    userEmail = "alex.turner@acme.corp";
    department = "SCADA & Industrial Automation";
    endpointHost = "alex-industrial-ws01";
    prompt =
      req.body.prompt ||
      "Investigating turbine Mark VIe register 0x4001 at internal substation 192.168.1.50 with nominal grid frequency 60.2 Hz. What triggers sudden emergency trip?";
  } else if (employeeId === "marcus.vance") {
    userName = "Marcus Vance";
    userEmail = "marcus.vance@acme.corp";
    department = "Clinical & Health Informatics";
    endpointHost = "marcus-dell-latitude";
    prompt =
      req.body.prompt ||
      "Summarize clinical status for patient Johnathan Doe, SSN: 123-45-6789, MRN #98421 diagnosed with Stage 2 Hypertension.";
  } else if (employeeId === "elena.rostova") {
    userName = "Elena Rostova";
    userEmail = "elena.rostova@acme.corp";
    department = "Fintech & Payment Gateway";
    endpointHost = "elena-fintech-node";
    prompt =
      req.body.prompt ||
      "Validate payment webhook: { card_number: \"4532-8812-9901-4321\", cvv: \"882\", exp: \"08/28\" } for failed checkout event.";
  } else if (employeeId === "david.kim") {
    userName = "David Kim";
    userEmail = "david.kim@acme.corp";
    department = "Core Backend Platform";
    endpointHost = "david-thinkpad-x1";
    prompt =
      req.body.prompt ||
      "How do I rotate our master JWT secret: jwt_secret_signing_key_prod_9942a across our Kubernetes microservices?";
  } else if (employeeId === "mohammed") {
    userName = "Mohammed";
    userEmail = "mohammed@acme.corp";
    department = "Core Systems Engineering";
    endpointHost = require("os").hostname() || "mohammed-workstation";
    prompt =
      req.body.prompt ||
      (leakType === "benign_prompt"
        ? "Explain how combined cycle gas turbines achieve high thermodynamic efficiency."
        : leakType === "sanitized_prompt"
        ? "Investigating turbine [SCADA_REG_01] at internal substation [INTERNAL_IP_01] with nominal grid frequency [FREQUENCY_01]."
        : "Investigating turbine Mark VIe register 0x4001 at internal substation 192.168.1.50 with AWS key AKIAIOSFODNN7EXAMPLE.");
  } else {
    userName = employeeId.charAt(0).toUpperCase() + employeeId.slice(1);
    userEmail = `${employeeId}@acme.corp`;
    department = "Enterprise Operations";
    endpointHost = `${employeeId}-workstation`;
    prompt = req.body.prompt || (leakType === "benign_prompt" ? "What is the syntax for React useEffect cleanup functions?" : "Found AWS key AKIAIOSFODNN7EXAMPLE in debug logs.");
  }

  // Override prompt if leakType is benign_prompt or sanitized_prompt and no custom prompt was provided
  if (!req.body.prompt) {
    if (leakType === "benign_prompt") {
      prompt = "Explain how combined cycle gas turbines achieve high thermodynamic efficiency.";
    } else if (leakType === "sanitized_prompt") {
      prompt = "Investigating turbine [SCADA_REG_01] at internal substation [INTERNAL_IP_01] with nominal grid frequency [FREQUENCY_01]. What triggers sudden emergency trip?";
    }
  }

  const interceptedAt = new Date().toISOString();
  const detection = analyzePrompt(prompt);
  const action = decideAction(detection.overallRisk, detection.detections);
  let sanitizedPrompt = prompt;

  if (action === "hard_block") {
    sanitizedPrompt =
      "[BLOCKED — Prompt contained live credentials / confidential parameters]";
  } else if (action === "silent_redact") {
    const tokenMap = tee.createTokenTable(
      `sim-${Date.now()}`,
      detection.detections
    );
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
    endpointIp: "10.0.14.88",
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

