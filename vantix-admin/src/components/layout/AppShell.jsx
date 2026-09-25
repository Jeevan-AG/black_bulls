import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Shield, ShieldAlert, Sliders, Users, Settings, LogOut, Radio, Terminal } from 'lucide-react';
import LaunchScreen from '../common/LaunchScreen';

const AppShell = ({ children, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showContent, setShowContent] = useState(false);

  return (
    <div className="app-shell">
      {/* Website Launch Splash Animation */}
      <LaunchScreen onComplete={() => setShowContent(true)} />

      <div className="orion-global-bg" />
      
      {/* Main App Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: showContent ? 1 : 0.85, scale: showContent ? 1 : 0.99 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        style={{ display: "flex", flexDirection: "column", minHeight: "100vh", width: "100%" }}
      >
        {/* Top Cyber Navigation Bar */}
        <header className="orion-topnav">
          <div className="orion-topnav-left">
            <button
              className="orion-hamburger-btn"
              onClick={() => setMenuOpen(!menuOpen)}
              title="Navigation Menu"
              aria-label="Navigation Menu"
            >
              <Menu size={18} />
            </button>

            <div className="orion-brand">
              <div className="orion-brand-icon">V</div>
              <span>VANTIX SOC</span>
            </div>

            <div
              style={{
                display: "none",
                alignItems: "center",
                gap: 8,
                marginLeft: 16,
                padding: "4px 12px",
                borderRadius: "9999px",
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                fontSize: 11,
                fontWeight: 700,
                color: "#34d399",
                letterSpacing: "0.04em",
              }}
              className="soc-live-pill"
            >
              <span className="live-pulse-dot emerald" style={{ width: 6, height: 6 }} />
              <span>CORE ACTIVE</span>
            </div>
          </div>

          <div className="orion-actions">
            <button
              className="apple-btn"
              onClick={onLogout}
              style={{
                padding: "7px 16px",
                fontSize: 12.5,
                fontWeight: 600,
                borderRadius: "9999px",
              }}
            >
              <LogOut size={13} color="#f43f5e" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Animated Slide-out Cyber Drawer */}
        <AnimatePresence>
          {menuOpen && (
            <>
              <motion.div
                className="orion-drawer-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                onClick={() => setMenuOpen(false)}
              />
              <motion.aside
                className="orion-drawer"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
              >
                <div className="orion-drawer-header">
                  <div className="orion-brand">
                    <div className="orion-brand-icon">V</div>
                    <span>VANTIX DEFENSE</span>
                  </div>
                  <button className="orion-drawer-close" onClick={() => setMenuOpen(false)}>
                    <X size={16} />
                  </button>
                </div>

                <nav className="orion-drawer-nav">
                  <NavLink
                    to="/"
                    end
                    className={({ isActive }) => (isActive ? 'active' : '')}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Shield size={17} />
                    <span>Operation Centre</span>
                  </NavLink>

                  <NavLink
                    to="/threat-tracking"
                    className={({ isActive }) => (isActive ? 'active' : '')}
                    onClick={() => setMenuOpen(false)}
                  >
                    <ShieldAlert size={17} />
                    <span>Threat Tracking</span>
                  </NavLink>

                  <NavLink
                    to="/rules"
                    className={({ isActive }) => (isActive ? 'active' : '')}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Sliders size={17} />
                    <span>DLP Rules</span>
                  </NavLink>

                  <NavLink
                    to="/employees"
                    className={({ isActive }) => (isActive ? 'active' : '')}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Users size={17} />
                    <span>Employees</span>
                  </NavLink>

                  <NavLink
                    to="/settings"
                    className={({ isActive }) => (isActive ? 'active' : '')}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Settings size={17} />
                    <span>Settings</span>
                  </NavLink>
                </nav>

                <div
                  style={{
                    padding: "20px 24px",
                    borderTop: "1px solid var(--apple-border)",
                    fontSize: 11,
                    color: "var(--apple-text-muted)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#ffffff", letterSpacing: "0.04em" }}>
                    HACKFINIX VANTIX v2.6.0
                  </div>
                  <div>Industrial Cybersecurity Engine</div>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main className="main-content">
          {children}
        </main>
      </motion.div>
    </div>
  );
};

export default AppShell;
