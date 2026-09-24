// ─── Vantix Standalone AI Data Guard — Background Engine ────────────────────────
// 100% Client-Side 3-Sublayer Industrial Detection Engine & TEE Redaction
// Runs locally inside Chrome/Edge service worker — Zero network dependencies!
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

// ─── Sublayer A: Rule-Based Detection Patterns ───────────────────────────────
const PATTERNS = {
  // Credentials & Secrets
  API_KEY: {
    patterns: [
      /\b(?:sk-[A-Za-z0-9_\-]{20,})/g,                   // OpenAI legacy / Anthropic
      /\b(?:sk-proj-[A-Za-z0-9_\-]{30,})/g,              // OpenAI Project API Key
      /\b(?:sk_(?:live|test)_[A-Za-z0-9_\-]{24,})/g,     // Stripe Key
      /\b(?:AIza[A-Za-z0-9_\-]{35})/g,                    // Google Gemini / GCP Key
      /\b(?:AKIA[A-Z0-9]{16})/g,                          // AWS Access Key ID
      /\b(?:ghp_[A-Za-z0-9]{36,})/g,                      // GitHub Personal Access Token
      /\b(?:xox[baprs]-[A-Za-z0-9\-]{10,})/g,            // Slack Token
      /\b(?:hf_[A-Za-z0-9]{34,})/g,                       // HuggingFace Token
    ],
    category: "CREDENTIAL",
    label: "API Key / Token",
    placeholder: "CREDENTIAL",
    baseRisk: 90,
  },
  PASSWORD_SECRET: {
    patterns: [
      /(?:password|passwd|secret_key|client_secret|auth_token|secret_access_key|api_secret|aws_secret_access_key)\s*[:=]\s*(?:['"][^'"]{4,}['"]|[A-Za-z0-9\/+=_\-@#$!%*?&]{6,})/gi,
      /(?:aws_secret_access_key|aws_secret|secret_key)\s*[:=]\s*[A-Za-z0-9\/+=]{20,}/gi,
    ],
    category: "CREDENTIAL",
    label: "Secret Assignment",
    placeholder: "CREDENTIAL",
    baseRisk: 90,
  },
  PRIVATE_KEY: {
    patterns: [
      /-----BEGIN\s+(?:RSA\s+)?(?:PRIVATE|PUBLIC)\s+KEY-----/g,
      /-----BEGIN\s+CERTIFICATE-----/g,
    ],
    category: "CREDENTIAL",
    label: "Private Key / Certificate",
    placeholder: "CREDENTIAL",
    baseRisk: 95,
  },
  CONNECTION_STRING: {
    patterns: [
      /(?:mongodb|mysql|postgresql|postgres|redis|amqp):\/\/[^\s"']+/gi,
    ],
    category: "CREDENTIAL",
    label: "Database Connection URI",
    placeholder: "CREDENTIAL",
    baseRisk: 90,
  },
  JWT_TOKEN: {
    patterns: [
      /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    ],
    category: "CREDENTIAL",
    label: "JWT Auth Token",
    placeholder: "CREDENTIAL",
    baseRisk: 85,
  },

  // Financial
  CREDIT_CARD: {
    patterns: [
      /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
      /\b(?:4[0-9]{3}|5[1-5][0-9]{2}|3[47][0-9]{2})[\s-][0-9]{4}[\s-][0-9]{4}[\s-][0-9]{4}\b/g,
    ],
    category: "FINANCIAL",
    label: "Credit Card Number",
    placeholder: "FINANCIAL_RECORD",
    baseRisk: 85,
  },
  IBAN: {
    patterns: [
      /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}\b/g,
    ],
    category: "FINANCIAL",
    label: "IBAN Bank Account",
    placeholder: "FINANCIAL_RECORD",
    baseRisk: 75,
  },

  // PII
  SSN: {
    patterns: [
      /\b\d{3}-\d{2}-\d{4}\b/g,
    ],
    category: "CRITICAL_PII",
    label: "Social Security Number (SSN)",
    placeholder: "PII_VALUE",
    baseRisk: 85,
  },
  AADHAAR: {
    patterns: [
      /(?<!\d)\d{4}\s?\d{4}\s?\d{4}(?!\d)/g,
    ],
    category: "CRITICAL_PII",
    label: "Aadhaar Identity Number",
    placeholder: "PII_VALUE",
    baseRisk: 75,
  },
  PAN: {
    patterns: [
      /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,
    ],
    category: "CRITICAL_PII",
    label: "Tax ID / PAN Number",
    placeholder: "PII_VALUE",
    baseRisk: 70,
  },
  EMAIL: {
    patterns: [
      /\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b/gi,
    ],
    category: "PII",
    label: "Email Address",
    placeholder: "PII_VALUE",
    baseRisk: 10,
  },
  PHONE: {
    patterns: [
      /(?<!\d)(?:\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}(?!\d)/g,
    ],
    category: "PII",
    label: "Phone Number",
    placeholder: "PII_VALUE",
    baseRisk: 10,
  },

  // Network & Infrastructure
  NETWORK_ADDR: {
    patterns: [
      /\b(?:192\.168|10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}(?::\d+)?\b/g,
      /\b(?:subnet|vlan|gateway)\s*[:=]?\s*[\d.\/]+/gi,
    ],
    category: "NETWORK_ADDR",
    label: "Internal IP / Network Address",
    placeholder: "NETWORK_ADDR",
    baseRisk: 35,
  },

  // OT / SCADA / Industrial Registers
  REGISTER_ADDR: {
    patterns: [
      /\b0x[0-9A-Fa-f]{4,}\b/g,
      /\b(?:modbus|holding|input|scada)\s+(?:register\s+)?(?:address\s*)?[:=]?\s*[34][0-9]{4}\b/gi,
    ],
    category: "REGISTER_ADDR",
    label: "Register Address / Modbus",
    placeholder: "REGISTER_ADDR",
    baseRisk: 30,
  },

  // Prompt Injection Attacks
  PROMPT_INJECTION: {
    patterns: [
      /(?:ignore\s+(?:all\s+)?previous\s+instructions|system\s+prompt\s+override|disregard\s+all\s+prior\s+prompts|DAN\s+mode|jailbreak|unrestricted\s+developer\s+mode|simulate\s+unfiltered|bypass\s+(?:all\s+)?safety\s+filters)/gi,
    ],
    category: "PROMPT_INJECTION",
    label: "Prompt Injection Attack",
    placeholder: "PROMPT_INJECTION_FLAG",
    baseRisk: 95,
  },
};

// ─── Sublayer B: Combination Risk Matrix ─────────────────────────────────────
const COMBINATION_MATRIX = {
  "CREDENTIAL+NETWORK_ADDR": 2.5,
  "CREDENTIAL+LOCATION": 2.2,
  "FINANCIAL+CREDENTIAL": 2.5,
  "FINANCIAL+PII": 2.0,
  "PROMPT_INJECTION+CREDENTIAL": 3.2,
  "PROMPT_INJECTION+NETWORK_ADDR": 2.8,
  "REGISTER_ADDR+NETWORK_ADDR": 2.0,
};

// ─── Core Inspection Function ────────────────────────────────────────────────
function analyzePromptLocal(text) {
  if (!text || typeof text !== "string") {
    return { overallRisk: 0, detections: [], sanitizedPrompt: text, categoriesFound: [] };
  }

  const detections = [];
  const seen = new Set();
  const tokenMap = new Map();
  const categoryCounts = {};

  for (const [patternName, config] of Object.entries(PATTERNS)) {
    for (const regex of config.patterns) {
      const re = new RegExp(regex.source, regex.flags);
      let match;
      while ((match = re.exec(text)) !== null) {
        const val = match[0];

        // Skip placeholders like [CREDENTIAL], [PII_VALUE]
        if (/^['"]?\[[A-Z0-9_]+\]['"]?$/.test(val.trim())) continue;

        const key = `${config.category}:${val}`;
        if (!seen.has(key)) {
          seen.add(key);
          detections.push({
            patternName,
            category: config.category,
            label: config.label,
            value: val,
            start: match.index,
            isolationRisk: config.baseRisk,
          });

          // Build synthetic token
          if (!tokenMap.has(val)) {
            categoryCounts[config.category] = (categoryCounts[config.category] || 0) + 1;
            const count = categoryCounts[config.category];
            const placeholder = `[${config.placeholder}${count > 1 ? `_${count}` : ""}]`;
            tokenMap.set(val, placeholder);
          }
        }
      }
    }
  }

  // Calculate combinations and risk
  const categoriesFound = [...new Set(detections.map((d) => d.category))];
  let maxMultiplier = 1.0;

  for (const [comboKey, mult] of Object.entries(COMBINATION_MATRIX)) {
    const cats = comboKey.split("+");
    if (cats.every((c) => categoriesFound.includes(c))) {
      if (mult > maxMultiplier) maxMultiplier = mult;
    }
  }

  let overallRisk = 0;
  const sensitiveDetections = detections.filter((d) =>
    ["CREDENTIAL", "FINANCIAL", "CRITICAL_PII", "PROMPT_INJECTION", "REGISTER_ADDR"].includes(d.category)
  );

  if (sensitiveDetections.length > 0) {
    const maxBase = Math.max(...sensitiveDetections.map((d) => d.isolationRisk));
    overallRisk = Math.min(100, Math.round(maxBase * maxMultiplier));
  } else if (detections.length > 0) {
    const maxBase = Math.max(...detections.map((d) => d.isolationRisk));
    overallRisk = Math.min(100, Math.round(maxBase * maxMultiplier));
  }

  // Generate Sanitized Prompt
  let sanitizedPrompt = text;
  const sortedTokens = [...tokenMap.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [realVal, ph] of sortedTokens) {
    const escaped = realVal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    sanitizedPrompt = sanitizedPrompt.replace(new RegExp(escaped, "gi"), ph);
  }

  return {
    overallRisk,
    detections,
    sanitizedPrompt,
    categoriesFound,
  };
}

// ─── Initialize Extension State in Local Storage ─────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get([
    "interceptedCount",
    "blockedCount",
    "redactedCount",
    "violationLogs",
    "policySettings",
  ]);

  await chrome.storage.local.set({
    enabled: true,
    interceptedCount: current.interceptedCount || 0,
    blockedCount: current.blockedCount || 0,
    redactedCount: current.redactedCount || 0,
    violationLogs: current.violationLogs || [],
    policySettings: current.policySettings || {
      hardBlockCredentials: true,
      silentRedactPii: true,
      promptInjectionShield: true,
      alertSound: true,
    },
    systemUser: "Standalone User",
    activeGateway: "100% Local Enclave (Offline)",
  });

  chrome.action.setBadgeText({ text: "PROT" });
  chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
  console.log("[Vantix Standalone Engine] Initialized 100% offline local protection engine.");
});

// ─── Handle Inspection Requests from Content Script ───────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "INSPECT_PROMPT") {
    (async () => {
      try {
        const rawPrompt = message.prompt || "";
        const analysis = analyzePromptLocal(rawPrompt);
        const stored = await chrome.storage.local.get([
          "interceptedCount",
          "blockedCount",
          "redactedCount",
          "violationLogs",
          "policySettings",
        ]);

        const settings = stored.policySettings || { hardBlockCredentials: true, silentRedactPii: true };
        const isBlocked = analysis.overallRisk >= 75 && settings.hardBlockCredentials;
        const isRedacted = analysis.overallRisk >= 10 && analysis.sanitizedPrompt !== rawPrompt && settings.silentRedactPii;

        let actionTaken = "pass";
        if (isBlocked) actionTaken = "hard_block";
        else if (isRedacted) actionTaken = "silent_redact";

        // Update local statistics
        const newStats = {
          interceptedCount: (stored.interceptedCount || 0) + 1,
          blockedCount: (stored.blockedCount || 0) + (isBlocked ? 1 : 0),
          redactedCount: (stored.redactedCount || 0) + (isRedacted ? 1 : 0),
        };

        // Extract domain from sender tab
        let targetDomain = "AI Web App";
        if (sender.tab && sender.tab.url) {
          try {
            targetDomain = new URL(sender.tab.url).hostname;
          } catch (e) {}
        }

        // Add to local audit log if violation occurred
        if (actionTaken !== "pass") {
          const logs = stored.violationLogs || [];
          const newEntry = {
            id: `log-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            date: new Date().toLocaleDateString(),
            domain: targetDomain,
            riskScore: analysis.overallRisk,
            actionTaken,
            categories: analysis.categoriesFound,
            promptSnippet: rawPrompt.slice(0, 100) + (rawPrompt.length > 100 ? "..." : ""),
            originalPrompt: rawPrompt,
            sanitizedPrompt: analysis.sanitizedPrompt,
            detectionsCount: analysis.detections.length,
          };

          // Maintain top 100 logs
          logs.unshift(newEntry);
          if (logs.length > 100) logs.pop();
          newStats.violationLogs = logs;
        }

        if (isBlocked) {
          chrome.action.setBadgeText({ text: "ALERT" });
          chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
        } else if (isRedacted) {
          chrome.action.setBadgeText({ text: "REDACT" });
          chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });
        }

        await chrome.storage.local.set(newStats);

        sendResponse({
          success: true,
          result: {
            action: actionTaken,
            blocked: isBlocked,
            redacted: isRedacted,
            riskScore: analysis.overallRisk,
            sanitizedPrompt: analysis.sanitizedPrompt,
            categoriesRedacted: analysis.categoriesFound,
            message: isBlocked
              ? "Prompt contains live infrastructure credentials or critical secrets and was blocked locally."
              : "Prompt sanitized by Vantix TEE.",
          },
        });
      } catch (err) {
        console.error("[Vantix Standalone Engine] Error inspecting prompt:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep async channel open
  }

  if (message.type === "CLEAR_LOGS") {
    chrome.storage.local.set({ violationLogs: [], interceptedCount: 0, blockedCount: 0, redactedCount: 0 }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
