# 🐧 Vantix Standalone AI Data Guard — Linux Installation Guide

This standalone version runs **100% offline on Linux**. No root privileges, backend servers, databases, or admin tools required!

---

## ⚡ Quick Setup (Linux)

1. Open your terminal in this directory and make the script executable:
   ```bash
   chmod +x install-linux.sh
   ./install-linux.sh
   ```
2. The script will copy the extension folder to `~/.local/share/vantix-guard-extension`.
3. Open **Chrome**, **Chromium**, **Brave**, or **Edge** and go to `chrome://extensions`.
4. Enable **Developer mode** (top-right toggle).
5. Click **Load unpacked** and select:
   `~/.local/share/vantix-guard-extension`

---

## 🎯 Features Included Inside the Extension

- **100% Offline Local Engine**: Scans prompts in <2ms directly in your browser.
- **Hard Block Credentials**: Aborts prompt submission if AWS keys, OpenAI keys, or DB URIs are detected.
- **Silent PII Redaction**: Automatically substitutes emails, phone numbers, and SSNs with synthetic placeholders (`[PII_VALUE]`).
- **Integrated Local Dashboard**: Click the Vantix Extension Popup or shield badge on ChatGPT/Claude to view violation logs, risk meters, and run the interactive prompt sandbox!
