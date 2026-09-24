"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const interceptedEl = document.getElementById("interceptedCount");
  const blockedEl = document.getElementById("blockedCount");
  const redactedEl = document.getElementById("redactedCount");
  const toggleBlock = document.getElementById("toggleBlock");
  const toggleRedact = document.getElementById("toggleRedact");
  const openDashboardBtn = document.getElementById("openDashboardBtn");
  const clearLogsBtn = document.getElementById("clearLogsBtn");

  // Load current stats & policy settings
  const stored = await chrome.storage.local.get([
    "interceptedCount",
    "blockedCount",
    "redactedCount",
    "policySettings",
  ]);

  interceptedEl.textContent = stored.interceptedCount || 0;
  blockedEl.textContent = stored.blockedCount || 0;
  redactedEl.textContent = stored.redactedCount || 0;

  const policy = stored.policySettings || { hardBlockCredentials: true, silentRedactPii: true };
  toggleBlock.checked = policy.hardBlockCredentials !== false;
  toggleRedact.checked = policy.silentRedactPii !== false;

  // Toggle handlers
  toggleBlock.addEventListener("change", async () => {
    const cur = await chrome.storage.local.get("policySettings");
    const updated = { ...(cur.policySettings || {}), hardBlockCredentials: toggleBlock.checked };
    await chrome.storage.local.set({ policySettings: updated });
  });

  toggleRedact.addEventListener("change", async () => {
    const cur = await chrome.storage.local.get("policySettings");
    const updated = { ...(cur.policySettings || {}), silentRedactPii: toggleRedact.checked };
    await chrome.storage.local.set({ policySettings: updated });
  });

  // Open Integrated Dashboard
  openDashboardBtn.addEventListener("click", () => {
    const url = chrome.runtime.getURL("dashboard.html");
    chrome.tabs.create({ url });
  });

  // Clear Logs
  clearLogsBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "CLEAR_LOGS" }, () => {
      interceptedEl.textContent = 0;
      blockedEl.textContent = 0;
      redactedEl.textContent = 0;
    });
  });
});
