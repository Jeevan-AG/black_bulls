#!/usr/bin/env node

// ─── Vantix Network Bridge CLI ───────────────────────────────────────────────
// Usage:
//   node bridgeCli.js start
//   node bridgeCli.js status
//   node bridgeCli.js test
//   node bridgeCli.js setup-cert
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const { createBridgeServer, DEFAULT_PORT, getSystemIdentity } = require("./bridgeProxy");
const { getOrCreateRootCa, CA_CRT } = require("./certManager");
const http = require("http");
const https = require("https");
const { execSync } = require("child_process");
const fs = require("fs");

const command = process.argv[2] || "status";

switch (command) {
  case "start": {
    const port = parseInt(process.env.VANTIX_BRIDGE_PORT) || DEFAULT_PORT;
    const bridge = createBridgeServer({ port });
    const identity = getSystemIdentity();

    bridge.start(() => {
      console.log("═════════════════════════════════════════════════════════════");
      console.log("  VANTIX NETWORK BRIDGE — Active & Intercepting");
      console.log("═════════════════════════════════════════════════════════════");
      console.log(`  Bridge Proxy:    http://127.0.0.1:${port}`);
      console.log(`  Identified User: ${identity.user} (${identity.host})`);
      console.log(`  Monitored AI:    OpenAI, Anthropic, ChatGPT, Gemini, Groq`);
      console.log(`  Admin Dashboard: http://localhost:5173`);
      console.log("─────────────────────────────────────────────────────────────");
      console.log("  To route your terminal/apps through this bridge, run:");
      console.log(`    export HTTPS_PROXY=http://127.0.0.1:${port}`);
      console.log(`    export HTTP_PROXY=http://127.0.0.1:${port}`);
      console.log("═════════════════════════════════════════════════════════════\n");
    });
    break;
  }

  case "status": {
    const identity = getSystemIdentity();
    const caExists = fs.existsSync(CA_CRT);

    console.log("═════════════════════════════════════════════════════════════");
    console.log("  VANTIX NETWORK BRIDGE — System Status");
    console.log("═════════════════════════════════════════════════════════════");
    console.log(`  Local OS User:   ${identity.user}`);
    console.log(`  Device Hostname: ${identity.host}`);
    console.log(`  Platform:        ${identity.platform}`);
    console.log(`  Default Port:    ${DEFAULT_PORT}`);
    console.log(`  Root CA Cert:    ${caExists ? "GENERATED ✓" : "NOT FOUND (Run setup-cert)"}`);
    if (caExists) console.log(`  Cert Path:       ${CA_CRT}`);
    console.log("═════════════════════════════════════════════════════════════");
    break;
  }

  case "setup-cert": {
    console.log("[Vantix-Bridge] Generating & configuring Root CA...");
    getOrCreateRootCa();

    console.log("\n[Vantix-Bridge] To install the Root CA on your Linux machine (one-time):");
    console.log(`  sudo cp "${CA_CRT}" /usr/local/share/ca-certificates/vantix-ca.crt`);
    console.log("  sudo update-ca-certificates\n");
    console.log("For Chrome / Brave / Edge directly:");
    console.log(`  Settings → Privacy and Security → Security → Manage Certificates → Authorities → Import: ${CA_CRT}`);
    break;
  }

  case "send":
  case "prompt":
  case "test": {
    const userPrompt = process.argv.slice(3).join(" ").trim();
    if (!userPrompt) {
      console.log("Usage:");
      console.log('  ./vantix-protect.sh send "Your actual AI prompt here"');
      console.log("\nExamples:");
      console.log('  ./vantix-protect.sh send "Help debug AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"');
      console.log('  ./vantix-protect.sh send "Check Modbus register 0x4001 for 230V at plant site B"');
      break;
    }

    const identity = getSystemIdentity();
    console.log("═════════════════════════════════════════════════════════════");
    console.log("  VANTIX LIVE INTERCEPTION — Active Inspection");
    console.log("═════════════════════════════════════════════════════════════");
    console.log(`  Identified User:   ${identity.user}@${identity.host}`);
    console.log(`  Original Prompt:   "${userPrompt}"`);
    console.log("─────────────────────────────────────────────────────────────");

    const payload = JSON.stringify({
      prompt: userPrompt,
      userId: identity.user,
      userEmail: identity.email,
      sessionId: `live-${Date.now()}`,
    });

    const req = http.request(
      "http://127.0.0.1:5000/api/vantix/chat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Vantix-User": identity.user,
          "X-Vantix-Host": identity.host,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            const isBlocked = json.blocked || json.meta?.action === "hard_block";
            const action = isBlocked ? "hard_block" : (json.meta?.action || "silent_redact");
            const risk = json.meta?.riskScore !== undefined ? json.meta.riskScore : (json.riskScore || 0);
            const count = json.meta?.detectionsCount !== undefined ? json.meta.detectionsCount : (isBlocked ? 1 : 0);
            const categories = json.meta?.categoriesRedacted || [];

            console.log("\n🛡  VANTIX INTERCEPTION & INSPECTION RESULT:");
            if (isBlocked) {
              console.log("  ╔═════════════════════════════════════════════════════════════╗");
              console.log("  ║ ⛔ SECURITY ENFORCEMENT: HARD BLOCK                         ║");
              console.log("  ║    AI request terminated before leaving this device         ║");
              console.log("  ╚═════════════════════════════════════════════════════════════╝");
            } else {
              console.log("  ╔═════════════════════════════════════════════════════════════╗");
              console.log("  ║ ⚡ TEE SILENT REDACTION: ACTIVE                             ║");
              console.log("  ║    Sensitive data sanitized, sent to AI, restored live      ║");
              console.log("  ╚═════════════════════════════════════════════════════════════╝");
            }
            console.log(`  Identified User:     ${identity.user} on ${identity.host}`);
            console.log(`  Security Action:     ${action.toUpperCase()}`);
            console.log(`  Risk Score:          ${risk}/100`);
            console.log(`  Detections Count:    ${count}`);
            console.log(`  Categories Detected: ${categories.join(", ") || (isBlocked ? "CREDENTIAL" : "None")}`);
            console.log(`  Processing Latency:  ${json.processingTime || 0}ms`);

            if (isBlocked) {
              console.log("\n🚫 Block Reason:");
              console.log(`  ${json.message || "Live credentials detected by enterprise firewall policy."}`);
            } else {
              console.log("\n🤖 Restored AI Response (Transparent to user):");
              console.log(`  ${json.response || "No response"}`);
            }
            console.log("\n✓ Broadcasted in real-time to Admin Dashboard (http://localhost:5173)!");
            console.log("═════════════════════════════════════════════════════════════\n");
          } catch (e) {
            console.error("Failed to parse response:", data);
          }
        });
      }
    );

    req.on("error", (err) => {
      console.error("Failed to reach Vantix backend on port 5000. Error:", err.message);
    });

    req.write(payload);
    req.end();
    break;
  }

  default:
    console.log("Usage: node bridgeCli.js [start|status|setup-cert|send <prompt>]");
}
