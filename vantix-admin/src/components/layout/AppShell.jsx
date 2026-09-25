import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Shield, ShieldAlert, Sliders, Users, Settings, LogOut, Play, Download, Sun, Moon } from 'lucide-react';
import vantixIcon from '../../assets/vantix-icon.png';
import { getStoredTheme, applyTheme } from '../../utils/theme.js';

const AppShell = ({ children, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => getStoredTheme());

  useEffect(() => {
    const handleThemeChange = (e) => {
      if (e.detail?.theme) setTheme(e.detail.theme);
    };
    window.addEventListener('vantix:theme-change', handleThemeChange);
    return () => window.removeEventListener('vantix:theme-change', handleThemeChange);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
    setTheme(next);
  };

  return (
    <div className="app-shell">
      <div className="orion-global-bg" />
      
      {/* Main App Container */}
      <div
        style={{ display: "flex", flexDirection: "column", minHeight: "100vh", width: "100%" }}
      >
        {/* Apple Frosted Navbar */}
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
              <div className="orion-brand-icon">
                <img src={vantixIcon} alt="Vantix" />
              </div>
              <span>VANTIX</span>
            </div>
          </div>

          <div className="orion-actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              className="live-pulse-dot"
              style={{ background: "#10b981", boxShadow: "0 0 10px #10b981" }}
              title="System Connected"
            />
            <button
              className="apple-btn"
              onClick={toggleTheme}
              style={{ padding: "6px 10px" }}
              title={`Switch to ${theme === "light" ? "Dark" : "Light"} mode`}
              aria-label="Toggle theme"
            >
              {theme === "light" ? <Moon size={14} color="#6366f1" /> : <Sun size={14} color="#f59e0b" />}
            </button>
            <button className="apple-btn" onClick={onLogout} style={{ padding: "6px 14px" }}>
              <LogOut size={13} color="#f43f5e" />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Animated Slide-out Apple Drawer */}
        <AnimatePresence>
          {menuOpen && (
            <>
              <motion.div
                className="orion-drawer-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setMenuOpen(false)}
              />
              <motion.aside
                className="orion-drawer"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 350, damping: 32 }}
              >
                <div className="orion-drawer-header">
                  <div className="orion-brand">
                    <div className="orion-brand-icon">
                      <img src={vantixIcon} alt="Vantix" />
                    </div>
                    <span>VANTIX</span>
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

                {/* Bottom of Hamburger Menu: Tactical Actions */}
                <div className="orion-drawer-footer">
                  <div className="orion-drawer-footer-label">TACTICAL OPERATIONS</div>
                  <div className="orion-drawer-footer-actions">
                    <button
                      className="apple-btn drawer-btn"
                      onClick={() => {
                        setMenuOpen(false);
                        window.dispatchEvent(new CustomEvent('vantix:open-simulate'));
                      }}
                    >
                      <Play size={13} color="#ff0055" />
                      <span>Simulate Test</span>
                    </button>
                    <button
                      className="apple-btn primary drawer-btn"
                      onClick={() => {
                        setMenuOpen(false);
                        window.dispatchEvent(new CustomEvent('vantix:export-audit'));
                      }}
                    >
                      <Download size={13} />
                      <span>Export Audit</span>
                    </button>
                  </div>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppShell;
