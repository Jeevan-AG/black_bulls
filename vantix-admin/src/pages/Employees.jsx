import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, UserCheck, Shield, Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import api from "../utils/api";

const Employees = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmployeeEmail, setNewEmployeeEmail] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const fetchUsers = async () => {
    try {
      const res = await api.get("/users");
      if (res.data.success) setUsers(res.data.users);
    } catch (err) {
      console.error(err);
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
        setSuccess(res.data.message);
        setConfirmDelete(null);
        fetchUsers();
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to remove user");
      setConfirmDelete(null);
    }
  };

  const handleRoleChange = async (userId, newRoleValue) => {
    setError("");
    setSuccess("");
    try {
      const res = await api.patch(`/users/${userId}`, { role: newRoleValue });
      if (res.data.success) {
        setSuccess(`Role updated to ${newRoleValue}`);
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
        setSuccess(res.data.message);
        fetchUsers();
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to toggle access");
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!newEmployeeEmail) return;
    try {
      const res = await api.post("/users", { email: newEmployeeEmail, role: "employee" });
      if (res.data.success) {
        setSuccess(`Employee added! Initial password: Password123`);
        setShowAddModal(false);
        setNewEmployeeEmail("");
        fetchUsers();
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add employee");
    }
  };

  const onlineCount = users.filter((u) => u.isOnline).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#ffffff", margin: 0, letterSpacing: "-0.02em" }}>
            Employees
          </h1>
          <p style={{ fontSize: 13, color: "var(--apple-text-muted)", margin: "4px 0 0 0" }}>
            Identity directory and DLP access management
          </p>
        </div>

        <button className="apple-btn primary" onClick={() => setShowAddModal(true)}>
          <Plus size={14} />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Quick KPI Glass Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <div className="apple-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--apple-text-muted)", textTransform: "uppercase" }}>
              Total Identities
            </span>
            <Users size={16} color="#38bdf8" />
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#ffffff" }}>{users.length}</div>
        </div>

        <div className="apple-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--apple-text-muted)", textTransform: "uppercase" }}>
              Currently Online
            </span>
            <UserCheck size={16} color="#10b981" />
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#10b981" }}>{onlineCount}</div>
        </div>

        <div className="apple-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--apple-text-muted)", textTransform: "uppercase" }}>
              Security Admins
            </span>
            <Shield size={16} color="#6366f1" />
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#818cf8" }}>
            {users.filter((u) => u.role === "admin").length}
          </div>
        </div>
      </div>

      {/* Employee Directory Table */}
      <div className="apple-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--apple-border)" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#ffffff" }}>Employee Roster</span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="apple-table">
            <thead>
              <tr>
                <th>Identity Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Active App</th>
                <th>Agent Access</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td style={{ fontWeight: 600, color: "#ffffff" }}>{user.email}</td>
                  <td>
                    <select
                      className="apple-input"
                      value={user.role}
                      onChange={(e) => handleRoleChange(user._id, e.target.value)}
                      style={{ padding: "4px 8px", fontSize: 12, width: 100 }}
                    >
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    <span className={`apple-pill ${user.isOnline ? "emerald" : "rose"}`}>
                      <span className="live-pulse-dot" style={{ background: user.isOnline ? "#10b981" : "#f43f5e" }} />
                      {user.isOnline ? "Online" : "Offline"}
                    </span>
                  </td>
                  <td>
                    {user.currentApp ? (
                      <span className="apple-pill indigo">{user.currentApp}</span>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--apple-text-muted)" }}>—</span>
                    )}
                  </td>
                  <td>
                    <button
                      className={`apple-btn ${user.isAuthorized ? "" : "danger"}`}
                      style={{ padding: "4px 10px", fontSize: 11 }}
                      onClick={() => handleToggleAccess(user._id)}
                    >
                      {user.isAuthorized ? "Revoke" : "Grant"}
                    </button>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="apple-btn danger"
                      style={{ padding: "4px 8px" }}
                      onClick={() => setConfirmDelete(user)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--apple-text-muted)" }}>
                    No employee identities registered
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            className="orion-drawer-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              className="apple-card"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{ width: 420, maxWidth: "90vw", background: "rgba(18, 19, 26, 0.95)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#ffffff", marginBottom: 16 }}>
                Add New Employee
              </h3>

              <form onSubmit={handleAddEmployee} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <input
                  type="email"
                  className="apple-input"
                  placeholder="employee@company.corp"
                  value={newEmployeeEmail}
                  onChange={(e) => setNewEmployeeEmail(e.target.value)}
                  required
                  autoFocus
                />

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                  <button type="button" className="apple-btn" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="apple-btn primary">
                    Invite Employee
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Employees;
