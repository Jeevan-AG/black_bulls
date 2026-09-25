import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Zap,
  Lock,
  ArrowRight,
  Cpu,
  Globe,
  Radio,
  CheckCircle2,
  Terminal,
} from 'lucide-react';

const BOOT_LOGS = [
  'INITIALIZING OS MITM PACKET INTERCEPTOR...',
  'CALIBRATING HYPERSONIC DLP REGEX MATRICES...',
  'ESTABLISHING HMAC-SHA256 AUDIT LOG SHIELD...',
  'SYNCHRONIZING THREAT INTELLIGENCE MATRIX...',
  'SYSTEM ARMED & OPERATIONAL - CONNECTED.',
];

const LaunchScreen = ({ onComplete }) => {
  // 'intro' | 'buffering' | 'done'
  const [phase, setPhase] = useState('intro');
  const [logIndex, setLogIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const handleStart = () => {
    setPhase('buffering');
  };

  useEffect(() => {
    if (phase !== 'buffering') return;

    // Simulate real high-tech diagnostic boot sequence
    const logInterval = setInterval(() => {
      setLogIndex((prev) => (prev < BOOT_LOGS.length - 1 ? prev + 1 : prev));
    }, 420);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setTimeout(() => {
            setPhase('done');
            if (onComplete) onComplete();
          }, 350);
          return 100;
        }
        return prev + Math.floor(Math.random() * 18 + 12);
      });
    }, 180);

    return () => {
      clearInterval(logInterval);
      clearInterval(progressInterval);
    };
  }, [phase, onComplete]);

  return (
    <AnimatePresence>
      {phase !== 'done' && (
        <motion.div
          key="cyber-launch-screen"
          initial={{ y: 0, opacity: 1 }}
          exit={{ y: '-100%' }}
          transition={{ duration: 0.8, ease: [0.77, 0, 0.175, 1] }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            backgroundColor: '#07080c',
            backgroundImage: `
              radial-gradient(ellipse 80% 50% at 50% -20%, rgba(255, 0, 85, 0.28) 0%, transparent 70%),
              radial-gradient(circle 600px at 80% 80%, rgba(225, 29, 72, 0.15) 0%, transparent 60%),
              linear-gradient(rgba(255, 0, 85, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 0, 85, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: '100% 100%, 100% 100%, 48px 48px, 48px 48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            padding: '24px',
          }}
        >
          {/* Main Hero Container */}
          <div
            style={{
              width: '100%',
              maxWidth: 1100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              zIndex: 10,
            }}
          >
            {/* 1. Left Information Deck */}
            <AnimatePresence>
              {phase === 'intro' && (
                <motion.div
                  key="hero-intro-deck"
                  initial={{ opacity: 0, x: -40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -60 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    flex: 1,
                    maxWidth: 580,
                    marginRight: 48,
                    padding: '40px 44px',
                    borderRadius: '26px',
                    background: 'linear-gradient(135deg, rgba(16, 20, 32, 0.85) 0%, rgba(10, 12, 18, 0.95) 100%)',
                    backdropFilter: 'blur(36px)',
                    WebkitBackdropFilter: 'blur(36px)',
                    border: '1px solid rgba(255, 0, 85, 0.22)',
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 24px 60px -15px rgba(0, 0, 0, 0.9), 0 0 35px rgba(255, 0, 85, 0.12)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 24,
                  }}
                >
                  {/* Top Holographic Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                        padding: '5px 14px',
                        borderRadius: '9999px',
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                        background: 'rgba(255, 0, 85, 0.14)',
                        border: '1px solid rgba(255, 0, 85, 0.45)',
                        color: '#ff2b5f',
                        boxShadow: '0 0 16px rgba(255, 0, 85, 0.25)',
                      }}
                    >
                      <Shield size={13} color="#ff0055" />
                      HACKFINIX CYBER DEFENSE 2026
                    </span>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 12px',
                        borderRadius: '9999px',
                        fontSize: 11,
                        fontWeight: 700,
                        background: 'rgba(16, 185, 129, 0.12)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        color: '#34d399',
                      }}
                    >
                      <span className="live-pulse-dot emerald" style={{ width: 6, height: 6 }} />
                      GATEWAY ONLINE
                    </span>
                  </div>

                  {/* Title & Core Pitch */}
                  <div>
                    <h1
                      style={{
                        fontSize: 38,
                        fontWeight: 800,
                        color: '#ffffff',
                        lineHeight: 1.18,
                        letterSpacing: '-0.03em',
                        margin: 0,
                      }}
                    >
                      Autonomous AI Data <br />
                      <span
                        style={{
                          background: 'linear-gradient(135deg, #ff1744 0%, #ff0055 50%, #f43f5e 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          filter: 'drop-shadow(0 0 25px rgba(255, 0, 85, 0.4))',
                        }}
                      >
                        Loss Prevention Engine
                      </span>
                    </h1>

                    <p
                      style={{
                        fontSize: 14.5,
                        lineHeight: 1.65,
                        color: '#94a3b8',
                        marginTop: 16,
                        marginBottom: 0,
                      }}
                    >
                      Real-time OS proxy & AI interception matrix. Neutralizes outbound source code leaks, API keys, SCADA registers, and regulated PII before reaching remote LLM endpoints.
                    </p>
                  </div>

                  {/* Feature Tags */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        padding: '6px 14px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#cbd5e1',
                      }}
                    >
                      <Cpu size={13} color="#ff0055" />
                      <span>Kernel MITM Proxy</span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        padding: '6px 14px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#cbd5e1',
                      }}
                    >
                      <Globe size={13} color="#06b6d4" />
                      <span>Browser Guard</span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        padding: '6px 14px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#cbd5e1',
                      }}
                    >
                      <Lock size={13} color="#10b981" />
                      <span>HMAC-SHA256 Trail</span>
                    </div>
                  </div>

                  {/* High-Impact CTA Button */}
                  <div style={{ marginTop: 8 }}>
                    <motion.button
                      whileHover={{ scale: 1.03, boxShadow: '0 0 35px rgba(255, 0, 85, 0.7)' }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleStart}
                      className="apple-btn primary"
                      style={{
                        padding: '14px 34px',
                        fontSize: 15,
                        fontWeight: 700,
                        letterSpacing: '0.02em',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 12,
                        cursor: 'pointer',
                        borderRadius: '14px',
                      }}
                    >
                      <span>INITIALIZE DEFENSE PROTOCOL</span>
                      <ArrowRight size={18} />
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 2. Right Visual Deck: Holographic HUD Shield & Padlock (HackfiniX Emblem) */}
            <motion.div
              layout
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              style={{
                width: phase === 'intro' ? 440 : 540,
                padding: phase === 'intro' ? '48px 40px' : '56px 48px',
                borderRadius: '28px',
                background: 'linear-gradient(135deg, rgba(14, 17, 26, 0.9) 0%, rgba(8, 10, 15, 0.98) 100%)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
                border: '1px solid rgba(255, 0, 85, 0.3)',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 30px 70px -20px rgba(0, 0, 0, 0.95), 0 0 45px rgba(255, 0, 85, 0.18)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              {/* Corner Cyber Brackets */}
              <div style={{ position: 'absolute', top: 12, left: 12, width: 14, height: 14, borderTop: '2px solid #ff0055', borderLeft: '2px solid #ff0055' }} />
              <div style={{ position: 'absolute', top: 12, right: 12, width: 14, height: 14, borderTop: '2px solid #ff0055', borderRight: '2px solid #ff0055' }} />
              <div style={{ position: 'absolute', bottom: 12, left: 12, width: 14, height: 14, borderBottom: '2px solid #ff0055', borderLeft: '2px solid #ff0055' }} />
              <div style={{ position: 'absolute', bottom: 12, right: 12, width: 14, height: 14, borderBottom: '2px solid #ff0055', borderRight: '2px solid #ff0055' }} />

              {/* Central Holographic Target HUD */}
              <div
                style={{
                  position: 'relative',
                  width: phase === 'intro' ? 200 : 220,
                  height: phase === 'intro' ? 200 : 220,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                }}
              >
                {/* Outermost Segmented HUD Ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: phase === 'buffering' ? 3 : 16,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                  style={{
                    position: 'absolute',
                    inset: -14,
                    borderRadius: '50%',
                    border: '2px dashed rgba(255, 0, 85, 0.45)',
                    boxShadow: '0 0 25px rgba(255, 0, 85, 0.25)',
                  }}
                />

                {/* Counter Rotating Ring with Accent Notch */}
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{
                    duration: phase === 'buffering' ? 1.5 : 9,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                  style={{
                    position: 'absolute',
                    inset: -2,
                    borderRadius: '50%',
                    border: '2px solid transparent',
                    borderTopColor: '#ff0055',
                    borderRightColor: 'rgba(255, 0, 85, 0.7)',
                    borderBottomColor: 'rgba(225, 29, 72, 0.3)',
                    boxShadow: '0 0 35px rgba(255, 0, 85, 0.4)',
                  }}
                />

                {/* Deep Neon Red Halo Diffuse Backlight */}
                <div
                  style={{
                    position: 'absolute',
                    width: 130,
                    height: 130,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255, 0, 85, 0.6) 0%, rgba(225, 29, 72, 0.25) 50%, transparent 75%)',
                    filter: 'blur(20px)',
                  }}
                />

                {/* Central Cybernetic Shield & Padlock Emblem (from HackfiniX badge) */}
                <motion.div
                  animate={phase === 'intro' ? { scale: [1, 1.04, 1] } : { scale: [1, 1.08, 1] }}
                  transition={{
                    duration: phase === 'intro' ? 2.8 : 0.8,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  style={{
                    width: 110,
                    height: 110,
                    borderRadius: '28px',
                    background: 'linear-gradient(145deg, #ff0055 0%, #e11d48 55%, #881337 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 12px 35px rgba(255, 0, 85, 0.6), inset 0 2px 0 rgba(255, 255, 255, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    position: 'relative',
                    zIndex: 5,
                  }}
                >
                  <Lock size={44} color="#ffffff" strokeWidth={2.4} />
                </motion.div>
              </div>

              {/* Brand Label under HUD */}
              <div style={{ textAlign: 'center', marginTop: 6 }}>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    letterSpacing: '0.14em',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <span>VANTIX SOC</span>
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    color: '#ff2a5f',
                    textTransform: 'uppercase',
                    marginTop: 4,
                  }}
                >
                  INDUSTRIAL CYBERSECURITY
                </div>
              </div>

              {/* ── Phase 2: High-Tech Diagnostic Boot Console ── */}
              {phase === 'buffering' && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    width: '100%',
                    marginTop: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                  }}
                >
                  {/* Glowing Progress Bar */}
                  <div
                    style={{
                      width: '100%',
                      height: 7,
                      borderRadius: 9999,
                      background: 'rgba(255, 255, 255, 0.06)',
                      overflow: 'hidden',
                      border: '1px solid rgba(255, 0, 85, 0.25)',
                    }}
                  >
                    <motion.div
                      style={{
                        height: '100%',
                        width: `${Math.min(progress, 100)}%`,
                        background: 'linear-gradient(90deg, #ff0055, #ff1744)',
                        boxShadow: '0 0 16px #ff0055',
                        borderRadius: 9999,
                        transition: 'width 0.18s ease-out',
                      }}
                    />
                  </div>

                  {/* Terminal Log Readout */}
                  <div
                    style={{
                      background: 'rgba(5, 7, 10, 0.8)',
                      border: '1px solid rgba(255, 0, 85, 0.2)',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 11.5,
                      color: '#34d399',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <Terminal size={14} color="#ff0055" />
                    <span>{BOOT_LOGS[logIndex]}</span>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LaunchScreen;
