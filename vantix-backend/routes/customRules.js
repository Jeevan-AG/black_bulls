// ─── Vantix — /api/custom-rules ────────────────────────────────────────────
// Lightweight, in-memory store for admin-defined flagged terms. Deliberately
// does NOT require MongoDB or authMiddleware — this backend is running in
// standalone/in-memory mode, so this mirrors that: it works immediately, but
// resets on server restart. Swap for the Rule model + authMiddleware once
// MongoDB and real admin login are wired up.

const express = require("express");
const router = express.Router();

/** @type {{id: string, term: string, type: "literal"|"regex", label: string, action: "redact"|"block"}[]} */
let customKeywords = [];

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── GET /api/custom-rules ───────────────────────────────────────────────────
// Returns every admin-defined term. Polled by the browser extension so it can
// merge these into its client-side (synchronous) detection patterns.
router.get("/", (req, res) => {
  res.json({ success: true, keywords: customKeywords });
});

// ─── POST /api/custom-rules ──────────────────────────────────────────────────
// body: { term: string, type?: "literal"|"regex", label?: string, action?: "redact"|"block" }
router.post("/", (req, res) => {
  const { term, type = "literal", label, action = "redact" } = req.body || {};

  if (!term || typeof term !== "string" || !term.trim()) {
    return res.status(400).json({ success: false, error: "term is required" });
  }
  if (!["literal", "regex"].includes(type)) {
    return res.status(400).json({ success: false, error: "type must be 'literal' or 'regex'" });
  }
  if (!["redact", "block"].includes(action)) {
    return res.status(400).json({ success: false, error: "action must be 'redact' or 'block'" });
  }
  if (type === "regex") {
    try {
      new RegExp(term);
    } catch (e) {
      return res.status(400).json({ success: false, error: `Invalid regex: ${e.message}` });
    }
  }

  const cleanTerm = term.trim();
  const exists = customKeywords.some(
    (k) => k.term.toLowerCase() === cleanTerm.toLowerCase() && k.type === type
  );
  if (exists) {
    return res.json({ success: true, message: "Term already exists", keywords: customKeywords });
  }

  const entry = {
    id: makeId(),
    term: cleanTerm,
    type,
    label: (label || cleanTerm).trim(),
    action,
  };
  customKeywords.push(entry);
  console.log(`[CustomRules] Added: "${entry.term}" (${entry.type}, ${entry.action})`);
  res.json({ success: true, keywords: customKeywords });
});

// ─── DELETE /api/custom-rules/:id ────────────────────────────────────────────
router.delete("/:id", (req, res) => {
  const before = customKeywords.length;
  customKeywords = customKeywords.filter((k) => k.id !== req.params.id);
  if (customKeywords.length === before) {
    return res.status(404).json({ success: false, error: "No matching term found" });
  }
  console.log(`[CustomRules] Removed: ${req.params.id}`);
  res.json({ success: true, keywords: customKeywords });
});

module.exports = router;