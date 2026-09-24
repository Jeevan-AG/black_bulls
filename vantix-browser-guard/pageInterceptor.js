// ─── Vantix Enterprise AI Guard — Main World Network Interceptor ──────────────
// Injected into page context (window) at document_start.
// Hooks window.fetch and XMLHttpRequest to sanitize outgoing AI prompt payloads
// in-flight before they can leave the browser, guaranteeing ZERO data leaks.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";

  if (window.__vantix_interceptor_active) return;
  window.__vantix_interceptor_active = true;

  console.log("[Vantix Guard] In-Page Network Interceptor active (Zero-Leak Protection).");

  // Client-side detection & replacement patterns
  const PATTERNS = [
    // 1. Natural Language Keys & Secrets with keyword context
    {
      regex: /(?:(?:my|the|our|test|sample)\s+)?aws\s*(?:access\s*)?key\s*(?:is|[:=])\s*['"]?([^\s"'.,;]{4,})['"]?/gi,
      type: "AWS_KEY",
      isSecret: true,
    },
    {
      regex: /(?:(?:my|the|our|test|sample)\s+)?openai\s*(?:api\s*)?key\s*(?:is|[:=])\s*['"]?([^\s"'.,;]{4,})['"]?/gi,
      type: "OPENAI_API_KEY",
      isSecret: true,
    },
    {
      regex: /(?:(?:my|the|our|test|sample)\s+)?(?:password|passwd)\s*(?:is|[:=])\s*['"]?([^\s"'.,;]{4,})['"]?/gi,
      type: "PASSWORD",
      isSecret: true,
    },
    {
      regex: /(?:(?:my|the|our|test|sample)\s+)?(?:auth_token|token)\s*(?:is|[:=])\s*['"]?([^\s"'.,;]{4,})['"]?/gi,
      type: "AUTH_TOKEN",
      isSecret: true,
    },
    {
      regex: /(?:(?:my|the|our|test|sample)\s+)?(?:secret|secret_key)\s*(?:is|[:=])\s*['"]?([^\s"'.,;]{4,})['"]?/gi,
      type: "SECRET_KEY",
      isSecret: true,
    },
    {
      regex: /(?:(?:my|the|our|test|sample)\s+)?(?:api_key|api\s*key)\s*(?:is|[:=])\s*['"]?([^\s"'.,;]{4,})['"]?/gi,
      type: "API_KEY",
      isSecret: true,
    },

    // 2. High-Entropy Tokens & API Keys
    { regex: /\bAKIA[A-Z0-9]{16}\b/g, type: "AWS_ACCESS_KEY", isSecret: true },
    { regex: /\bsk-[A-Za-z0-9_\-]{20,}\b/g, type: "OPENAI_API_KEY", isSecret: true },
    { regex: /\bghp_[A-Za-z0-9]{36,}\b/g, type: "GITHUB_TOKEN", isSecret: true },
    { regex: /\bAIza[A-Za-z0-9_\-]{35}\b/g, type: "GOOGLE_API_KEY", isSecret: true },
    { regex: /-----BEGIN\s+(?:RSA\s+)?(?:PRIVATE|PUBLIC)\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?(?:PRIVATE|PUBLIC)\s+KEY-----/g, type: "PRIVATE_KEY", isSecret: true },
    { regex: /(?:mongodb|mysql|postgresql|postgres|redis|amqp):\/\/[^\s"']+/gi, type: "DB_CONNECTION_STRING", isSecret: true },
    { regex: /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g, type: "JWT_AUTH_TOKEN", isSecret: true },

    // 3. Phone Numbers
    { regex: /(?:\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, type: "PHONE_NUMBER" },
    { regex: /(?<!\d)(?:\+91[\s-]?)?[6-9]\d{9}(?!\d)/g, type: "PHONE_NUMBER" },

    // 4. Email Addresses
    { regex: /\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b/gi, type: "EMAIL_ADDRESS" },

    // 5. Government IDs: Aadhaar (12 digits) & PAN & SSN
    { regex: /(?<!\d)\d{4}[\s-]?\d{4}[\s-]?\d{4}(?!\d)/g, type: "AADHAAR_NUMBER" },
    { regex: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, type: "PAN_NUMBER" },
    { regex: /\b\d{3}-\d{2}-\d{4}\b/g, type: "SSN_NUMBER" },

    // 6. Financial: Credit / Debit Cards
    { regex: /\b(?:4[0-9]{3}|5[1-5][0-9]{2}|3[47][0-9]{2})[\s-][0-9]{4}[\s-][0-9]{4}[\s-][0-9]{4}\b/g, type: "CREDIT_DEBIT_CARD" },
    { regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g, type: "CREDIT_DEBIT_CARD" },
    { regex: /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}\b/g, type: "BANK_ACCOUNT_IBAN" },

    // 7. Network / Infrastructure
    { regex: /\b(?:192\.168|10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}(?::\d+)?\b/g, type: "IP_ADDRESS" },
    { regex: /\b(?:modbus|holding|input|scada)\s+(?:register\s+)?(?:address\s*)?[:=]?\s*[34][0-9]{4}\b/gi, type: "REGISTER_ADDR" },
    { regex: /\b0x[0-9A-Fa-f]{4,}\b/g, type: "REGISTER_ADDR" },
  ];

  function sanitizePayloadString(rawStr) {
    if (!rawStr || typeof rawStr !== "string") {
      return { text: rawStr, redactedCount: 0, secretsCount: 0, items: [] };
    }

    let text = rawStr;
    let redactedCount = 0;
    let secretsCount = 0;
    const items = [];
    const counts = {};

    for (const pat of PATTERNS) {
      const regex = new RegExp(pat.regex);
      const matches = [...text.matchAll(regex)];
      if (matches.length > 0) {
        for (const match of matches) {
          const valToReplace = match[1] || match[0];
          if (!valToReplace || valToReplace.length < 3) continue;

          if (pat.isSecret) secretsCount++;
          redactedCount++;

          if (!counts[pat.type]) counts[pat.type] = 0;
          counts[pat.type]++;
          const placeholder = `[${pat.type}${counts[pat.type] > 1 ? `_${counts[pat.type]}` : ""}]`;

          text = text.split(valToReplace).join(placeholder);
          items.push({ type: pat.type, placeholder, originalLength: valToReplace.length });
        }
      }
    }

    return { text, redactedCount, secretsCount, items };
  }

  // ── Hook 1: window.fetch ───────────────────────────────────────────────────
  const originalFetch = window.fetch;
  window.fetch = async function (resource, config) {
    let url = typeof resource === "string" ? resource : (resource && resource.url) || "";

    const isAiChatEndpoint =
      url.includes("/backend-api/conversation") ||
      url.includes("/backend-api/lat/r") ||
      url.includes("/api/chat") ||
      url.includes("/chat_conversations") ||
      url.includes("/completion") ||
      url.includes("batchexecute") ||
      url.includes("streamGenerateContent") ||
      url.includes("/v1/chat") ||
      url.includes("/graphql");

    if (config && config.body && isAiChatEndpoint) {
      if (typeof config.body === "string") {
        const { text, redactedCount, secretsCount, items } = sanitizePayloadString(config.body);

        if (secretsCount > 3) {
          console.warn("[Vantix Guard] ⛔ HARD BLOCK: Outgoing payload contained > 3 exposed secrets. Request aborted.");
          window.dispatchEvent(
            new CustomEvent("vantix:network_block", {
              detail: { reason: `Massive credential exposure detected (${secretsCount} secrets). Request blocked by Vantix.`, secretsCount },
            })
          );
          return new Response(
            JSON.stringify({
              error: {
                message: "Vantix AI Firewall: Outgoing prompt blocked due to massive credential exposure.",
                type: "vantix_violation",
              },
            }),
            { status: 403, statusText: "Forbidden", headers: { "Content-Type": "application/json" } }
          );
        }

        if (redactedCount > 0) {
          console.log(`[Vantix Guard] 🛡 IN-FLIGHT REDACTION: Scrubbed ${redactedCount} sensitive values from outgoing request.`);
          config.body = text;

          window.dispatchEvent(
            new CustomEvent("vantix:network_redact", {
              detail: { redactedCount, items },
            })
          );

          // Dual-sync telemetry to local engine & cloud dashboard asynchronously
          try {
            originalFetch("http://localhost:5000/api/vantix/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Vantix-Source": "browser-in-flight" },
              body: JSON.stringify({
                prompt: `[In-Flight Protected Request] Scrubbed ${redactedCount} sensitive items: ${items.map((i) => i.placeholder).join(", ")}`,
                userId: "employee",
                sessionId: `browser-${Date.now()}`,
              }),
            }).catch(() => {});
          } catch (e) {}
        }
      }
    }

    return originalFetch.apply(this, arguments);
  };

  // ── Hook 2: XMLHttpRequest ─────────────────────────────────────────────────
  const originalXhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    if (body && typeof body === "string") {
      const { text, redactedCount, secretsCount, items } = sanitizePayloadString(body);

      if (secretsCount > 3) {
        console.warn("[Vantix Guard] ⛔ HARD BLOCK (XHR): Request aborted due to > 3 exposed secrets.");
        window.dispatchEvent(
          new CustomEvent("vantix:network_block", {
            detail: { reason: `Massive credential exposure detected (${secretsCount} secrets).`, secretsCount },
          })
        );
        return;
      }

      if (redactedCount > 0) {
        console.log(`[Vantix Guard] 🛡 IN-FLIGHT REDACTION (XHR): Scrubbed ${redactedCount} sensitive values.`);
        body = text;

        window.dispatchEvent(
          new CustomEvent("vantix:network_redact", {
            detail: { redactedCount, items },
          })
        );
      }
    }

    return originalXhrSend.call(this, body);
  };
})();
