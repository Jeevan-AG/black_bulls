import React from "react";

// ─── Risk Meter Component ───────────────────────────────────────────────────
// Visual radial gauge displaying cumulative cross-session risk (0-100).
// Smoothly shifts colors: Green (0-39) → Amber (40-69) → Red (70-100).
// ─────────────────────────────────────────────────────────────────────────────

export default function RiskMeter({ score = 0, promptCount = 0, anomalyTriggered = false }) {
  const clampedScore = Math.max(0, Math.min(100, score));

  // Determine severity tier
  let tier = { label: "NORMAL", color: "#10b981", bg: "rgba(16, 185, 129, 0.12)" };
  if (clampedScore >= 85 || anomalyTriggered) {
    tier = { label: "CRITICAL", color: "#ef4444", bg: "rgba(239, 68, 68, 0.18)" };
  } else if (clampedScore >= 60) {
    tier = { label: "HIGH", color: "#f97316", bg: "rgba(249, 115, 22, 0.15)" };
  } else if (clampedScore >= 35) {
    tier = { label: "ELEVATED", color: "#eab308", bg: "rgba(234, 179, 8, 0.12)" };
  }

  // Semi-circle gauge math (arc from 180° to 360°)
  const radius = 68;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  return (
    <div className="demo-panel risk-meter-panel">
      <div className="demo-panel-header">
        <span className="demo-panel-dot" style={{ background: tier.color }} />
        <span>CROSS-SESSION RISK METER</span>
        <span
          className="demo-badge"
          style={{ background: tier.bg, color: tier.color, border: `1px solid ${tier.color}44` }}
        >
          {tier.label}
        </span>
      </div>

      <div className="risk-meter-content">
        <div className="gauge-wrapper">
          <svg width="170" height="95" viewBox="0 0 170 95" className="gauge-svg">
            {/* Background Arc */}
            <path
              d="M 15 85 A 68 68 0 0 1 155 85"
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            {/* Value Arc */}
            <path
              d="M 15 85 A 68 68 0 0 1 155 85"
              fill="none"
              stroke={tier.color}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{
                transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.5s ease",
                filter: clampedScore > 70 ? `drop-shadow(0 0 8px ${tier.color}88)` : "none",
              }}
            />
          </svg>

          {/* Center score readout */}
          <div className="gauge-readout">
            <span className="gauge-number" style={{ color: tier.color }}>
              {clampedScore}
            </span>
            <span className="gauge-max">/ 100</span>
          </div>
        </div>

        <div className="risk-meta-stats">
          <div className="meta-stat-item">
            <span className="meta-label">Analyzed Prompts</span>
            <span className="meta-val">{promptCount}</span>
          </div>
          <div className="meta-stat-item">
            <span className="meta-label">Anomaly Status</span>
            <span className="meta-val" style={{ color: anomalyTriggered ? "#ef4444" : "#10b981" }}>
              {anomalyTriggered ? "⚠ BREACH" : "NOMINAL"}
            </span>
          </div>
          <div className="meta-stat-item">
            <span className="meta-label">Leak Vector</span>
            <span className="meta-val" style={{ color: clampedScore > 50 ? "#f97316" : "#94a3b8" }}>
              {clampedScore > 70 ? "MULTI-DAY SLOW LEAK" : clampedScore > 30 ? "OT RECONNAISSANCE" : "PASSIVE"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
