import { useState } from "react";  //React Hook for managing component-level state.
import { api } from "./api";      //Your custom utility that wraps fetch calls to the backend (/api/auth/...)
//functional component that renders the registration form
export default function Signup() { 
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [msg, setMsg] = useState({ text: "", type: "" });//Stores the input values entered by the user (name, email, password).

  const onChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });
  //Creating New account
  async function onSubmit(e) {
    e.preventDefault();
    setMsg({ text: "Creating account...", type: "" });
    try {
      const user = await api("/api/auth/signup", { method: "POST", body: form });//Calls backend signup endpoint.
      setMsg({ text: `Created: ${user.email}`, type: "ok" });
    } catch (err) {
      setMsg({ text: err.message, type: "err" });
    }
  }
 //handles submit event
  return ( 
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
      <div className="field"> 
        <label className="label">Name</label>
        <input className="input" name="name" placeholder="Jane Doe" value={form.name} onChange={onChange} required />
      </div>

      <div className="field">
        <label className="label">Email</label>
        <input className="input" name="email" type="email" placeholder="jane@example.com" value={form.email} onChange={onChange} required />
      </div>

      <div className="field">
        <label className="label">Password</label>
        <input className="input" name="password" type="password" placeholder="At least 8 characters" value={form.password} onChange={onChange} required />
      </div>

      <button className="btn" type="submit">Create Account</button>
      {msg.text ? <div className={`note ${msg.type === "ok" ? "ok" : msg.type === "err" ? "err" : ""}`}>{msg.text}</div> : null}
    </form>
  );
}
