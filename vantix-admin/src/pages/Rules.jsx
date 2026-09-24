import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Shield, Key, FileText, Lock, Plus, Trash2 } from "lucide-react";
import api from "../utils/api";

const NUMBER_TYPE_LABELS = {
  phone: "Phone / Contact No.",
  account_number: "Bank Account",
  ifsc: "IFSC Code",
  aadhaar: "Aadhaar",
  pan: "PAN",
  employee_id: "Employee ID",
  other: "Other",
};

const EMPTY_APIKEY = { label: "", value: "" };
const EMPTY_NUMBER = { label: "", type: "phone", value: "" };

const Rules = () => {
  const [rules, setRules] = useState({
    domains: [],
    keywords: [],
    customPatterns: [],
    apiKeys: [],
    sensitiveNumbers: [],
    monitoredApps: [],
  });
  const [newDomain, setNewDomain] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [newApiKey, setNewApiKey] = useState(EMPTY_APIKEY);
  const [newNumber, setNewNumber] = useState(EMPTY_NUMBER);
  const [busy, setBusy] = useState(false);

  const fetchRules = async () => {
    try {
      const res = await api.get("/rules");
      setRules({
        domains: res.data.companyRules?.domains || [],
        keywords: res.data.companyRules?.keywords || [],
        customPatterns: res.data.companyRules?.customPatterns || [],
        apiKeys: res.data.companyRules?.apiKeys || [],
        sensitiveNumbers: res.data.companyRules?.sensitiveNumbers || [],
        monitoredApps: res.data.companyRules?.monitoredApps || [],
      });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const wrap = (fn) => async (...args) => {
    try {
      setBusy(true);
      await fn(...args);
      await fetchRules();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handleAddDomain = wrap(async (e) => {
    e.preventDefault();
    await api.post("/rules/domain", { domain: newDomain });
    setNewDomain("");
  });
  const handleAddKeyword = wrap(async (e) => {
    e.preventDefault();
    await api.post("/rules/keyword", { keyword: newKeyword });
    setNewKeyword("");
  });
  const handleAddApiKey = wrap(async (e) => {
    e.preventDefault();
    await api.post("/rules/apikey", newApiKey);
    setNewApiKey(EMPTY_APIKEY);
  });
  const handleAddNumber = wrap(async (e) => {
    e.preventDefault();
    await api.post("/rules/number", newNumber);
    setNewNumber(EMPTY_NUMBER);
  });

  const handleRemoveDomain = wrap((domain) => api.delete("/rules/domain", { data: { domain } }));
  const handleRemoveKeyword = wrap((keyword) => api.delete("/rules/keyword", { data: { keyword } }));
  const handleRemoveApiKey = wrap((id) => api.delete(`/rules/apikey/${id}`));
  const handleRemoveNumber = wrap((id) => api.delete(`/rules/number/${id}`));

  const totalRules = rules.domains.length + rules.keywords.length + rules.apiKeys.length + rules.sensitiveNumbers.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
    >
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#ffffff", margin: 0, letterSpacing: "-0.02em" }}>
            DLP Rules
          </h1>
          <p style={{ fontSize: 13, color: "var(--apple-text-muted)", margin: "4px 0 0 0" }}>
            Data Loss Prevention rules & tokenization policy engine
          </p>
        </div>

        <span className="apple-pill indigo">{totalRules} Active Rules</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 20 }}>
        {/* Protected Domains Card */}
        <div className="apple-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Shield size={16} color="#38bdf8" />
              <span style={{ fontSize: 15, fontWeight: 600, color: "#ffffff" }}>Protected Domains</span>
            </div>
            <span className="apple-pill cyan">{rules.domains.length}</span>
          </div>

          <form onSubmit={handleAddDomain} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input
              className="apple-input"
              type="text"
              placeholder="@company.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              required
            />
            <button className="apple-btn primary" type="submit" disabled={busy} style={{ whiteSpace: "nowrap" }}>
              <Plus size={14} /> Add
            </button>
          </form>

          <table className="apple-table">
            <thead>
              <tr>
                <th>Domain Pattern</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rules.domains.map((d, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{d}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="apple-btn danger" onClick={() => handleRemoveDomain(d)} disabled={busy} style={{ padding: "4px 8px" }}>
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {rules.domains.length === 0 && (
                <tr>
                  <td colSpan={2} style={{ textAlign: "center", color: "var(--apple-text-muted)", padding: 20 }}>
                    No domains configured
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Secret Keywords Card */}
        <div className="apple-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={16} color="#f59e0b" />
              <span style={{ fontSize: 15, fontWeight: 600, color: "#ffffff" }}>Confidential Keywords</span>
            </div>
            <span className="apple-pill amber">{rules.keywords.length}</span>
          </div>

          <form onSubmit={handleAddKeyword} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input
              className="apple-input"
              type="text"
              placeholder="Project Falcon"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              required
            />
            <button className="apple-btn primary" type="submit" disabled={busy} style={{ whiteSpace: "nowrap" }}>
              <Plus size={14} /> Add
            </button>
          </form>

          <table className="apple-table">
            <thead>
              <tr>
                <th>Keyword Pattern</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rules.keywords.map((k, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{k}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="apple-btn danger" onClick={() => handleRemoveKeyword(k)} disabled={busy} style={{ padding: "4px 8px" }}>
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {rules.keywords.length === 0 && (
                <tr>
                  <td colSpan={2} style={{ textAlign: "center", color: "var(--apple-text-muted)", padding: 20 }}>
                    No keywords configured
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Protected API Keys Card */}
      <div className="apple-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Key size={16} color="#818cf8" />
            <span style={{ fontSize: 15, fontWeight: 600, color: "#ffffff" }}>Protected API Keys</span>
          </div>
          <span className="apple-pill indigo">{rules.apiKeys.length}</span>
        </div>

        <form onSubmit={handleAddApiKey} style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 10, marginBottom: 16 }}>
          <input
            className="apple-input"
            placeholder="Label (e.g., Stripe Key)"
            value={newApiKey.label}
            onChange={(e) => setNewApiKey((s) => ({ ...s, label: e.target.value }))}
            required
          />
          <input
            className="apple-input"
            type="password"
            placeholder="sk_live_••••••••"
            value={newApiKey.value}
            onChange={(e) => setNewApiKey((s) => ({ ...s, value: e.target.value }))}
            required
          />
          <button className="apple-btn primary" type="submit" disabled={busy}>
            <Plus size={14} /> Add Key
          </button>
        </form>

        <table className="apple-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Hint</th>
              <th>Source</th>
              <th style={{ textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rules.apiKeys.map((k) => (
              <tr key={k._id}>
                <td style={{ fontWeight: 600 }}>{k.label}</td>
                <td style={{ fontFamily: "monospace", color: "var(--apple-text-muted)" }}>••••{k.hint}</td>
                <td>
                  <span className="apple-pill indigo">{k.auto_detected ? "Auto-detected" : "Manual"}</span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button className="apple-btn danger" onClick={() => handleRemoveApiKey(k._id)} disabled={busy} style={{ padding: "4px 8px" }}>
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
            {rules.apiKeys.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "var(--apple-text-muted)", padding: 20 }}>
                  No API key patterns configured
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default Rules;