# 🍏 Vantix Standalone AI Data Guard — macOS Installation Guide

This standalone version runs **100% offline on your Mac**. No backend servers, Node.js scripts, databases, or admin tools required!

---

## ⚡ Quick Setup (macOS)

1. Double-click **`install-mac.command`** in Finder (if macOS warns about unsigned script, right-click and choose *Open*).
2. The installer will copy the extension folder to your user directory (`~/vantix-guard-extension`).
3. Open **Google Chrome**, **Brave**, or **Microsoft Edge** and go to:
   - `chrome://extensions`
4. Enable **Developer mode** (toggle in the top right).
5. Click **Load unpacked** and select the folder:
   `~/vantix-guard-extension`

---

## 🎯 Features Included Inside the Extension

- **100% Offline Local Engine**: Scans prompts in <2ms directly in your browser.
- **Hard Block Credentials**: Aborts prompt submission if AWS keys, OpenAI keys, or DB URIs are detected.
- **Silent PII Redaction**: Automatically substitutes emails, phone numbers, and SSNs with synthetic placeholders (`[PII_VALUE]`).
- **Integrated Local Dashboard**: Click the Vantix Extension Popup or shield badge on ChatGPT/Claude to view violation logs, risk meters, and run the interactive prompt sandbox!
