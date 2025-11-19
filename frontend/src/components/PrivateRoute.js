import React from "react";
import { Navigate } from "react-router-dom";

export default function PrivateRoute({ role: requiredRole, children }) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) return <Navigate to="/" replace />;
  if (requiredRole && role !== requiredRole) {
    // redirect to the correct landing for their role
    return <Navigate to={role === "company" ? "/company" : "/station"} replace />;
  }
  return children;
}
