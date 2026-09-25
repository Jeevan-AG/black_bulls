import React, { useEffect, useState, useMemo } from "react";
import api from "../utils/api";
import {
  Users,
  UserCheck,
  UserX,
  Shield,
  Search,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Radio,
  Laptop,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Cpu,
} from "lucide-react";

export default function Employees() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmployeeEmail, setNewEmployeeEmail] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/users");
      if (res.data.success) {
        setUsers(res.data.users);
      }
    } catch (err) {
      console.error("Users fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDeleteUser = async (userId) => {
    setError("");
    setSuccess("");
    try {
      const res = await api.delete(`/users/${userId}`);
      if (res.data.success) {
        setSuccess(res.data.message || "Endpoint removed successfully");
        setConfirmDelete(null);
        fetchUsers();
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to remove user endpoint");
      setConfirmDelete(null);
    }
  };

  const handleRoleChange = async (userId, newRoleValue) => {
    setError("");
    setSuccess("");
    try {
      const res = await api.patch(`/users/${userId}`, { role: newRoleValue });
      if (res.data.success) {
        setSuccess(`Role updated to ${newRoleValue.toUpperCase()}`);
        fetchUsers();
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update role");
    }
  };

  const handleToggleAccess = async (userId) => {
    setError("");
    setSuccess("");
    try {
      const res = await api.put(`/users/${userId}/toggle-access`);
      if (res.data.success) {
        setSuccess(res.data.message || "Access policy updated");
        fetchUsers();
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to toggle agent access");
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!newEmployeeEmail.trim()) return;

    try {
      const res = await api.post("/users", {
        email: newEmployeeEmail.trim(),
        role: "employee",
      });
      if (res.data.success) {
        setSuccess(
          `Employee provisioned! They can authenticate on the extension with default credentials: Password123`
        );
        setShowAddModal(false);
        setNewEmployeeEmail("");
        fetchUsers();
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to provision employee");
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        (u.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.currentApp || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchRole =
        roleFilter === "ALL" ? true : (u.role || "").toLowerCase() === roleFilter.toLowerCase();
      return matchSearch && matchRole;
    });
  }, [users, searchTerm, roleFilter]);

  const onlineCount = users.filter((u) => u.isOnline).length;
  const adminCount = users.filter((u) => u.role === "admin").length;
  const authorizedCount = users.filter((u) => u.isAuthorized !== false).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <div className="page-title">
            <Users size={26} color="#22d3ee" />
            <span>Endpoint Fleet & Agent Management</span>
          </div>
          <p className="page-subtitle">
            ZERO TRUST IDENTITY & CLIENT BROWSER GUARD TELEMETRY
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            className="btn btn--secondary"
            onClick={fetchUsers}
            title="Refresh Fleet Status"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Sync</span>
          </button>
          <button
            className="btn btn--primary"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={14} />
            <span>Provision Endpoint</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {success && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            color: "#34d399",
            fontSize: "13px",
            fontFamily: "var(--font-mono)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: "rgba(244, 63, 94, 0.1)",
            border: "1px solid rgba(244, 63, 94, 0.3)",
            color: "#fb7185",
            fontSize: "13px",
            fontFamily: "var(--font-mono)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Fleet Telemetry KPI Cards ── */}
      <div className="grid grid--4">
        <div className="telemetry-kpi card--cyan-accent">
          <div className="kpi-head">
            <span className="kpi-title">Fleet Endpoints</span>
            <div className="kpi-icon">
              <Laptop size={16} />
            </div>
          </div>
          <div className="kpi-value">{users.length}</div>
          <div className="kpi-footer">
            <span>Enrolled in corporate zero trust</span>
          </div>
        </div>

        <div className="telemetry-kpi card--emerald-accent">
          <div className="kpi-head">
            <span className="kpi-title">Active Heartbeats</span>
            <div className="kpi-icon" style={{ color: "#34d399" }}>
              <Radio size={16} />
            </div>
          </div>
          <div className="kpi-value text-emerald">{onlineCount}</div>
          <div className="kpi-footer">
            <span className="beacon-dot" />
            <span>Currently streaming telemetry</span>
          </div>
        </div>

        <div className="telemetry-kpi">
          <div className="kpi-head">
            <span className="kpi-title">Access Authorized</span>
            <div className="kpi-icon" style={{ color: "#38bdf8" }}>
              <UserCheck size={16} />
            </div>
          </div>
          <div className="kpi-value">{authorizedCount}</div>
          <div className="kpi-footer">
            <span>Guard policy enforced</span>
          </div>
        </div>

        <div className="telemetry-kpi">
          <div className="kpi-head">
            <span className="kpi-title">Admin Officers</span>
            <div className="kpi-icon" style={{ color: "#a78bfa" }}>
              <Shield size={16} />
            </div>
          </div>
          <div className="kpi-value text-cyan">{adminCount}</div>
          <div className="kpi-footer">
            <span>Root policy authority</span>
          </div>
        </div>
      </div>

      {/* ── Fleet Directory & Filter Controls ── */}
      <section className="glass-panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: "1 1 300px" }}>
            <div style={{ position: "relative", width: "100%", maxWidth: "380px" }}>
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />
              <input
                type="text"
                className="input input--mono"
                style={{ paddingLeft: "36px" }}
                placeholder="Search endpoints by email, domain, app..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="select"
              style={{ width: "auto", minWidth: "130px" }}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="ALL">All Roles</option>
              <option value="employee">Employees</option>
              <option value="admin">Administrators</option>
            </select>
          </div>

          <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-muted)" }}>
            Showing {filteredUsers.length} of {users.length} registered nodes
          </span>
        </div>

        {/* Directory Table */}
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Node / Identity</th>
                <th>Role & Access</th>
                <th>Daemon Status</th>
                <th>Active AI Surface</th>
                <th>Enforcement State</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user._id}>
                  {/* Email & Monogram */}
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "8px",
                          background: user.role === "admin" ? "rgba(99, 102, 241, 0.15)" : "rgba(34, 211, 238, 0.1)",
                          border: `1px solid ${
                            user.role === "admin" ? "rgba(99, 102, 241, 0.3)" : "rgba(34, 211, 238, 0.25)"
                          }`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: "var(--font-mono)",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: user.role === "admin" ? "#818cf8" : "var(--cyan-primary)",
                        }}
                      >
                        {(user.email || "E").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{user.email}</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)" }}>
                          UID: {user._id ? user._id.slice(-8) : "N/A"}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Role Selector */}
                  <td>
                    <select
                      className="select"
                      value={user.role}
                      onChange={(e) => handleRoleChange(user._id, e.target.value)}
                      style={{
                        padding: "4px 8px",
                        fontSize: "11px",
                        fontFamily: "var(--font-mono)",
                        width: "auto",
                        minWidth: "105px",
                        height: "28px",
                        color: user.role === "admin" ? "var(--cyan-primary)" : "var(--text-primary)",
                      }}
                    >
                      <option value="employee">EMPLOYEE</option>
                      <option value="admin">ADMIN</option>
                    </select>
                  </td>

                  {/* Daemon Heartbeat */}
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          width: "7px",
                          height: "7px",
                          borderRadius: "50%",
                          background: user.isOnline ? "#10b981" : "#64748b",
                          boxShadow: user.isOnline ? "0 0 8px #10b981" : "none",
                        }}
                      />
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: user.isOnline ? "#34d399" : "var(--text-muted)",
                        }}
                      >
                        {user.isOnline ? "ONLINE" : "OFFLINE"}
                      </span>
                    </div>
                  </td>

                  {/* Active Surface */}
                  <td>
                    {user.isOnline && user.currentApp ? (
                      <span className="badge badge--cyan" style={{ fontSize: "11px" }}>
                        {user.currentApp}
                      </span>
                    ) : (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-dim)" }}>
                        IDLE / STANDBY
                      </span>
                    )}
                  </td>

                  {/* Enforcement State & Quick Toggle */}
                  <td>
                    <button
                      className={`btn ${user.isAuthorized !== false ? "btn--ghost" : "btn--danger"}`}
                      type="button"
                      style={{ padding: "4px 10px", fontSize: "11px", height: "28px" }}
                      onClick={() => handleToggleAccess(user._id)}
                      title={user.isAuthorized !== false ? "Revoke Endpoint Access" : "Grant Endpoint Access"}
                    >
                      {user.isAuthorized !== false ? (
                        <>
                          <Lock size={12} />
                          <span>Active (Revoke)</span>
                        </>
                      ) : (
                        <>
                          <Unlock size={12} />
                          <span>Suspended (Grant)</span>
                        </>
                      )}
                    </button>
                  </td>

                  {/* Actions */}
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btn--danger"
                      type="button"
                      style={{ padding: "4px 8px", fontSize: "11px", height: "28px" }}
                      onClick={() => setConfirmDelete(user)}
                      title="Deprovision Node"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}

              {!loading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
                    No fleet endpoints match the specified criteria
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        border: "2px solid var(--border-subtle)",
                        borderTopColor: "var(--cyan-primary)",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                        margin: "0 auto 8px",
                      }}
                    />
                    Synchronizing fleet telemetry...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Provision Endpoint Modal ── */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2, 6, 23, 0.8)",
            backdropFilter: "blur(12px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: "460px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.9)",
              border: "1px solid var(--border-medium)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Plus size={18} color="#22d3ee" />
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#ffffff" }}>
                  Provision Fleet Endpoint
                </h3>
              </div>
            </div>

            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px", lineHeight: 1.5 }}>
              Register an authorized corporate identity. The user can activate their browser guard extension immediately using their assigned email.
            </p>

            <form onSubmit={handleAddEmployee} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label className="field-label">Employee Email Address</label>
                <input
                  type="email"
                  className="input input--mono"
                  placeholder="analyst@enterprise.corp"
                  value={newEmployeeEmail}
                  onChange={(e) => setNewEmployeeEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  background: "rgba(34, 211, 238, 0.05)",
                  border: "1px solid rgba(34, 211, 238, 0.15)",
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--cyan-primary)",
                }}
              >
                Default Extension Password: <strong>Password123</strong>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "8px" }}>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary">
                  Enroll Endpoint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm Removal Modal ── */}
      {confirmDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2, 6, 23, 0.8)",
            backdropFilter: "blur(12px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: "440px",
              width: "100%",
              border: "1px solid var(--border-critical)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <AlertTriangle size={20} color="#f43f5e" />
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#fb7185" }}>
                Confirm Node Deprovision
              </h3>
            </div>

            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px", lineHeight: 1.6 }}>
              Are you sure you want to deprovision endpoint{" "}
              <strong style={{ color: "#ffffff", fontFamily: "var(--font-mono)" }}>
                {confirmDelete.email}
              </strong>
              ? Outbound AI guard enforcement on this client will cease. Historical incident audit trails will remain preserved.
            </p>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => handleDeleteUser(confirmDelete._id)}
              >
                Confirm Deprovision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
