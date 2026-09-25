// ─── Vantix — Behavioral Risk Tracker ────────────────────────────────────────
// Tracks cumulative user behavior across multiple requests/sessions.
// Implements progressive enforcement:
//
//   1. Counts severe credential leakage incidents per user
//   2. Flags users who exceed threshold (default: 5 severe violations)
//   3. Auto-disables flagged users from AI access
//   4. Provides admin override to re-enable users
//
// Severity Levels:
//   CRITICAL  — API keys, private keys, connection strings, JWTs (risk >= 80)
//   HIGH      — Credentials, financial data, critical PII (risk >= 50)
//   MODERATE  — PII, phone, email, network addresses (risk >= 30)
//   LOW       — Device types, electrical params, locations (risk < 30)
//
// Enforcement:
//   - 3+ CRITICAL violations → AUTO DISABLE + alert admin
//   - 5+ HIGH+ violations → AUTO DISABLE + alert admin
//   - 10+ MODERATE+ violations → FLAG for review
//   - Disabled users get ALL prompts hard-blocked until admin re-enables
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

// ─── In-Memory User Behavior Store ──────────────────────────────────────────
const _userBehavior = new Map(); // userId → UserBehaviorRecord

const THRESHOLDS = {
  CRITICAL_DISABLE: 3,    // 3 critical violations → auto disable
  HIGH_DISABLE: 5,        // 5 high+ violations → auto disable
  MODERATE_FLAG: 10,      // 10 moderate+ violations → flag for review
  DECAY_HOURS: 24,        // Violations older than 24h decay by 50%
};

/**
 * Classify the severity of an incident based on detections and risk score.
 */
function classifyIncidentSeverity(overallRisk, detections) {
  if (!detections || detections.length === 0) return "NONE";

  const hasCriticalCredential = detections.some(
    (d) =>
      (d.category === "CREDENTIAL" && d.isolationRisk >= 85) ||
      d.patternName === "PRIVATE_KEY" ||
      d.patternName === "CONNECTION_STRING" ||
      d.patternName === "JWT_TOKEN"
  );

  const hasPromptInjection = detections.some(
    (d) => d.category === "PROMPT_INJECTION"
  );

  if (hasCriticalCredential || hasPromptInjection || overallRisk >= 80) {
    return "CRITICAL";
  }

  const hasHighRisk = detections.some(
    (d) =>
      ["CREDENTIAL", "FINANCIAL", "CRITICAL_PII"].includes(d.category) ||
      d.isolationRisk >= 60
  );

  if (hasHighRisk || overallRisk >= 50) {
    return "HIGH";
  }

  if (overallRisk >= 30) {
    return "MODERATE";
  }

  return "LOW";
}

/**
 * Get or create a user behavior record.
 */
function getUserBehavior(userId) {
  const key = (userId || "unknown").toLowerCase().trim();
  if (!_userBehavior.has(key)) {
    _userBehavior.set(key, {
      userId: key,
      disabled: false,
      disabledAt: null,
      disabledReason: null,
      flagged: false,
      flaggedAt: null,
      totalViolations: 0,
      criticalCount: 0,
      highCount: 0,
      moderateCount: 0,
      lowCount: 0,
      recentViolations: [],  // { timestamp, severity, riskScore, categories, action }
      lastViolationAt: null,
      adminOverride: null,    // { action, by, at, reason }
    });
  }
  return _userBehavior.get(key);
}

/**
 * Record a new violation for a user and check if enforcement action is needed.
 *
 * @param {string} userId — User identifier
 * @param {number} overallRisk — Risk score from detection engine
 * @param {object[]} detections — Detections from analyzePrompt
 * @param {string} action — Action that was taken (hard_block, silent_redact, etc.)
 * @returns {{ behavior: object, enforcement: string|null, reason: string|null }}
 */
function recordViolation(userId, overallRisk, detections, action) {
  const behavior = getUserBehavior(userId);
  const severity = classifyIncidentSeverity(overallRisk, detections);

  // Don't count LOW or NONE severity as violations
  if (severity === "NONE" || severity === "LOW") {
    return {
      behavior: sanitizeBehavior(behavior),
      enforcement: null,
      reason: null,
    };
  }

  // Apply time-decay: violations older than DECAY_HOURS are half-weighted
  const now = Date.now();
  const decayMs = THRESHOLDS.DECAY_HOURS * 60 * 60 * 1000;

  // Record the violation
  const violation = {
    timestamp: new Date().toISOString(),
    severity,
    riskScore: overallRisk,
    categories: (detections || []).map((d) => d.category).filter(Boolean),
    action,
  };

  behavior.recentViolations.push(violation);
  behavior.lastViolationAt = violation.timestamp;
  behavior.totalViolations++;

  // Keep last 50 violations max
  if (behavior.recentViolations.length > 50) {
    behavior.recentViolations = behavior.recentViolations.slice(-50);
  }

  // Increment severity counters
  switch (severity) {
    case "CRITICAL":
      behavior.criticalCount++;
      break;
    case "HIGH":
      behavior.highCount++;
      break;
    case "MODERATE":
      behavior.moderateCount++;
      break;
  }

  // ── Enforcement Decision ────────────────────────────────────────────────
  let enforcement = null;
  let reason = null;

  // Check if already disabled by admin override (re-enabled)
  if (behavior.adminOverride?.action === "re-enable") {
    // Admin re-enabled — reset counts but keep monitoring
    return {
      behavior: sanitizeBehavior(behavior),
      enforcement: null,
      reason: "Admin re-enabled — monitoring continues",
    };
  }

  // Already disabled? Keep disabled.
  if (behavior.disabled) {
    return {
      behavior: sanitizeBehavior(behavior),
      enforcement: "ALREADY_DISABLED",
      reason: behavior.disabledReason,
    };
  }

  // Count recent weighted violations (time-decay applied)
  let weightedCritical = 0;
  let weightedHigh = 0;
  let weightedModerate = 0;

  for (const v of behavior.recentViolations) {
    const age = now - new Date(v.timestamp).getTime();
    const weight = age > decayMs ? 0.5 : 1.0;

    if (v.severity === "CRITICAL") weightedCritical += weight;
    if (v.severity === "HIGH") weightedHigh += weight;
    if (v.severity === "MODERATE") weightedModerate += weight;
  }

  // Check critical threshold (3 CRITICAL → auto disable)
  if (weightedCritical >= THRESHOLDS.CRITICAL_DISABLE) {
    behavior.disabled = true;
    behavior.disabledAt = new Date().toISOString();
    behavior.disabledReason = `Auto-disabled: ${Math.round(weightedCritical)} critical credential leakage violations (threshold: ${THRESHOLDS.CRITICAL_DISABLE})`;
    enforcement = "AUTO_DISABLE";
    reason = behavior.disabledReason;
  }
  // Check high threshold (5 HIGH+ → auto disable)
  else if (weightedCritical + weightedHigh >= THRESHOLDS.HIGH_DISABLE) {
    behavior.disabled = true;
    behavior.disabledAt = new Date().toISOString();
    behavior.disabledReason = `Auto-disabled: ${Math.round(weightedCritical + weightedHigh)} high-severity violations (threshold: ${THRESHOLDS.HIGH_DISABLE})`;
    enforcement = "AUTO_DISABLE";
    reason = behavior.disabledReason;
  }
  // Check moderate threshold (10 MODERATE+ → flag for review)
  else if (weightedCritical + weightedHigh + weightedModerate >= THRESHOLDS.MODERATE_FLAG) {
    if (!behavior.flagged) {
      behavior.flagged = true;
      behavior.flaggedAt = new Date().toISOString();
      enforcement = "FLAGGED";
      reason = `Flagged for review: ${Math.round(weightedCritical + weightedHigh + weightedModerate)} cumulative violations (threshold: ${THRESHOLDS.MODERATE_FLAG})`;
    }
  }

  return {
    behavior: sanitizeBehavior(behavior),
    enforcement,
    reason,
  };
}

/**
 * Check if a user is disabled from AI access.
 */
function isUserDisabled(userId) {
  const key = (userId || "unknown").toLowerCase().trim();
  if (!_userBehavior.has(key)) return false;
  const behavior = _userBehavior.get(key);

  // If admin re-enabled, not disabled
  if (behavior.adminOverride?.action === "re-enable") return false;

  return behavior.disabled === true;
}

/**
 * Get the full behavior record for a user (for admin dashboard).
 */
function getUserBehaviorReport(userId) {
  return sanitizeBehavior(getUserBehavior(userId));
}

/**
 * Admin action: re-enable a disabled user.
 */
function adminReEnableUser(userId, adminId, reason) {
  const behavior = getUserBehavior(userId);
  behavior.disabled = false;
  behavior.disabledAt = null;
  behavior.disabledReason = null;
  behavior.flagged = false;
  behavior.flaggedAt = null;
  // Reset counts but keep history
  behavior.criticalCount = 0;
  behavior.highCount = 0;
  behavior.moderateCount = 0;
  behavior.adminOverride = {
    action: "re-enable",
    by: adminId || "admin",
    at: new Date().toISOString(),
    reason: reason || "Admin re-enabled user",
  };
  return sanitizeBehavior(behavior);
}

/**
 * Admin action: manually disable a user.
 */
function adminDisableUser(userId, adminId, reason) {
  const behavior = getUserBehavior(userId);
  behavior.disabled = true;
  behavior.disabledAt = new Date().toISOString();
  behavior.disabledReason = reason || "Manually disabled by admin";
  behavior.adminOverride = {
    action: "disable",
    by: adminId || "admin",
    at: new Date().toISOString(),
    reason: reason || "Manually disabled by admin",
  };
  return sanitizeBehavior(behavior);
}

/**
 * Get summary of all tracked users (for admin overview).
 */
function getAllUserBehaviors() {
  const result = [];
  for (const [key, behavior] of _userBehavior.entries()) {
    if (behavior.totalViolations > 0) {
      result.push(sanitizeBehavior(behavior));
    }
  }
  return result.sort((a, b) => b.totalViolations - a.totalViolations);
}

/**
 * Reset a user's behavior tracking (for testing/demo).
 */
function resetUserBehavior(userId) {
  const key = (userId || "unknown").toLowerCase().trim();
  _userBehavior.delete(key);
}

/**
 * Reset all behavior tracking.
 */
function resetAllBehavior() {
  _userBehavior.clear();
}

/**
 * Strip internal references from behavior record for API responses.
 */
function sanitizeBehavior(behavior) {
  return {
    userId: behavior.userId,
    disabled: behavior.disabled,
    disabledAt: behavior.disabledAt,
    disabledReason: behavior.disabledReason,
    flagged: behavior.flagged,
    flaggedAt: behavior.flaggedAt,
    totalViolations: behavior.totalViolations,
    criticalCount: behavior.criticalCount,
    highCount: behavior.highCount,
    moderateCount: behavior.moderateCount,
    lowCount: behavior.lowCount,
    lastViolationAt: behavior.lastViolationAt,
    recentViolations: behavior.recentViolations.slice(-10), // Last 10 for display
    adminOverride: behavior.adminOverride,
  };
}


module.exports = {
  recordViolation,
  isUserDisabled,
  getUserBehaviorReport,
  adminReEnableUser,
  adminDisableUser,
  getAllUserBehaviors,
  resetUserBehavior,
  resetAllBehavior,
  classifyIncidentSeverity,
  THRESHOLDS,
};
