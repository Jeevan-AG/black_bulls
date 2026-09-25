// ─── Vantix Enterprise AI Guard — Content Interceptor ─────────────────────────
// Hooks into ChatGPT, Claude, and Gemini DOM. Redacts sensitive data
// SYNCHRONOUSLY, in place, before the user's own real Enter/click submits it —
// so the conversation still reaches the AI, just with secrets swapped out.
// Only a genuine critical-secret match blocks sending entirely.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

console.log("[Vantix Guard] Content script loaded into AI chat interface.");

// ─── Tier 1: CRITICAL patterns — block sending entirely, never transmitted ───
// Ported from vantix-backend/engines/industrialDetector.js so this decision
// can be made synchronously, in the same event handler that intercepts
// Enter/click — no async round trip, so nothing needs to be "faked" through
// afterward.
const CRITICAL_PATTERNS = [
  { regex: /\bsk_(?:live|test)_[A-Za-z0-9_-]{24,}/g, label: "Stripe Key" },
  { regex: /\bAIza[A-Za-z0-9_-]{35}\b/g, label: "Google API Key" },
  { regex: /\bAKIA[A-Z0-9]{16}\b/g, label: "AWS Access Key" },
  { regex: /\bghp_[A-Za-z0-9]{36,}\b/g, label: "GitHub Token" },
  { regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, label: "Slack Token" },
  { regex: /\bhf_[A-Za-z0-9]{34,}\b/g, label: "HuggingFace Token" },
  {
    regex: /(?:password|passwd|secret_key|client_secret|auth_token|secret_access_key|api_secret|aws_secret_access_key|api_key|apikey|access_token)\s*[:=]\s*(?:['"][^'"]{4,}['"]|[A-Za-z0-9/+=_\-@#$!%*?&]{6,})/gi,
    label: "Secret Assignment",
  },
  // Generic OpenAI-style keys (sk-..., sk-proj-..., etc.) — broader than the
  // Stripe-specific sk_live_/sk_test_ pattern above (underscore, not dash).
  { regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g, label: "API Key (OpenAI-style)" },
  { regex: /\bBearer\s+[A-Za-z0-9\-_.]{20,}\b/gi, label: "Bearer Token" },
  {
    regex: /-----BEGIN\s+(?:RSA\s+)?(?:PRIVATE|PUBLIC)\s+KEY-----/g,
    label: "Private Key",
  },
  { regex: /-----BEGIN\s+CERTIFICATE-----/g, label: "Certificate" },
  {
    regex: /(?:mongodb|mysql|postgresql|postgres|redis|amqp):\/\/[^\s"']+/gi,
    label: "DB Connection String",
  },
  { regex: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, label: "JWT Token" },
  {
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    label: "Credit Card",
  },
];

// ─── Tier 2: PII patterns — redact in place, message still sends ────────────
const PII_PATTERNS = [
  { regex: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, label: "[CONFIDENTIAL_PAN]" },
  { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, label: "[CONFIDENTIAL_EMAIL]" },
  // Requires an actual "-" or "." separator (or a leading "+" country code /
  // parens around the area code) between digit groups — plain spaces are NOT
  // accepted as a separator anymore. That's the deliberate fix: math written
  // as "100 200 3000" or "12 345 6789" no longer matches, since real phone
  // numbers are essentially never written with only bare spaces and no other
  // punctuation. The lookbehind/lookahead also reject a match sitting right
  // next to a digit or an arithmetic operator, so it won't fire inside a
  // longer number or an equation like "5+1234567890".
  {
    regex: /(?<![\d+\-*/=.])(?:\+\d{1,3}[-.]?)?\(?\d{3}\)?[-.]\d{3}[-.]\d{4}(?!\d)/g,
    label: "[CONFIDENTIAL_PHONE]",
  },
  // International format with a leading "+" and no separators at all
  // (e.g. +919876543210) — still fairly phone-specific since it requires
  // 10–14 digits immediately after a "+" with no operator right before it.
  {
    regex: /(?<![\d+\-*/=.])\+\d{10,14}\b/g,
    label: "[CONFIDENTIAL_PHONE]",
  },
];

// ─── Admin-Customizable Terms ─────────────────────────────────────────────────
// Populated (async) from chrome.storage.local, which background.js keeps in
// sync with the backend's /api/custom-rules. Detection itself stays fully
// synchronous — we only ever read this already-resolved array, never await
// storage inside the hot path.
let customEntries = []; // [{ id, term, type: 'literal'|'regex', label, action: 'redact'|'block' }]

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildCustomRegex(entry) {
  try {
    return entry.type === "regex"
      ? new RegExp(entry.term, "gi")
      : new RegExp(escapeRegex(entry.term), "gi");
  } catch (e) {
    console.warn("[Vantix Guard] Invalid custom pattern, skipping:", entry.term, e);
    return null;
  }
}

function loadCustomEntries() {
  chrome.storage.local.get("customKeywords", (res) => {
    if (Array.isArray(res.customKeywords)) {
      customEntries = res.customKeywords;
      console.log(`[Vantix Guard] Loaded ${customEntries.length} admin-defined term(s).`);
    }
  });
}
loadCustomEntries();

// Keep the in-memory list live if the popup/background updates storage
// without needing a page reload.
if (chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.customKeywords) {
      customEntries = changes.customKeywords.newValue || [];
      console.log(`[Vantix Guard] Custom terms updated (${customEntries.length}).`);
    }
  });
}

function detectCritical(text) {
  const hits = [];
  for (const p of CRITICAL_PATTERNS) {
    if (p.regex.test(text)) hits.push(p.label);
    p.regex.lastIndex = 0; // reset global regex state between calls
  }
  // Admin-defined terms with action "block"
  for (const entry of customEntries) {
    if (entry.action !== "block") continue;
    const re = buildCustomRegex(entry);
    if (re && re.test(text)) hits.push(entry.label || entry.term);
  }
  return hits;
}

function sanitizeTextLocally(text) {
  let sanitized = text;
  let matchesCount = 0;
  for (const pattern of PII_PATTERNS) {
    const matches = sanitized.match(pattern.regex);
    if (matches) {
      matchesCount += matches.length;
      sanitized = sanitized.replace(pattern.regex, pattern.label);
    }
  }
  // Admin-defined terms with action "redact"
  for (const entry of customEntries) {
    if (entry.action !== "redact") continue;
    const re = buildCustomRegex(entry);
    if (!re) continue;
    const matches = sanitized.match(re);
    if (matches) {
      matchesCount += matches.length;
      const tag = `[${(entry.label || entry.term).toUpperCase().replace(/[^A-Z0-9]+/g, "_")}]`;
      sanitized = sanitized.replace(re, tag);
    }
  }
  return { sanitized, matchesCount };
}

// ─── Helper: Identify Active Input Element ───────────────────────────────────
function findPromptInput() {
  const cgPrompt = document.getElementById("prompt-textarea");
  if (cgPrompt) return cgPrompt;

  const claudePrompt =
    document.querySelector('div[contenteditable="true"].ProseMirror') ||
    document.querySelector('div[contenteditable="true"]');
  if (claudePrompt) return claudePrompt;

  const geminiPrompt =
    document.querySelector(".ql-editor") ||
    document.querySelector('rich-textarea div[contenteditable="true"]') ||
    document.querySelector('textarea[aria-label*="prompt"]');
  if (geminiPrompt) return geminiPrompt;

  return document.querySelector('textarea, [contenteditable="true"]');
}

// ─── Helper: Get / Set Text (native setters so React's controlled state sees it) ──
function getInputText(el) {
  if (!el) return "";
  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return el.value || "";
  return el.innerText || el.textContent || "";
}

function setInputText(el, newText) {
  if (!el) return;

  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(el, newText);
    } else {
      el.value = newText;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (el.isContentEditable) {
    el.innerText = newText;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

// ─── Visual UI ────────────────────────────────────────────────────────────────
function injectStatusBadge() {
  if (document.getElementById("vantix-guard-badge")) return;
  const badge = document.createElement("div");
  badge.id = "vantix-guard-badge";
  badge.innerHTML = `<span class="vantix-badge-dot"></span><span>Vantix Guard: ACTIVE</span>`;
  badge.title = "Vantix Enterprise AI Data Firewall is active and monitoring.";
  badge.addEventListener("click", () => window.open("http://localhost:5173", "_blank"));
  document.body.appendChild(badge);
}

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
    <span>Vantix Guard: ${tokensCount} confidential entity/entities redacted before send</span>
  `;
  pill.classList.add("visible");
  setTimeout(() => pill.classList.remove("visible"), 4000);
}

function showBlockBanner(labels) {
  let banner = document.getElementById("vantix-block-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "vantix-block-banner";
    document.body.appendChild(banner);
  }
  banner.innerHTML = `
    <div class="vantix-banner-header">
      <div class="vantix-banner-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>BLOCKED BY VANTIX ENTERPRISE FIREWALL</span>
      </div>
    </div>
    <div class="vantix-banner-body">
      This message contains a live credential (${labels.join(", ")}) and was not sent.
    </div>
  `;
  banner.classList.add("visible");
  const timer = setTimeout(() => banner.classList.remove("visible"), 8000);
  banner.onclick = () => {
    clearTimeout(timer);
    banner.classList.remove("visible");
  };
}

// Fire-and-forget telemetry to the dashboard. Never blocks or delays sending —
// purely for the SOC dashboard's visibility, so a slow/unreachable backend
// can no longer affect whether a message actually goes out.
function reportAsync(prompt, action) {
  try {
    chrome.runtime.sendMessage({ type: "INSPECT_PROMPT", prompt, clientAction: action }, () => {
      // Intentionally ignore response/errors — this is telemetry only.
      void chrome.runtime.lastError;
    });
  } catch (err) {
    // Extension context can be invalidated on reload; ignore.
  }
}

// ─── Core Interception Pipeline ──────────────────────────────────────────────
function handlePromptSubmission(e) {
  const inputEl = findPromptInput();
  if (!inputEl) return;

  const rawPrompt = getInputText(inputEl).trim();
  if (!rawPrompt || rawPrompt.length < 5) return;

  // 1. CRITICAL check — decided synchronously, so we can safely block the
  //    real event outright with no async round trip needed.
  const criticalHits = detectCritical(rawPrompt);
  if (criticalHits.length > 0) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    console.warn("[Vantix Guard] ⛔ HARD BLOCK — critical secret detected:", criticalHits);
    showBlockBanner(criticalHits);
    reportAsync(rawPrompt, "hard_block");
    return; // nothing sent
  }

  // 2. PII redaction — mutate the DOM in place, synchronously, and then let
  //    the ORIGINAL real Enter/click continue propagating. We do NOT call
  //    preventDefault here: the site's own handler fires next (later in this
  //    same event's propagation) and reads the now-redacted text, so it
  //    submits for real, using the user's own trusted action — no synthetic
  //    resubmission needed.
  const { sanitized, matchesCount } = sanitizeTextLocally(rawPrompt);
  if (matchesCount > 0 && sanitized !== rawPrompt) {
    console.log(`[Vantix Guard] ⚡ Redacting ${matchesCount} item(s) before send.`);
    setInputText(inputEl, sanitized);
    showRedactPill(matchesCount);
    reportAsync(sanitized, "silent_redact");
    return; // let the real event continue — no preventDefault
  }

  // 3. Nothing sensitive found — do nothing, real event proceeds untouched.
  reportAsync(rawPrompt, "pass");
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
function setupListeners() {
  // Capture phase so we run BEFORE the site's own handlers, giving our DOM
  // mutation time to land before their Enter/click logic reads the text.
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
      const inputEl = findPromptInput();
      if (!inputEl) return;

      const isSendBtn =
        target.getAttribute("data-testid") === "send-button" ||
        target.getAttribute("data-testid") === "composer-send-button" ||
        target.getAttribute("aria-label") === "Send prompt" ||
        (target.getAttribute("aria-label") && /send|submit/i.test(target.getAttribute("aria-label"))) ||
        target.getAttribute("type") === "submit";

      if (isSendBtn) {
        handlePromptSubmission(e);
      }
    },
    true
  );

  document.addEventListener(
    "submit",
    (e) => {
      const inputEl = findPromptInput();
      if (inputEl) handlePromptSubmission(e);
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

// ─── PDF Upload Guard ──────────────────────────────────────────────────────
// PDFs with a genuine credential/block-type hit are blocked outright.
// PDFs with only PII/redact-type hits get rebuilt as a new, plain-text PDF
// with those spans swapped for [TAG]s (see buildRedactedPdf) — this does NOT
// preserve original formatting/images, since editing text in place inside an
// existing PDF's byte structure isn't practical client-side; it trades
// fidelity for actually being able to redact-and-send rather than block.
// pdf.min.js / pdf-lib.min.js (loaded before this file) expose the globals
// `pdfjsLib` and `PDFLib`.
// pdf.js needs its own Worker for real parsing performance. Pointing
// workerSrc straight at the extension's chrome-extension:// URL can hit the
// host page's own Content-Security-Policy (chatgpt.com/gemini.google.com
// enforce fairly strict CSPs) and pdf.js's in-page fallback then fails too.
// Fetching the worker's code ourselves and handing it over as a blob: URL
// sidesteps that — CSPs that block extension-hosted script URLs very often
// still permit blob: sources.
let pdfWorkerReady = null;
async function ensurePdfWorker() {
  if (typeof pdfjsLib === "undefined") return;
  if (pdfWorkerReady) return pdfWorkerReady;
  pdfWorkerReady = (async () => {
    try {
      const res = await fetch(chrome.runtime.getURL("lib/pdf.worker.min.js"));
      const code = await res.text();
      const blob = new Blob([code], { type: "text/javascript" });
      pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
    } catch (err) {
      console.warn("[Vantix Guard] Could not prepare PDF worker blob, falling back to direct URL:", err);
      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("lib/pdf.worker.min.js");
    }
  })();
  return pdfWorkerReady;
}

async function extractPdfText(file) {
  await ensurePdfWorker();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  const maxPages = Math.min(pdf.numPages, 30); // cap for performance on huge files
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => it.str).join(" ") + "\n";
  }
  return text;
}

async function scanSinglePdf(file) {
  try {
    const text = await extractPdfText(file);

    const blockHits = new Set();
    detectCritical(text).forEach((h) => blockHits.add(h)); // real credentials always block
    for (const entry of customEntries) {
      if (entry.action !== "block") continue;
      const re = buildCustomRegex(entry);
      if (re && re.test(text)) blockHits.add(entry.label || entry.term);
    }

    // PII + custom "redact" terms don't block on their own — they trigger a
    // rebuilt, redacted PDF instead (see redactPdfText / buildRedactedPdf).
    const redactHits = new Set();
    for (const p of PII_PATTERNS) {
      if (p.regex.test(text)) redactHits.add(p.label.replace(/[[\]]/g, ""));
      p.regex.lastIndex = 0;
    }
    for (const entry of customEntries) {
      if (entry.action !== "redact") continue;
      const re = buildCustomRegex(entry);
      if (re && re.test(text)) redactHits.add(entry.label || entry.term);
    }

    return {
      text,
      blocked: blockHits.size > 0,
      blockHits: Array.from(blockHits),
      needsRedaction: blockHits.size === 0 && redactHits.size > 0,
      redactHits: Array.from(redactHits),
    };
  } catch (err) {
    console.warn("[Vantix Guard] Could not scan PDF (allowing through):", file.name, err);
    return { text: "", blocked: false, blockHits: [], needsRedaction: false, redactHits: [] };
  }
}

// Applies the same PII_PATTERNS + custom "redact" entries used for chat text
// to raw extracted PDF text, producing a redacted plain-text version.
function redactPdfText(text) {
  let sanitized = text;
  for (const pattern of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern.regex, pattern.label);
  }
  for (const entry of customEntries) {
    if (entry.action !== "redact") continue;
    const re = buildCustomRegex(entry);
    if (!re) continue;
    const tag = `[${(entry.label || entry.term).toUpperCase().replace(/[^A-Z0-9]+/g, "_")}]`;
    sanitized = sanitized.replace(re, tag);
  }
  return sanitized;
}

// Rebuilds a brand-new, simple PDF containing the redacted text. This does
// NOT preserve the original file's layout/formatting/images — recreating a
// visually identical PDF with specific text edited out isn't practical
// client-side, so this trades fidelity for actually being able to redact at
// all. The result is a plain, readable document with sensitive spans
// replaced by [TAG]s.
async function buildRedactedPdf(text, originalName) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontSize = 11;
  const margin = 50;
  const pageWidth = 612;
  const pageHeight = 792;
  const maxLineWidth = pageWidth - margin * 2;
  const lineHeight = fontSize * 1.4;

  // PDF text extraction can surface characters (smart quotes, ligatures,
  // odd whitespace, private-use glyphs from subset fonts) that pdf-lib's
  // standard Helvetica font can't encode — that used to throw and abort the
  // whole rebuild, which is why nothing got attached. Swap anything the font
  // can't actually draw for a safe placeholder instead of failing closed.
  const safeText = sanitizeForFont(text, font);

  // Word-wrap the (already redacted, now font-safe) text into lines that fit
  // the page width.
  const wrapped = [];
  for (const rawLine of safeText.split("\n")) {
    if (rawLine.trim() === "") {
      wrapped.push("");
      continue;
    }
    const words = rawLine.split(/\s+/).filter(Boolean);
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(test, fontSize) > maxLineWidth && current) {
        wrapped.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) wrapped.push(current);
  }

  let page = doc.addPage([pageWidth, pageHeight]);
  page.drawText("Redacted by Vantix Guard - original attachment withheld", {
    x: margin,
    y: pageHeight - margin,
    size: 9,
    font,
    color: rgb(0.6, 0.1, 0.1),
  });
  let y = pageHeight - margin - 30;

  for (const line of wrapped) {
    if (y < margin) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0.1, 0.1, 0.1) });
    y -= lineHeight;
  }

  const bytes = await doc.save();
  const safeName = (originalName || "document.pdf").replace(/\.pdf$/i, "");
  return new File([bytes], `redacted_${safeName}.pdf`, { type: "application/pdf" });
}

// Replaces any character the given pdf-lib font can't encode with "?", so a
// single unusual glyph from PDF text extraction can't abort the whole
// rebuild. Newlines are left untouched (handled separately by the wrapper).
function sanitizeForFont(text, font) {
  let out = "";
  for (const ch of text) {
    if (ch === "\n") {
      out += ch;
      continue;
    }
    try {
      font.widthOfTextAtSize(ch, 10);
      out += ch;
    } catch (e) {
      out += "?";
    }
  }
  return out;
}

function clearFileInput(input) {
  const dt = new DataTransfer();
  input.files = dt.files;
}

function reassignFiles(input, files) {
  const dt = new DataTransfer();
  files.forEach((f) => dt.items.add(f));
  input.files = dt.files;
}

async function handleFileInputChange(e) {
  const input = e.target;
  if (!input || input.tagName !== "INPUT" || input.type !== "file" || !input.files) return;

  const allFiles = Array.from(input.files);
  const pdfFiles = allFiles.filter(
    (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name)
  );
  if (pdfFiles.length === 0) return; // not a PDF — let it through untouched

  // Parsing is inherently async, so we can't decide synchronously the way
  // typed text is handled. Hold this exact change event back, scan, then
  // either re-dispatch a real change event (clean/redacted) or clear the
  // input and block (critical) — the site never sees a file until we've
  // decided.
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  if (typeof pdfjsLib === "undefined" || typeof PDFLib === "undefined") {
    console.warn("[Vantix Guard] PDF libraries not loaded — letting PDF through unscanned.");
    reassignFiles(input, allFiles);
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  const verdicts = await Promise.all(pdfFiles.map(scanSinglePdf));

  const blockedHits = [...new Set(verdicts.filter((v) => v.blocked).flatMap((v) => v.blockHits))];
  if (blockedHits.length > 0) {
    clearFileInput(input);
    console.warn("[Vantix Guard] ⛔ PDF upload blocked:", blockedHits);
    showBlockBanner(blockedHits);
    reportAsync(`[PDF upload blocked: ${pdfFiles.map((f) => f.name).join(", ")}]`, "hard_block");
    return;
  }

  // No critical hits. Rebuild redacted replacements for any PDF that needs
  // one; non-PDFs and clean PDFs pass through as their original File object.
  const finalFiles = [];
  let totalRedactedCount = 0;

  for (const file of allFiles) {
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      finalFiles.push(file);
      continue;
    }
    const verdict = verdicts[pdfFiles.indexOf(file)];
    if (verdict && verdict.needsRedaction) {
      try {
        const redactedText = redactPdfText(verdict.text);
        const redactedFile = await buildRedactedPdf(redactedText, file.name);
        finalFiles.push(redactedFile);
        totalRedactedCount += verdict.redactHits.length;
        console.log(`[Vantix Guard] ⚡ Rebuilt redacted PDF for "${file.name}":`, verdict.redactHits);
      } catch (err) {
        console.warn("[Vantix Guard] Could not rebuild redacted PDF, blocking instead:", err);
        showBlockBanner(["PDF redaction failed"]);
        return; // fail closed if rebuild itself errors — don't leak the original
      }
    } else {
      finalFiles.push(file);
    }
  }

  if (totalRedactedCount > 0) {
    showRedactPill(totalRedactedCount);
    reportAsync(`[PDF redacted before upload: ${pdfFiles.map((f) => f.name).join(", ")}]`, "silent_redact");
  }

  reassignFiles(input, finalFiles);
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

document.addEventListener("change", handleFileInputChange, true);