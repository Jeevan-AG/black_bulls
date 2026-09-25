// ─── Vantix Network Bridge — Certificate Authority Manager ───────────────────
// Manages local Root CA and dynamic on-the-fly certificate generation for
// intercepted AI domains.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const CA_DIR = path.join(__dirname, "ca");
const CA_KEY = path.join(CA_DIR, "vantix-ca.key");
const CA_CRT = path.join(CA_DIR, "vantix-ca.crt");
const CERT_CACHE_DIR = path.join(CA_DIR, "certs");

// In-memory certificate cache: hostname → { key, cert }
const certCache = new Map();

function ensureCaDirs() {
  if (!fs.existsSync(CA_DIR)) fs.mkdirSync(CA_DIR, { recursive: true });
  if (!fs.existsSync(CERT_CACHE_DIR)) fs.mkdirSync(CERT_CACHE_DIR, { recursive: true });
}

// Preload all cached host certs into memory at startup for zero-latency (<0.1ms) TLS handshakes
function preloadCerts() {
  ensureCaDirs();
  try {
    const files = fs.readdirSync(CERT_CACHE_DIR);
    for (const f of files) {
      if (f.endsWith(".crt")) {
        const host = f.slice(0, -4);
        const keyPath = path.join(CERT_CACHE_DIR, `${host}.key`);
        const crtPath = path.join(CERT_CACHE_DIR, f);
        if (fs.existsSync(keyPath)) {
          certCache.set(host, {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(crtPath),
          });
        }
      }
    }
  } catch (e) {}
}
preloadCerts();

/**
 * Generates Root CA if it doesn't already exist.
 */
function getOrCreateRootCa() {
  ensureCaDirs();

  if (fs.existsSync(CA_KEY) && fs.existsSync(CA_CRT)) {
    return {
      keyPath: CA_KEY,
      crtPath: CA_CRT,
      key: fs.readFileSync(CA_KEY),
      cert: fs.readFileSync(CA_CRT),
    };
  }

  console.log("[Vantix-Bridge] Generating Vantix Enterprise Root CA...");
  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${CA_KEY}" -out "${CA_CRT}" -days 1095 -nodes -subj "/CN=Vantix Enterprise Root CA/O=Vantix Security/C=US"`,
      { stdio: "ignore" }
    );
    console.log(`[Vantix-Bridge] ✓ Root CA created at ${CA_CRT}`);
    return {
      keyPath: CA_KEY,
      crtPath: CA_CRT,
      key: fs.readFileSync(CA_KEY),
      cert: fs.readFileSync(CA_CRT),
    };
  } catch (err) {
    throw new Error(`Failed to generate Root CA: ${err.message}`);
  }
}

/**
 * Dynamically generates or retrieves cached certificate for a target hostname.
 */
function getCertForHost(hostname) {
  const cleanHost = hostname.split(":")[0].toLowerCase();

  if (certCache.has(cleanHost)) {
    return certCache.get(cleanHost);
  }

  ensureCaDirs();
  const hostKeyPath = path.join(CERT_CACHE_DIR, `${cleanHost}.key`);
  const hostCrtPath = path.join(CERT_CACHE_DIR, `${cleanHost}.crt`);

  if (fs.existsSync(hostKeyPath) && fs.existsSync(hostCrtPath)) {
    const creds = {
      key: fs.readFileSync(hostKeyPath),
      cert: fs.readFileSync(hostCrtPath),
    };
    certCache.set(cleanHost, creds);
    return creds;
  }

  const { keyPath: caKey, crtPath: caCrt } = getOrCreateRootCa();
  const hostCsrPath = path.join(CERT_CACHE_DIR, `${cleanHost}.csr`);
  const hostExtPath = path.join(CERT_CACHE_DIR, `${cleanHost}.ext`);

  const extConfig = `
[v3_req]
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = ${cleanHost}
DNS.2 = *.${cleanHost}
`;
  fs.writeFileSync(hostExtPath, extConfig);

  try {
    // Generate CSR
    execSync(
      `openssl req -new -newkey rsa:2048 -nodes -keyout "${hostKeyPath}" -out "${hostCsrPath}" -subj "/CN=${cleanHost}"`,
      { stdio: "ignore" }
    );

    // Sign with CA including SAN extension for modern browser compliance
    execSync(
      `openssl x509 -req -in "${hostCsrPath}" -CA "${caCrt}" -CAkey "${caKey}" -CAcreateserial -out "${hostCrtPath}" -days 365 -extfile "${hostExtPath}" -extensions v3_req`,
      { stdio: "ignore" }
    );

    // Clean up temporary CSR and ext files
    if (fs.existsSync(hostCsrPath)) fs.unlinkSync(hostCsrPath);
    if (fs.existsSync(hostExtPath)) fs.unlinkSync(hostExtPath);

    try {
      fs.chmodSync(hostKeyPath, 0o644);
      fs.chmodSync(hostCrtPath, 0o644);
    } catch (e) {}

    const creds = {
      key: fs.readFileSync(hostKeyPath),
      cert: fs.readFileSync(hostCrtPath),
    };
    certCache.set(cleanHost, creds);
    return creds;
  } catch (err) {
    throw new Error(`Failed to generate cert for ${cleanHost}: ${err.message}`);
  }
}

module.exports = {
  getOrCreateRootCa,
  getCertForHost,
  CA_CRT,
  CA_KEY,
};
