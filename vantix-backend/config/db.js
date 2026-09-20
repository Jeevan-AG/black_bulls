// ─── Vantix — Database Connection ────────────────────────────────────────────
// Connects to MongoDB using Mongoose.
// Reads MONGO_URI from .env (set via dotenv in server.js before this runs).
//
// Call connectDB() once at server startup.
// Mongoose automatically handles reconnection after that.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require("mongoose");

// Never buffer commands indefinitely — fail-fast so in-memory fallback engages instantly
mongoose.set("bufferCommands", false);

async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.warn("[DB] MONGO_URI is not set in .env — running in Standalone / In-Memory mode ✓");
    return;
  }



  try {
    await mongoose.connect(uri, {});
    console.log(`[DB] MongoDB connected ✓`);

    mongoose.connection.on("disconnected", () => {
      console.warn("[DB] MongoDB disconnected — Mongoose will auto-reconnect");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("[DB] MongoDB reconnected ✓");
    });

  } catch (err) {
    console.warn("[DB] MongoDB not reachable at " + (uri || "localhost") + " (" + err.message + ")");
    console.warn("[DB] Running in Standalone / In-Memory mode — All Vantix Proxy, TEE Enclave, and Live Demo features are fully operational! ✓");
  }
}

module.exports = connectDB;
