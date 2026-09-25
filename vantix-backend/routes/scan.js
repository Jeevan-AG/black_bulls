const express = require("express");
const router = express.Router();
const { analyzeText } = require("../utils/presidio");
const Violation = require("../models/Violation");
const { asyncHandler } = require("../middleware/errorHandler");
const { authMiddleware } = require("../middleware/authMiddleware");

// ─── POST /api/check  (also mounted at /api/scan) ────────────────────────────
// Called by the Chrome extension and clipboard agent to scan text via Presidio.
// If Presidio detects sensitive entities, a violation is logged automatically.
router.post(
  "/",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      return res.json({ blocked: false });
    }

    // Call Presidio NLP engine
    const presidioResults = await analyzeText(text);

    if (presidioResults.length > 0) {
      const types = presidioResults.map((r) => r.entity_type);

      // Log as a violation
      await Violation.create({
        userId:    req.user ? req.user.id : undefined,
        orgId:     req.orgId,
        url:       req.body.source || "presidio-scan",
        matches:   types.map((t) => ({ type: t })),
        timestamp: new Date(),
      });

      console.log(`[Presidio] Blocked — ${types.join(", ")}`);
      return res.json({ blocked: true, types });
    }

    res.json({ blocked: false });
  })
);

// ─── POST /api/check/open  (no auth — for clipboard agent bootstrap) ─────────
// Same as above but without auth middleware for local-only clipboard agent use.
router.post(
  "/open",
  asyncHandler(async (req, res) => {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      return res.json({ blocked: false });
    }

    const presidioResults = await analyzeText(text);

    if (presidioResults.length > 0) {
      const types = presidioResults.map((r) => r.entity_type);
      console.log(`[Presidio/Open] Detected — ${types.join(", ")}`);
      return res.json({ blocked: true, types });
    }

    res.json({ blocked: false });
  })
);

module.exports = router;
