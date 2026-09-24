# 🛡️ Vantix Standalone AI Data Guard (v2.0)

**100% Offline AI Data Loss Prevention & TEE Firewall Browser Extension**
No backend servers, databases, or admin portals required. Everything runs 100% locally inside your browser!

---

## 📁 Repository Structure

```
vantix-standalone/
├── Windows/
│   ├── vantix-guard-extension/      # Extension source folder
│   ├── Install-Vantix.bat           # 1-Click Windows Batch Installer
│   ├── Install-Vantix-Windows.ps1   # PowerShell Installer
│   └── README-Windows.md            # Windows Guide
├── Mac/
│   ├── vantix-guard-extension/      # Extension source folder
│   ├── install-mac.command          # 1-Click Mac Command Script
│   └── README-Mac.md                # macOS Guide
└── Linux/
    ├── vantix-guard-extension/      # Extension source folder
    ├── install-linux.sh             # 1-Click Linux Bash Installer
    └── README-Linux.md              # Linux Guide
```

---

## ⚡ How to Install & Use (Windows)

1. Open `vantix-standalone\Windows` and double-click **`Install-Vantix.bat`**.
2. Open **Google Chrome** or **Microsoft Edge** and go to `chrome://extensions` (or `edge://extensions`).
3. Turn ON **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the folder `C:\Users\<YourUsername>\vantix-guard-extension`.

---

## 🚀 Key Features

1. **Zero External Requests / 100% Offline**: Microsecond regex & TEE enclave scanning directly inside the Chrome Extension background worker.
2. **Hard Block Credentials**: Instantly halts prompt submission on ChatGPT, Claude, Gemini, Copilot, Perplexity, & DeepSeek if live AWS keys, OpenAI keys, or DB URIs are found.
3. **Silent PII Redaction**: Automatically substitutes emails, phone numbers, SSNs, and internal IPs with synthetic placeholders (`[PII_VALUE]`).
4. **Embedded Local SOC Dashboard**: Click the extension icon or status badge on ChatGPT to view audit logs, risk meters, and run the interactive local prompt sandbox!
