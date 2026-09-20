// ─── Vantix Enterprise AI Guard — Popup Logic ───────────────────────────────

"use strict";

const BACKEND_URL = "http://localhost:5000";

document.addEventListener("DOMContentLoaded", async () => {
  const elIntercepted = document.getElementById("count-intercepted");
  const elBlocked = document.getElementById("count-blocked");
  const elRedacted = document.getElementById("count-redacted");
  const elEngineStatus = document.getElementById("engine-status");
  const elStatusPill = document.getElementById("status-pill");
  const elStatusText = document.getElementById("status-text");
  const btnDashboard = document.getElementById("btn-open-dashboard");

  // Load telemetry stats from chrome.storage.local
  const stats = await chrome.storage.local.get([
    "interceptedCount",
    "blockedCount",
    "redactedCount",
  ]);

  if (elIntercepted) elIntercepted.textContent = stats.interceptedCount || 0;
  if (elBlocked) elBlocked.textContent = stats.blockedCount || 0;
  if (elRedacted) elRedacted.textContent = stats.redactedCount || 0;

  // Check backend engine connectivity
  try {
    const res = await fetch(`${BACKEND_URL}/api/vantix/health`);
    const json = await res.json();
    if (json && json.status === "operational") {
      elEngineStatus.textContent = "Active (Port 5000) ✓";
      elEngineStatus.className = "engine-val ok";
      elStatusPill.className = "status-pill active";
      elStatusText.textContent = "PROTECTED";
    } else {
      throw new Error("Invalid response");
    }
  } catch (err) {
    elEngineStatus.textContent = "Offline (Check ./vantix-protect.sh)";
    elEngineStatus.className = "engine-val err";
    elStatusPill.className = "status-pill offline";
    elStatusText.textContent = "OFFLINE";
  }

  // Open Dashboard button
  btnDashboard.addEventListener("click", () => {
    chrome.tabs.create({ url: "http://localhost:5173" });
  });
});
