// ─── Vantix — Smart Context Scoring Layer ────────────────────────────────────
// Reads the FULL text context before deciding whether detections are genuine
// threats or benign/test/dummy data that should NOT be redacted.
//
// Key Capabilities:
//   1. Detects "dummy/test/sample/example" qualifiers near matched values
//   2. Detects mathematical/arithmetic context ("add these numbers", "sum", "multiply")
//   3. Detects explicitly safe framing ("for testing", "placeholder", "fictional")
//   4. Scores each detection individually based on surrounding context
//   5. Returns per-detection verdict: GENUINE, BENIGN, or UNCERTAIN
//
// Integration: Called AFTER industrialDetector.analyzePrompt() and BEFORE
//              TEE redaction. Filters out benign detections so they aren't redacted.
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

// ─── Context Window Size (chars around each detection to analyze) ────────────
const CONTEXT_WINDOW = 120;

// ─── Benign Indicator Patterns ───────────────────────────────────────────────
// These patterns, when found near a detection, suggest the data is NOT real.

const BENIGN_QUALIFIERS = [
  // Explicit test/dummy/sample markers
  /\b(?:dummy|fake|test|sample|example|placeholder|mock|demo|fictional|hypothetical|made[\s-]?up|not[\s-]?real|illustrat(?:ive|ion)|tutorial|practice|sandbox)\b/i,
  // Negation of ownership ("not my", "isn't real")
  /\b(?:not\s+(?:my|our|a\s+real|an?\s+actual)|isn'?t\s+(?:real|actual|my)|don'?t\s+(?:use|share)\s+(?:this|that|my))\b/i,
  // Explicit safe framing
  /\b(?:for\s+(?:testing|demonstration|illustration|educational\s+purposes|example)|just\s+(?:an?\s+example|testing|a\s+demo|a\s+test))\b/i,
  // Random/generated markers
  /\b(?:randomly?\s+generated|auto[\s-]?generated|generated\s+(?:by|for|as)|lorem\s+ipsum)\b/i,
];

// ─── Mathematical / Arithmetic Context ──────────────────────────────────────
// When user says "add these numbers" or "calculate", digit sequences that
// LOOK like phone numbers are likely just numbers for arithmetic.

const MATH_CONTEXT_PATTERNS = [
  /\b(?:add|sum|subtract|multiply|divide|calculate|compute|total|average|mean|plus|minus|times)\b/i,
  /\b(?:what\s+is|find\s+the|how\s+much|result\s+of|equation|arithmetic|math)\b/i,
  /\b(?:addition|subtraction|multiplication|division|remainder|modulo|modulus)\b/i,
  /[+\-*/÷×=]\s*\d/,  // Arithmetic operators near digits
  /\d\s*[+\-*/÷×=]\s*\d/, // Numbers with operators between them
];

// ─── Genuine Threat Amplifiers ──────────────────────────────────────────────
// Patterns that INCREASE confidence the data is real/genuine.

const GENUINE_AMPLIFIERS = [
  // Ownership claims
  /\b(?:my|our|company'?s?|production|prod|live|real|actual|corporate)\s+(?:key|password|token|secret|credential|api|account|email|phone|number|card|ssn|aadhaar|pan)\b/i,
  // Urgency / action
  /\b(?:rotate|revoke|change|update|check|verify|fix|debug|deploy|push)\s+(?:this|the|my|our)\b/i,
  // Infrastructure references
  /\b(?:production|staging|prod|infra|server|database|cluster|aws|azure|gcp|cloud)\b/i,
  // Sharing / exfiltration intent
  /\b(?:send|share|post|upload|paste|copy|forward|leak|exfiltrate)\s+(?:this|the|my|these)\b/i,
  // Direct credential assignment context
  /\b(?:\.env|config|settings|secrets|credentials)(?:\s+file|\s+var)?\b/i,
];

// ─── High-Confidence Benign Value Patterns ──────────────────────────────────
// Known test/example values that are universally recognized as non-real.

const KNOWN_DUMMY_VALUES = [
  // AWS example keys from official docs
  "AKIAIOSFODNN7EXAMPLE",
  "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  // Stripe test keys
  "sk_test_",
  // Common dummy emails
  "test@test.com", "test@example.com", "user@example.com", "dummy@dummy.com",
  "admin@example.com", "noreply@example.com", "foo@bar.com", "jane@doe.com",
  "john@doe.com", "example@example.com", "sample@sample.com",
  // Common dummy phones
  "555-", "1234567890", "0000000000", "9999999999",
  // Common dummy SSNs
  "123-45-6789", "000-00-0000", "111-11-1111",
  // Common dummy credit cards
  "4111111111111111", "4242424242424242", "5500000000000004",
  // Dummy IPs
  "192.168.1.1", "10.0.0.1", "127.0.0.1",
];


// ─── Core Context Scoring Function ──────────────────────────────────────────

/**
 * Analyze each detection in its surrounding text context to determine
 * if it's a genuine threat or benign/test data.
 *
 * @param {string} fullText — The complete prompt text
 * @param {object[]} detections — Array of detections from industrialDetector
 * @returns {{ scoredDetections: object[], genuineDetections: object[], benignDetections: object[], contextVerdict: string, overallContextScore: number }}
 */
function scoreDetections(fullText, detections) {
  if (!fullText || !detections || detections.length === 0) {
    return {
      scoredDetections: [],
      genuineDetections: [],
      benignDetections: [],
      contextVerdict: "CLEAN",
      overallContextScore: 0,
    };
  }

  const lowerFull = fullText.toLowerCase();

  // ── Phase 1: Global context analysis ──────────────────────────────────────
  // Check if the ENTIRE prompt has a dominant mathematical / test / dummy tone.

  let globalMathScore = 0;
  for (const pattern of MATH_CONTEXT_PATTERNS) {
    if (pattern.test(fullText)) {
      globalMathScore += 20;
    }
  }
  globalMathScore = Math.min(globalMathScore, 80);

  let globalBenignScore = 0;
  for (const pattern of BENIGN_QUALIFIERS) {
    if (pattern.test(fullText)) {
      globalBenignScore += 25;
    }
  }
  globalBenignScore = Math.min(globalBenignScore, 80);

  let globalGenuineScore = 0;
  for (const pattern of GENUINE_AMPLIFIERS) {
    if (pattern.test(fullText)) {
      globalGenuineScore += 20;
    }
  }
  globalGenuineScore = Math.min(globalGenuineScore, 80);

  // ── Phase 2: Per-detection local context scoring ──────────────────────────
  const scoredDetections = [];

  for (const det of detections) {
    const result = scoreOneDetection(det, fullText, lowerFull, {
      globalMathScore,
      globalBenignScore,
      globalGenuineScore,
    });
    scoredDetections.push(result);
  }

  // ── Phase 3: Separate genuine from benign ─────────────────────────────────
  const genuineDetections = scoredDetections
    .filter((d) => d.contextVerdict === "GENUINE" || d.contextVerdict === "UNCERTAIN")
    .map((d) => d.detection);

  const benignDetections = scoredDetections
    .filter((d) => d.contextVerdict === "BENIGN")
    .map((d) => d.detection);

  // Overall verdict
  const genuineCount = genuineDetections.length;
  const totalCount = scoredDetections.length;
  let contextVerdict = "CLEAN";
  let overallContextScore = 0;

  if (genuineCount === 0 && totalCount > 0) {
    contextVerdict = "ALL_BENIGN";
    overallContextScore = 0;
  } else if (genuineCount > 0) {
    overallContextScore = Math.round(
      scoredDetections
        .filter((d) => d.contextVerdict !== "BENIGN")
        .reduce((acc, d) => acc + d.severityScore, 0) / genuineCount
    );
    contextVerdict = overallContextScore >= 70 ? "CRITICAL" : overallContextScore >= 40 ? "HIGH" : "MODERATE";
  }

  return {
    scoredDetections,
    genuineDetections,
    benignDetections,
    contextVerdict,
    overallContextScore,
  };
}


/**
 * Score a single detection based on its surrounding context.
 */
function scoreOneDetection(det, fullText, lowerFull, globalScores) {
  const { globalMathScore, globalBenignScore, globalGenuineScore } = globalScores;

  // Extract local context window around the detection
  const start = Math.max(0, (det.start || 0) - CONTEXT_WINDOW);
  const end = Math.min(fullText.length, (det.end || 0) + CONTEXT_WINDOW);
  const localContext = fullText.slice(start, end);
  const lowerLocal = localContext.toLowerCase();

  let benignScore = 0;  // 0-100: how likely benign
  let genuineScore = 0; // 0-100: how likely genuine
  const reasons = [];

  // ── Check 1: Known dummy values ───────────────────────────────────────────
  const detValue = (det.value || "").trim();
  for (const dummy of KNOWN_DUMMY_VALUES) {
    if (detValue.includes(dummy) || dummy.includes(detValue)) {
      benignScore += 60;
      reasons.push(`Known dummy value: "${dummy}"`);
      break;
    }
  }

  // ── Check 2: Local benign qualifiers ──────────────────────────────────────
  for (const pattern of BENIGN_QUALIFIERS) {
    if (pattern.test(localContext)) {
      benignScore += 30;
      reasons.push(`Benign qualifier in local context`);
      break; // Only count once locally
    }
  }

  // ── Check 3: Mathematical context for number-like detections ──────────────
  const isNumberLike = ["PHONE", "AADHAAR", "SSN", "CREDIT_CARD", "PAN"].includes(det.patternName) ||
                        ["PII", "CRITICAL_PII", "FINANCIAL"].includes(det.category);
  if (isNumberLike && globalMathScore >= 40) {
    benignScore += Math.min(globalMathScore, 50);
    reasons.push(`Mathematical context detected (score: ${globalMathScore})`);

    // Extra boost if arithmetic operators are directly adjacent to the detected value
    const hasAdjacentOperator = /\d\s*[+\-*/÷×=]\s*\d/.test(lowerLocal) ||
                                 /\b(?:add|plus|sum|subtract|minus|multiply|divide|calculate)\b/.test(lowerLocal);
    if (hasAdjacentOperator) {
      benignScore += 30;
      reasons.push(`Arithmetic operator adjacent to detected number`);
    }
  }

  // ── Check 4: "dummy email" / "test phone" nearby ──────────────────────────
  if (det.category === "PII" || det.patternName === "EMAIL" || det.patternName === "PHONE") {
    const testEmailPhone = /\b(?:dummy|test|fake|sample|example|placeholder|mock)\s+(?:email|phone|number|address|contact)\b/i;
    if (testEmailPhone.test(localContext) || testEmailPhone.test(fullText)) {
      benignScore += 50;
      reasons.push(`Explicit "dummy/test" qualifier for PII`);
    }
  }

  // ── Check 5: Global benign tone ───────────────────────────────────────────
  if (globalBenignScore >= 40) {
    benignScore += Math.round(globalBenignScore * 0.3);
    reasons.push(`Global benign tone (score: ${globalBenignScore})`);
  }

  // ── Check 6: Genuine amplifiers ───────────────────────────────────────────
  for (const pattern of GENUINE_AMPLIFIERS) {
    if (pattern.test(localContext)) {
      genuineScore += 25;
      reasons.push(`Genuine amplifier in local context`);
      break;
    }
  }

  if (globalGenuineScore >= 30) {
    genuineScore += Math.round(globalGenuineScore * 0.4);
    reasons.push(`Global genuine tone (score: ${globalGenuineScore})`);
  }

  // ── Check 7: High-entropy secrets are almost always genuine ───────────────
  if (det.category === "CREDENTIAL" && det.isolationRisk >= 85) {
    // API keys, private keys, JWTs, connection strings are rarely "dummy"
    // unless they exactly match known dummy values (handled above)
    if (benignScore < 60) {
      genuineScore += 40;
      reasons.push(`High-risk credential (isolationRisk: ${det.isolationRisk})`);
    }
  }

  // ── Check 8: Prompt injection is ALWAYS genuine ───────────────────────────
  if (det.category === "PROMPT_INJECTION") {
    genuineScore = 100;
    benignScore = 0;
    reasons.push(`Prompt injection always treated as genuine`);
  }

  // ── Final verdict ─────────────────────────────────────────────────────────
  benignScore = Math.min(benignScore, 100);
  genuineScore = Math.min(genuineScore, 100);

  let contextVerdict;
  let severityScore;

  if (benignScore >= 70 && genuineScore < 30) {
    contextVerdict = "BENIGN";
    severityScore = Math.max(0, det.isolationRisk - benignScore);
  } else if (genuineScore >= 50 || (genuineScore > benignScore)) {
    contextVerdict = "GENUINE";
    severityScore = Math.min(100, det.isolationRisk + Math.round(genuineScore * 0.2));
  } else {
    contextVerdict = "UNCERTAIN";
    // Default to genuine (better safe than sorry) but with reduced severity
    severityScore = det.isolationRisk;
  }

  return {
    detection: det,
    contextVerdict,
    severityScore,
    benignScore,
    genuineScore,
    reasons,
    localContextSnippet: localContext.slice(0, 80) + (localContext.length > 80 ? "..." : ""),
  };
}


module.exports = {
  scoreDetections,
  BENIGN_QUALIFIERS,
  MATH_CONTEXT_PATTERNS,
  GENUINE_AMPLIFIERS,
  KNOWN_DUMMY_VALUES,
};
