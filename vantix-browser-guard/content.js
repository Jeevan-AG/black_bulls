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

// ─── Real-Time Typing Pre-Check (Debounced) ──────────────────────────────────
let _debounceTimer = null;
function handleLiveInput(inputEl) {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    const text = getInputText(inputEl).trim();
    if (text.length < 8) {
      if (inputEl.dataset.vantixBlocked === "true") {
        unblockInput(inputEl);
      }
      return;
    }

    try {
      chrome.runtime.sendMessage(
        { type: "INSPECT_PROMPT", prompt: text },
        (response) => {
          if (response && response.success && response.result) {
            const res = response.result;
            const isBlocked = res.blocked || res.meta?.action === "hard_block";
            if (isBlocked) {
              blockInput(inputEl, res.message, res.meta?.riskScore || 90, res.meta?.categoriesRedacted || []);
            } else if (inputEl.dataset.vantixBlocked === "true") {
              unblockInput(inputEl);
            }
          }
        }
      );
    } catch (e) {}
  }, 400);
}

// ─── Core Interception Pipeline ──────────────────────────────────────────────
let isProcessing = false;

async function handlePromptSubmission(e) {
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

  // Prevent recursive loop if already sanitized by Vantix
  if (inputEl.__vantix_sanitized) {
    inputEl.__vantix_sanitized = false;
    return;
  }

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
          blockInput(inputEl, res.message, riskScore, categories);
          return;
        }

        // ── Case 2: Silent Redaction (<=3 credentials / PII) ───────────────
        if (isRedacted && res.sanitizedPrompt && res.sanitizedPrompt !== rawPrompt) {
          console.log("[Vantix Guard] ⚡ SILENT REDACTION applied.");
          unblockInput(inputEl);
          setInputText(inputEl, res.sanitizedPrompt);
          showRedactPill(categories.length || 1);

          inputEl.__vantix_sanitized = true;
          triggerRealSubmit(inputEl);
          return;
        }

        // ── Case 3: Pass ───────────────────────────────────────────────────
        unblockInput(inputEl);
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
  const sendBtn = findSendButton();

  if (sendBtn && !sendBtn.disabled && !sendBtn.dataset.vantixBlocked) {
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

// ─── Event Listeners: Keydown, Button Click & Form Submit ─────────────────────
function setupListeners() {
  // 1. Intercept Enter key inside the prompt input (capture phase)
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
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
      const inputEl = findPromptInput();
      const target = e.target.closest("button");
      if (!target) return;

      const isSend =
        target.getAttribute("data-testid")?.includes("send") ||
        target.getAttribute("aria-label")?.toLowerCase().includes("send") ||
        target.getAttribute("aria-label")?.toLowerCase().includes("submit") ||
        target.type === "submit" ||
        target === findSendButton();

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

        if (inputEl && !inputEl.__vantix_sanitized) {
          handlePromptSubmission(e);
        }
      }
    },
    true // Capture phase
  );

  // 3. Intercept form submit events (capture phase)
  document.addEventListener(
    "submit",
    (e) => {
      const inputEl = findPromptInput();
      if (inputEl && inputEl.dataset.vantixBlocked === "true") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
      if (inputEl && !inputEl.__vantix_sanitized) {
        handlePromptSubmission(e);
      }
    },
    true
  );

  // 4. Live typing listener on prompt input
  document.addEventListener("input", (e) => {
    const inputEl = findPromptInput();
    if (inputEl && (e.target === inputEl || inputEl.contains(e.target))) {
      handleLiveInput(inputEl);
    }
  });

  injectStatusBadge();
}

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
