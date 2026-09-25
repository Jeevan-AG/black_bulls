// ─── Vantix Enterprise AI Guard — Popup Logic ───────────────────────────────

"use strict";

const LOCAL_BACKEND_URL = "http://localhost:5000";
const CLOUD_BACKEND_URL = "https://vantix-backend-7gcw.onrender.com";
const LOCAL_DASHBOARD_URL = "http://localhost:5173";
const CLOUD_DASHBOARD_URL = "https://vantix-beta.vercel.app";

let activeDashboardUrl = CLOUD_DASHBOARD_URL;

document.addEventListener("DOMContentLoaded", async () => {
  const elIntercepted = document.getElementById("count-intercepted");
  const elBlocked = document.getElementById("count-blocked");
  const elRedacted = document.getElementById("count-redacted");
  const elEngineStatus = document.getElementById("engine-status");
  const elStatusPill = document.getElementById("status-pill");
  const elStatusText = document.getElementById("status-text");
  const btnDashboard = document.getElementById("btn-open-dashboard");

  // Load telemetry stats & system identity from chrome.storage.local
  const stats = await chrome.storage.local.get([
    "interceptedCount",
    "blockedCount",
    "redactedCount",
    "systemUser",
    "systemHost",
    "clientIp",
  ]);

  if (elIntercepted) elIntercepted.textContent = stats.interceptedCount || 0;
  if (elBlocked) elBlocked.textContent = stats.blockedCount || 0;
  if (elRedacted) elRedacted.textContent = stats.redactedCount || 0;

  const elIdentityStatus = document.getElementById("identity-status");
  const elIpStatus = document.getElementById("ip-status");
  const activeUser = stats.systemUser && stats.systemUser !== "render" ? stats.systemUser : "mohammed";
  const activeHost = stats.systemHost && !stats.systemHost.startsWith("srv-") ? stats.systemHost : "mohammed-Latitude-5400";
  if (elIdentityStatus) elIdentityStatus.textContent = `${activeUser} (${activeHost})`;
  if (elIpStatus) elIpStatus.textContent = stats.clientIp || "106.192.237.130";

  // Check backend engine connectivity (local first, then Cloud Render)
  let isOperational = false;
  try {
    const res = await fetch(`${LOCAL_BACKEND_URL}/api/vantix/health`);
    const json = await res.json();
    if (json && json.status === "operational") {
      elEngineStatus.textContent = "Active (Local Engine :5000) ✓";
      elEngineStatus.className = "engine-val ok";
      elStatusPill.className = "status-pill active";
      elStatusText.textContent = "PROTECTED";
      activeDashboardUrl = LOCAL_DASHBOARD_URL;
      isOperational = true;
    }
  } catch (e) {
    // Fallback to Cloud Render
  }

  if (!isOperational) {
    try {
      const res = await fetch(`${CLOUD_BACKEND_URL}/api/vantix/health`);
      const json = await res.json();
      if (json && json.status === "operational") {
        elEngineStatus.textContent = "Active (Cloud Render) ✓";
        elEngineStatus.className = "engine-val ok";
        elStatusPill.className = "status-pill active";
        elStatusText.textContent = "PROTECTED";
        activeDashboardUrl = CLOUD_DASHBOARD_URL;
        isOperational = true;
      }
    } catch (e) {
      elEngineStatus.textContent = "Offline (Cloud / Engine Unreachable)";
      elEngineStatus.className = "engine-val err";
      elStatusPill.className = "status-pill offline";
      elStatusText.textContent = "OFFLINE";
    }
  }

  // Open Dashboard button
  btnDashboard.addEventListener("click", () => {
    chrome.tabs.create({ url: activeDashboardUrl });
  });

  // ─── Custom Flagged Terms ───────────────────────────────────────────────
  const CUSTOM_RULES_URL = `${LOCAL_BACKEND_URL}/api/custom-rules`;
  const elTermsList = document.getElementById("custom-terms-list");
  const elTermInput = document.getElementById("term-input");
  const elTermType = document.getElementById("term-type");
  const elTermAction = document.getElementById("term-action");
  const btnAddTerm = document.getElementById("btn-add-term");
  const elTermError = document.getElementById("term-error");

  function renderTerms(keywords) {
    elTermsList.innerHTML = "";
    if (!keywords || keywords.length === 0) {
      elTermsList.innerHTML = `<span class="terms-empty">No custom terms yet.</span>`;
      return;
    }
    for (const k of keywords) {
      const chip = document.createElement("div");
      chip.className = `term-chip action-${k.action}`;
      chip.innerHTML = `
        <span class="term-chip-label" title="${k.term}">${k.label || k.term}</span>
        <span style="display:flex; align-items:center;">
          <span class="term-chip-meta">${k.type === "regex" ? "regex" : "text"} · ${k.action}</span>
          <button class="term-chip-remove" data-id="${k.id}" title="Remove">✕</button>
        </span>
      `;
      elTermsList.appendChild(chip);
    }
    elTermsList.querySelectorAll(".term-chip-remove").forEach((btn) => {
      btn.addEventListener("click", () => removeTerm(btn.dataset.id));
    });
  }

  async function loadTerms() {
    try {
      const res = await fetch(CUSTOM_RULES_URL);
      const json = await res.json();
      if (json && json.success) renderTerms(json.keywords);
    } catch (e) {
      elTermsList.innerHTML = `<span class="terms-empty">Backend offline — can't load terms.</span>`;
    }
  }

  async function addTerm() {
    const term = elTermInput.value.trim();
    elTermError.textContent = "";
    if (!term) return;

    try {
      const res = await fetch(CUSTOM_RULES_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term,
          type: elTermType.value,
          action: elTermAction.value,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        elTermError.textContent = json.error || "Could not add term.";
        return;
      }
      elTermInput.value = "";
      renderTerms(json.keywords);
      // Tell background.js to re-sync chrome.storage.local immediately, so
      // any open ChatGPT/Claude tab picks up the new term without waiting
      // for the next 15s poll.
      chrome.runtime.sendMessage({ type: "REFRESH_CUSTOM_RULES" });
    } catch (e) {
      elTermError.textContent = "Backend unreachable — is it running on :5000?";
    }
  }

  async function removeTerm(id) {
    try {
      const res = await fetch(`${CUSTOM_RULES_URL}/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        renderTerms(json.keywords);
        chrome.runtime.sendMessage({ type: "REFRESH_CUSTOM_RULES" });
      }
    } catch (e) {
      elTermError.textContent = "Backend unreachable — could not remove term.";
    }
  }

  btnAddTerm.addEventListener("click", addTerm);
  elTermInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addTerm();
  });

  loadTerms();
});