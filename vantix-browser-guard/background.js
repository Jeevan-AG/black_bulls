// ─── Vantix Enterprise AI Guard — Service Worker ─────────────────────────────
// Coordinates telemetry, handles badge updates, and syncs policy.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const CLOUD_BACKEND_URL = "https://vantix-backend-7gcw.onrender.com";
const LOCAL_BACKEND_URL = "http://localhost:5000";

let effectiveBackendUrl = LOCAL_BACKEND_URL;
let currentSystemUser = "mohammed";
let currentSystemHost = "mohammed-Latitude-5400";

// Fetch dynamic system identity — ONLY from local engine (which runs on user's machine)
// Never query cloud Render for identity — it would return the server's OS, not the user's.
async function fetchSystemIdentity() {
  // 1. Try local engine (runs on user's machine — returns real OS user/hostname)
  try {
    const res = await fetch(`${LOCAL_BACKEND_URL}/api/vantix/system-identity`);
    const data = await res.json();
    if (data && data.user && data.user !== "render") {
      currentSystemUser = data.user;
      currentSystemHost = data.host;
      await chrome.storage.local.set({ systemUser: data.user, systemHost: data.host });
      return;
    }
  } catch (e) {}

  // 2. Fallback: use previously stored identity (persists across sessions)
  try {
    const stored = await chrome.storage.local.get(["systemUser", "systemHost"]);
    if (stored.systemUser && stored.systemUser !== "render") {
      currentSystemUser = stored.systemUser;
      currentSystemHost = stored.systemHost || currentSystemHost;
      return;
    }
  } catch (e) {}

  // 3. Final fallback: detect platform from Chrome APIs
  try {
    const info = await chrome.runtime.getPlatformInfo();
    const platformMap = { win: "Windows", mac: "macOS", linux: "Linux", cros: "ChromeOS" };
    currentSystemHost = `${platformMap[info.os] || info.os}-${info.arch}-workstation`;
    await chrome.storage.local.set({ systemUser: currentSystemUser, systemHost: currentSystemHost });
  } catch (e) {}
}

// Initialize extension state
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    enabled: true,
    interceptedCount: 0,
    blockedCount: 0,
    redactedCount: 0,
    lastViolation: null,
    backendOnline: false,
    activeGateway: "Detecting...",
    systemUser: currentSystemUser,
    systemHost: currentSystemHost,
  });

  chrome.action.setBadgeText({ text: "ON" });
  chrome.action.setBadgeBackgroundColor({ color: "#22d3ee" });
  console.log("[Vantix Guard] Background service worker initialized.");
  fetchSystemIdentity();
});

// Periodic heartbeat to verify Vantix engine (Local first, then Cloud Render)
async function checkEngineHealth() {
  await fetchSystemIdentity();

  try {
    const res = await fetch(`${LOCAL_BACKEND_URL}/api/vantix/health`, { method: "GET" });
    const json = await res.json();
    if (json && json.status === "operational") {
      effectiveBackendUrl = LOCAL_BACKEND_URL;
      await chrome.storage.local.set({ backendOnline: true, activeGateway: "Local Engine (:5000)" });
      chrome.action.setBadgeText({ text: "PROT" });
      chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
      return;
    }
  } catch (e) {
    // Fallback to Cloud Render Gateway
  }

  try {
    const res = await fetch(`${CLOUD_BACKEND_URL}/api/vantix/health`, { method: "GET" });
    const json = await res.json();
    if (json && json.status === "operational") {
      effectiveBackendUrl = CLOUD_BACKEND_URL;
      await chrome.storage.local.set({ backendOnline: true, activeGateway: "Cloud Gateway (Render)" });
      chrome.action.setBadgeText({ text: "PROT" });
      chrome.action.setBadgeBackgroundColor({ color: "#06b6d4" });
      return;
    }
  } catch (err) {
    await chrome.storage.local.set({ backendOnline: false, activeGateway: "Offline" });
    chrome.action.setBadgeText({ text: "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
  }
}

// Check engine health on startup and periodically
checkEngineHealth();
setInterval(checkEngineHealth, 15000);

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "INSPECT_PROMPT") {
    (async () => {
      try {
        const stored = await chrome.storage.local.get(["systemUser", "systemHost"]);
        let user = message.user || stored.systemUser || currentSystemUser || "mohammed";
        let host = stored.systemHost || currentSystemHost || "mohammed-Latitude-5400";
        if (user === "render" || user === "unknown-user" || user === "root") user = "mohammed";
        if (!host || host.startsWith("srv-") || host === "unknown-host") host = "mohammed-Latitude-5400";

        const payload = {
          prompt: message.prompt,
          userId: user,
          user: user,
          host: host,
          sessionId: `browser-${user}-${Date.now()}`,
        };

        // 1. Primary inspection for low-latency (<5ms)
        const res = await fetch(`${effectiveBackendUrl}/api/vantix/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Vantix-User": user,
            "X-Vantix-Host": host,
            "X-Vantix-Source": "browser-guard",
          },
          body: JSON.stringify(payload),
        });

        const json = await res.json();

        // 2. Dual-Sync: If local engine was used, sync to Cloud Render in background
        // so live Vercel dashboard updates in real-time
        if (effectiveBackendUrl !== CLOUD_BACKEND_URL) {
          fetch(`${CLOUD_BACKEND_URL}/api/vantix/chat`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Vantix-User": user,
              "X-Vantix-Host": host,
              "X-Vantix-Source": "browser-guard",
            },
            body: JSON.stringify(payload),
          }).catch(() => {});
        }

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
