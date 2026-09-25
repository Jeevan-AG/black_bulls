// ─── Vantix — Cryptographically Signed AuditLog Model ──────────────────────────
// Represents a tamper-evident audit record of every intercepted prompt.
// Signed inside the software TEE enclave using HMAC-SHA256.
//
// PRIVACY BY ARCHITECTURE:
//   Contains only sanitized metadata, categories, scores, and cryptographic proofs.
//   RAW sensitive data (passwords, registers, tokens) is NEVER saved here.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema(
  {
    orgId: {
      type: String,
      default: "demo-org",
      index: true,
    },
    userId: {
      type: String,
      default: "demo-engineer",
      index: true,
    },
    userEmail: {
      type: String,
      default: "john.engineer@acme.com",
    },
    userRole: {
      type: String,
      default: "OT_ENGINEER",
    },
    application: {
      type: String,
      default: "ai-proxy-gateway",
    },
    aiPlatform: {
      type: String,
      default: "groq-llama-3.3",
    },
    promptSnippet: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    actionTaken: {
      type: String,
      enum: ["silent_redact", "combination_strip", "hard_block", "monitor", "pass"],
      default: "silent_redact",
      index: true,
    },
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    categoriesRedacted: {
      type: [String],
      default: [],
    },
    detectionCount: {
      type: Number,
      default: 0,
    },
    combinationCount: {
      type: Number,
      default: 0,
    },
    policyRuleApplied: {
      type: String,
      default: "DEFAULT_INDUSTRIAL_SAFETY",
    },
    cryptoSignature: {
      type: String,
      required: true,
    },
    signatureAlgorithm: {
      type: String,
      default: "HMAC-SHA256",
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

AuditLogSchema.index({ orgId: 1, timestamp: -1 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);
