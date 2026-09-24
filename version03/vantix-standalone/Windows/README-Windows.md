# 🪟 Vantix Standalone AI Data Guard — Windows Installation Guide

This standalone version runs **100% offline on your Windows PC**. No backend servers, databases, or admin tools required!

---

## ⚡ Quick 1-Click Installation (Windows)

1. Double-click **`Install-Vantix.bat`** (or right-click `Install-Vantix-Windows.ps1` and select *Run with PowerShell*).
2. The script will copy the extension folder to your user directory (`%USERPROFILE%\vantix-guard-extension`).
3. Open **Google Chrome** or **Microsoft Edge** and navigate to:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
4. Toggle **Developer mode** ON in the top-right corner.
5. Click **Load unpacked** and select the folder:
   `C:\Users\<YourUsername>\vantix-guard-extension`

---

## 🎯 Features Included Inside the Extension

- **100% Offline Local Engine**: Scans prompts in <2ms directly in your browser.
- **Hard Block Credentials**: Aborts prompt submission if AWS keys, OpenAI keys, or DB URIs are detected.
- **Silent PII Redaction**: Automatically substitutes emails, phone numbers, and SSNs with synthetic placeholders (`[PII_VALUE]`).
- **Integrated Local Dashboard**: Click the Vantix Extension Popup or shield badge on ChatGPT/Claude to view violation logs, risk meters, and run the interactive prompt sandbox!
