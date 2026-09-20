import React from "react";

// ─── Detection Feed ──────────────────────────────────────────────────────────
// Live scrolling feed of every prompt processed by Vantix.
// Shows: timestamp, risk score, action taken, categories redacted.

const riskColor = (score) => {
  if (score >= 70) return "#ef4444";
  if (score >= 40) return "#f59e0b";
  if (score > 0) return "#22d3ee";
  return "#4ade80";
};

const actionLabel = (action) => {
  const map = {
    silent_redact: "SILENT REDACT",
    combination_strip: "COMBO STRIP",
    hard_block: "HARD BLOCK",
    monitor: "MONITOR",
    pass: "PASS",
  };
  return map[action] || action;
};

const actionColor = (action) => {
  const map = {
    silent_redact: "#22d3ee",
    hard_block: "#ef4444",
    monitor: "#f59e0b",
    pass: "#4ade80",
  };
  return map[action] || "#94a3b8";
};

export default function DetectionFeed({ events = [] }) {
  return (
    <div className="demo-panel detection-feed">
      <div className="demo-panel-header">
        <span className="demo-panel-dot" style={{ background: "#22d3ee" }} />
        <span>DETECTION FEED</span>
        <span className="demo-panel-count">{events.length}</span>
      </div>
      <div className="demo-panel-body feed-scroll">
        {events.length === 0 && (
          <div className="feed-empty">Waiting for prompts...</div>
        )}
        {events.map((evt, i) => (
          <div key={i} className="feed-item" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="feed-item-header">
              <span className="feed-timestamp">
                {new Date(evt.timestamp).toLocaleTimeString()}
              </span>
              <span
                className="feed-risk-badge"
                style={{ background: riskColor(evt.riskScore), color: evt.riskScore >= 40 ? "#000" : "#fff" }}
              >
                RISK {evt.riskScore}
              </span>
              <span
                className="feed-action-badge"
                style={{ borderColor: actionColor(evt.actionTaken), color: actionColor(evt.actionTaken) }}
              >
                {actionLabel(evt.actionTaken)}
              </span>
            </div>
            <div className="feed-item-prompt">{evt.promptSnippet}</div>
            {evt.detections && evt.detections.length > 0 && (
              <div className="feed-item-detections">
                {evt.detections.map((d, j) => (
                  <span key={j} className="feed-detection-tag">
                    {d.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
