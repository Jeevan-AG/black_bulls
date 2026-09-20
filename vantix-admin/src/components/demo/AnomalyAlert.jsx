import React from "react";

// ─── Anomaly Alert Modal Overlay ─────────────────────────────────────────────
// Climax moment of the Vantix split-screen demo.
// Displays the plain-English intelligence report generated automatically by
// Vantix's cross-session analyzer (Section 13).
// ─────────────────────────────────────────────────────────────────────────────

export default function AnomalyAlert({ report, riskScore = 94, onClose, onAcknowledge }) {
  if (!report) return null;

  return (
    <div className="anomaly-overlay">
      <div className="anomaly-modal">
        {/* Pulse effect header */}
        <div className="anomaly-header">
          <div className="anomaly-icon-wrap">
            <span className="anomaly-icon">⚠</span>
            <div className="anomaly-pulse" />
          </div>
          <div>
            <h2 className="anomaly-title">CRITICAL ANOMALY DETECTED</h2>
            <p className="anomaly-subtitle">Cross-Session Reconstruction Pattern Identified</p>
          </div>
          <button className="anomaly-close-btn" onClick={onClose} title="Dismiss Overlay">
            ✕
          </button>
        </div>

        {/* Severity Banner */}
        <div className="anomaly-banner">
          <div className="anomaly-score-badge">
            <span className="score-val">{riskScore}</span>
            <span className="score-den">/ 100</span>
          </div>
          <div className="anomaly-banner-text">
            <strong>THREAT LEVEL: CRITICAL (SLOW LEAK ATTACK)</strong>
            <span>Individually harmless queries reconstructed sensitive plant control blueprint.</span>
          </div>
        </div>

        {/* Plain-English Report Content */}
        <div className="anomaly-body">
          <div className="report-pre-box">
            <pre className="report-text">{report}</pre>
          </div>
        </div>

        {/* Action Footer */}
        <div className="anomaly-footer">
          <div className="footer-meta">
            <span className="verified-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Cryptographically Signed (HMAC-SHA256)
            </span>
          </div>
          <div className="footer-actions">
            <button className="btn-secondary" onClick={onClose}>
              Dismiss View
            </button>
            <button className="btn-critical" onClick={onAcknowledge || onClose}>
              Acknowledge & Escalate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
