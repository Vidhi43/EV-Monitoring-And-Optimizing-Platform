import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../pages/LoginPage.css";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:4000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // backend returns {error: "..."} when invalid
        setError(data.error || "Invalid credentials. Try again.");
      } else {
        // ✅ Save details from backend
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.role);
        localStorage.setItem("username", data.username);

        // redirect based on role
        navigate(data.role === "company" ? "/company" : "/station");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Server error. Backend might not be running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="login-bg"
      style={{
        backgroundImage: `url(${process.env.PUBLIC_URL + '/bg.png'})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="login-card">
        <h1 className="login-title">⚡ EV Charging System</h1>
        <p className="login-subtitle">Login to continue</p>

        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>

          {error && <p className="error">{error}</p>}
        </form>

        <p className="demo-info">
          Demo credentials:
          <br />
          <strong>stationUser / 5678</strong> &nbsp;|&nbsp;
          <strong>companyAdmin / 1234</strong>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
