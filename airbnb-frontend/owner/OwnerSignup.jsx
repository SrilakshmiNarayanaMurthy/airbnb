import { useState } from "react";

export default function OwnerSignup({ onAuthed }) {
  const [f, setF] = useState({
    name: "", email: "", password: "",
    city: "", state: "", country: ""
  });
  const [loading, setLoading] = useState(false);

  function onChange(e) {
    const { name, value } = e.target;
    setF(prev => ({ ...prev, [name]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      //const res = await fetch("http://localhost:4000/api/owners/signup", {
      const res = await fetch("http://localhost:4000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        //body: JSON.stringify(f),
        body: JSON.stringify({ ...f, role: "owner" }),
      });
      const data = await res.json();
      if (!res.ok) return alert(data?.error || "Owner signup failed");
      onAuthed?.(data); // logged in as owner; App.jsx will switch to Owner view
    } catch {
      alert("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 8 }}>
      <input className="input" name="name" placeholder="Name" value={f.name} onChange={onChange} required />
      <input className="input" type="email" name="email" placeholder="Email" value={f.email} onChange={onChange} required />
      <input className="input" type="password" name="password" placeholder="Password (min 8)" value={f.password} onChange={onChange} required />
      <input className="input" name="city" placeholder="City" value={f.city} onChange={onChange} required />
      <input className="input" name="state" placeholder="State (optional)" value={f.state} onChange={onChange} />
      <input className="input" name="country" placeholder="Country" value={f.country} onChange={onChange} required />
      <button className="btn" disabled={loading}>
        {loading ? "Creating..." : "Create owner account"}
      </button>
    </form>
  );
}
