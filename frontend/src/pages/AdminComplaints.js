// src/pages/AdminComplaints.js
import React, { useEffect, useState } from "react";
import "./StationDashboard.css";

/**
 * AdminComplaints: simplified single-pane complaints manager.
 * Props:
 *  - apiBase (string) default "http://localhost:4000"
 */
const AdminComplaints = ({ apiBase = "http://localhost:4000" }) => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadComplaints();
  }, []);

  const loadComplaints = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/api/complaints`);
      if (!res.ok) throw new Error("Failed to load complaints");
      const data = await res.json();
      setComplaints(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError("Could not fetch complaints. Is backend running?");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, newStatus) => {
    setSavingId(id);
    try {
      const res = await fetch(`${apiBase}/api/complaints/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const updated = await res.json();
      setComplaints((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      console.error(err);
      alert("Could not update complaint. Check backend.");
    } finally {
      setSavingId(null);
    }
  };

  const deleteComplaint = async (id) => {
    if (!window.confirm("Delete this complaint?")) return;
    try {
      const res = await fetch(`${apiBase}/api/complaints/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setComplaints((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error(err);
      alert("Could not delete complaint.");
    }
  };

  return (
    <div style={{ width: "100%" }}>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: "#00ff88" }}>Complaints</h3>
        <p style={{ color: "#a3a3a3", marginTop: 6 }}>
          Manage user-submitted complaints from station users.
        </p>
      </div>

      <div style={{ maxWidth: 1100 }}>
        {error && <div className="fetch-error">{error}</div>}
        {loading ? (
          <div className="loading">Loading complaints…</div>
        ) : (
          <>
            {complaints.length === 0 ? (
              <div className="no-data">No complaints yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {complaints.map((c) => (
                  <div key={c.id} className="complaint-item" style={{ alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <strong style={{ color: "#00ff88" }}>{c.name}</strong>
                          <div style={{ color: "#cfcfcf", fontSize: 13 }}>{c.email}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700, color: "#00ff88" }}>{c.status}</div>
                          <div style={{ fontSize: 12, color: "#a3a3a3" }}>
                            {c.created_at
                              ? new Date(c.created_at).toLocaleString()
                              : ""}
                          </div>
                        </div>
                      </div>

                      <p style={{ marginTop: 8, color: "#e6e6e6" }}>{c.issue}</p>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        marginLeft: 12,
                      }}
                    >
                      <button
                        className="small-btn btn"
                        onClick={() => updateStatus(c.id, "Accepted")}
                        disabled={savingId === c.id}
                      >
                        Accept
                      </button>
                      <button
                        className="small-btn btn"
                        onClick={() => updateStatus(c.id, "In Progress")}
                        disabled={savingId === c.id}
                      >
                        Process
                      </button>
                      <button
                        className="small-btn btn"
                        onClick={() => updateStatus(c.id, "Declined")}
                        disabled={savingId === c.id}
                      >
                        Decline
                      </button>
                      <button
                        className="small-btn btn"
                        onClick={() => deleteComplaint(c.id)}
                        style={{
                          background: "transparent",
                          border: "1px solid rgba(255,77,77,0.12)",
                          color: "#ffb4b4",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminComplaints;
