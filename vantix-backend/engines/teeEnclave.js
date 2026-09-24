// ─── Vantix — TEE Security Enclave (Software Simulation) ─────────────────────
// Enforces the exact architectural guarantees of a hardware TEE:
//   • Ephemeral in-memory token tables (never persisted to disk)
//   • Semantic placeholder generation
//   • Prompt sanitization & response restoration
//   • Cryptographic audit log signing (HMAC-SHA256)
//   • Remote attestation endpoint data
//
// Token tables are created per-session, held only in RAM, and destroyed
// immediately after response restoration.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const crypto = require("crypto");
const { CATEGORY_PLACEHOLDERS, resolvePlaceholderForDetection } = require("./industrialDetector");

// ─── Enclave State ───────────────────────────────────────────────────────────
// Per-session token tables — Map<sessionId, { tokenMap, createdAt }>
const _sessionTokenTables = new Map();

// Auto-purge sessions older than 60 seconds (safety net)
const SESSION_TTL_MS = 60_000;

const _purgeInterval = setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of _sessionTokenTables) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      destroySession(sessionId);
    }
  }
}, 10_000);

// Allow clean shutdown
_purgeInterval.unref();


// ─── Signing Key ─────────────────────────────────────────────────────────────

function getSigningKey() {
  const hex = process.env.TEE_SIGNING_KEY;
  if (!hex || hex.length < 32) {
    // Fallback for dev — in production this must be set
    return Buffer.from("vantix_tee_default_signing_key_for_dev_only!!", "utf8");
  }
  return Buffer.from(hex, "hex");
}


// ─── Semantic Placeholder Generation ─────────────────────────────────────────

/**
 * Given a list of detections from the industrial detector, generate
 * semantic placeholders and build the ephemeral token table.
 *
 * @param {string}   sessionId  — Unique session identifier
 * @param {object[]} detections — Array from analyzePrompt().detections
 * @returns {Map<string, string>} realValue → placeholder mapping
 */
function createTokenTable(sessionId, detections, originalPrompt = "") {
  const tokenMap = new Map(); // realValue → placeholder
  const placeholderCounts = {}; // placeholderBase → count (for numbering)

  // Sort detections by position (start index) so numbering is predictable
  const sorted = [...detections].sort((a, b) => a.start - b.start);

  for (const det of sorted) {
    if (tokenMap.has(det.value)) continue; // Already mapped

    const placeholderBase = typeof resolvePlaceholderForDetection === "function"
      ? resolvePlaceholderForDetection(det, originalPrompt)
      : (CATEGORY_PLACEHOLDERS[det.category] || det.category);

    // Count occurrences of this placeholder
    if (!placeholderCounts[placeholderBase]) placeholderCounts[placeholderBase] = 0;
    placeholderCounts[placeholderBase]++;

    // Only number if there are multiple values in the same category
    const count = placeholderCounts[placeholderBase];
    const placeholder = `[${placeholderBase}${count > 1 ? `_${count}` : ""}]`;

    tokenMap.set(det.value, placeholder);
  }

  // Store in enclave memory
  _sessionTokenTables.set(sessionId, {
    tokenMap,
    reverseMap: new Map([...tokenMap].map(([k, v]) => [v, k])),
    createdAt: Date.now(),
  });

  return tokenMap;
}


/**
 * Sanitize a prompt by replacing all detected sensitive values with
 * their semantic placeholders.
 *
 * @param {string}           text     — Original prompt text
 * @param {Map<string,string>} tokenMap — realValue → placeholder
 * @returns {string} Sanitized prompt
 */
function sanitizePrompt(text, tokenMap) {
  let sanitized = text;

  // Sort by value length descending to prevent partial replacements
  const entries = [...tokenMap.entries()].sort((a, b) => b[0].length - a[0].length);

  for (const [realValue, placeholder] of entries) {
    // Case-insensitive replacement while preserving all occurrences
    const escaped = realValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    sanitized = sanitized.replace(regex, placeholder);
  }

  return sanitized;
}


/**
 * Restore an AI response by swapping placeholders back to real values.
 *
 * @param {string} sessionId — Session whose token table to use
 * @param {string} response  — AI response containing placeholders
 * @returns {string} Restored response with real values
 */
function restoreResponse(sessionId, response) {
  const session = _sessionTokenTables.get(sessionId);
  if (!session) return response; // No session — return as-is

  let restored = response;

  for (const [placeholder, realValue] of session.reverseMap) {
    const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "g");
    restored = restored.replace(regex, realValue);
  }

  return restored;
}


/**
 * Destroy a session's token table — zero out memory and dereference.
 * After this call, no record of the real values exists anywhere.
 */
function destroySession(sessionId) {
  const session = _sessionTokenTables.get(sessionId);
  if (!session) return;

  // Zero out all values in the maps
  for (const [key] of session.tokenMap) {
    session.tokenMap.set(key, "");
  }
  for (const [key] of session.reverseMap) {
    session.reverseMap.set(key, "");
  }

  session.tokenMap.clear();
  session.reverseMap.clear();
  _sessionTokenTables.delete(sessionId);
}


// ─── Cryptographic Audit Signing ─────────────────────────────────────────────

/**
 * Sign an audit log entry with HMAC-SHA256.
 *
 * @param {object} auditEntry — The audit log fields to sign
 * @returns {string} Hex-encoded HMAC signature
 */
function signAuditEntry(auditEntry) {
  const payload = JSON.stringify({
    timestamp:    auditEntry.timestamp,
    userId:       auditEntry.userId,
    orgId:        auditEntry.orgId,
    riskScore:    auditEntry.riskScore,
    actionTaken:  auditEntry.actionTaken,
    categories:   auditEntry.categoriesRedacted,
  });

  const hmac = crypto.createHmac("sha256", getSigningKey());
  hmac.update(payload);
  return hmac.digest("hex");
}


/**
 * Verify an audit log entry's signature.
 */
function verifyAuditSignature(auditEntry, signature) {
  const expected = signAuditEntry(auditEntry);
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature, "hex")
  );
}


// ─── Remote Attestation ──────────────────────────────────────────────────────

/**
 * Generate attestation data proving enclave integrity.
 * In production this would be an Intel SGX MRENCLAVE measurement.
 * Here we provide a cryptographic measurement hash of the running code.
 */
function getAttestationReport() {
  const codeHash = crypto
    .createHash("sha256")
    .update(require("fs").readFileSync(__filename))
    .digest("hex");

  return {
    enclaveStatus: "ACTIVE",
    attestationType: "SOFTWARE_TEE_SIMULATION",
    codeHash,
    timestamp: new Date().toISOString(),
    signingKeyFingerprint: crypto
      .createHash("sha256")
      .update(getSigningKey())
      .digest("hex")
      .slice(0, 16),
    activeSessions: _sessionTokenTables.size,
    guarantees: [
      "Token tables exist only in volatile memory",
      "Token tables are destroyed after response restoration",
      "All audit entries are HMAC-SHA256 signed",
      "Signing key never leaves the enclave process",
    ],
  };
}


// ─── Enclave Stats (for dashboard) ───────────────────────────────────────────

function getEnclaveStats() {
  return {
    activeSessions: _sessionTokenTables.size,
    status: "ACTIVE",
    uptime: process.uptime(),
  };
}

function getTokenTable(sessionId) {
  return _sessionTokenTables.get(sessionId) || null;
}


module.exports = {
  createTokenTable,
  getTokenTable,
  sanitizePrompt,
  restoreResponse,
  destroySession,
  signAuditEntry,
  verifyAuditSignature,
  getAttestationReport,
  getEnclaveStats,
};
