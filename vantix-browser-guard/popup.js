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
  const activeUser = stats.systemUser && stats.systemUser !== "render" ? stats.systemUser : "Active User";
  const activeHost = stats.systemHost && !stats.systemHost.startsWith("srv-") ? stats.systemHost : "Workstation";
  if (elIdentityStatus) elIdentityStatus.textContent = `${activeUser} (${activeHost})`;
  if (elIpStatus) elIpStatus.textContent = stats.clientIp || "Resolving IP...";

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
});
