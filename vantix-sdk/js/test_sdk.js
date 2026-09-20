// Quick SDK verification script
const { VantixClient } = require("./vantix");

async function run() {
  const client = new VantixClient({ endpoint: "http://localhost:5000" });
  try {
    console.log("Checking Vantix attestation...");
    const att = await client.getAttestation();
    console.log("Attestation:", att.status || "OK");
  } catch (err) {
    console.log("Gateway offline or response:", err.message);
  }
}

if (require.main === module) {
  run();
}
