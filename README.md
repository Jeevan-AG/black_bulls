# 🛡️ Vantix — Enterprise AI Data Loss Prevention Firewall

**Vantix** stops sensitive corporate credentials, customer PII, and proprietary code from leaking into public and private AI models (ChatGPT, Claude, Gemini, DeepSeek, and AI SDKs). 

It operates a zero-exposure **dual-layer architecture**:
1. **Layer 1 (OS & Network)**: Transparent proxy (`iptables`) intercepting terminal commands, Python scripts, and SDKs.
2. **Layer 2 (Browser Guard)**: Chrome extension intercepting keystrokes and DOM submissions on web AI interfaces with real-time redaction or blocking.

---

## ⚡ How It Works (Under the Hood)

1. **Pre-Flight Interception (<5ms)**: Outbound text is captured before submission—either from the browser DOM (ChatGPT/Claude) or raw OS socket (`curl`/Python).
2. **Confidential TEE Inspection**: The prompt is processed through high-speed deterministic regex and entropy engines within a simulated Trusted Execution Environment.
3. **Dual Enforcement Actions**:
   - ⛔ **Hard Block**: If live infrastructure credentials (AWS, OpenAI, Private Keys) are detected, transmission is halted immediately with a security alert.
   - 🔒 **Silent Redaction**: If PII, database URIs, or internal IP addresses are detected, Vantix substitutes them with irreversible synthetic tokens (`<REDACTED_API_KEY_1>`), protecting secrets while preserving developer productivity.
4. **Real-Time SOC Telemetry**: Violations are cryptographically signed (HMAC-SHA256) for audit trails and broadcast via WebSockets to the centralized Admin SOC Dashboard.

---

## 🌐 Live Hosted Deployment

- **Live Dashboard**: [https://vantix-beta.vercel.app](https://vantix-beta.vercel.app)
- **Live Cloud API**: [https://vantix-backend-7gcw.onrender.com](https://vantix-backend-7gcw.onrender.com)
- **Default Admin Login**: `admin@vantix.corp` / `Admin@123456` *(or click One-Click Demo Access)*

---

## 🚀 Quick Setup (Using Hosted Cloud)

No local backend needed. Connect your machine to the live cloud backend:

### 🐧 Linux (Full OS + Browser Protection)
Run this single command in your terminal to deploy the transparent proxy, trust the CA, and configure Chrome policies:
```bash
curl -fsSL https://vantix-beta.vercel.app/quickstart.sh | sudo bash
```
> **To stop monitoring**: `sudo /opt/vantix/vantix-protect.sh stop`

---

### 🍏 macOS (Browser Protection)
Run in Terminal to download and unpack the extension:
```bash
curl -fsSL https://vantix-beta.vercel.app/downloads/vantix-browser-guard.zip -o ~/vantix-guard.zip && unzip -qo ~/vantix-guard.zip -d ~/vantix-guard
```
1. Open Google Chrome and go to `chrome://extensions`.
2. Toggle **Developer mode** (top right).
3. Click **Load unpacked** and select the `~/vantix-guard` folder.

---

### 🪟 Windows (Browser Protection)
Run in PowerShell to download and unpack the extension:
```powershell
iwr https://vantix-beta.vercel.app/downloads/vantix-browser-guard.zip -OutFile "$HOME\vantix-guard.zip"; Expand-Archive "$HOME\vantix-guard.zip" -DestinationPath "$HOME\vantix-guard" -Force
```
1. Open Google Chrome and go to `chrome://extensions`.
2. Toggle **Developer mode** (top right).
3. Click **Load unpacked** and select the `vantix-guard` folder in your user directory.

---

## 💻 Running Locally

To run the entire stack on your local machine:

### 1. Start the Backend
```bash
cd vantix-backend
npm install
npm start
# Server runs on http://localhost:5000 (WebSocket: ws://localhost:5000/ws/vantix)
```

### 2. Start the Admin Dashboard
```bash
cd vantix-admin
npm install
npm run dev
# Dashboard runs on http://localhost:5173
```

### 3. (Optional - Linux Only) Start Local OS Network Interception
```bash
sudo ./vantix-protect.sh start
# Intercepts all local AI traffic on port 8443 via iptables
```

---

## 🎯 Supported Platforms
- **Web AI**: ChatGPT, Claude, Google Gemini, Copilot, Perplexity, DeepSeek, Grok, Meta AI.
- **Code & Terminal**: Python (`openai`, `anthropic`), cURL, Node.js, and IDE plugins.
