const mongoose = require("mongoose");

const CustomPatternSchema = new mongoose.Schema(
  {
    label:   { type: String, required: true, trim: true },
    pattern: { type: String, required: true, trim: true },
    source:  { type: String, enum: ["company", "general"], default: "company" },
  },
  { _id: false }
);

const ApiKeySchema = new mongoose.Schema(
  {
    label:          { type: String, required: true, trim: true },
    encryptedValue: { type: String, required: true },
    hash:           { type: String, required: true },   // ← SHA-256, sent to extension
    hint:           { type: String, required: true },
    auto_detected:  { type: Boolean, default: false },
    source_url:     { type: String },
  },
  { _id: true }
);

const SensitiveNumberSchema = new mongoose.Schema(
  {
    label:          { type: String, required: true, trim: true },
    type:           { type: String, enum: ["phone", "account_number", "tax_id", "other"], required: true },
    encryptedValue: { type: String, required: true },
    hash:           { type: String, required: true },   // ← SHA-256, sent to extension
    hint:           { type: String, required: true },
  },
  { _id: true }
);

const RuleSchema = new mongoose.Schema(
  {
    orgId:            { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    domains:          { type: [String], default: [], set: (arr) => arr.map((d) => d.toLowerCase().trim()) },
    keywords:         { type: [String], default: [], set: (arr) => arr.map((k) => k.trim()) },
    customPatterns:   { type: [CustomPatternSchema],    default: [] },
    apiKeys:          { type: [ApiKeySchema],           default: [] },
    sensitiveNumbers: { type: [SensitiveNumberSchema],  default: [] },
    monitoredApps:    { type: [String],                 default: ["ChatGPT", "Notepad"] },
    sensitivityTiers: {
      type: Map,
      of: String,
      default: {
        REGISTER_ADDR: "silent_redact",
        ELECTRICAL_PARAM: "silent_redact",
        DEVICE_TYPE: "silent_redact",
        LOCATION: "silent_redact",
        NETWORK_ADDR: "silent_redact",
        CREDENTIAL: "hard_block",
        PII: "silent_redact",
      },
    },
    rolePolicies: [
      {
        role: { type: String, required: true },
        allowedActions: [String],
        strictness: { type: String, enum: ["normal", "strict", "paranoid"], default: "normal" },
      },
    ],
    platformPolicies: [
      {
        platform: { type: String, required: true },
        actionOverride: { type: String, enum: ["allow", "silent_redact", "block"], default: "silent_redact" },
      },
    ],
    killSwitch: {
      enabled: { type: Boolean, default: false },
      activatedAt: { type: Date },
      reason: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Rule", RuleSchema);