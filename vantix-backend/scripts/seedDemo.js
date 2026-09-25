/**
 * Vantix — Demo Seed Script
 * =========================
 * Creates a complete demo organization with realistic data.
 *
 * Usage:
 *   node scripts/seedDemo.js
 *   npm run seed:demo
 */

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
const crypto   = require("crypto");

const User      = require("../models/User");
const Company   = require("../models/Company");
const Rule      = require("../models/Rule");
const Violation = require("../models/Violation");
const ActivityLog = require("../models/ActivityLog");
const AuditLog  = require("../models/AuditLog");
const tee       = require("../engines/teeEnclave");

// ── Helpers ──────────────────────────────────────────────────────────────────

function randomDate(daysBack) {
  const now = Date.now();
  return new Date(now - Math.floor(Math.random() * daysBack * 24 * 60 * 60 * 1000));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) throw new Error("ENCRYPTION_KEY must be set");
  return Buffer.from(hex, "hex");
}

function encrypt(plaintext) {
  const iv      = crypto.randomBytes(12);
  const cipher  = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc     = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, enc].map(b => b.toString("hex")).join(":");
}

function hashValue(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) { console.error("MONGO_URI not set in .env"); process.exit(1); }

  await mongoose.connect(uri);
  console.log("[Seed] Connected to MongoDB");

  // ── Check if already seeded ──
  const existing = await User.findOne({ email: "admin@nexustech.com" });
  if (existing) {
    console.log("[Seed] admin@nexustech.com already exists — skipping creation.");
    console.log("[Seed] To re-seed, delete the admin first:  db.users.deleteMany({email:/nexustech/})");
    await mongoose.disconnect();
    return;
  }

  // ── 1. Create Admin ──
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash("Demo@1234", salt);

  const admin = await User.create({
    email: "admin@nexustech.com",
    password: hashedPassword,
    role: "admin",
    isFirstLogin: false,
  });
  console.log(`[Seed] ✓ Created admin: admin@nexustech.com (id: ${admin._id})`);

  // ── 2. Create Company ──
  await Company.create({
    companyDomain: "nexustech.com",
    adminId: admin._id,
    adminEmail: "admin@nexustech.com",
  });
  console.log("[Seed] ✓ Created company: Nexus Technologies (nexustech.com)");

  // ── 3. Create Employees ──
  const employeeData = [
    { email: "arjun.mehta@nexustech.com",   tag: "active" },
    { email: "priya.sharma@nexustech.com",  tag: "active" },
    { email: "rohan.das@nexustech.com",     tag: "active" },
    { email: "sneha.patel@nexustech.com",   tag: "inactive" },
    { email: "kiran.rao@nexustech.com",     tag: "not_installed" },
  ];

  const empPassword = await bcrypt.hash("Employee@123", salt);
  const employees = [];

  for (const e of employeeData) {
    const emp = await User.create({
      email: e.email,
      password: empPassword,
      role: "employee",
      isFirstLogin: false,
      orgId: admin._id,
    });
    employees.push({ ...e, _id: emp._id });
  }
  console.log(`[Seed] ✓ Created ${employees.length} employees`);

  // ── 4. Create Activity Logs ──
  const platforms = ["chatgpt.com", "gemini.google.com", "claude.ai", "copilot.microsoft.com"];
  let activityCount = 0;

  for (const emp of employees) {
    if (emp.tag === "not_installed") continue; // No activity for kiran

    const daysOfActivity = emp.tag === "active" ? 25 : 8; // Active = lots, inactive = old
    const daysAgoStart   = emp.tag === "active" ? 30 : 45; // Inactive started further back

    for (let i = 0; i < daysOfActivity; i++) {
      const dayOffset = emp.tag === "active"
        ? Math.floor(Math.random() * 30)
        : 15 + Math.floor(Math.random() * 30); // Inactive: 15–45 days ago

      const ts = new Date(Date.now() - dayOffset * 24 * 60 * 60 * 1000);

      await ActivityLog.create({
        userId: emp._id,
        orgId: admin._id,
        platform: pick(platforms),
        timestamp: ts,
      });
      activityCount++;
    }
  }
  console.log(`[Seed] ✓ Created ${activityCount} activity log entries`);

  // ── 5. Create Rules ──
  const phoneValue = "+919876543210";
  await Rule.create({
    orgId: admin._id,
    domains: ["nexustech.com"],
    keywords: ["Project Phoenix", "NexusCore", "Operation Delta"],
    customPatterns: [
      { label: "OpenAI Key", pattern: "sk-[a-zA-Z0-9]{48}", source: "company" },
    ],
    apiKeys: [],
    sensitiveNumbers: [
      {
        label: "Support Line",
        type: "phone",
        encryptedValue: encrypt(phoneValue),
        hash: hashValue(phoneValue),
        hint: phoneValue.slice(-4),
      },
    ],
  });
  console.log("[Seed] ✓ Created detection rules (domains, keywords, patterns, contacts)");

  // ── 6. Create Violations ──
  const arjun = employees.find(e => e.email.startsWith("arjun"));
  const priya = employees.find(e => e.email.startsWith("priya"));
  const rohan = employees.find(e => e.email.startsWith("rohan"));
  const sneha = employees.find(e => e.email.startsWith("sneha"));

  const urls = [
    "chatgpt.com", "gemini.google.com", "claude.ai",
    "copilot.microsoft.com", "perplexity.ai", "poe.com",
  ];

  const violationDefs = [
    // PAN card (5)
    { userId: arjun._id, types: ["PAN"], url: pick(urls) },
    { userId: arjun._id, types: ["PAN"], url: pick(urls) },
    { userId: arjun._id, types: ["PAN"], url: pick(urls) },
    { userId: priya._id, types: ["PAN"], url: pick(urls) },
    { userId: priya._id, types: ["PAN"], url: pick(urls) },

    // Company email leaked (6)
    { userId: rohan._id, types: ["Company email"], url: pick(urls) },
    { userId: rohan._id, types: ["Company email"], url: pick(urls) },
    { userId: rohan._id, types: ["Company email"], url: pick(urls) },
    { userId: arjun._id, types: ["Company email"], url: pick(urls) },
    { userId: arjun._id, types: ["Company email"], url: pick(urls) },
    { userId: arjun._id, types: ["Company email"], url: pick(urls) },

    // API key detected (4)
    { userId: priya._id, types: ["API key / secret"], url: pick(urls) },
    { userId: priya._id, types: ["API key / secret"], url: pick(urls) },
    { userId: rohan._id, types: ["API key / secret"], url: pick(urls) },
    { userId: rohan._id, types: ["API key / secret"], url: pick(urls) },

    // Secret keyword (4)
    { userId: arjun._id, types: ["Keyword: Project Phoenix"], url: pick(urls) },
    { userId: arjun._id, types: ["Keyword: Project Phoenix"], url: pick(urls) },
    { userId: arjun._id, types: ["Keyword: Project Phoenix"], url: pick(urls) },
    { userId: arjun._id, types: ["Keyword: Project Phoenix"], url: pick(urls) },

    // Phone number (3)
    { userId: sneha._id, types: ["Phone Number"], url: pick(urls) },
    { userId: sneha._id, types: ["Phone Number"], url: pick(urls) },
    { userId: sneha._id, types: ["Phone Number"], url: pick(urls) },

    // Credit card (3)
    { userId: rohan._id, types: ["Credit Card"], url: pick(urls) },
    { userId: rohan._id, types: ["Credit Card"], url: pick(urls) },
    { userId: rohan._id, types: ["Credit Card"], url: pick(urls) },
  ];

  let violationCount = 0;
  for (const v of violationDefs) {
    await Violation.create({
      userId: v.userId,
      orgId: admin._id,
      url: v.url,
      matches: v.types.map(t => ({ type: t })),
      timestamp: randomDate(30), // random date within last 30 days
    });
    violationCount++;
  }
  console.log(`[Seed] ✓ Created ${violationCount} violations`);

  // ── 7. Create Vantix Cryptographically Signed Audit Logs ──
  const sampleAuditPrompts = [
    { prompt: "Querying holding register 0x4001 on turbine controller at plant site B", action: "silent_redact", risk: 78, cats: ["REGISTER_ADDR", "DEVICE_TYPE", "LOCATION"] },
    { prompt: "Checking 230V threshold for cooling pump at plant site B", action: "silent_redact", risk: 62, cats: ["ELECTRICAL_PARAM", "LOCATION"] },
    { prompt: "Routing substation IP 192.168.1.50 to SCADA core", action: "silent_redact", risk: 54, cats: ["NETWORK_ADDR", "DEVICE_TYPE"] },
    { prompt: "Attempting root login with master key sk-ant-api03-live-credentials", action: "hard_block", risk: 96, cats: ["CREDENTIAL"] },
  ];

  for (const sp of sampleAuditPrompts) {
    const timestamp = randomDate(7);
    const sig = tee.signAuditEntry({
      timestamp: timestamp.toISOString(),
      userId: "demo-engineer",
      orgId: admin._id.toString(),
      riskScore: sp.risk,
      actionTaken: sp.action,
      categoriesRedacted: sp.cats,
    });

    await AuditLog.create({
      orgId: admin._id.toString(),
      userId: "demo-engineer",
      userEmail: "john.engineer@acme.com",
      userRole: "OT_ENGINEER",
      promptSnippet: sp.prompt,
      actionTaken: sp.action,
      riskScore: sp.risk,
      categoriesRedacted: sp.cats,
      detectionCount: sp.cats.length,
      cryptoSignature: sig,
      timestamp,
    });
  }
  console.log(`[Seed] ✓ Created signed Vantix TEE audit records`);

  // ── Done ──
  console.log("──────────────────────────────────────────");
  console.log("  Demo seed complete!");
  console.log("  Login:    admin@nexustech.com");
  console.log("  Password: Demo@1234");
  console.log("──────────────────────────────────────────");

  await mongoose.disconnect();
  console.log("[Seed] Disconnected from MongoDB");
}

seed().catch(err => {
  console.error("[Seed] Fatal error:", err);
  process.exit(1);
});
