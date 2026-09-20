// ─── Vantix Enterprise AI Guard — Content Interceptor ─────────────────────────
// Hooks into ChatGPT, Claude, and Gemini DOM. Intercepts prompt submission,
// executes pre-flight TEE inspection, enforces Hard Block, or performs Silent Redact.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

console.log("[Vantix Guard] Content script loaded into AI chat interface.");

// ─── Helper: Identify Active Input Element ───────────────────────────────────
function findPromptInput() {
  // ChatGPT
  const cgPrompt = document.getElementById("prompt-textarea");
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

// ─── Helper: Get Text from Input Element ─────────────────────────────────────
function getInputText(el) {
  if (!el) return "";
  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
    return el.value || "";
  }
  // Contenteditable
  return el.innerText || el.textContent || "";
}

// ─── Helper: Set Text on Input Element (Triggering React/Vue State) ───────────
function setInputText(el, newText) {
  if (!el) return;

  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
    el.value = newText;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (el.isContentEditable) {
    el.innerText = newText;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
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
    : "CREDENTIAL / INDUSTRIAL SECRET";

  banner.innerHTML = `
    <div class="vantix-banner-header">
      <div class="vantix-banner-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>BLOCKED BY VANTIX ENTERPRISE FIREWALL</span>
      </div>
      <div class="vantix-banner-risk">RISK SCORE: ${riskScore || 90}/100</div>
    </div>
    <div class="vantix-banner-body">
      ${message || "This prompt contains live credentials or sensitive industrial parameters and was aborted before leaving this device."}
    </div>
    <div class="vantix-banner-meta">
      <span>Violation Categories: <strong>${categoryList}</strong></span>
      <span>Logged to Vantix Security Admin</span>
    </div>
  `;

  banner.classList.add("visible");

  // Auto-hide after 8 seconds or on click
  const timer = setTimeout(() => {
    banner.classList.remove("visible");
  }, 8000);

  banner.onclick = () => {
    clearTimeout(timer);
    banner.classList.remove("visible");
  };
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

// ─── Core Interception Pipeline ──────────────────────────────────────────────
let isProcessing = false;

async function handlePromptSubmission(e) {
  const inputEl = findPromptInput();
  if (!inputEl) return;

  const rawPrompt = getInputText(inputEl).trim();
  if (!rawPrompt || rawPrompt.length < 5) return;

  // Prevent recursive loop if already sanitized by Vantix
  if (inputEl.__vantix_sanitized) {
    inputEl.__vantix_sanitized = false;
    return;
  }

  if (isProcessing) {
    e.preventDefault();
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

        if (!response || !response.success || !response.result) {
          console.warn("[Vantix Guard] Engine not reachable, allowing prompt.");
          inputEl.__vantix_sanitized = true;
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
          inputEl.classList.add("vantix-shake-element");
          setTimeout(() => inputEl.classList.remove("vantix-shake-element"), 500);

          showBlockBanner(res.message, riskScore, categories);
          return;
        }

        // ── Case 2: Silent Redaction ───────────────────────────────────────
        if (isRedacted && res.sanitizedPrompt && res.sanitizedPrompt !== rawPrompt) {
          console.log("[Vantix Guard] ⚡ SILENT REDACTION applied.");
          setInputText(inputEl, res.sanitizedPrompt);
          showRedactPill(categories.length || 1);

          inputEl.__vantix_sanitized = true;
          triggerRealSubmit(inputEl);
          return;
        }

        // ── Case 3: Pass ───────────────────────────────────────────────────
        inputEl.__vantix_sanitized = true;
        triggerRealSubmit(inputEl);
      }
    );
  } catch (err) {
    isProcessing = false;
    console.error("[Vantix Guard] Error during prompt interception:", err);
    inputEl.__vantix_sanitized = true;
    triggerRealSubmit(inputEl);
  }
}

// ─── Helper: Trigger Native Submit ───────────────────────────────────────────
function triggerRealSubmit(inputEl) {
  // Find send button
  const sendBtn =
    document.querySelector('button[data-testid="send-button"]') ||
    document.querySelector('button[aria-label="Send prompt"]') ||
    document.querySelector('button[data-testid="composer-send-button"]') ||
    document.querySelector('button[aria-label*="Send"]');

  if (sendBtn && !sendBtn.disabled) {
    sendBtn.click();
  } else {
    try {
      if (typeof KeyboardEvent !== "undefined") {
        const enterEvt = new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        });
        inputEl.dispatchEvent(enterEvt);
      }
    } catch (err) {
      console.warn("[Vantix Guard] Could not dispatch enter event:", err);
    }
  }
}

// ─── Event Listeners: Keydown & Button Click ──────────────────────────────────
function setupListeners() {
  // Intercept Enter key inside the prompt input (capture phase)
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        const inputEl = findPromptInput();
        if (inputEl && (e.target === inputEl || inputEl.contains(e.target))) {
          handlePromptSubmission(e);
        }
      }
    },
    true // Capture phase: execute BEFORE web app's React handlers
  );

  // Intercept clicks on any submit / send buttons (capture phase)
  document.addEventListener(
    "click",
    (e) => {
      const target = e.target.closest("button");
      if (!target) return;

      const isSendBtn =
        target.getAttribute("data-testid") === "send-button" ||
        target.getAttribute("data-testid") === "composer-send-button" ||
        target.getAttribute("aria-label") === "Send prompt" ||
        (target.getAttribute("aria-label") && target.getAttribute("aria-label").includes("Send"));

      if (isSendBtn) {
        const inputEl = findPromptInput();
        if (inputEl && !inputEl.__vantix_sanitized) {
          handlePromptSubmission(e);
        }
      }
    },
    true // Capture phase
  );

  injectStatusBadge();
}

// Ensure listeners are registered
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupListeners);
} else {
  setupListeners();
}

// Periodically check if badge needs re-injecting after single-page navigation
setInterval(injectStatusBadge, 3000);
