import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import CompanyDashboard from "./pages/CompanyDashboard";
import StationDashboard from "./pages/StationDashboard";
import PrivateRoute from "./components/PrivateRoute";
import AdminComplaints from "./pages/AdminComplaints";

function App() {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const authenticatedLanding = role === "company" ? "/company" : role === "station" ? "/station" : "/";

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />

        <Route path="/company" element={
          <PrivateRoute role="company"><CompanyDashboard /></PrivateRoute>
        } />

        <Route path="/company/complaints" element={
          <PrivateRoute role="company"><AdminComplaints /></PrivateRoute>
        } />

        <Route path="/station" element={
          <PrivateRoute role="station"><StationDashboard /></PrivateRoute>
        } />

        <Route path="*" element={ token ? <Navigate to={authenticatedLanding} replace /> : <Navigate to="/" replace /> } />
      </Routes>
    </Router>
  );
}

export default App;
