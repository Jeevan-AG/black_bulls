// ─── Vantix Standalone AI Guard — Content Interceptor ─────────────────────────
// Hooks into ChatGPT, Claude, Gemini, Copilot, Perplexity, DeepSeek DOMs.
// Intercepts prompt submission, triggers 100% local inspection, enforces Hard Block or Silent Redaction.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

console.log("[Vantix Standalone Guard] Content interceptor loaded into AI chat interface.");

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

  // Copilot / Perplexity / DeepSeek / Generic fallback
  return document.querySelector('textarea, [contenteditable="true"]');
}

// ─── Helper: Get Text from Input Element ─────────────────────────────────────
function getInputText(el) {
  if (!el) return "";
  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
    return el.value || "";
  }
  return el.innerText || el.textContent || "";
}

// ─── Helper: Set Text on Input Element ───────────────────────────────────────
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

// ─── Visual UI: Floating Shield Badge ─────────────────────────────────────────
function injectStatusBadge() {
  if (document.getElementById("vantix-guard-badge")) return;

  const badge = document.createElement("div");
  badge.id = "vantix-guard-badge";
  badge.innerHTML = `
    <span class="vantix-badge-dot"></span>
    <span>Vantix Guard: ACTIVE</span>
  `;

  badge.title = "Vantix Standalone AI Data Guard is active. Click to open local Dashboard.";
  badge.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" }, () => {
      // Fallback open via extension URL
      const dashUrl = chrome.runtime.getURL("dashboard.html");
      window.open(dashUrl, "_blank");
    });
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
    : "CREDENTIAL / SENSITIVE SECRET";

  banner.innerHTML = `
    <div class="vantix-banner-header">
      <div class="vantix-banner-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>BLOCKED BY VANTIX AI GUARD</span>
      </div>
      <div class="vantix-banner-risk">RISK SCORE: ${riskScore || 90}/100</div>
    </div>
    <div class="vantix-banner-body">
      ${message || "This prompt contains live credentials or secrets and was blocked locally on your machine."}
    </div>
    <div class="vantix-banner-meta">
      <span>Detected Categories: <strong>${categoryList}</strong></span>
      <span style="color: #38bdf8; cursor: pointer; text-decoration: underline;" id="vantix-open-log-btn">View Log in Local Dashboard</span>
    </div>
  `;

  banner.classList.add("visible");

  const openLogBtn = banner.querySelector("#vantix-open-log-btn");
  if (openLogBtn) {
    openLogBtn.onclick = (e) => {
      e.stopPropagation();
      window.open(chrome.runtime.getURL("dashboard.html"), "_blank");
    };
  }

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
    <span>Vantix Standalone TEE: ${tokensCount} sensitive tokens redacted before send</span>
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

  if (inputEl.__vantix_sanitized) {
    inputEl.__vantix_sanitized = false;
    return;
  }

  if (isProcessing) {
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  isProcessing = true;

  try {
    chrome.runtime.sendMessage(
      {
        type: "INSPECT_PROMPT",
        prompt: rawPrompt,
      },
      (response) => {
        isProcessing = false;

        if (!response || !response.success || !response.result) {
          inputEl.__vantix_sanitized = true;
          triggerRealSubmit(inputEl);
          return;
        }

        const res = response.result;
        const isBlocked = res.action === "hard_block" || res.blocked;
        const isRedacted = res.action === "silent_redact" || res.redacted;
        const riskScore = res.riskScore || 0;
        const categories = res.categoriesRedacted || [];

        // ── Case 1: Hard Block ─────────────────────────────────────────────
        if (isBlocked) {
          console.warn("[Vantix Standalone] ⛔ HARD BLOCK triggered.");
          inputEl.classList.add("vantix-shake-element");
          setTimeout(() => inputEl.classList.remove("vantix-shake-element"), 500);
          showBlockBanner(res.message, riskScore, categories);
          return;
        }

        // ── Case 2: Silent Redaction ───────────────────────────────────────
        if (isRedacted && res.sanitizedPrompt && res.sanitizedPrompt !== rawPrompt) {
          console.log("[Vantix Standalone] ⚡ SILENT REDACTION applied.");
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
    console.error("[Vantix Standalone] Error during prompt interception:", err);
    inputEl.__vantix_sanitized = true;
    triggerRealSubmit(inputEl);
  }
}

// ─── Helper: Trigger Native Submit ───────────────────────────────────────────
function triggerRealSubmit(inputEl) {
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
      console.warn("[Vantix Standalone] Could not dispatch enter event:", err);
    }
  }
}

// ─── Event Listeners ─────────────────────────────────────────────────────────
function setupListeners() {
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
    true
  );

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
    true
  );

  injectStatusBadge();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupListeners);
} else {
  setupListeners();
}

setInterval(injectStatusBadge, 3000);
