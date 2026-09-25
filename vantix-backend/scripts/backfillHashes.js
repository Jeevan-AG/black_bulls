require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require("mongoose");
const crypto   = require("crypto");
const Rule     = require("../models/Rule");

function hashValue(value) {
  return crypto.createHash("sha256").update(value.trim()).digest("hex");
}

async function run() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not found in .env");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB ✓");

  const rules = await Rule.find({});
  let updated = 0;

  for (const rule of rules) {
    let dirty = false;

    for (const key of rule.apiKeys) {
      if (!key.hash) {
        key.hash = "NEEDS_REENTRY";
        dirty = true;
      }
    }

    for (const num of rule.sensitiveNumbers) {
      if (!num.hash) {
        num.hash = "NEEDS_REENTRY";
        dirty = true;
      }
    }

    if (dirty) {
      await rule.save();
      updated++;
    }
  }

  console.log(`Done — updated ${updated} rule documents`);
  mongoose.disconnect();
}

run().catch(console.error);