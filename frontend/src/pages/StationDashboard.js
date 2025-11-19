// src/pages/StationDashboard.js
import React, { useState, useEffect } from "react";
import "./StationDashboard.css";

// Try to bundle image (preferred). Put a file at src/assets/futureev.png
import bundledFutureEv from "../assets/futureev.png";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// change this if your backend lives on a different origin
const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:4000";
const STATION_ID = 102;

const StationDashboard = () => {
  const [activePage, setActivePage] = useState("dashboard");
  const [complaints, setComplaints] = useState([]);
  const [formData, setFormData] = useState({ name: "", email: "", issue: "" });

  const [summary, setSummary] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [chartOptions, setChartOptions] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState("");

  // image handling: prefer bundled import, fallback to public/futureev.png
  const [imageSrc, setImageSrc] = useState("");
  const [imageAvailable, setImageAvailable] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkImage = async () => {
      // 1) Bundled import path from webpack
      if (bundledFutureEv) {
        // create Image to test
        const img = new Image();
        img.onload = () => {
          if (mounted) {
            setImageSrc(bundledFutureEv);
            setImageAvailable(true);
          }
        };
        img.onerror = () => {
          // try public fallback next
          tryPublic();
        };
        img.src = bundledFutureEv;
        return;
      }
      // if no bundled import, try public path
      tryPublic();
    };

    const tryPublic = () => {
      const publicPath = `${process.env.PUBLIC_URL || ""}/futureev.png`;
      const img2 = new Image();
      img2.onload = () => {
        if (mounted) {
          setImageSrc(publicPath);
          setImageAvailable(true);
        }
      };
      img2.onerror = () => {
        if (mounted) {
          setImageAvailable(false);
          setImageSrc("");
        }
      };
      img2.src = `${process.env.PUBLIC_URL || ""}/futureev.png`;
    };

    checkImage();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // load complaints on mount so admin can see them
    loadComplaints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activePage === "status") loadStationReport(STATION_ID);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage]);

  const logout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  // POST complaint + optimistic UI
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.issue) return;

    const temp = {
      id: Date.now(),
      name: formData.name,
      email: formData.email || "",
      issue: formData.issue,
      status: "Submitting...",
      created_at: new Date().toISOString(),
    };
    setComplaints((prev) => [temp, ...prev]);
    setFormData({ name: "", email: "", issue: "" });

    try {
      const res = await fetch(`${API_BASE}/api/complaints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: temp.name, email: temp.email, issue: temp.issue }),
      });
      if (!res.ok) throw new Error("submit failed");
      const created = await res.json();
      setComplaints((prev) => [created, ...prev.filter((c) => c.id !== temp.id)]);
    } catch (err) {
      console.error("Submit complaint failed:", err);
      setComplaints((prev) => prev.map((c) => (c.id === temp.id ? { ...c, status: "Failed" } : c)));
      alert("Could not send complaint to server. Is backend running?");
    }
  };

  // load complaints from backend (best-effort; local-only still works)
  const loadComplaints = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/complaints`);
      if (!res.ok) throw new Error("Failed to load complaints");
      const arr = await res.json();
      setComplaints(Array.isArray(arr) ? arr.slice().sort((a, b) => (b.created_at || 0) - (a.created_at || 0)) : []);
    } catch (err) {
      console.warn("Could not fetch complaints:", err);
    }
  };

  // load station report (keeps your CSV parsing logic)
  const loadStationReport = async (stationId) => {
    setLoadingReport(true);
    setReportError("");
    setSummary(null);
    setChartData(null);
    setChartOptions(null);

    try {
      const resSum = await fetch("/static/stations_summary.json");
      if (!resSum.ok) throw new Error("stations_summary.json not found");
      const summaries = await resSum.json();
      const st = summaries.find((s) => Number(s.station_id) === Number(stationId));
      if (st) setSummary(st);

      const csvPath = `/static/ev_station_${stationId}_daily_data.csv`;
      const resCsv = await fetch(csvPath);
      if (!resCsv.ok) throw new Error(`CSV not found at ${csvPath}`);
      const text = await resCsv.text();

      const rows = text.trim().split("\n").map((r) => r.split(","));
      const header = rows.shift().map((h) => h.trim().toLowerCase());
      const dateIdx = header.findIndex((h) => h === "date");
      const sessionsIdx =
        header.findIndex((h) => h.includes("charging_sessions")) !== -1
          ? header.findIndex((h) => h.includes("charging_sessions"))
          : header.findIndex((h) => h.includes("sessions"));

      const dates = [];
      const sessions = [];
      for (const r of rows) {
        const d = dateIdx !== -1 && r[dateIdx] ? r[dateIdx].trim() : "";
        const s = sessionsIdx !== -1 && r[sessionsIdx] ? Number(r[sessionsIdx]) : 0;
        dates.push(d);
        sessions.push(Number.isFinite(s) ? s : 0);
      }

      const numeric = sessions.map((v) => Number(v) || 0);
      const avgVal = numeric.length ? numeric.reduce((a, b) => a + b, 0) / numeric.length : 0;

      let minVal = Infinity,
        maxVal = -Infinity,
        minIdx = -1,
        maxIdx = -1;
      numeric.forEach((v, i) => {
        if (v < minVal) {
          minVal = v;
          minIdx = i;
        }
        if (v > maxVal) {
          maxVal = v;
          maxIdx = i;
        }
      });

      const pointRadius = numeric.map(() => 3);
      const pointBackground = numeric.map(() => "rgba(0,255,136,0.95)");
      if (minIdx !== -1) {
        pointRadius[minIdx] = 7;
        pointBackground[minIdx] = "#ff6b6b";
      }
      if (maxIdx !== -1) {
        pointRadius[maxIdx] = 7;
        pointBackground[maxIdx] = "#4dd0e1";
      }

      const mainDataset = {
        label: "Charging sessions",
        data: numeric,
        fill: true,
        tension: 0.22,
        backgroundColor: "rgba(0,255,136,0.06)",
        borderColor: "rgba(0,255,136,0.95)",
        pointRadius,
        pointBackgroundColor: pointBackground,
        pointHoverRadius: 8,
        borderWidth: 2.5,
      };

      const avgDataset = {
        label: "Average",
        data: Array(numeric.length).fill(Number(avgVal.toFixed(2))),
        type: "line",
        borderColor: "rgba(255,255,255,0.16)",
        borderDash: [6, 6],
        borderWidth: 1.3,
        pointRadius: 0,
        fill: false,
        tension: 0,
      };

      const spread = Math.max(10, Math.ceil((maxVal - minVal) * 0.2));
      const suggestedMin = Math.max(0, Math.floor(minVal - spread));
      const suggestedMax = Math.ceil(maxVal + spread);

      setChartData({ labels: dates, datasets: [mainDataset, avgDataset] });

      setChartOptions({
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: true, labels: { color: "#bfeccf" } },
          tooltip: {
            backgroundColor: "#0f1412",
            titleColor: "#dfffe6",
            bodyColor: "#bfeccf",
            callbacks: {
              title: (items) => items[0].label,
              label: (ctx) => {
                const v = ctx.parsed.y;
                const diff = (v - avgVal).toFixed(1);
                const sign = diff >= 0 ? "+" : "";
                return ` ${v} sessions (${sign}${diff})`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: "#9fcfb3", maxRotation: 0, minRotation: 0, maxTicksLimit: 12 },
            grid: { display: false },
          },
          y: {
            ticks: { color: "#9fcfb3" },
            grid: { color: "rgba(255,255,255,0.03)" },
            suggestedMin,
            suggestedMax,
          },
        },
      });
    } catch (err) {
      console.error("Station 102 report load failed:", err);
      setReportError("Could not load Station 102 report. Check files in public/static/");
    } finally {
      setLoadingReport(false);
    }
  };

  // public fallback path (public/futureev.png)
  const publicImgPath = `${process.env.PUBLIC_URL || ""}/futureev.png`;

  return (
    <div className="station-layout">
      <aside className="sidebar">
        <div className="sidebar-top">
          <h2 className="sidebar-title">⚡ EV Station</h2>
          <nav>
            <ul>
              <li>
                <button className={activePage === "dashboard" ? "active" : ""} onClick={() => setActivePage("dashboard")}>
                  Dashboard
                </button>
              </li>
              <li>
                <button className={activePage === "status" ? "active" : ""} onClick={() => setActivePage("status")}>
                  Report
                </button>
              </li>
              <li>
                <button className={activePage === "contact" ? "active" : ""} onClick={() => setActivePage("contact")}>
                  Contact Us
                </button>
              </li>
            </ul>
          </nav>
        </div>

        <button className="logout-btn" onClick={logout}>
          Logout
        </button>
      </aside>

      <main className="dashboard-content">
        {activePage === "dashboard" && (
          <>
            <header className="dashboard-header">
              <div className="header-left">
                <h2 className="station-title">Station Dashboard</h2>
                <p>Welcome back, Station User 👋</p>
              </div>
            </header>

            <section className="dashboard-grid">
              <div className="card">
                <h3>Energy Output</h3>
                <p>1658kW (AC Fast Charger)</p>
              </div>

              <div className="card">
                <h3>Current Price</h3>
                <p>₹12.5 / kWh</p>
              </div>

              <div className="card">
                <h3>Active Vehicles</h3>
                <p>3 vehicles charging now</p>
              </div>
            </section>

            {/* Image area */}
            <div className="image-wrapper" style={{ marginTop: 20 }}>
              {imageAvailable ? (
                <img
                  src={imageSrc || publicImgPath}
                  alt="EV Illustration"
                  className="dashboard-image"
                  onError={(e) => {
                    console.error("Image onError:", e);
                    // hide broken image and show placeholder block
                    e.currentTarget.style.display = "none";
                    setImageSrc("");
                    setImageAvailable(false);
                  }}
                />
              ) : (
                // fallback visual block
                <div className="bg-image-block" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                  <div style={{ color: "#9fbfaa" }}>Image not available</div>
                </div>
              )}
            </div>
          </>
        )}

        {activePage === "status" && (
          <section className="status-section">
            <h2>Station 102 — Report</h2>

            {reportError && <div className="fetch-error">{reportError}</div>}

            {summary && (
              <div className="station-report-summary">
                <div className="summary-card">
                  <div className="summary-label">Avg Voltage</div>
                  <div className="summary-value">{summary.avg_voltage ?? "—"} V</div>
                </div>
                <div className="summary-card">
                  <div className="summary-label">Avg Current</div>
                  <div className="summary-value">{summary.avg_current ?? "—"} A</div>
                </div>
                <div className="summary-card">
                  <div className="summary-label">Avg Sessions</div>
                  <div className="summary-value">{summary.avg_sessions ?? "—"}</div>
                </div>
                <div className="summary-card">
                  <div className="summary-label">Total Revenue</div>
                  <div className="summary-value">₹{summary.total_revenue_inr ?? "—"}</div>
                </div>
              </div>
            )}

            <div className="station-report-chart">
              {loadingReport && <div className="loading">Loading report...</div>}
              {chartData && chartOptions ? (
                <div className="chart-card">
                  <Line data={chartData} options={chartOptions} />
                </div>
              ) : (
                !loadingReport &&
                !reportError && <div className="no-data">No chart data yet. Click Report tab to load.</div>
              )}
            </div>
          </section>
        )}

        {activePage === "contact" && (
          <section className="contact-section">
            <header className="contact-header">
              <h2>Contact Support Team</h2>
              <p>Report a technical issue, pricing error, or operational problem.</p>
            </header>

            <form className="contact-form" onSubmit={handleFormSubmit}>
              <input type="text" name="name" placeholder="Your Name" value={formData.name} onChange={handleInputChange} required />
              <input type="email" name="email" placeholder="Email Address" value={formData.email} onChange={handleInputChange} />
              <textarea name="issue" placeholder="Describe your issue..." value={formData.issue} onChange={handleInputChange} required />
              <button type="submit">Submit Complaint</button>
            </form>

            {complaints.length > 0 && (
              <div className="complaints-list">
                <h3>Submitted Complaints</h3>
                {complaints.map((c) => (
                  <div key={c.id} className="complaint-item">
                    <span className="complaint-name">{c.name}</span>
                    <span className="complaint-divider">|</span>
                    <span className="complaint-text">{c.issue.length > 60 ? c.issue.substring(0, 60) + "..." : c.issue}</span>
                    <span className={`complaint-status status-${(c.status || "").toLowerCase().replace(/\s/g, "-")}`}>
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

export default StationDashboard;
