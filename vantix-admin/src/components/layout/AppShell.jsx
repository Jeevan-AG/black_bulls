import React, { useState, useEffect } from "react";
import { NavLink, Link } from "react-router-dom";
import {
  Activity,
  ShieldAlert,
  Users,
  Sliders,
  LogOut,
  Shield,
} from "lucide-react";

const AppShell = ({ children, onLogout }) => {
  const [adminEmail, setAdminEmail] = useState("admin@vantix.corp");

  useEffect(() => {
    try {
      const token = sessionStorage.getItem("vantixAdminToken");
      if (token && token.includes(".")) {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload?.email) {
          setAdminEmail(payload.email);
        }
      }
    } catch {
      // Fallback
    }
  }, []);

  return (
    <div className="app-shell">
      {/* Ambient Cyber Radar Background */}
      <div className="vantix-radar-bg" />

      {/* Industrial SOC Command Header */}
      <header className="vantix-header">
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <Link to="/" className="brand-wrapper">
            <div className="brand-logo-hex">
              <Shield size={18} color="#22d3ee" strokeWidth={2.2} />
            </div>
            <div className="brand-text-block">
              <div className="brand-title">
                VANTIX
                <span className="brand-tag">SOC V2</span>
              </div>
              <div className="brand-subtitle">
                AI DLP ENCLAVE FIREWALL
              </div>
            </div>
          </Link>

          {/* Navigation Items */}
          <nav className="vantix-nav">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `vantix-nav-item ${isActive ? "active" : ""}`
              }
            >
              <Activity size={15} />
              <span>SOC Stream</span>
            </NavLink>

            <NavLink
              to="/rules"
              className={({ isActive }) =>
                `vantix-nav-item ${isActive ? "active" : ""}`
              }
            >
              <ShieldAlert size={15} />
              <span>DLP Policies</span>
            </NavLink>

            <NavLink
              to="/employees"
              className={({ isActive }) =>
                `vantix-nav-item ${isActive ? "active" : ""}`
              }
            >
              <Users size={15} />
              <span>Fleet Endpoints</span>
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `vantix-nav-item ${isActive ? "active" : ""}`
              }
            >
              <Sliders size={15} />
              <span>Settings</span>
            </NavLink>
          </nav>
        </div>

        {/* Real-time Telemetry & Profile Actions */}
        <div className="vantix-header-actions">
          {/* TEE Enclave Status */}
          <div className="enclave-badge" title="Cryptographic TEE Enclave Hardware Verified">
            <span className="beacon-dot" />
            <span>TEE ACTIVE</span>
          </div>

          {/* Admin User / Logout */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              paddingLeft: "10px",
              borderLeft: "1px solid var(--border-subtle)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "1px",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  maxWidth: "160px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {adminEmail}
              </span>
              <span
                style={{
                  fontSize: "9px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--cyan-primary)",
                  letterSpacing: "0.04em",
                  fontWeight: 600,
                }}
              >
                ROOT AUDITOR
              </span>
            </div>

            <button
              onClick={onLogout}
              className="btn btn--danger"
              style={{
                padding: "5px 10px",
                fontSize: "11px",
                height: "30px",
                gap: "5px",
              }}
              title="Terminate Admin Session"
            >
              <LogOut size={12} />
              <span>Exit</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Command View */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default AppShell;
