// ─── Vantix Verification Test Suite ──────────────────────────────────────────
// Comprehensive automated test suite validating:
//   1. Sublayer A: Rule-Based Industrial Pattern Detection
//   2. Sublayer B: Contextual Industrial NLP Scoring
//   3. Sublayer C: Multi-Factor Combination Risk Multipliers
//   4. Software TEE Enclave: Ephemeral Token Tables & Crypto Signatures
//   5. Cross-Session Anomaly Detection: 6-Stage Slow-Leak Reconstruction
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const assert = require("assert");
const { analyzePrompt, SUBLAYER_A_PATTERNS } = require("./industrialDetector");
const tee = require("./teeEnclave");
const sessionGraph = require("./sessionGraph");

console.log("═════════════════════════════════════════════════════════════");
console.log("  VANTIX ENGINE AUTOMATED VERIFICATION SUITE");
console.log("═════════════════════════════════════════════════════════════\n");

let passed = 0;
let total = 0;

function it(desc, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✕ ${desc}`);
    console.error(`    Error: ${err.message}`);
  }
}

// ── 1. Sublayer A Tests ──────────────────────────────────────────────────────
console.log("─── Phase 1: Sublayer A Industrial Pattern Detection ───");

it("detects Modbus register addresses (hex and standard)", () => {
  const res1 = analyzePrompt("Set register 0x4001 to 100");
  assert(res1.categoriesFound.includes("REGISTER_ADDR"), "Missing REGISTER_ADDR");

  const res2 = analyzePrompt("Holding register 40050 has value 20");
  assert(res2.categoriesFound.includes("REGISTER_ADDR"), "Missing standard register");
});

it("detects electrical parameters (voltage, frequency, amperage)", () => {
  const res = analyzePrompt("Operating at 230V, 50Hz, 15A threshold");
  assert(res.categoriesFound.includes("ELECTRICAL_PARAM"), "Missing ELECTRICAL_PARAM");
  assert(res.detections.some((d) => d.value.includes("230V")));
});

it("detects SCADA / ICS controllers and device types", () => {
  const res = analyzePrompt("Connecting to Mark VIe turbine controller and RTU");
  assert(res.categoriesFound.includes("DEVICE_TYPE"), "Missing DEVICE_TYPE");
});

it("detects physical industrial site locations", () => {
  const res = analyzePrompt("Inspecting equipment at plant site B substation");
  assert(res.categoriesFound.includes("LOCATION"), "Missing LOCATION");
});

it("detects internal industrial network addresses", () => {
  const res = analyzePrompt("DCS server IP is 192.168.1.50 and PLC is 10.0.0.1");
  assert(res.categoriesFound.includes("NETWORK_ADDR"), "Missing NETWORK_ADDR");
});

it("flags live credentials with high isolation risk", () => {
  const res = analyzePrompt("API key is sk-ant-api03-1234567890abcdef1234567890abcdef");
  assert(res.categoriesFound.includes("CREDENTIAL"), "Missing CREDENTIAL");
  const cred = res.detections.find((d) => d.category === "CREDENTIAL");
  assert(cred.isolationRisk >= 85, "Expected high isolation risk for credential");
});


// ── 2. Sublayer B & C Tests ──────────────────────────────────────────────────
console.log("\n─── Phase 1 & 5: Sublayer B Context & Sublayer C Combinations ───");

it("calculates Section 06 spec combination risk multiplier", () => {
  // Exact example from Section 06:
  // "My Modbus register 0x4001 is holding 230V threshold for the turbine controller at plant site B. Why is it tripping?"
  const prompt = "My Modbus register 0x4001 is holding 230V threshold for the turbine controller at plant site B. Why is it tripping?";
  const res = analyzePrompt(prompt);

  assert(res.categoriesFound.includes("REGISTER_ADDR"), "Missing REGISTER_ADDR");
  assert(res.categoriesFound.includes("ELECTRICAL_PARAM"), "Missing ELECTRICAL_PARAM");
  assert(res.categoriesFound.includes("DEVICE_TYPE"), "Missing DEVICE_TYPE");
  assert(res.categoriesFound.includes("LOCATION"), "Missing LOCATION");

  // Combination score should be critically elevated
  assert(res.overallRisk >= 90, `Expected critical risk >= 90, got ${res.overallRisk}`);
  assert(res.combinations.length >= 4, "Expected multiple combination triggers");
});

it("keeps single isolated queries at low risk", () => {
  const res = analyzePrompt("What are the best practices for steam turbine maintenance?");
  assert(res.overallRisk < 40, `Expected low risk < 40, got ${res.overallRisk}`);
});


// ── 3. Phase 2: Software TEE Enclave ─────────────────────────────────────────
console.log("\n─── Phase 2: TEE Security Core & Ephemeral Enclave ───");

it("creates ephemeral token table and sanitizes prompt with semantic tokens", () => {
  const prompt = "Please check 0x4001 on turbine controller at site B";
  const detection = analyzePrompt(prompt);
  const sessionId = "test-tee-sess-1";

  const tokenTable = tee.createTokenTable(sessionId, detection.detections);
  assert(tokenTable.size > 0, "Token table is empty");

  const sanitized = tee.sanitizePrompt(prompt, tokenTable);
  assert(!sanitized.includes("0x4001"), "Raw register address leaked in sanitized prompt");
  assert(sanitized.includes("[REGISTER_ADDR]"), "Missing semantic placeholder [REGISTER_ADDR]");

  // Response restoration
  const simulatedAIResponse = "The [REGISTER_ADDR] on [DEVICE_TYPE] at [LOCATION] is operating normally.";
  const restored = tee.restoreResponse(sessionId, simulatedAIResponse);
  assert(restored.includes("0x4001"), "Failed to restore real register address");

  // Enclave memory zeroing
  tee.destroySession(sessionId);
  assert.strictEqual(tee.getTokenTable(sessionId), null, "Token table was not destroyed");
});

it("generates and verifies HMAC-SHA256 cryptographic audit signature", () => {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    userId: "john.engineer@acme.com",
    riskScore: 94,
    actionTaken: "silent_redact",
  };
  const signature = tee.signAuditEntry(auditEntry);
  assert(typeof signature === "string" && signature.length === 64, "Invalid signature length");

  const isValid = tee.verifyAuditSignature(auditEntry, signature);
  assert.strictEqual(isValid, true, "Signature verification failed");

  // Tamper detection test
  const tamperedEntry = { ...auditEntry, riskScore: 10 };
  const isTamperedValid = tee.verifyAuditSignature(tamperedEntry, signature);
  assert.strictEqual(isTamperedValid, false, "Tampered entry was incorrectly validated");
});


// ── 4. Phase 3: Cross-Session Anomaly Detection ──────────────────────────────
console.log("\n─── Phase 3: Cross-Session Graph & Slow Leak Detection ───");

it("tracks cumulative progression across the 6-step demo and triggers critical anomaly on prompt 6", () => {
  const userId = "test-slow-leak-user";
  const userEmail = "john.engineer@acme.com";
  sessionGraph.resetSessionGraph(userId);

  const prompts = [
    "What are the best practices for industrial turbine maintenance?",
    "What Modbus holding registers (e.g. 0x4001) are typically used for vibration?",
    "Can you show typical register mappings for a Mark VIe controller at 230V?",
    "We have a substation at plant site B with IP 192.168.1.50. How should it route to DCS?",
    "Here is the network topology connecting SCADA server to PLC 10.0.0.1. Any bottlenecks?",
    "Emergency shutdown procedure for turbine controller when vibration exceeds 15mm/s threshold at site B?",
  ];

  let lastResult = null;
  const riskScores = [];

  for (let i = 0; i < prompts.length; i++) {
    const detection = analyzePrompt(prompts[i]);
    lastResult = sessionGraph.updateSessionGraph(userId, userEmail, detection);
    riskScores.push(lastResult.riskScore);
  }

  console.log(`    Risk Score Progression: ${riskScores.join(" → ")}`);
  assert(riskScores[0] <= 40, "Prompt 1 should be low/baseline risk");
  assert(riskScores[riskScores.length - 1] >= 90, "Prompt 6 must reach critical risk >= 90");
  assert.strictEqual(lastResult.anomalyTriggered, true, "Anomaly alert must trigger by prompt 6");
  assert(lastResult.anomalyReport !== null, "Anomaly report must be generated");
  assert(lastResult.anomalyReport.includes("ANOMALY DETECTED"), "Report must include spec header");

  // Clean up
  sessionGraph.resetSessionGraph(userId);
});

// ── Summary ──────────────────────────────────────────────────────────────────
console.log("\n═════════════════════════════════════════════════════════════");
console.log(`  TEST RESULTS: ${passed}/${total} TESTS PASSED`);
console.log("═════════════════════════════════════════════════════════════\n");

if (passed !== total) {
  process.exit(1);
}
