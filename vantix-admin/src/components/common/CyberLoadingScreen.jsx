import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Zap, Terminal, Activity, Cpu, CheckCircle2 } from 'lucide-react';
import vantixIcon from '../../assets/vantix-icon.png';
import vantixLogo from '../../assets/vantix-logo.png';
import './CyberLoadingScreen.css';

const CyberLoadingScreen = ({ onComplete, duration = 2200 }) => {
  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [isDone, setIsDone] = useState(false);

  const statusLogs = [
    { text: "INITIALIZING ZERO-TRUST SECURITY CORE...", icon: <Cpu size={14} /> },
    { text: "CALIBRATING QUANTUM ENCRYPTION TUNNEL...", icon: <Shield size={14} /> },
    { text: "ACTIVATING NEURAL DLP THREAT FILTERS...", icon: <Zap size={14} /> },
    { text: "SYNCHRONIZING SOC TELEMETRY STREAMS...", icon: <Activity size={14} /> },
    { text: "SYSTEM ARMED // COMMAND ACCESS GRANTED", icon: <CheckCircle2 size={14} /> },
  ];

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const currentProgress = Math.min(100, Math.floor((elapsed / duration) * 100));
      setProgress(currentProgress);

      const logIndex = Math.min(
        statusLogs.length - 1,
        Math.floor((elapsed / duration) * statusLogs.length)
      );
      setStatusIndex(logIndex);

      if (elapsed >= duration) {
        clearInterval(interval);
        setIsDone(true);
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 400);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [duration, onComplete]);

  const handleSkip = () => {
    setProgress(100);
    setIsDone(true);
    if (onComplete) onComplete();
  };

  return (
    <AnimatePresence>
      {!isDone && (
        <motion.div
          className="cyber-loader-container"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          onClick={handleSkip}
        >
          {/* Ambient Cyber Background Grid & Deep Crimson Light Cones */}
          <div className="cyber-loader-grid" />
          <div className="cyber-loader-glow glow-top-right" />
          <div className="cyber-loader-glow glow-bottom-left" />

          {/* Central Buffering & Emblem Unit */}
          <div className="cyber-loader-content">
            <div className="cyber-buffering-wrapper">
              {/* Outer Pulsing Aura */}
              <div className="cyber-loader-pulse-aura" />

              {/* Orbiting Laser Segment Ring */}
              <svg className="cyber-svg-outer-orbit" viewBox="0 0 200 200">
                <circle
                  cx="100"
                  cy="100"
                  r="92"
                  className="cyber-svg-track"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="92"
                  className="cyber-svg-spinner"
                  style={{
                    strokeDashoffset: 578 - (578 * progress) / 100
                  }}
                />
              </svg>

              {/* Rotating Dashed Reticle Ring */}
              <div className="cyber-reticle-ring" />
              <div className="cyber-reticle-counter-ring" />

              {/* HUD Compass Ticks */}
              <div className="cyber-hud-tick tick-n">00</div>
              <div className="cyber-hud-tick tick-e">90</div>
              <div className="cyber-hud-tick tick-s">180</div>
              <div className="cyber-hud-tick tick-w">270</div>

              {/* Central Eagle Crest Logo Box */}
              <div className="cyber-loader-emblem-box">
                <img
                  src={vantixIcon}
                  alt="Vantix Security Crest"
                  className="cyber-loader-eagle-img"
                />
                <div className="cyber-emblem-scanline" />
              </div>
            </div>

            {/* Brand Title */}
            <div className="cyber-loader-brand-wrapper">
              <span className="cyber-loader-brand-title">VANTIX</span>
              <span className="cyber-loader-brand-subtitle">AI DATA LOSS PREVENTION &bull; SOC COMMAND</span>
            </div>

            {/* Progress & Live Telemetry */}
            <div className="cyber-loader-telemetry">
              {/* Live Loading Bar */}
              <div className="cyber-loader-bar-bg">
                <div
                  className="cyber-loader-bar-fill"
                  style={{ width: `${progress}%` }}
                />
                <div
                  className="cyber-loader-bar-light"
                  style={{ left: `${progress}%` }}
                />
              </div>

              {/* Percentage & Status Text */}
              <div className="cyber-loader-status-row">
                <div className="cyber-status-text-container">
                  <span className="cyber-status-icon">
                    {statusLogs[statusIndex]?.icon}
                  </span>
                  <span className="cyber-status-label">
                    {statusLogs[statusIndex]?.text}
                  </span>
                </div>
                <span className="cyber-status-percent">
                  {progress}%
                </span>
              </div>
            </div>

            {/* Skip hint */}
            <div className="cyber-loader-skip-hint">
              <span>Click anywhere to initialize immediately</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CyberLoadingScreen;
