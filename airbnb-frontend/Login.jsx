import { useState } from "react";
import { api } from "./api";

export default function Login({ onAuthed }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [msg, setMsg] = useState({ text: "", type: "" });

  const onChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setMsg({ text: "Logging in...", type: "" });
    try {
      const res = await api("/api/auth/login", { method: "POST", body: form });
      setMsg({ text: `Welcome ${res.user.name}`, type: "ok" });
      onAuthed?.(res.user);
    } catch (err) {
      setMsg({ text: err.message, type: "err" });
    }
  }

  async function checkMe() {
    try {
      const me = await api("/api/auth/me");
      setMsg({ text: `Authenticated as ${me.user.email}`, type: "ok" });
    } catch {
      setMsg({ text: "Not authenticated", type: "err" });
    }
  }

  async function doLogout() {
    await api("/api/auth/logout", { method: "POST" });
    setMsg({ text: "Logged out", type: "" });
    onAuthed?.(null);
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <div className="field">
          <label className="label">Email</label>
          <input className="input" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={onChange} required />
        </div>

        <div className="field">
          <label className="label">Password</label>
          <input className="input" name="password" type="password" placeholder="Your password" value={form.password} onChange={onChange} required />
        </div>

        <button className="btn" type="submit">Login</button>
      </form>

      <div className="actions">
        <button className="btn btn-outline" onClick={checkMe}>Who am I?</button>
        <button className="btn btn-outline" onClick={doLogout}>Logout</button>
      </div>

      {msg.text ? <div className={`note ${msg.type === "ok" ? "ok" : msg.type === "err" ? "err" : ""}`}>{msg.text}</div> : null}
    </div>
  );
}
