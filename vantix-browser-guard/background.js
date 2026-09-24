// ─── Vantix Enterprise AI Guard — Service Worker ─────────────────────────────
// Coordinates telemetry, handles badge updates, and syncs policy.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const CLOUD_BACKEND_URL = "https://vantix-backend-7gcw.onrender.com";
const LOCAL_BACKEND_URL = "http://localhost:5000";

let effectiveBackendUrl = LOCAL_BACKEND_URL;
let currentSystemUser = "";
let currentSystemHost = "";

// Fetch dynamic system identity — from local engine (OS level) or dynamic platform detection
async function fetchSystemIdentity() {
  // 1. Try local engine (runs on user's machine — returns real OS user/hostname)
  try {
    const res = await fetch(`${LOCAL_BACKEND_URL}/api/vantix/system-identity`);
    const data = await res.json();
    if (data && data.user && data.user !== "render") {
      currentSystemUser = data.user;
      currentSystemHost = data.host;
      await chrome.storage.local.set({ systemUser: data.user, systemHost: data.host, clientIp: data.clientIp });
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
    currentSystemUser = `${(platformMap[info.os] || "user").toLowerCase()}-user`;
    await chrome.storage.local.set({ systemUser: currentSystemUser, systemHost: currentSystemHost });
  } catch (e) {}

  // 4. Discover external/network endpoint IP from gateway
  try {
    const res = await fetch(`${CLOUD_BACKEND_URL}/api/vantix/system-identity`);
    const data = await res.json();
    if (data && data.clientIp) {
      await chrome.storage.local.set({ clientIp: data.clientIp });
    }
  } catch (e) {}
}

const TARGET_AI_DOMAINS = [
  "chatgpt.com",
  "chat.openai.com",
  "openai.com",
  "claude.ai",
  "anthropic.com",
  "gemini.google.com",
  "perplexity.ai",
  "deepseek.com",
  "copilot.microsoft.com",
  "grok.com",
  "meta.ai",
  "x.ai",
  "poe.com"
];

// Register declarative rule with requestDomains so proxy knows browser extension is active
let _headersConfigured = false;
async function setupExtensionHeaders() {
  if (_headersConfigured) return;
  try {
    if (chrome.declarativeNetRequest) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1001],
        addRules: [
          {
            id: 1001,
            priority: 1,
            action: {
              type: "modifyHeaders",
              requestHeaders: [
                {
                  header: "X-Vantix-Extension",
                  operation: "set",
                  value: "active",
                },
              ],
            },
            condition: {
              urlFilter: "*",
              resourceTypes: [
                "main_frame",
                "sub_frame",
                "stylesheet",
                "script",
                "image",
                "font",
                "object",
                "xmlhttprequest",
                "ping",
                "csp_report",
                "media",
                "websocket",
                "webtransport",
                "webbundle",
                "other"
              ],
              requestDomains: TARGET_AI_DOMAINS,
            },
          },
        ],
      });
      _headersConfigured = true;
    }
  } catch (err) {
    console.warn("[Vantix Guard] Could not register declarative header rule:", err);
  }
}

// Sync authentication cookie to AI sites so proxy knows extension is active on all navigations
async function syncGuardCookies() {
  if (!chrome.cookies) return;
  for (const domain of TARGET_AI_DOMAINS) {
    try {
      await chrome.cookies.set({
        url: `https://${domain}`,
        name: "vantix_guard",
        value: "active",
        path: "/",
        sameSite: "no_restriction",
        secure: true,
      });
      await chrome.cookies.set({
        url: `https://${domain}`,
        domain: `.${domain}`,
        name: "vantix_guard",
        value: "active",
        path: "/",
        sameSite: "no_restriction",
        secure: true,
      });
    } catch (e) {}
  }
}

// Register local proxy heartbeat so transparent proxy knows this workstation is managed
async function sendGuardHeartbeat() {
  try {
    const stored = await chrome.storage.local.get(["systemUser", "systemHost"]);
    const user = stored.systemUser || currentSystemUser || "employee";
    const host = stored.systemHost || currentSystemHost || "workstation";

    await fetch(`${LOCAL_BACKEND_URL}/api/vantix/guard-heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, host, active: true }),
    });
  } catch (e) {}
}

// Dynamic per-domain navigation intent authorization
async function authorizeAiDomain(domain) {
  if (!domain) return;
  const clean = domain.split(":")[0].toLowerCase().trim();
  try {
    await fetch(`${LOCAL_BACKEND_URL}/api/vantix/authorize-ai-access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: clean, timestamp: Date.now() }),
    });
  } catch (e) {}
}

// 1. Detect navigation in managed browser the instant user types URL or clicks link
if (chrome.webNavigation && chrome.webNavigation.onBeforeNavigate) {
  chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    try {
      const url = new URL(details.url);
      const host = url.hostname.toLowerCase();
      if (TARGET_AI_DOMAINS.some((d) => host === d || host.endsWith("." + d))) {
        authorizeAiDomain(host);
      }
    } catch (e) {}
  });
}

// 2. Also track active tab updates
if (chrome.tabs && chrome.tabs.onUpdated) {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
      try {
        const url = new URL(changeInfo.url);
        const host = url.hostname.toLowerCase();
        if (TARGET_AI_DOMAINS.some((d) => host === d || host.endsWith("." + d))) {
          authorizeAiDomain(host);
        }
      } catch (e) {}
    }
  });
}

// 3. Lowest-level network hook — fires BEFORE any TCP/HTTP packet leaves the managed browser
if (chrome.webRequest && chrome.webRequest.onBeforeRequest) {
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      try {
        const url = new URL(details.url);
        const host = url.hostname.toLowerCase();
        if (TARGET_AI_DOMAINS.some((d) => host === d || host.endsWith("." + d))) {
          authorizeAiDomain(host);
        }
      } catch (e) {}
    },
    { urls: ["https://*/*"] }
  );
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
  fetchSystemIdentity();
  setupExtensionHeaders();
  syncGuardCookies();
  sendGuardHeartbeat();
});

setupExtensionHeaders();
syncGuardCookies();
sendGuardHeartbeat();

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
        let user = message.user || stored.systemUser || currentSystemUser || "employee";
        let host = stored.systemHost || currentSystemHost || "workstation";
        if (user === "render" || user === "unknown-user" || user === "root") user = "employee";
        if (!host || host.startsWith("srv-") || host === "unknown-host") host = "workstation";

        const payload = {
          prompt: message.prompt,
          userId: user,
          user: user,
          host: host,
          sessionId: `browser-${user}-${Date.now()}`,
        };

        // 1. Primary inspection for ultra-low latency (<5ms TEE Enclave)
        let json;
        try {
          const res = await fetch(`${effectiveBackendUrl}/api/vantix/inspect`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Vantix-User": user,
              "X-Vantix-Host": host,
              "X-Vantix-Source": "browser-guard",
            },
            body: JSON.stringify(payload),
          });
          json = await res.json();
          if (!res.ok || !json.success) {
            throw new Error(json.error || `HTTP ${res.status}`);
          }
        } catch (e) {
          // Fallback to /chat if /inspect route is temporarily offline or restarting
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
          json = await res.json();
        }

        // 2. Dual-Sync: If local engine was used, sync audit to Cloud Render asynchronously
        // so live Vercel dashboard updates in real-time
        if (effectiveBackendUrl !== CLOUD_BACKEND_URL) {
          fetch(`${CLOUD_BACKEND_URL}/api/vantix/inspect`, {
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

  if (message.type === "ACTIVATE_GUARD_SESSION") {
    (async () => {
      await setupExtensionHeaders();
      await syncGuardCookies();
      await sendGuardHeartbeat();
      sendResponse({ success: true, active: true });
    })();
    return true;
  }

  if (message.type === "AUTHORIZE_AI_ACCESS") {
    (async () => {
      try {
        const domain = message.domain;
        await fetch(`${LOCAL_BACKEND_URL}/api/vantix/authorize-ai-access`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain, timestamp: Date.now() }),
        });
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});

// Periodic heartbeat & cookie refresh every 10 seconds
setInterval(async () => {
  await sendGuardHeartbeat();
  await syncGuardCookies();
}, 10000);
