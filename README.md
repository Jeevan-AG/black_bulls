# 🛡️ Vantix — Enterprise AI Data Loss Prevention Firewall

**Vantix** is an enterprise-grade AI security firewall that stops sensitive corporate credentials, customer PII, and industrial secrets from leaking into public and private LLMs (OpenAI, Claude, Gemini, DeepSeek, and custom AI APIs).

---

## ⚡ Core Architecture

Vantix operates a zero-exposure **Dual-Layer Endpoint Security Engine**:

1. **OS Network Daemon (`vantix-protect.sh` / iptables)**:
   - Transparently intercepts all outbound AI API traffic system-wide (`0.0.0.0:8443`).
   - Covers VS Code, Cursor, terminal CLIs, Python scripts, Node.js, and cURL requests without application plugins.
2. **Browser Guard (Manifest V3 Extension)**:
   - Pre-flight DOM interception across ChatGPT (`chatgpt.com`), Claude (`claude.ai`), and Gemini (`gemini.google.com`).
   - Automatically halts prompts with hard credentials (`HARD BLOCK`) and substitutes sensitive infrastructure values with non-reconstructable semantic tokens (`SILENT REDACT`).
3. **SOC Security Operations Center**:
   - Centralized web dashboard tracking employee exfiltration attempts, targeted AI sites, cryptographic HMAC-SHA256 audit signatures, and risk progression.

---

## 🚀 Quick Start (Local Activation)

### 1. Activate System-Wide OS Protection
Run the single command below to enable transparent kernel routing and start the MITM inspection daemon:
```bash
sudo ./vantix-protect.sh start
```

### 2. Verify / Run Demo Exfiltration
Simulate live exfiltration scenarios (credentials, database URIs, SCADA parameters):
```bash
./vantix-protect.sh demo
```

### 3. Deactivate Protection
Restore default networking and flush firewall routing:
```bash
sudo ./vantix-protect.sh stop
```

---

## 💻 Local Development

### Backend (`vantix-backend`)
```bash
cd vantix-backend
npm install
npm start
# Runs on http://localhost:5000 (WebSocket: ws://localhost:5000/ws/vantix)
```

### Admin Dashboard (`vantix-admin`)
```bash
cd vantix-admin
npm install
npm run dev
# Runs on http://localhost:5173
```

---

## 🌐 Production Cloud Deployment

### 1. Frontend Deployment (Vercel)
- **Root Directory**: `vantix-admin`
- **Framework Preset**: `Vite`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**:
  ```env
  VITE_API_URL=https://your-vantix-backend.onrender.com
  VITE_WS_URL=wss://your-vantix-backend.onrender.com/ws/vantix
  ```

### 2. Backend Deployment (Render)
- **Root Directory**: `vantix-backend`
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `node index.js`
- **Environment Variables**:
  ```env
  PORT=5000
  NODE_ENV=production
  JWT_SECRET=your_production_secret_key_2026
  FRONTEND_URL=https://your-vantix-admin.vercel.app
  ```

---

## 🔐 Administrator Access
- **Portal**: `/login`
- **Default Admin ID**: `admin@vantix.corp`
- **Master Key**: `Admin@123456` (or click *⚡ One-Click Demo Access*)
