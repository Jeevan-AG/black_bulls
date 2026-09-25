// ─── Vantix — SessionGraph Mongoose Model ──────────────────────────────────────
// Persists cumulative cross-session graph analytics per user/org.
// Tracks slow-leak attack indicators over time.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require("mongoose");

const SessionGraphSchema = new mongoose.Schema(
  {
    orgId: {
      type: String,
      default: "demo-org",
      index: true,
    },
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userEmail: {
      type: String,
      default: "john.engineer@acme.com",
    },
    department: {
      type: String,
      default: "OT Team, Site B",
    },
    coverageMap: {
      type: Map,
      of: Number,
      default: {},
    },
    promptCount: {
      type: Number,
      default: 0,
    },
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    anomalyTriggered: {
      type: Boolean,
      default: false,
    },
    anomalyReport: {
      type: String,
      default: null,
    },
    firstPromptAt: {
      type: Date,
      default: Date.now,
    },
    lastPromptAt: {
      type: Date,
      default: Date.now,
    },
    promptHistory: [
      {
        promptIndex: Number,
        timestamp: Date,
        topicsTouched: [String],
        promptRisk: Number,
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("SessionGraph", SessionGraphSchema);
