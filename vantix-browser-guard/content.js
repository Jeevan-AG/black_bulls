// ─── Vantix Enterprise AI Guard — Content Interceptor ─────────────────────────
// Hooks into ChatGPT, Claude, and Gemini DOM. Intercepts prompt submission,
// executes pre-flight TEE inspection, enforces Hard Block (disabling send button
// and showing prominent block banner), or performs Silent Redact.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

console.log("[Vantix Guard] Content script loaded into AI chat interface.");

// ─── Helper: Identify Active Input Element ───────────────────────────────────
function findPromptInput() {
  // ChatGPT
  const cgPrompt = document.getElementById("prompt-textarea") ||
                   document.querySelector('div[contenteditable="true"]#prompt-textarea') ||
                   document.querySelector('textarea[data-id="root"]') ||
                   document.querySelector('div[data-placeholder*="Message"]') ||
                   document.querySelector('div[data-placeholder*="Ask"]');
  if (cgPrompt) return cgPrompt;

  // Claude
  const claudePrompt = document.querySelector('div[contenteditable="true"].ProseMirror') ||
                       document.querySelector('div[contenteditable="true"]');
  if (claudePrompt) return claudePrompt;

  // Gemini
  const geminiPrompt = document.querySelector(".ql-editor") ||
                       document.querySelector('rich-textarea div[contenteditable="true"]') ||
                       document.querySelector('textarea[aria-label*="prompt"]');
  if (geminiPrompt) return geminiPrompt;

  // Generic fallback
  return document.querySelector('textarea, [contenteditable="true"]');
}

// ─── Helper: Identify Active Send Button ─────────────────────────────────────
function findSendButton() {
  return (
    document.querySelector('button[data-testid="send-button"]') ||
    document.querySelector('button[data-testid="composer-send-button"]') ||
    document.querySelector('button[data-testid="fruitjuice-send-button"]') ||
    document.querySelector('#send-button') ||
    document.querySelector('button[aria-label*="Send" i]') ||
    document.querySelector('button[aria-label*="Submit" i]') ||
    document.querySelector('form button[type="submit"]') ||
    document.querySelector('fieldset button[type="submit"]') ||
    document.querySelector('button:has(svg path[d*="M2.01 21L23 12 2.01 3"])') ||
    document.querySelector('button.send-button')
  );
}

// ─── Helper: Get Text from Input Element ─────────────────────────────────────
function getInputText(el) {
  if (!el) return "";
  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
    return el.value || "";
  }
  // Contenteditable
  return el.innerText || el.textContent || "";
}

// ─── Helper: Set Text on Input Element (Triggering React/Vue/ProseMirror State) ─
function setInputText(el, newText) {
  if (!el) return;

  try {
    el.focus();
  } catch (e) {}

  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
    try {
      const nativeSetter =
        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set ||
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (nativeSetter) {
        nativeSetter.call(el, newText);
      } else {
        el.value = newText;
      }
    } catch (e) {
      el.value = newText;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (el.isContentEditable) {
    try {
      el.focus();
      document.execCommand("selectAll", false, null);
      const success = document.execCommand("insertText", false, newText);
      if (!success) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        selection.removeAllRanges();
        selection.addRange(range);
        const success2 = document.execCommand("insertText", false, newText);
        if (!success2) {
          el.innerText = newText;
          el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: newText }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    } catch (err) {
      el.innerText = newText;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
}

// ─── Visual UI: Floating Enterprise Shield Badge ─────────────────────────────
function injectStatusBadge() {
  if (document.getElementById("vantix-guard-badge")) return;

  const badge = document.createElement("div");
  badge.id = "vantix-guard-badge";
  badge.innerHTML = `
    <span class="vantix-badge-dot"></span>
    <span>Vantix Guard: ACTIVE</span>
  `;

  badge.title = "Vantix Enterprise AI Data Firewall is active and monitoring.";
  badge.addEventListener("click", () => {
    window.open("http://localhost:5173", "_blank");
  });

  document.body.appendChild(badge);
}

// ─── Helper: Block and Disable Send Button ────────────────────────────────────
function blockSendButton(reason) {
  const sendBtn = findSendButton();
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.setAttribute("disabled", "true");
    sendBtn.classList.add("vantix-btn-blocked");
    sendBtn.dataset.vantixBlocked = "true";
    sendBtn.title = reason || "Blocked by Vantix AI Firewall";
    sendBtn.style.opacity = "0.35";
    sendBtn.style.cursor = "not-allowed";
    sendBtn.style.pointerEvents = "none";
    sendBtn.style.filter = "grayscale(1)";
  }
}

function unblockSendButton() {
  const sendBtn = findSendButton();
  if (sendBtn) {
    sendBtn.disabled = false;
    sendBtn.removeAttribute("disabled");
    sendBtn.classList.remove("vantix-btn-blocked");
    delete sendBtn.dataset.vantixBlocked;
    sendBtn.removeAttribute("title");
    sendBtn.style.opacity = "";
    sendBtn.style.cursor = "";
    sendBtn.style.pointerEvents = "";
    sendBtn.style.filter = "";
  }
}

// ─── Visual UI: Hard Block Alert Banner ──────────────────────────────────────
function showBlockBanner(message, riskScore, categories) {
  let banner = document.getElementById("vantix-block-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "vantix-block-banner";
    document.body.appendChild(banner);
  }

  const categoryList = Array.isArray(categories) && categories.length > 0
    ? categories.join(", ")
    : "MASSIVE CREDENTIAL EXPOSURE / EXPLOIT DETECTED";

  banner.innerHTML = `
    <div class="vantix-banner-header">
      <div class="vantix-banner-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>BLOCKED BY VANTIX ENTERPRISE FIREWALL</span>
      </div>
      <div class="vantix-banner-risk">RISK SCORE: ${riskScore || 90}/100</div>
    </div>
    <div class="vantix-banner-body">
      ${message || "This prompt contains live credentials or prohibited secrets. Outbound transmission has been blocked and the send button is disabled."}
    </div>
    <div class="vantix-banner-meta">
      <span>Violation Categories: <strong>${categoryList}</strong></span>
      <span>Send Button: <strong style="color: #ef4444;">LOCKED</strong></span>
      <span>Logged to Security Admin</span>
    </div>
  `;

  banner.classList.add("visible");
}

function hideBlockBanner() {
  const banner = document.getElementById("vantix-block-banner");
  if (banner) {
    banner.classList.remove("visible");
  }
}

// ─── Visual UI: Silent Redaction Pill ─────────────────────────────────────────
function showRedactPill(tokensCount) {
  let pill = document.getElementById("vantix-redact-pill");
  if (!pill) {
    pill = document.createElement("div");
    pill.id = "vantix-redact-pill";
    document.body.appendChild(pill);
  }

  pill.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
    <span>Vantix TEE: ${tokensCount} sensitive tokens redacted before send</span>
  `;

  pill.classList.add("visible");
  setTimeout(() => {
    pill.classList.remove("visible");
  }, 4000);
}

// ─── Input Locking Helpers ───────────────────────────────────────────────────
function blockInput(inputEl, message, riskScore, categories) {
  if (!inputEl) return;
  inputEl.dataset.vantixBlocked = "true";
  inputEl.classList.add("vantix-input-blocked");
  inputEl.classList.add("vantix-shake-element");
  setTimeout(() => inputEl.classList.remove("vantix-shake-element"), 500);

  blockSendButton(message);
  showBlockBanner(message, riskScore, categories);
}

function unblockInput(inputEl) {
  if (!inputEl) return;
  delete inputEl.dataset.vantixBlocked;
  inputEl.classList.remove("vantix-input-blocked");
  unblockSendButton();
  hideBlockBanner();
}

// ─── Ephemeral Token Store (Two-Way Round-Trip Un-Redaction) ──────────────────
// Maps placeholder -> realValue (e.g. "[AWS_KEY]" -> "AKIA1234567890ABCDEF")
// Holds tokens in memory and session storage so responses are restored to original
// format with actual values before reaching the user.
const _activeTokenMap = new Map();

function persistTokenMap() {
  try {
    const list = Array.from(_activeTokenMap.entries());
    sessionStorage.setItem("vantix_active_tokens", JSON.stringify(list));
  } catch (e) {}
}

function loadTokenMap() {
  try {
    const raw = sessionStorage.getItem("vantix_active_tokens");
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const [ph, rv] of list) {
          if (ph && rv) _activeTokenMap.set(ph, rv);
        }
      }
    }
  } catch (e) {}
}
loadTokenMap();

function registerTokenMappings(mappings) {
  if (!mappings || !Array.isArray(mappings)) return;
  let added = false;
  for (const item of mappings) {
    if (item && item.placeholder && item.realVal) {
      _activeTokenMap.set(item.placeholder, item.realVal);
      added = true;
    }
  }
  if (added) {
    persistTokenMap();
    scheduleUnredact();
  }
}

// ─── Zero-Leak Local Regex Sanitizer (Always-On Client Fallback) ─────────────
const LOCAL_SENSITIVE_PATTERNS = [
  // 1. Natural Language Keys & Secrets
  {
    regex: /(?:(?:my|the|our|test|sample|here\s+is\s+(?:my|the))\s+)?(?:aws|amazon)\s*(?:access\s*)?(?:key|id|secret|token)\s*(?:is|[:=]|\s+)\s*['"]?([^\s"'.,;]{4,})['"]?/gi,
    type: "AWS_KEY",
    isSecret: true,
  },
  {
    regex: /(?:(?:my|the|our|test|sample|here\s+is\s+(?:my|the))\s+)?(?:openai|chatgpt)\s*(?:api\s*)?(?:key|id|secret|token)\s*(?:is|[:=]|\s+)\s*['"]?([^\s"'.,;]{4,})['"]?/gi,
    type: "OPENAI_API_KEY",
    isSecret: true,
  },
  {
    regex: /(?:(?:my|the|our|test|sample|here\s+is\s+(?:my|the))\s+)?(?:password|passwd)\s*(?:is|[:=]|\s+)\s*['"]?([^\s"'.,;]{4,})['"]?/gi,
    type: "PASSWORD",
    isSecret: true,
  },
  {
    regex: /(?:(?:my|the|our|test|sample|here\s+is\s+(?:my|the))\s+)?(?:auth_token|token)\s*(?:is|[:=]|\s+)\s*['"]?([^\s"'.,;]{4,})['"]?/gi,
    type: "AUTH_TOKEN",
    isSecret: true,
  },
  {
    regex: /(?:(?:my|the|our|test|sample|here\s+is\s+(?:my|the))\s+)?(?:secret|secret_key)\s*(?:is|[:=]|\s+)\s*['"]?([^\s"'.,;]{4,})['"]?/gi,
    type: "SECRET_KEY",
    isSecret: true,
  },
  {
    regex: /(?:(?:my|the|our|test|sample|here\s+is\s+(?:my|the))\s+)?(?:api_key|api\s*key|apikey)\s*(?:is|[:=]|\s+)\s*['"]?([^\s"'.,;]{4,})['"]?/gi,
    type: "API_KEY",
    isSecret: true,
  },

  // 2. High-Entropy Tokens & API Keys
  { regex: /\bAKIA[A-Z0-9]{16}\b/g, type: "AWS_KEY", isSecret: true },
  { regex: /\bsk-[A-Za-z0-9_\-]{20,}\b/g, type: "OPENAI_API_KEY", isSecret: true },
  { regex: /\bghp_[A-Za-z0-9]{36,}\b/g, type: "GITHUB_TOKEN", isSecret: true },
  { regex: /\bAIza[A-Za-z0-9_\-]{35}\b/g, type: "GOOGLE_API_KEY", isSecret: true },

  // 3. Phone Numbers
  { regex: /(?:\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, type: "PHONE_NUMBER" },
  { regex: /(?<!\d)(?:\+91[\s-]?)?[6-9]\d{9}(?!\d)/g, type: "PHONE_NUMBER" },

  // 4. Email Addresses
  { regex: /\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b/gi, type: "EMAIL_ADDRESS" },

  // 5. Government IDs
  { regex: /(?<!\d)\d{4}[\s-]?\d{4}[\s-]?\d{4}(?!\d)/g, type: "AADHAAR_NUMBER" },
  { regex: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, type: "PAN_NUMBER" },
  { regex: /\b\d{3}-\d{2}-\d{4}\b/g, type: "SSN_NUMBER" },

  // 6. Financial
  { regex: /\b(?:4[0-9]{3}|5[1-5][0-9]{2}|3[47][0-9]{2})[\s-][0-9]{4}[\s-][0-9]{4}[\s-][0-9]{4}\b/g, type: "CREDIT_DEBIT_CARD" },

  // 7. Network / Industrial
  { regex: /\b(?:192\.168|10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/g, type: "IP_ADDRESS" },
  { regex: /\b(?:modbus|holding|input|scada)\s+(?:register\s+)?(?:address\s*)?[:=]?\s*[34][0-9]{4}\b/gi, type: "REGISTER_ADDR" },
];

function sanitizeLocally(text) {
  if (!text || typeof text !== "string") {
    return { sanitized: text, redactedCount: 0, secretsCount: 0, categories: [], tokenMapping: [] };
  }

  let sanitized = text;
  let redactedCount = 0;
  let secretsCount = 0;
  const categories = [];
  const tokenMapping = [];
  const counts = {};

  for (const pat of LOCAL_SENSITIVE_PATTERNS) {
    const re = new RegExp(pat.regex.source, pat.regex.flags);
    const matches = [...sanitized.matchAll(re)];
    for (const m of matches) {
      const val = m[1] || m[0];
      if (!val || val.length < 3) continue;
      if (/^\[[A-Z0-9_]+\]$/.test(val)) continue; // Already placeholder

      if (pat.isSecret) secretsCount++;
      redactedCount++;

      if (!counts[pat.type]) counts[pat.type] = 0;
      counts[pat.type]++;
      const placeholder = `[${pat.type}${counts[pat.type] > 1 ? `_${counts[pat.type]}` : ""}]`;

      sanitized = sanitized.split(val).join(placeholder);
      if (!categories.includes(pat.type)) categories.push(pat.type);
      tokenMapping.push({ realVal: val, placeholder });
    }
  }

  return { sanitized, redactedCount, secretsCount, categories, tokenMapping };
}

// ─── Core Interception Pipeline ──────────────────────────────────────────────
let isProcessing = false;
let _isDispatchingSyntheticSubmit = false;

async function handlePromptSubmission(e) {
  // If this submit event was triggered by our own triggerRealSubmit, allow it through to the web app!
  if (_isDispatchingSyntheticSubmit) {
    return;
  }

  const inputEl = findPromptInput();
  if (!inputEl) return;

  // If already locked by Hard Block, halt immediately!
  if (inputEl.dataset.vantixBlocked === "true") {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    blockSendButton("Blocked by Vantix DLP policy");
    inputEl.classList.add("vantix-shake-element");
    setTimeout(() => inputEl.classList.remove("vantix-shake-element"), 500);
    return;
  }

  const rawPrompt = getInputText(inputEl).trim();
  if (!rawPrompt || rawPrompt.length < 3) return;

  if (isProcessing) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return;
  }

  // Halt the submission event immediately while we inspect
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  isProcessing = true;

  try {
    // Query Vantix Engine via background service worker
    chrome.runtime.sendMessage(
      {
        type: "INSPECT_PROMPT",
        prompt: rawPrompt,
      },
      (response) => {
        isProcessing = false;

        // Fallback: if background service worker is unreachable or returns error,
        // sanitize locally using client-side regex engine so zero leaks can occur!
        if (!response || !response.success || !response.result) {
          console.warn("[Vantix Guard] Engine not directly reachable, engaging local Zero-Leak sanitizer...");
          const local = sanitizeLocally(rawPrompt);
          if (local.secretsCount > 3) {
            blockInput(inputEl, "Outbound transmission blocked due to massive credential exposure.", 95, local.categories);
            return;
          }
          if (local.redactedCount > 0) {
            console.log("[Vantix Guard] ⚡ LOCAL SILENT REDACTION applied:", local.sanitized);
            registerTokenMappings(local.tokenMapping);
            unblockInput(inputEl);
            setInputText(inputEl, local.sanitized);
            showRedactPill(local.redactedCount);
            setTimeout(() => {
              triggerRealSubmit(inputEl);
            }, 40);
            return;
          }
          unblockInput(inputEl);
          triggerRealSubmit(inputEl);
          return;
        }

        const res = response.result;
        const isBlocked = res.blocked || res.meta?.action === "hard_block";
        const isRedacted = res.meta?.action === "silent_redact";
        const riskScore = res.meta?.riskScore || res.riskScore || 0;
        const categories = res.meta?.categoriesRedacted || [];

        // ── Case 1: Hard Block ─────────────────────────────────────────────
        if (isBlocked) {
          console.warn("[Vantix Guard] ⛔ HARD BLOCK triggered for prompt.");
          blockInput(inputEl, res.message, riskScore, categories);
          return;
        }

        // Register any token mapping returned by the TEE Enclave for two-way restoration
        if (res.tokenMapping && Array.isArray(res.tokenMapping) && res.tokenMapping.length > 0) {
          registerTokenMappings(res.tokenMapping);
        } else {
          // Client-side fallback ensures two-way un-redaction works seamlessly under all network states
          const local = sanitizeLocally(rawPrompt);
          if (local.tokenMapping && local.tokenMapping.length > 0) {
            registerTokenMappings(local.tokenMapping);
          }
        }

        // ── Case 2: Silent Redaction (<=3 credentials / PII) ───────────────
        if (isRedacted && res.sanitizedPrompt && res.sanitizedPrompt !== rawPrompt) {
          console.log("[Vantix Guard] ⚡ SILENT REDACTION applied:", res.sanitizedPrompt);
          unblockInput(inputEl);
          setInputText(inputEl, res.sanitizedPrompt);
          showRedactPill(categories.length || 1);

          setTimeout(() => {
            triggerRealSubmit(inputEl);
          }, 40);
          return;
        }

        // ── Case 3: Pass ───────────────────────────────────────────────────
        unblockInput(inputEl);
        triggerRealSubmit(inputEl);
      }
    );
  } catch (err) {
    isProcessing = false;
    console.error("[Vantix Guard] Error during prompt interception, falling back to local sanitizer:", err);
    const local = sanitizeLocally(rawPrompt);
    if (local.secretsCount > 3) {
      blockInput(inputEl, "Outbound transmission blocked due to massive credential exposure.", 95, local.categories);
      return;
    }
    if (local.redactedCount > 0) {
      registerTokenMappings(local.tokenMapping);
      setInputText(inputEl, local.sanitized);
      showRedactPill(local.redactedCount);
      setTimeout(() => triggerRealSubmit(inputEl), 40);
      return;
    }
    triggerRealSubmit(inputEl);
  }
}

// ─── Helper: Trigger Native Submit ───────────────────────────────────────────
function triggerRealSubmit(inputEl) {
  _isDispatchingSyntheticSubmit = true;
  const sendBtn = findSendButton();

  if (sendBtn && !sendBtn.disabled && !sendBtn.dataset.vantixBlocked) {
    sendBtn.click();
  } else if (inputEl) {
    try {
      const enterEvt = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      });
      inputEl.dispatchEvent(enterEvt);
    } catch (err) {
      console.warn("[Vantix Guard] Could not dispatch enter event:", err);
    }
  }

  // Release the synthetic dispatch lock after event dispatch finishes
  setTimeout(() => {
    _isDispatchingSyntheticSubmit = false;
  }, 100);
}

// ─── Event Listeners: Keydown, Button Click & Form Submit ─────────────────────
function setupListeners() {
  // 1. Intercept Enter key inside the prompt input (capture phase)
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        if (_isDispatchingSyntheticSubmit) return; // Allow synthetic enter through
        const inputEl = findPromptInput();
        if (inputEl && (e.target === inputEl || inputEl.contains(e.target))) {
          if (inputEl.dataset.vantixBlocked === "true") {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            inputEl.classList.add("vantix-shake-element");
            setTimeout(() => inputEl.classList.remove("vantix-shake-element"), 500);
            return false;
          }
          handlePromptSubmission(e);
        }
      }
    },
    true // Capture phase: execute BEFORE web app's React handlers
  );

  // 2. Intercept clicks on send buttons (capture phase)
  document.addEventListener(
    "click",
    (e) => {
      if (_isDispatchingSyntheticSubmit) return; // Allow synthetic click through
      const inputEl = findPromptInput();
      const target = e.target.closest("button") || e.target.closest('[role="button"]');
      if (!target) return;

      const sendBtn = findSendButton();
      const isSend =
        target === sendBtn ||
        (sendBtn && (sendBtn.contains(e.target) || sendBtn.contains(target))) ||
        target.getAttribute("data-testid")?.includes("send") ||
        target.getAttribute("aria-label")?.toLowerCase().includes("send") ||
        target.getAttribute("aria-label")?.toLowerCase().includes("submit") ||
        target.type === "submit";

      if (isSend) {
        if (inputEl && inputEl.dataset.vantixBlocked === "true") {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          blockSendButton("Blocked by Vantix DLP policy");
          inputEl.classList.add("vantix-shake-element");
          setTimeout(() => inputEl.classList.remove("vantix-shake-element"), 500);
          return false;
        }

        handlePromptSubmission(e);
      }
    },
    true // Capture phase
  );

  // 3. Intercept form submit events (capture phase)
  document.addEventListener(
    "submit",
    (e) => {
      if (_isDispatchingSyntheticSubmit) return;
      const inputEl = findPromptInput();
      if (inputEl && inputEl.dataset.vantixBlocked === "true") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
      handlePromptSubmission(e);
    },
    true
  );

  injectStatusBadge();
}

// ─── Real-Time Roundtrip Response Un-Redactor (Two-Way Restoration) ──────────
let _unredactScheduled = false;

function scheduleUnredact() {
  if (_unredactScheduled || _activeTokenMap.size === 0) return;
  _unredactScheduled = true;
  requestAnimationFrame(() => {
    _unredactScheduled = false;
    runUnredaction();
  });
}

function runUnredaction() {
  if (_activeTokenMap.size === 0) return;

  const placeholders = Array.from(_activeTokenMap.keys());
  if (placeholders.length === 0) return;

  // Build combined regex: sort longest first to prevent partial token collisions
  const escaped = placeholders
    .sort((a, b) => b.length - a.length)
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const placeholderRegex = new RegExp(escaped, "g");

  // Chat message containers across ChatGPT, Claude, Gemini, and LLM web clients
  const candidates = document.querySelectorAll(
    '[data-message-author-role], .markdown, .prose, .font-claude-message, message-content, [data-testid*="conversation-turn"], [class*="message-content"], [class*="turn-content"], [class*="chat-message"], div[class*="ChatMessage"]'
  );

  const targets = candidates.length > 0 ? Array.from(candidates) : [document.body];

  for (const root of targets) {
    if (!root || !root.textContent || root.textContent.indexOf("[") === -1) continue;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || node.nodeValue.indexOf("[") === -1) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let textNode;
    while ((textNode = walker.nextNode())) {
      const original = textNode.nodeValue;
      if (placeholderRegex.test(original)) {
        placeholderRegex.lastIndex = 0;
        const restored = original.replace(placeholderRegex, (match) => {
          return _activeTokenMap.get(match) || match;
        });
        if (restored !== original) {
          textNode.nodeValue = restored;
        }
      }
    }
  }
}

// Observe DOM mutations to un-redact streaming AI responses as words arrive
const _domObserver = new MutationObserver((mutations) => {
  if (_activeTokenMap.size === 0) return;
  for (const m of mutations) {
    if (m.type === "childList" || m.type === "characterData") {
      scheduleUnredact();
      break;
    }
  }
});

_domObserver.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
});

// Ensure listeners are registered
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupListeners);
} else {
  setupListeners();
}

// Periodically check if badge and listeners need re-attaching after single-page navigation
setInterval(() => {
  injectStatusBadge();
  const inputEl = findPromptInput();
  if (inputEl && inputEl.dataset.vantixBlocked === "true") {
    blockSendButton("Blocked by Vantix DLP policy");
  }
}, 2000);

// Self-Heal: If extension is active in tab but page shows the proxy unmanaged block card,
// immediately activate session and auto-reload to display the real AI interface!
function checkAndAutoRecover() {
  if (document.body && document.body.innerText && document.body.innerText.includes("UNMANAGED AI ACCESS BLOCKED")) {
    console.log("[Vantix Guard] Extension detected on blocked page. Activating guard session & reloading...");
    chrome.runtime.sendMessage({ type: "ACTIVATE_GUARD_SESSION" }, () => {
      setTimeout(() => {
        window.location.reload();
      }, 400);
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", checkAndAutoRecover);
} else {
  checkAndAutoRecover();
}

// ─── Browser Domain Intent Authorization ────────────────────────────────────
// Signals active tab presence on initial document load via extension background worker
// (avoids Private Network Access / CORS loopback restrictions on chatgpt.com)
try {
  chrome.runtime.sendMessage({
    type: "AUTHORIZE_AI_ACCESS",
    domain: location.hostname.toLowerCase(),
  });
} catch (e) {}


