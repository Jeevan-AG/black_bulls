// ─── Vantix SDK for Node.js / JavaScript ─────────────────────────────────────
// Official developer SDK for integrating Vantix Silent AI Data Firewall into
// backend applications, agentic workflows, and microservices.
//
// Usage:
//   const { VantixClient } = require("vantix-sdk");
//   const vantix = new VantixClient({ endpoint: "http://localhost:5000", apiKey: "..." });
//   const result = await vantix.chat("What is the register map for 0x4001?", { userId: "eng-1" });
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const http = require("http");
const https = require("https");
const { URL } = require("url");

class VantixClient {
  /**
   * @param {Object} options
   * @param {string} [options.endpoint="http://localhost:5000"] - Vantix gateway URL
   * @param {string} [options.apiKey=""] - Organization API key
   * @param {string} [options.orgId="default-org"]
   * @param {number} [options.timeoutMs=30000]
   */
  constructor(options = {}) {
    this.endpoint = (options.endpoint || process.env.VANTIX_GATEWAY_URL || "http://localhost:5000").replace(/\/$/, "");
    this.apiKey = options.apiKey || process.env.VANTIX_API_KEY || "";
    this.orgId = options.orgId || process.env.VANTIX_ORG_ID || "default-org";
    this.timeoutMs = options.timeoutMs || 30000;
  }

  /**
   * Send a prompt through the Vantix 7-step silent firewall pipeline.
   *
   * @param {string} prompt - Raw outbound prompt from employee/application
   * @param {Object} [meta={}]
   * @param {string} [meta.userId="anonymous"]
   * @param {string} [meta.userEmail=""]
   * @param {string} [meta.sessionId=""]
   * @param {string} [meta.appId="custom-app"]
   * @returns {Promise<{ success: boolean, response: string, meta: Object }>}
   */
  async chat(prompt, meta = {}) {
    if (!prompt || typeof prompt !== "string") {
      throw new Error("[VantixSDK] prompt must be a non-empty string");
    }

    const payload = JSON.stringify({
      prompt,
      userId: meta.userId || "anonymous",
      userEmail: meta.userEmail || "",
      sessionId: meta.sessionId || `sess-${Date.now()}`,
      orgId: this.orgId,
      appId: meta.appId || "vantix-js-sdk",
    });

    const parsedUrl = new URL(`${this.endpoint}/api/vantix/chat`);
    const isHttps = parsedUrl.protocol === "https:";
    const transport = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const req = transport.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
            ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
            "X-Vantix-SDK": "nodejs-v2.0",
          },
          timeout: this.timeoutMs,
        },
        (res) => {
          let rawData = "";
          res.on("data", (chunk) => {
            rawData += chunk;
          });
          res.on("end", () => {
            try {
              const parsed = JSON.parse(rawData);
              resolve(parsed);
            } catch (err) {
              reject(new Error(`[VantixSDK] Invalid JSON response: ${rawData}`));
            }
          });
        }
      );

      req.on("error", (err) => {
        reject(new Error(`[VantixSDK] Request failed: ${err.message}`));
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("[VantixSDK] Request timed out"));
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Check health and TEE attestation of the connected Vantix gateway.
   */
  async getAttestation() {
    const parsedUrl = new URL(`${this.endpoint}/api/vantix/attestation`);
    const transport = parsedUrl.protocol === "https:" ? https : http;

    return new Promise((resolve, reject) => {
      transport.get(parsedUrl.toString(), (res) => {
        let rawData = "";
        res.on("data", (chunk) => { rawData += chunk; });
        res.on("end", () => {
          try {
            resolve(JSON.parse(rawData));
          } catch (e) {
            reject(e);
          }
        });
      }).on("error", reject);
    });
  }
}

// Convenience top-level singleton
const defaultClient = new VantixClient();

module.exports = {
  VantixClient,
  chat: (prompt, meta) => defaultClient.chat(prompt, meta),
  getAttestation: () => defaultClient.getAttestation(),
};
