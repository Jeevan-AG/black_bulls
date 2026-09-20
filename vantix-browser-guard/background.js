// ─── Vantix Enterprise AI Guard — Service Worker ─────────────────────────────
// Coordinates telemetry, handles badge updates, and syncs policy.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const BACKEND_URL = "http://localhost:5000";

// Initialize extension state
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    enabled: true,
    interceptedCount: 0,
    blockedCount: 0,
    redactedCount: 0,
    lastViolation: null,
    backendOnline: false,
  });

  chrome.action.setBadgeText({ text: "ON" });
  chrome.action.setBadgeBackgroundColor({ color: "#22d3ee" });
  console.log("[Vantix Guard] Background service worker initialized.");
});

// Periodic heartbeat to verify local Vantix engine
async function checkEngineHealth() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/vantix/health`, { method: "GET" });
    const json = await res.json();
    const isOnline = json && json.status === "operational";
    await chrome.storage.local.set({ backendOnline: isOnline });
    if (isOnline) {
      chrome.action.setBadgeText({ text: "PROT" });
      chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
    } else {
      chrome.action.setBadgeText({ text: "WARN" });
      chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });
    }
  } catch (err) {
    await chrome.storage.local.set({ backendOnline: false });
    chrome.action.setBadgeText({ text: "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
  }
}

// Check engine health on startup and periodically
checkEngineHealth();

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "INSPECT_PROMPT") {
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/vantix/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Vantix-User": message.user || "employee",
            "X-Vantix-Host": "browser-endpoint",
            "X-Vantix-Source": "browser-guard",
          },
          body: JSON.stringify({
            prompt: message.prompt,
            userId: message.user || "employee",
            sessionId: `browser-${Date.now()}`,
          }),
        });

        const json = await res.json();

        // Update local statistics
        const stats = await chrome.storage.local.get([
          "interceptedCount",
          "blockedCount",
          "redactedCount",
        ]);

        const isBlocked = json.blocked || json.meta?.action === "hard_block";
        const isRedacted = json.meta?.action === "silent_redact";

        const newStats = {
          interceptedCount: (stats.interceptedCount || 0) + 1,
          blockedCount: (stats.blockedCount || 0) + (isBlocked ? 1 : 0),
          redactedCount: (stats.redactedCount || 0) + (isRedacted ? 1 : 0),
        };

        if (isBlocked) {
          newStats.lastViolation = {
            timestamp: new Date().toLocaleTimeString(),
            message: json.message || "Live credentials blocked",
            promptSnippet: message.prompt.slice(0, 80),
          };
          chrome.action.setBadgeText({ text: "ALERT" });
          chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
        }

        await chrome.storage.local.set(newStats);

        sendResponse({ success: true, result: json });
      } catch (err) {
        console.error("[Vantix Guard] Engine request failed:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep message port open for async response
  }
});
