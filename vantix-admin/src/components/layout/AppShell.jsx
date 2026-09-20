import React from 'react';
import { NavLink } from 'react-router-dom';
import { Search, User, Sliders } from 'lucide-react';

const AppShell = ({ children, onLogout }) => {
  return (
    <div className="app-shell">
      <div className="orion-global-bg"></div>
      
      <header className="orion-topnav">
        <div className="orion-brand">
          <div className="orion-brand-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--brand-purple)', color: 'white' }}>V</div>
          VANTIX
        </div>

        <nav className="orion-nav-links">
          <NavLink to="/" end className={({isActive}) => isActive ? 'active' : ''} data-active={window.location.pathname === '/'}>SOC Overview</NavLink>
          <NavLink to="/rules" data-active={window.location.pathname.includes('/rules')}>DLP Rules</NavLink>
          <NavLink to="/settings" data-active={window.location.pathname.includes('/settings')}>Settings</NavLink>
        </nav>

        <div className="orion-actions">
          <button
            onClick={onLogout}
            title="Sign Out of Admin Console"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              color: "#f87171",
              padding: "6px 14px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"; }}
          >
            <User size={14} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default AppShell;
