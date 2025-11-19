import React, { useState, useEffect } from "react";
import Modal from "react-modal";
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
import "./StationListPage.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);
Modal.setAppElement("#root");

const StationCard = ({ station, onOpen, onShowOnMap }) => (
  <div className="station-card">
    <div className="card-top compact">
      <div className="card-title-compact">
        <h3>{station.name}</h3>
        <div className="card-meta-compact">
          <div><strong>Rows:</strong> {station.rows}</div>
          <div><strong>ID:</strong> {station.station_id}</div>
        </div>
      </div>
    </div>

    <div className="card-actions-compact">
      {/* NOTE: className changed to 'manage-btn' to match CSS */}
      <button className="manage-btn" onClick={() => onOpen(station.station_id)}>
        View Details
      </button>

      {/* NOTE: show-map-btn kept as before (matches CSS) */}
      <button
        className="show-map-btn"
        onClick={() => {
          if (onShowOnMap) onShowOnMap(station);
        }}
        title="Show on map"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" style={{ marginRight: 8 }} aria-hidden>
          <path fill="currentColor" d="M20.5 3l-5.5 2.2L9 3 3.5 5.2v13.6L9 19l6 2.2 5.5-2.2V3zM9 5.1l5 1.9v11.8l-5-1.9V5.1zM6 6.2v11.6L4.5 18V6.4L6 5.8z" />
        </svg>
        <span className="label">Show on map</span>
      </button>
    </div>
  </div>
);

const StationListPage = ({ stations: stationsProp = null, onSelectStation = null, openStationId = null, onOpenHandled = null }) => {
  const [stations, setStations] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState(null);
  const [selectedStationObj, setSelectedStationObj] = useState(null); // full object
  const [chartData, setChartData] = useState(null);
  const [chartOptions, setChartOptions] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState("");
  const [statSummary, setStatSummary] = useState(null);

  useEffect(() => {
    if (stationsProp && Array.isArray(stationsProp) && stationsProp.length > 0) {
      setStations(stationsProp);
      setLoading(false);
      return;
    }

    fetch("/static/stations_summary.json")
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => setStations(data || []))
      .catch((err) => {
        console.warn("stations summary fetch failed:", err);
        setFetchError("Could not load station summaries. Make sure stations_summary.json is in public/static/");
        setStations([
          { station_id: 101, name: "Station 101", avg_voltage: 225, avg_current: 22, avg_sessions: 56, total_revenue_inr: 500000, rows: 30, lat: 18.5204, lng: 73.8567 },
          { station_id: 102, name: "Station 102", avg_voltage: 228, avg_current: 21, avg_sessions: 55, total_revenue_inr: 497000, rows: 30, lat: 19.0760, lng: 72.8777 },
          { station_id: 103, name: "Station 103", avg_voltage: 224, avg_current: 20, avg_sessions: 59, total_revenue_inr: 533000, rows: 30, lat: 17.3850, lng: 78.4867 },
          { station_id: 104, name: "Station 104", avg_voltage: 227, avg_current: 21, avg_sessions: 57, total_revenue_inr: 512000, rows: 30, lat: 12.9716, lng: 77.5946 },
          { station_id: 105, name: "Station 105", avg_voltage: 226, avg_current: 20, avg_sessions: 57, total_revenue_inr: 517000, rows: 30, lat: 28.7041, lng: 77.1025 },
        ]);
      })
      .finally(() => setLoading(false));
  }, [stationsProp]);

  const openDetails = async (stationId) => {
    const stationObj = stations.find((s) => String(s.station_id) === String(stationId)) || null;
    setSelectedStationObj(stationObj);
    setSelectedStationId(stationId);
    setModalOpen(true);
    setChartLoading(true);
    setChartError("");
    setChartData(null);
    setChartOptions(null);
    setStatSummary(null);

    try {
      const csvPath = `/static/ev_station_${stationId}_daily_data.csv`;
      const res = await fetch(csvPath);
      if (!res.ok) throw new Error("CSV not found at " + csvPath);
      const text = await res.text();

      const rows = text.trim().split("\n").map((r) => r.split(","));
      const header = rows.shift().map((h) => h.trim());

      const dateIdx = header.findIndex((h) => h.toLowerCase() === "date");
      const sessionsIdx =
        header.findIndex((h) => h.toLowerCase().includes("charging_sessions")) !== -1
          ? header.findIndex((h) => h.toLowerCase().includes("charging_sessions"))
          : header.findIndex((h) => h.toLowerCase().includes("sessions"));

      const dates = [];
      const sessions = [];
      for (const r of rows) {
        const d = r[dateIdx] ? r[dateIdx].trim() : "";
        const s = sessionsIdx !== -1 && r[sessionsIdx] ? Number(r[sessionsIdx]) : 0;
        dates.push(d);
        sessions.push(Number.isFinite(s) ? s : 0);
      }

      // compute stats
      const numeric = sessions.map((v) => Number(v) || 0);
      const avgVal = numeric.reduce((a, b) => a + b, 0) / Math.max(1, numeric.length);
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

      const pointRadius = numeric.map(() => 2);
      const pointBackground = numeric.map(() => "rgba(0,255,136,0.95)");
      if (minIdx !== -1) {
        pointRadius[minIdx] = 6;
        pointBackground[minIdx] = "#ff6b6b";
      }
      if (maxIdx !== -1) {
        pointRadius[maxIdx] = 6;
        pointBackground[maxIdx] = "#4dd0e1";
      }

      const mainDataset = {
        label: "Charging sessions",
        data: numeric,
        fill: true,
        tension: 0.25,
        backgroundColor: "rgba(0,255,136,0.06)",
        borderColor: "rgba(0,255,136,0.95)",
        pointRadius,
        pointBackgroundColor: pointBackground,
        pointHoverRadius: 7,
        borderWidth: 2.5,
      };

      const avgDataset = {
        label: "Average",
        data: Array(numeric.length).fill(Number(avgVal.toFixed(2))),
        type: "line",
        borderColor: "rgba(255,255,255,0.16)",
        borderDash: [6, 6],
        borderWidth: 1.5,
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
                const diff = v - avgVal;
                const sign = diff >= 0 ? "+" : "";
                return ` ${v} sessions (${sign}${diff.toFixed(1)})`;
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

      setStatSummary({ avg: Number(avgVal.toFixed(2)), min: minVal, max: maxVal });
    } catch (err) {
      console.error("Failed to load CSV:", err);
      setChartError("Could not load station CSV. Make sure ev_station_<id>_daily_data.csv is in public/static/");
    } finally {
      setChartLoading(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedStationId(null);
    setSelectedStationObj(null);
    setChartData(null);
    setChartOptions(null);
    setChartError("");
    setStatSummary(null);
    if (onOpenHandled) onOpenHandled();
  };

  useEffect(() => {
    if (openStationId) {
      openDetails(openStationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openStationId]);

  const filtered = stations.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="station-list-page">
      <header className="station-list-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1>Station Management</h1>
        <input
          type="text"
          placeholder="🔍 Search by city or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 320, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.03)", background: "#071615", color: "#cfe9d8" }}
        />
      </header>

      {fetchError && <div className="fetch-error">{fetchError}</div>}

      <div className="station-list" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 20 }}>
        {loading ? (
          <div className="loading">Loading stations...</div>
        ) : filtered.length > 0 ? (
          filtered.map((station) => (
            <StationCard
              key={station.station_id}
              station={station}
              onOpen={openDetails}
              onShowOnMap={(st) => {
                if (onSelectStation) {
                  onSelectStation(st);
                } else {
                  openDetails(st.station_id);
                }
              }}
            />
          ))
        ) : (
          <p className="no-results">No stations found.</p>
        )}
      </div>

      <Modal isOpen={modalOpen} onRequestClose={closeModal} contentLabel="Station Details" overlayClassName="modal-overlay" className="modal-content">
        <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h2>Station {selectedStationObj ? selectedStationObj.name : selectedStationId} — Daily Sessions</h2>
            {statSummary && (
              <div style={{ display: "flex", gap: 12, color: "#cfe9d8", fontSize: 13 }}>
                <div>
                  <strong>Avg sessions:</strong> {statSummary.avg}{" "}
                </div>
                <div>
                  <strong>Min:</strong> {statSummary.min}
                </div>
                <div>
                  <strong>Max:</strong> {statSummary.max}
                </div>
              </div>
            )}
          </div>
          <button className="modal-close" onClick={closeModal}>
            ✕
          </button>
        </div>

        {chartLoading && <div className="loading">Loading chart...</div>}
        {chartError && <div className="fetch-error">{chartError}</div>}

        {chartData && chartOptions && (
          <>
            <div className="chart-wrapper" style={{ height: 360 }}>
              <Line data={chartData} options={chartOptions} />
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 160px", background: "linear-gradient(180deg,#071a14,#042018)", padding: 12, borderRadius: 10, boxShadow: "0 10px 20px rgba(0,0,0,0.5)" }}>
                <div style={{ color: "#9feccf", fontSize: 12 }}>Avg Voltage</div>
                <div style={{ color: "#00ff88", fontWeight: 800, fontSize: 18 }}>{selectedStationObj?.avg_voltage ?? "—"} V</div>
              </div>

              <div style={{ flex: "1 1 160px", background: "linear-gradient(180deg,#071a14,#042018)", padding: 12, borderRadius: 10, boxShadow: "0 10px 20px rgba(0,0,0,0.5)" }}>
                <div style={{ color: "#9feccf", fontSize: 12 }}>Avg Current</div>
                <div style={{ color: "#00ff88", fontWeight: 800, fontSize: 18 }}>{selectedStationObj?.avg_current ?? "—"} A</div>
              </div>

              <div style={{ flex: "1 1 160px", background: "linear-gradient(180deg,#071a14,#042018)", padding: 12, borderRadius: 10, boxShadow: "0 10px 20px rgba(0,0,0,0.5)" }}>
                <div style={{ color: "#9feccf", fontSize: 12 }}>Avg Sessions</div>
                <div style={{ color: "#00ff88", fontWeight: 800, fontSize: 18 }}>{selectedStationObj?.avg_sessions ?? "—"}</div>
              </div>

              <div style={{ flex: "1 1 160px", background: "linear-gradient(180deg,#071a14,#042018)", padding: 12, borderRadius: 10, boxShadow: "0 10px 20px rgba(0,0,0,0.5)" }}>
                <div style={{ color: "#9feccf", fontSize: 12 }}>Total Revenue</div>
                <div style={{ color: "#00ff88", fontWeight: 800, fontSize: 18 }}>₹{(selectedStationObj?.total_revenue_inr ?? "—").toLocaleString?.() ?? (selectedStationObj?.total_revenue_inr ?? "—")}</div>
              </div>
            </div>
          </>
        )}

        {!chartData && !chartLoading && !chartError && (
          <>
            <div className="no-data">No chart data available for this station.</div>

            <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 160px", background: "linear-gradient(180deg,#071a14,#042018)", padding: 12, borderRadius: 10 }}>
                <div style={{ color: "#9feccf", fontSize: 12 }}>Avg Voltage</div>
                <div style={{ color: "#00ff88", fontWeight: 800, fontSize: 18 }}>{selectedStationObj?.avg_voltage ?? "—"} V</div>
              </div>
              <div style={{ flex: "1 1 160px", background: "linear-gradient(180deg,#071a14,#042018)", padding: 12, borderRadius: 10 }}>
                <div style={{ color: "#9feccf", fontSize: 12 }}>Avg Current</div>
                <div style={{ color: "#00ff88", fontWeight: 800, fontSize: 18 }}>{selectedStationObj?.avg_current ?? "—"} A</div>
              </div>
              <div style={{ flex: "1 1 160px", background: "linear-gradient(180deg,#071a14,#042018)", padding: 12, borderRadius: 10 }}>
                <div style={{ color: "#9feccf", fontSize: 12 }}>Avg Sessions</div>
                <div style={{ color: "#00ff88", fontWeight: 800, fontSize: 18 }}>{selectedStationObj?.avg_sessions ?? "—"}</div>
              </div>
              <div style={{ flex: "1 1 160px", background: "linear-gradient(180deg,#071a14,#042018)", padding: 12, borderRadius: 10 }}>
                <div style={{ color: "#9feccf", fontSize: 12 }}>Total Revenue</div>
                <div style={{ color: "#00ff88", fontWeight: 800, fontSize: 18 }}>₹{(selectedStationObj?.total_revenue_inr ?? "—").toLocaleString?.() ?? (selectedStationObj?.total_revenue_inr ?? "—")}</div>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default StationListPage;
