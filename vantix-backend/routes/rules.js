// ─── Vantix — /api/rules Routes ───────────────────────────────────────────────
const express  = require("express");
const router   = express.Router();
const Rule     = require("../models/Rule");
const { encrypt, hashValue } = require("../utils/encryption");
const { asyncHandler }       = require("../middleware/errorHandler");
const { authMiddleware, adminMiddleware } = require("../middleware/authMiddleware");

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getRules(orgId) {
  let rules = await Rule.findOne({ orgId });
  if (!rules) {
    console.log(`[Rules] Creating missing rules for org: ${orgId}`);
    rules = await Rule.create({ 
      orgId, 
      domains: [], 
      keywords: [], 
      customPatterns: [],
      monitoredApps: ["ChatGPT", "Notepad"] 
    });
  }
  return rules;
}

// hash is safe to send to extension — encryptedValue is never sent
function safeApiKey(f) {
  return { _id: f._id, label: f.label, hint: f.hint, hash: f.hash, auto_detected: f.auto_detected, source_url: f.source_url };
}

function safeNumber(f) {
  return { _id: f._id, label: f.label, type: f.type, hint: f.hint, hash: f.hash };
}

// ─── GET /api/rules ───────────────────────────────────────────────────────────
router.get(
  "/",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const rule = await Rule.findOne({ orgId: req.orgId });

    if (!rule) {
      return res.json({
        companyRules: { 
          domains: [], 
          keywords: [], 
          customPatterns: [], 
          apiKeys: [], 
          sensitiveNumbers: [],
          monitoredApps: ["ChatGPT", "Notepad"]
        },
        generalRules: { domains: [], keywords: [], customPatterns: [] },
      });
    }

    const companyPatterns = (rule.customPatterns || []).filter((p) => p.source !== "general");
    const generalPatterns = (rule.customPatterns || []).filter((p) => p.source === "general");

    return res.json({
      companyRules: {
        domains:          rule.domains        || [],
        keywords:         rule.keywords       || [],
        customPatterns:   companyPatterns,
        apiKeys:          (rule.apiKeys          || []).map(safeApiKey),
        sensitiveNumbers: (rule.sensitiveNumbers || []).map(safeNumber),
        monitoredApps:    rule.monitoredApps  || ["ChatGPT", "Notepad"],
      },
      generalRules: {
        domains:        [],
        keywords:       [],
        customPatterns: generalPatterns,
      },
    });
  })
);

// ─── PUT /api/rules ───────────────────────────────────────────────────────────
router.put(
  "/",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const { domains, keywords, customPatterns, monitoredApps } = req.body;
    console.log("[Rules] PUT /api/rules update:", { domains, keywords, customPatterns, monitoredApps });
    const rules = await getRules(req.orgId);

    if (Array.isArray(domains))        rules.domains        = domains;
    if (Array.isArray(keywords))       rules.keywords       = keywords;
    if (Array.isArray(customPatterns)) rules.customPatterns = customPatterns;
    if (Array.isArray(monitoredApps))  rules.monitoredApps  = monitoredApps;

    await rules.save();
    console.log("[Rules] Rules updated via PUT ✓");
    res.json({ success: true, rules });
  })
);

// ─── POST /api/rules/domain ───────────────────────────────────────────────────
router.post(
  "/domain",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const { domain } = req.body;
    if (!domain || typeof domain !== "string") {
      return res.status(400).json({ success: false, error: "domain is required" });
    }

    const clean = domain.toLowerCase().trim();
    const rules = await getRules(req.orgId);

    if (rules.domains.includes(clean)) {
      return res.json({ success: true, message: "Domain already exists", rules });
    }

    rules.domains.push(clean);
    await rules.save();
    console.log(`[Rules] Domain added: ${clean}`);
    res.json({ success: true, rules });
  })
);

// ─── DELETE /api/rules/domain ─────────────────────────────────────────────────
router.delete(
  "/domain",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ success: false, error: "domain is required" });

    const clean = domain.toLowerCase().trim();
    const rules = await getRules(req.orgId);
    rules.domains = rules.domains.filter((d) => d !== clean);
    await rules.save();
    console.log(`[Rules] Domain removed: ${clean}`);
    res.json({ success: true, rules });
  })
);

// ─── POST /api/rules/keyword ──────────────────────────────────────────────────
router.post(
  "/keyword",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const { keyword } = req.body;
    if (!keyword || typeof keyword !== "string") {
      return res.status(400).json({ success: false, error: "keyword is required" });
    }

    const clean = keyword.trim();
    const rules = await getRules(req.orgId);
    const exists = rules.keywords.some((k) => k.toLowerCase() === clean.toLowerCase());
    if (exists) return res.json({ success: true, message: "Keyword already exists", rules });

    rules.keywords.push(clean);
    await rules.save();
    console.log(`[Rules] Keyword added: ${clean}`);
    res.json({ success: true, rules });
  })
);

// ─── DELETE /api/rules/keyword ────────────────────────────────────────────────
router.delete(
  "/keyword",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ success: false, error: "keyword is required" });

    const rules = await getRules(req.orgId);
    rules.keywords = rules.keywords.filter(
      (k) => k.toLowerCase() !== keyword.toLowerCase().trim()
    );
    await rules.save();
    console.log(`[Rules] Keyword removed: ${keyword}`);
    res.json({ success: true, rules });
  })
);

// ─── POST /api/rules/pattern ──────────────────────────────────────────────────
router.post(
  "/pattern",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const { label, pattern, source = "company" } = req.body;
    if (!label || !pattern) {
      return res.status(400).json({ success: false, error: "label and pattern are required" });
    }
    if (!["company", "general"].includes(source)) {
      return res.status(400).json({ success: false, error: "source must be 'company' or 'general'" });
    }

    try { new RegExp(pattern); }
    catch (e) {
      return res.status(400).json({ success: false, error: `Invalid regex: ${e.message}` });
    }

    const rules = await getRules(req.orgId);
    const exists = rules.customPatterns.some((p) => p.label === label.trim());
    if (exists) return res.json({ success: true, message: "Pattern label already exists", rules });

    rules.customPatterns.push({ label: label.trim(), pattern: pattern.trim(), source });
    await rules.save();
    console.log(`[Rules] Pattern added: ${label} → ${pattern} (${source})`);
    res.json({ success: true, rules });
  })
);

// ─── DELETE /api/rules/pattern ────────────────────────────────────────────────
router.delete(
  "/pattern",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const { label } = req.body;
    if (!label) return res.status(400).json({ success: false, error: "label is required" });

    const rules = await getRules(req.orgId);
    rules.customPatterns = rules.customPatterns.filter((p) => p.label !== label.trim());
    await rules.save();
    console.log(`[Rules] Pattern removed: ${label}`);
    res.json({ success: true, rules });
  })
);

// ─── POST /api/rules/apikey ───────────────────────────────────────────────────
router.post(
  "/apikey",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { label, value, auto_detected, source_url } = req.body;
    
    // Only admins can manually add keys. Employees can only auto-detect.
    if (req.user.role !== "admin" && !auto_detected) {
      return res.status(403).json({ success: false, error: "Not authorized as an admin." });
    }

    if (!label || !value)
      return res.status(400).json({ success: false, error: "label and value are required" });

    const rules  = await getRules(req.orgId);
    const newHash = hashValue(value);

    // If auto_detected, silently ignore duplicates by hash (exact same token)
    if (auto_detected) {
      const valueExists = rules.apiKeys.some((k) => k.hash === newHash);
      if (valueExists) {
        return res.status(200).json({ success: true, message: "Auto-detected key already exists (value)", apiKeys: rules.apiKeys.map(safeApiKey) });
      }
    }

    let finalLabel = label.trim();
    const exists = rules.apiKeys.some((k) => k.label.toLowerCase() === finalLabel.toLowerCase());
    
    if (exists) {
      if (auto_detected) {
        // Append a random short string to make the label unique so we don't lose the auto-detected key
        finalLabel = `${finalLabel} (${Math.floor(Math.random() * 10000)})`;
      } else {
        return res.status(409).json({ success: false, error: "An API key with this label already exists" });
      }
    }

    rules.apiKeys.push({
      label:          finalLabel,
      encryptedValue: encrypt(value),
      hash:           newHash,
      hint:           value.slice(-4),
      auto_detected:  Boolean(auto_detected),
      source_url:     source_url || "",
    });
    await rules.save();
    console.log(`[Rules] API key added: ${label.trim()}`);
    res.json({ success: true, apiKeys: rules.apiKeys.map(safeApiKey) });
  })
);

// ─── DELETE /api/rules/apikey/:id ─────────────────────────────────────────────
router.delete(
  "/apikey/:id",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const rules  = await getRules(req.orgId);
    const before = rules.apiKeys.length;
    rules.apiKeys = rules.apiKeys.filter((k) => k._id.toString() !== req.params.id);

    if (rules.apiKeys.length === before)
      return res.status(404).json({ success: false, error: "API key not found" });

    await rules.save();
    console.log(`[Rules] API key removed: ${req.params.id}`);
    res.json({ success: true, apiKeys: rules.apiKeys.map(safeApiKey) });
  })
);

// ─── POST /api/rules/auto-add ─────────────────────────────────────────────────
router.post(
  "/auto-add",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { name, value, auto_detected, source_url } = req.body;
    
    if (!name || !value)
      return res.status(400).json({ success: false, error: "name and value are required" });

    const rules = await getRules(req.orgId);
    const newHash = hashValue(value);

    // Check duplicate by hash
    const valueExists = rules.apiKeys.some((k) => k.hash === newHash);
    if (valueExists) {
      return res.status(200).json({ message: "already exists" });
    }

    let finalLabel = `${name}`.trim();
    if (!finalLabel.toLowerCase().includes("key") && !finalLabel.toLowerCase().includes("token")) {
        finalLabel += " Key";
    }

    const exists = rules.apiKeys.some((k) => k.label.toLowerCase() === finalLabel.toLowerCase());
    if (exists) {
      finalLabel = `${finalLabel} (${Math.floor(Math.random() * 10000)})`;
    }

    rules.apiKeys.push({
      label:          finalLabel,
      encryptedValue: encrypt(value),
      hash:           newHash,
      hint:           value.slice(-4),
      auto_detected:  Boolean(auto_detected),
      source_url:     source_url || "",
    });
    
    await rules.save();
    console.log(`[Rules] Auto-add API key: ${finalLabel}`);
    res.status(201).json({ message: "auto-saved", success: true });
  })
);

// ─── POST /api/rules/number ───────────────────────────────────────────────────
router.post(
  "/number",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const { label, type, value } = req.body;
    if (!label || !type || !value)
      return res.status(400).json({ success: false, error: "label, type and value are required" });

    const VALID_TYPES = ["phone", "account_number", "tax_id", "other"];
    if (!VALID_TYPES.includes(type))
      return res.status(400).json({ success: false, error: `type must be one of: ${VALID_TYPES.join(", ")}` });

    const rules  = await getRules(req.orgId);
    const exists = rules.sensitiveNumbers.some(
      (n) => n.label.toLowerCase() === label.toLowerCase().trim()
    );
    if (exists)
      return res.status(409).json({ success: false, error: "A number with this label already exists" });

    rules.sensitiveNumbers.push({
      label:          label.trim(),
      type,
      encryptedValue: encrypt(value),
      hash:           hashValue(value),
      hint:           value.replace(/\D/g, "").slice(-4),
    });
    await rules.save();
    console.log(`[Rules] Sensitive number added: ${label.trim()} (${type})`);
    res.json({ success: true, sensitiveNumbers: rules.sensitiveNumbers.map(safeNumber) });
  })
);

// ─── DELETE /api/rules/number/:id ─────────────────────────────────────────────
router.delete(
  "/number/:id",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const rules  = await getRules(req.orgId);
    const before = rules.sensitiveNumbers.length;
    rules.sensitiveNumbers = rules.sensitiveNumbers.filter(
      (n) => n._id.toString() !== req.params.id
    );

    if (rules.sensitiveNumbers.length === before)
      return res.status(404).json({ success: false, error: "Number not found" });

    await rules.save();
    console.log(`[Rules] Sensitive number removed: ${req.params.id}`);
    res.json({ success: true, sensitiveNumbers: rules.sensitiveNumbers.map(safeNumber) });
  })
);

module.exports = router;