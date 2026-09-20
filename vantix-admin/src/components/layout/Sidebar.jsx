import React from "react";
import { Link, useLocation } from "react-router-dom";
import logo from "../../assets/vantix-logo.svg";
import { IconGrid, IconLogout, IconShield, IconUsers } from "./icons";

function IconReport(props) {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

function IconViolation(props) {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}

function IconSettings(props) {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

function IconDemo(props) {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  );
}

function NavItem({ to, icon, label }) {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link to={to} data-active={active ? "true" : "false"} title={label}>
      {icon}
    </Link>
  );
}

export default function Sidebar({ onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <img src={logo} alt="Vantix" />
      </div>

      <nav className="nav" aria-label="Primary">
        <NavItem to="/" label="Admin Dashboard & Live SOC" icon={<IconGrid />} />
        <NavItem to="/rules" label="Security Policy Engine" icon={<IconShield />} />
        <NavItem to="/employees" label="Monitored Employees" icon={<IconUsers />} />
        <NavItem to="/settings" label="Settings" icon={<IconSettings />} />
      </nav>

      <div className="sidebar__footer">
        <button
          onClick={onLogout}
          type="button"
          style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", width: "56px", height: "56px", borderRadius: "20px", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
        >
          <IconLogout style={{ width: 24, height: 24 }} />
        </button>
      </div>
    </aside>
  );
}
