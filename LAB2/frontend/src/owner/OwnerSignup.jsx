// src/owner/OwnerSignup.jsx
import { useState } from "react";
import { useDispatch } from "react-redux";
import { loginSuccess } from "../store/authSlice";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS",
  "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK",
  "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
  "WI", "WY"
];

export default function OwnerSignup({ onOwnerCreated }) {
  const dispatch = useDispatch();

  const [f, setF] = useState({
    name: "",
    email: "",
    password: "",
    city: "",
    state: "",
    country: "",
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  function onChange(e) {
    const { name, value } = e.target;
    setF((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("http://localhost:4000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...f, role: "owner" }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create owner");
        return;
      }

      setSuccess("Owner account created! Please log in and complete your profile.");

      const user = data.user || data;
      dispatch(
        loginSuccess({
          user,
          token: data.token || null,
        })
      );

      onOwnerCreated?.();
    } catch (err) {
      console.error("Owner signup error:", err);
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 8 }}>
      <input
        className="input"
        name="name"
        placeholder="Name"
        value={f.name}
        onChange={onChange}
        required
      />

      <input
        className="input"
        type="email"
        name="email"
        placeholder="Email"
        value={f.email}
        onChange={onChange}
        required
      />

      <input
        className="input"
        type="password"
        name="password"
        placeholder="Password (min 8)"
        value={f.password}
        onChange={onChange}
        required
      />

      <input
        className="input"
        name="city"
        placeholder="City"
        value={f.city}
        onChange={onChange}
        required
      />

      {/* ---- STATE DROPDOWN ---- */}
      <select
        className="input"
        name="state"
        value={f.state}
        onChange={onChange}
        required
      >
        <option value="">Select State</option>
        {US_STATES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <input
        className="input"
        name="country"
        placeholder="Country"
        value={f.country}
        onChange={onChange}
        required
      />

      <button className="btn" disabled={loading}>
        {loading ? "Creating..." : "Create owner account"}
      </button>

      {success && (
        <p style={{ color: "green", fontSize: 12, marginTop: 4 }}>{success}</p>
      )}
      {error && (
        <p style={{ color: "red", fontSize: 12, marginTop: 4 }}>{error}</p>
      )}
    </form>
  );
}
