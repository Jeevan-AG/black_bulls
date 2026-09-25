require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Company = require("../models/Company");
const Rule = require("../models/Rule");
const Violation = require("../models/Violation");

async function seed() {
  const uri = process.env.MONGO_URI;
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const email = "admin@vantix.com";
  const password = "admin123";

  // Check if user already exists
  let admin = await User.findOne({ email });
  if (!admin) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    admin = await User.create({
      email,
      password: hashedPassword,
      role: "admin",
      isFirstLogin: false,
    });
    console.log(`Created admin: ${email}`);
    
    // Create Company
    await Company.create({
      companyDomain: "vantix.com",
      adminId: admin._id,
      adminEmail: email,
    });
    
    // Create Rules
    await Rule.create({
      orgId: admin._id,
      domains: ["vantix.com"],
      keywords: ["VantixCore", "Project X"],
      customPatterns: []
    });
  }

  // Add 4 seed violations
  const violations = [
    { type: "Credit Card", url: "chatgpt.com" },
    { type: "API Key", url: "github.com" },
    { type: "Aadhaar Number", url: "gemini.google.com" },
    { type: "JWT Token", url: "claude.ai" }
  ];

  for (const v of violations) {
    await Violation.create({
      userId: admin._id,
      orgId: admin._id,
      url: v.url,
      matches: [{ type: v.type }],
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
    });
  }

  console.log(`Added ${violations.length} violations for ${email}`);
  await mongoose.disconnect();
}

seed().catch(console.error);
