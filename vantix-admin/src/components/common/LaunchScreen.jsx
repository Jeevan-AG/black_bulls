import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Shield, Zap, Lock, Terminal, Sparkles, Cpu, Globe } from 'lucide-react';

const LaunchScreen = ({ onComplete }) => {
  // 'intro' | 'buffering' | 'done'
  const [phase, setPhase] = useState('intro');

  const handleStart = () => {
    setPhase('buffering');

    // Smooth buffering for 1.8s then push-up reveal
    setTimeout(() => {
      setPhase('done');
      if (onComplete) onComplete();
    }, 1800);
  };

  return (
    <AnimatePresence>
      {phase !== 'done' && (
        <motion.div
          key="apple-interactive-launch"
          initial={{ y: 0, opacity: 1 }}
          exit={{ y: "-100%" }}
          transition={{ duration: 0.75, ease: [0.76, 0, 0.24, 1] }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            backgroundColor: "#060709",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            pointerEvents: "auto",
            padding: 32,
          }}
        >
          {/* Ambient Crimson Background Radial Lights */}
          <div
            style={{
              position: "absolute",
              top: "15%",
              right: "15%",
              width: 550,
              height: 550,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(225, 29, 72, 0.22) 0%, rgba(159, 18, 57, 0.08) 50%, transparent 70%)",
              filter: "blur(70px)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "10%",
              left: "10%",
              width: 450,
              height: 450,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255, 0, 85, 0.15) 0%, transparent 70%)",
              filter: "blur(60px)",
              pointerEvents: "none",
            }}
          />

          {/* Main Glass Hero Container */}
          <div
            style={{
              width: "100%",
              maxWidth: 1040,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              zIndex: 10,
            }}
          >
            {/* 1. Left Column: Information Card */}
            <AnimatePresence>
              {phase === 'intro' && (
                <motion.div
                  key="launch-info-panel"
                  initial={{ opacity: 0, x: -40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -60 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="apple-card"
                  style={{
                    flex: 1,
                    maxWidth: 540,
                    marginRight: 40,
                    padding: 36,
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                    background: "rgba(13, 14, 18, 0.85)",
                    backdropFilter: "blur(30px)",
                    border: "1px solid rgba(225, 29, 72, 0.25)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="apple-pill red">
                      <Shield size={12} color="#ff0055" />
                      HACKFINIX CYBERSECURITY
                    </span>
                    <span className="apple-pill emerald">
                      <Zap size={11} /> System Active
                    </span>
                  </div>

                  <div>
                    <h1
                      style={{
                        fontSize: 34,
                        fontWeight: 700,
                        color: "#ffffff",
                        lineHeight: 1.2,
                        letterSpacing: "-0.025em",
                        margin: 0,
                      }}
                    >
                      Industrial AI Data <br />
                      <span style={{ background: "linear-gradient(135deg, #ff0055 0%, #e11d48 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                        Loss Prevention Engine
                      </span>
                    </h1>

                    <p
                      style={{
                        fontSize: 13.5,
                        lineHeight: 1.6,
                        color: "var(--apple-text-sub)",
                        marginTop: 12,
                        margin: "12px 0 0 0",
                      }}
                    >
                      Zero-config OS network MITM proxy & browser guard. Intercepts outbound AI prompts, tokenizes sensitive secrets, and streams real-time threat telemetry.
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className="apple-pill red">
                      <Cpu size={12} /> MITM Proxy
                    </span>
                    <span className="apple-pill red">
                      <Globe size={12} /> Browser Guard
                    </span>
                    <span className="apple-pill red">
                      <Lock size={12} /> HMAC Audit Log
                    </span>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleStart}
                      className="apple-btn primary"
                      style={{
                        padding: "12px 28px",
                        fontSize: 14,
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 10,
                        cursor: "pointer",
                      }}
                    >
                      <span>Initialize Console</span>
                      <ArrowRight size={16} />
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 2. Right Column: Logo & Looping Orbit Animations */}
            <motion.div
              layout
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="apple-card"
              style={{
                width: phase === 'intro' ? 380 : 420,
                padding: phase === 'intro' ? 40 : 48,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(13, 14, 18, 0.85)",
                backdropFilter: "blur(30px)",
                border: "1px solid rgba(225, 29, 72, 0.25)",
              }}
            >
              <div style={{ position: "relative", width: 140, height: 140, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {/* Outer Orbit Crimson Ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: phase === 'buffering' ? 1.2 : 10,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  style={{
                    position: "absolute",
                    inset: -10,
                    borderRadius: "50%",
                    border: "2px solid transparent",
                    borderTopColor: "#ff0055",
                    borderRightColor: "rgba(225, 29, 72, 0.8)",
                    borderBottomColor: "rgba(159, 18, 57, 0.3)",
                    boxShadow: "0 0 30px rgba(225, 29, 72, 0.5)",
                  }}
                />

                {/* Inner Counter Ring */}
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
                  style={{
                    position: "absolute",
                    inset: -20,
                    borderRadius: "50%",
                    border: "1px dashed rgba(225, 29, 72, 0.25)",
                  }}
                />

                {/* Central VANTIX Glass Crimson Badge */}
                <motion.div
                  animate={phase === 'intro' ? { y: [0, -8, 0] } : { scale: [1, 1.04, 1] }}
                  transition={
                    phase === 'intro'
                      ? { duration: 3.5, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.9, repeat: Infinity, ease: "easeInOut" }
                  }
                  style={{
                    width: 90,
                    height: 90,
                    borderRadius: 24,
                    background: "linear-gradient(135deg, #ff0055 0%, #e11d48 100%)",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 42,
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    boxShadow: "0 16px 45px rgba(225, 29, 72, 0.55)",
                  }}
                >
                  V
                </motion.div>
              </div>

              {/* Text label under logo */}
              <div style={{ marginTop: 24, textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#ffffff", letterSpacing: "0.15em" }}>
                  VANTIX
                </div>

                {phase === 'intro' ? (
                  <div style={{ fontSize: 11, color: "var(--apple-text-muted)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    SOC Console Ready
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginTop: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
                  >
                    <span className="apple-pill red" style={{ fontSize: 11 }}>
                      <Sparkles size={11} color="#ff0055" />
                      Connecting Telemetry Stream...
                    </span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LaunchScreen;
