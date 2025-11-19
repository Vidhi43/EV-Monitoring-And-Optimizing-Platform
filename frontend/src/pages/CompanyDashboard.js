// src/pages/CompanyDashboard.js
import React, { useState, useEffect, useCallback, useRef } from "react";
import "./CompanyDashboard.css";
import StationListPage from "./StationListPage";
import AdminComplaints from "./AdminComplaints";

import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from "@react-google-maps/api";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Pie } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

const containerStyle = { width: "100%", height: "420px" };
const defaultCenter = { lat: 19.0760, lng: 72.8777 };

const SAMPLE_STATIONS = [
  { station_id: 101, name: "Station 101", lat: 18.5204, lng: 73.8567, avg_sessions: 56, avg_voltage: 225, total_revenue_inr: 500000 },
  { station_id: 102, name: "Station 102", lat: 19.0760, lng: 72.8777, avg_sessions: 55, avg_voltage: 228, total_revenue_inr: 497000 },
  { station_id: 103, name: "Station 103", lat: 17.3850, lng: 78.4867, avg_sessions: 59, avg_voltage: 224, total_revenue_inr: 533000 },
  { station_id: 104, name: "Station 104", lat: 12.9716, lng: 77.5946, avg_sessions: 57, avg_voltage: 227, total_revenue_inr: 512000 },
  { station_id: 105, name: "Station 105", lat: 28.7041, lng: 77.1025, avg_sessions: 57, avg_voltage: 226, total_revenue_inr: 517000 },
];

const vividPalette = [
  "#00FFC6",
  "#1EE3CF",
  "#3DD6D0",
  "#00B8A9",
  "#00897B",
  "#005F56",
];

const CompanyDashboard = () => {
  const [activePage, setActivePage] = useState("dashboard");
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const mapRefObj = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
  });

  const [openStationId, setOpenStationId] = useState(null);
  const onOpenHandled = () => setOpenStationId(null);

  useEffect(() => {
    let mounted = true;
    fetch("/static/stations_summary.json")
      .then((res) => {
        if (!res.ok) throw new Error("stations_summary.json not found");
        return res.json();
      })
      .then((data) => {
        if (!mounted) return;
        const cleaned = (data || []).map((s, i) => ({
          station_id: s.station_id ?? s.id ?? s.stationId ?? (100 + i),
          name: s.name ?? s.station_name ?? `Station ${s.station_id ?? s.id ?? (100 + i)}`,
          lat: s.lat !== undefined ? Number(s.lat) : s.latitude !== undefined ? Number(s.latitude) : undefined,
          lng: s.lng !== undefined ? Number(s.lng) : s.longitude !== undefined ? Number(s.longitude) : undefined,
          avg_sessions: Number(s.avg_sessions ?? s.avg_sessions) || 0,
          avg_voltage: Number(s.avg_voltage ?? s.avg_voltage) || 0,
          total_revenue_inr: Number(s.total_revenue_inr ?? s.revenue_inr) || 0,
          ...s,
        }));
        setStations(cleaned.length ? cleaned : SAMPLE_STATIONS);
      })
      .catch((err) => {
        console.warn("Could not load station summary, using sample", err);
        setStations(SAMPLE_STATIONS);
      });
    return () => (mounted = false);
  }, []);

  const onMapLoad = useCallback((map) => {
    mapRefObj.current = map;
  }, []);
  const onMapUnmount = useCallback(() => {
    mapRefObj.current = null;
  }, []);

  const goToStation = (st) => {
    if (!st) return;
    setSelectedStation(st);
    setActivePage("dashboard");
    if (mapRefObj.current && st.lat && st.lng) {
      mapRefObj.current.panTo({ lat: st.lat, lng: st.lng });
      mapRefObj.current.setZoom(13);
    }
  };

  const openStationDetails = (stationId) => {
    setOpenStationId(stationId);
    setActivePage("stations");
  };

  const computeKPIs = () => {
    if (selectedStation) {
      return {
        totalSessions: selectedStation.avg_sessions || 0,
        avgVoltage: selectedStation.avg_voltage || 0,
        totalRevenue: selectedStation.total_revenue_inr || 0,
        avgSessions: selectedStation.avg_sessions || 0,
      };
    }
    const totalSessions = stations.reduce((s, r) => s + (r.avg_sessions || 0), 0);
    const avgVoltage = stations.length ? Math.round(stations.reduce((s, r) => s + (r.avg_voltage || 0), 0) / stations.length) : 0;
    const totalRevenue = stations.reduce((s, r) => s + (r.total_revenue_inr || 0), 0);
    const avgSessions = stations.length ? Math.round(totalSessions / stations.length) : 0;
    return { totalSessions, avgVoltage, totalRevenue, avgSessions };
  };

  const [timeseries, setTimeseries] = useState({ labels: [], values: [] });
  useEffect(() => {
    let mounted = true;
    const loadTS = async () => {
      if (selectedStation && selectedStation.station_id) {
        const path = `/static/ev_station_${selectedStation.station_id}_daily_data.csv`;
        try {
          const res = await fetch(path);
          if (!res.ok) throw new Error("CSV missing");
          const text = await res.text();
          const rows = text.trim().split("\n").map((r) => r.split(","));
          const header = rows.shift().map((h) => h.trim().toLowerCase());
          const dateIdx = header.findIndex((h) => h === "date");
          const sessionsIdx = header.findIndex((h) => h.includes("charging_sessions")) !== -1 ? header.findIndex((h) => h.includes("charging_sessions")) : header.findIndex((h) => h.includes("sessions"));
          const dates = [];
          const vals = [];
          for (const r of rows) {
            dates.push(r[dateIdx] ? r[dateIdx].trim() : "");
            vals.push(sessionsIdx !== -1 ? Number(r[sessionsIdx] || 0) : 0);
          }
          if (mounted) setTimeseries({ labels: dates, values: vals });
          return;
        } catch (e) {
          console.warn("per-station CSV not found, using overview timeseries", e);
        }
      }
      const labels = stations.map((s) => s.name);
      const values = stations.map((s) => s.avg_sessions || 0);
      if (mounted) setTimeseries({ labels, values });
    };
    loadTS();
    return () => (mounted = false);
  }, [selectedStation, stations]);

  const totalRevenueAll = stations.reduce((s, r) => s + (r.total_revenue_inr || 0), 0);
  let revenuePie;
  if (selectedStation) {
    const selRev = selectedStation.total_revenue_inr || 0;
    const others = Math.max(0, totalRevenueAll - selRev);
    revenuePie = {
      labels: [`Selected: ${selectedStation.name}`, "Other stations"],
      datasets: [
        {
          data: [selRev, others],
          backgroundColor: ["#06B6D4", "#2D3748"],
          hoverBackgroundColor: ["#06B6D4", "#4B5563"],
          borderWidth: 0,
        },
      ],
    };
  } else {
    const labels = stations.map((s) => s.name);
    const data = stations.map((s) => s.total_revenue_inr || 0);
    const colors = stations.map((_, i) => vividPalette[i % vividPalette.length]);
    revenuePie = {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          hoverBackgroundColor: colors.map((c) => c),
          borderWidth: 0,
        },
      ],
    };
  }

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right",
        labels: { color: "#DFFFEA", boxWidth: 12, padding: 8 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = ctx.parsed;
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = total ? ((v / total) * 100).toFixed(1) : "0.0";
            return `${ctx.label}: ₹${Number(v).toLocaleString()} (${pct}%)`;
          },
        },
        titleColor: "#E6FFF4",
        bodyColor: "#D6FFE9",
        backgroundColor: "#041613",
      },
    },
  };

  const sessionsLine = {
    labels: timeseries.labels,
    datasets: [
      {
        label: selectedStation ? `${selectedStation.name} — sessions` : "Sessions (overview)",
        data: timeseries.values,
        fill: false,
        borderColor: "#06B6D4",
        tension: 0.22,
        pointRadius: 3,
        pointBackgroundColor: "#06B6D4",
      },
    ],
  };

  const sessionsOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#DFFFEA" } },
      tooltip: {
        titleColor: "#E6FFF4",
        bodyColor: "#D6FFE9",
        backgroundColor: "#041613",
      },
    },
    scales: {
      x: { ticks: { color: "#9FBFAA" }, grid: { color: "rgba(255,255,255,0.02)" } },
      y: { ticks: { color: "#9FBFAA" }, grid: { color: "rgba(255,255,255,0.02)" } },
    },
  };

  const kpis = computeKPIs();

  const handleMarkerClick = (s) => {
    setSelectedStation(s);
    setActivePage("dashboard");
    if (mapRefObj.current && s.lat && s.lng) {
      mapRefObj.current.panTo({ lat: s.lat, lng: s.lng });
      mapRefObj.current.setZoom(13);
    }
  };

  return (
    <div className="company-dashboard-root">
      <aside className="cd-sidebar">
        <div className="cd-brand">⚡ EV Analytics</div>
        <nav className="cd-nav">
          <button className={activePage === "dashboard" ? "active" : ""} onClick={() => setActivePage("dashboard")}>
            Dashboard
          </button>
          <button className={activePage === "stations" ? "active" : ""} onClick={() => setActivePage("stations")}>
            Stations
          </button>
          <button className={activePage === "reports" ? "active" : ""} onClick={() => setActivePage("reports")}>
            Complaints
          </button>
        </nav>
        <div style={{ marginTop: "auto" }} className="header-controls">
          <div className="kpi-small">Stations: <strong>{stations.length}</strong></div>
          <button className="btn-logout" onClick={() => { localStorage.clear(); window.location.href = "/"; }}>Logout</button>
        </div>
      </aside>

      <main className="cd-main">
        {activePage === "dashboard" && (
          <>
            <header className="cd-header">
              <div>
                <h1>Company Dashboard</h1>
                <p className="sub">Overview & station analytics</p>
              </div>
            </header>

            <section className="top-row">
              <div className="map-card">
                {!isLoaded && <div className="map-placeholder">Loading map...</div>}
                {loadError && <div className="map-placeholder error">Map error - check console & API key</div>}
                {isLoaded && (
                  <GoogleMap
                    mapContainerStyle={containerStyle}
                    center={ selectedStation && selectedStation.lat && selectedStation.lng ? {lat:selectedStation.lat,lng:selectedStation.lng} : (stations[0] && stations[0].lat ? {lat:stations[0].lat, lng: stations[0].lng} : defaultCenter) }
                    zoom={10}
                    onLoad={onMapLoad}
                    onUnmount={onMapUnmount}
                  >
                    {stations.map((s) => (typeof s.lat === "number" && typeof s.lng === "number") ? (
                      <Marker key={s.station_id} position={{ lat: s.lat, lng: s.lng }} onClick={() => handleMarkerClick(s)} />
                    ) : null)}
                    {selectedStation && selectedStation.lat && selectedStation.lng && (
                      <InfoWindow
                        position={{ lat: selectedStation.lat, lng: selectedStation.lng }}
                        onCloseClick={() => setSelectedStation(null)}
                      >
                        <div className="map-info-content" style={{ position: "relative", minWidth: 220 }}>
                          {/* explicit close button inside content */}
                          <button
                            onClick={() => setSelectedStation(null)}
                            aria-label="Close"
                            className="info-close-button"
                          >
                            ✖
                          </button>


                          <div className="map-info-top">
                            <div className="map-info-title">{selectedStation.name}</div>
                            <div className="map-info-revenue">Revenue: <span>₹{(selectedStation.total_revenue_inr ?? 0).toLocaleString()}</span></div>
                          </div>

                          <div className="map-info-actions" style={{ marginTop: 10 }}>
                            <button
                              className="map-info-btn map-info-open"
                              onClick={() => setActivePage("stations")}
                              title="Open station list"
                            >
                              Station list
                            </button>

                            <button
                              className="map-info-btn map-info-view"
                              onClick={() => openStationDetails(selectedStation.station_id)}
                              title="View details"
                              style={{ marginLeft: 8 }}
                            >
                              View details
                            </button>
                          </div>
                        </div>
                      </InfoWindow>
                    )}
                  </GoogleMap>
                )}
              </div>

              <div className="kpi-cards">
                <div className="kpi">
                  <div className="kpi-title">Total Sessions</div>
                  <div className="kpi-value">{kpis.totalSessions}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-title">Avg Voltage</div>
                  <div className="kpi-value">{kpis.avgVoltage} V</div>
                </div>
                <div className="kpi">
                  <div className="kpi-title">Total Revenue</div>
                  <div className="kpi-value">₹{kpis.totalRevenue.toLocaleString()}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-title">Avg Sessions</div>
                  <div className="kpi-value">{kpis.avgSessions}</div>
                </div>
              </div>
            </section>

            <section className="charts-row">
              <div className="chart-card">
                <h3>{selectedStation ? `${selectedStation.name} — Sessions` : "Sessions (overview)"}</h3>
                <div style={{ height: 280 }}>
                  <Line data={sessionsLine} options={sessionsOptions} />
                </div>
              </div>

              <div className="chart-card small">
                <h3>{selectedStation ? `Revenue: ${selectedStation.name}` : "Revenue split"}</h3>
                <div style={{ height: 280 }}>
                  <Pie data={revenuePie} options={pieOptions} />
                </div>
              </div>
            </section>
          </>
        )}

        {activePage === "stations" && (
          <StationListPage
            stations={stations}
            onSelectStation={(st) => goToStation(st)}
            openStationId={openStationId}
            onOpenHandled={onOpenHandled}
          />
        )}

        {activePage === "reports" && (
          // Render AdminComplaints inside reports tab
          <div style={{ padding: 20, width: "100%" }}>
            <h2 style={{ color: "#DFFFEA", marginBottom: 8 }}>Reports — Complaints Management</h2>
            <p style={{ color: "#a3a3a3", marginTop: 0 }}>View and manage complaints submitted by station users.</p>

            {/* pass apiBase prop so AdminComplaints calls your backend at 4000 */}
            <div style={{ marginTop: 12 }}>
              <AdminComplaints apiBase="http://localhost:4000" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CompanyDashboard;
