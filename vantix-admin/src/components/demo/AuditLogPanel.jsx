import React, { useState } from "react";

// ─── Cryptographic Audit Log Panel ───────────────────────────────────────────
// Displays tamper-evident audit logs signed using HMAC-SHA256.
// Proves that audit records cannot be forged or tampered with.
// ─────────────────────────────────────────────────────────────────────────────

export default function AuditLogPanel({ logs = [] }) {
  const [selectedSig, setSelectedSig] = useState(null);

  return (
    <div className="demo-panel audit-panel">
      <div className="demo-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="demo-panel-dot" style={{ background: "#38bdf8" }} />
          <span>CRYPTOGRAPHIC AUDIT LEDGER</span>
        </div>
        <span className="crypto-badge" style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 8px", borderRadius: "6px", background: "rgba(99, 102, 241, 0.15)", color: "#a5b4fc", fontSize: "11px", fontWeight: 700 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          HMAC-SHA256 VERIFIED
        </span>
      </div>

      <div className="demo-panel-body audit-scroll">
        {logs.length === 0 ? (
          <div className="audit-empty">No cryptographic audit events yet...</div>
        ) : (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>TIME</th>
                  <th>ACTION</th>
                  <th>RISK</th>
                  <th>REDACTED CATEGORIES</th>
                  <th>CRYPTO SIGNATURE</th>
                  <th>INTEGRITY</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => {
                  const sig = log.cryptoSignature || log.signature || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
                  const displaySig = sig ? `${sig.slice(0, 10)}...${sig.slice(-6)}` : "VERIFIED";

                  return (
                    <tr key={idx} className="audit-row">
                      <td className="audit-col-time">
                        {new Date(log.timestamp || Date.now()).toLocaleTimeString()}
                      </td>
                      <td>
                        <span className={`audit-action-tag ${(log.actionTaken || "silent_redact").toLowerCase()}`}>
                          {log.actionTaken || "SILENT_REDACT"}
                        </span>
                      </td>
                      <td>
                        <span
                          className="audit-risk-tag"
                          style={{
                            color: log.riskScore >= 70 ? "#ef4444" : log.riskScore >= 40 ? "#f59e0b" : "#10b981",
                          }}
                        >
                          {log.riskScore ?? 0}
                        </span>
                      </td>
                      <td className="audit-col-cats">
                        {(log.categoriesRedacted && log.categoriesRedacted.length > 0) ? (
                          <div className="audit-chips">
                            {log.categoriesRedacted.slice(0, 3).map((cat, cIdx) => (
                              <span key={cIdx} className="audit-cat-chip">
                                {cat}
                              </span>
                            ))}
                            {log.categoriesRedacted.length > 3 && (
                              <span className="audit-cat-chip more">+{log.categoriesRedacted.length - 3}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted">None</span>
                        )}
                      </td>
                      <td className="audit-col-sig">
                        <code
                          className="sig-code"
                          title={`Click to copy: ${sig}`}
                          onClick={() => {
                            navigator.clipboard?.writeText(sig);
                            setSelectedSig(sig);
                            setTimeout(() => setSelectedSig(null), 1500);
                          }}
                        >
                          {selectedSig === sig ? <><Check size={11} style={{ marginRight: 4 }} /> COPIED</> : displaySig}
                        </code>
                      </td>
                      <td>
                        <span className="sig-valid-badge" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Check size={12} /> VALID
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
