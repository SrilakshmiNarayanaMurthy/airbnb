// src/Login.jsx
import { useState } from "react";
import { api } from "./api";
import { useDispatch } from "react-redux";
import { authStart, loginSuccess, authFailure } from "./store/authSlice";

export default function Login({ onAuthed }) {
  const dispatch = useDispatch();
  const [form, setForm] = useState({ email: "", password: "" });
  const [msg, setMsg] = useState({ text: "", type: "" });

  const onChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setMsg({ text: "Logging in...", type: "" });
    dispatch(authStart());

    try {
      const res = await api("/api/auth/login", {
        method: "POST",
        body: form,
      });

      // ✅ Handle both: { user, token } OR plain user object
      const user = res.user || res;
      const token = res.token || null;

      dispatch(loginSuccess({ user, token }));
      setMsg({
        text: `Welcome ${user.name || user.email}`,
        type: "ok",
      });

      onAuthed?.(user, token);
    } catch (err) {
      dispatch(authFailure(err.message));
      setMsg({ text: err.message, type: "err" });
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <div className="field">
          <label className="label">Email</label>
          <input
            className="input"
            name="email"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={onChange}
            required
          />
        </div>

        <div className="field">
          <label className="label">Password</label>
          <input
            className="input"
            name="password"
            type="password"
            placeholder="Your password"
            value={form.password}
            onChange={onChange}
            required
          />
        </div>

        <button className="btn" type="submit">
          Login
        </button>
      </form>

      {msg.text ? (
        <div
          className={`note ${
            msg.type === "ok" ? "ok" : msg.type === "err" ? "err" : ""
          }`}
        >
          {msg.text}
        </div>
      ) : null}
    </div>
  );
}
