import React, { useState } from "react";
import { useLocation } from "react-router-dom";

function routeMeta(pathname) {
  if (pathname === "/") {
    return {
      title: "Security Overview",
      subtitle: "Live posture and recent data-leak prevention activity.",
    };
  }
  if (pathname === "/employees") {
    return {
      title: "Employee Directory",
      subtitle: "Provision users and monitor onboarding status.",
    };
  }
  if (pathname === "/rules") {
    return {
      title: "Detection Rules",
      subtitle: "Configure protected domains and sensitive keywords.",
    };
  }
  if (pathname === "/violations") {
    return {
      title: "Violation Audit Log",
      subtitle: "Detailed history of all blocked data leakage attempts.",
    };
  }
  if (pathname === "/reports") {
    return {
      title: "Reports",
      subtitle: "Generate and export weekly, monthly, or yearly activity reports.",
    };
  }
  if (pathname === "/settings") {
    return {
      title: "Settings",
      subtitle: "Manage organization, security, and preferences.",
    };
  }
  return { title: "Vantix Admin", subtitle: "Secure-by-default operations." };
}

export default function Topbar({ title, subtitle }) {
  const { pathname } = useLocation();
  const meta = routeMeta(pathname);
  const finalTitle = title || meta.title;
  const finalSubtitle = subtitle || meta.subtitle;

  const [isDark, setIsDark] = useState(
    () => (localStorage.getItem("theme") || "light") === "dark"
  );

  return (
    <header className="topbar">
      <div className="topbar__row">
        <div className="topbar__title">
          <h1>{finalTitle}</h1>
          <p>{finalSubtitle}</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Status indicator */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
            borderRadius: 999,
            background: "var(--panel)",
            border: "1px solid var(--border-color)",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-secondary)",
          }}>
            <div className="pulse-dot" />
            <span>System Active</span>
          </div>

          {/* Download Extension Button */}
          <a
            href="/downloads/vantix-browser-guard.zip"
            download="vantix-browser-guard.zip"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "6px 14px",
              borderRadius: 8,
              background: "rgba(37, 230, 217, 0.1)",
              border: "1px solid var(--brand)",
              color: "var(--brand)",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              cursor: "pointer",
            }}
            title="Download Chrome Extension (.zip) for remote employee or judge evaluation"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Download Extension (.zip)</span>
          </a>

          {/* Theme toggle */}
          <div
            className="theme-toggle"
            onClick={() => {
              window.toggleTheme();
              setIsDark(!isDark);
            }}
            title="Toggle theme"
          >
            <div className="toggle-track">
              <div className="toggle-thumb"></div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
