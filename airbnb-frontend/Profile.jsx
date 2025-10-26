import { useEffect, useMemo, useState } from "react";
import { api } from "./api";

const COUNTRIES = [
  "United States", "Canada", "India", "United Kingdom", "Australia", "Germany", "France", "Singapore", "United Arab Emirates", "Other"
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
];

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const isUSA = useMemo(() => (profile?.country || "") === "United States", [profile]);

  useEffect(() => {
    (async () => {
      try {
        const me = await api("/api/auth/profile");
        setProfile(me);
      } catch (e) {
        setMsg("Please log in to edit your profile.");
      }
    })();
  }, []);

  function onChange(e) {
    const { name, value } = e.target;
    setProfile((p) => ({ ...p, [name]: value }));
  }

  async function onSave(e) {
    e.preventDefault();
    try {
      await api("/api/auth/profile", { method: "PUT", body: profile });
      setMsg("✅ Profile updated");
    } catch (e) {
      setMsg(`❌ ${e.message}`);
    }
  }

  async function onAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("avatar", file);
    setUploading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/avatar`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setProfile((p) => ({ ...p, avatar_url: data.avatar_url }));
      setMsg("✅ Photo updated");
    } catch (e) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setUploading(false);
      e.target.value = ""; // reset picker
    }
  }

  if (!profile) return <div className="container"><div className="card">Loading… {msg}</div></div>;

  return (
    <div className="container">
      <div className="card" style={{ display: "grid", gap: 16 }}>
        <h2 className="title">My Profile</h2>

        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <img
            src={profile.avatar_url ? `${import.meta.env.VITE_API_URL}${profile.avatar_url}` : "https://via.placeholder.com/96?text=User"}
            alt="avatar"
            style={{ width: 96, height: 96, borderRadius: "9999px", objectFit: "cover", border: "1px solid #e5e7eb" }}
          />
          <label className="btn btn-outline" style={{ cursor: "pointer" }}>
            {uploading ? "Uploading…" : "Change photo"}
            <input type="file" accept="image/*" onChange={onAvatar} hidden />
          </label>
        </div>

        <form onSubmit={onSave} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
          <div className="field">
            <label className="label">Name</label>
            <input className="input" name="name" value={profile.name || ""} onChange={onChange} required />
          </div>

          <div className="field">
            <label className="label">Email</label>
            <input className="input" type="email" name="email" value={profile.email || ""} onChange={onChange} required />
          </div>

          <div className="field">
            <label className="label">Phone</label>
            <input className="input" name="phone" value={profile.phone || ""} onChange={onChange} placeholder="+1 555-123-4567" />
          </div>

          <div className="field">
            <label className="label">About me</label>
            <textarea className="input" name="about" rows={3} value={profile.about || ""} onChange={onChange} />
          </div>

          <div className="field">
            <label className="label">City</label>
            <input className="input" name="city" value={profile.city || ""} onChange={onChange} />
          </div>

          <div className="field">
            <label className="label">Country</label>
            <select className="input" name="country" value={profile.country || ""} onChange={onChange}>
              <option value="">Select country</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {isUSA && (
            <div className="field">
              <label className="label">State (abbr)</label>
              <select className="input" name="state" value={profile.state || ""} onChange={onChange}>
                <option value="">Select state</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          <div className="field">
            <label className="label">Languages (comma separated)</label>
            <input className="input" name="languages" value={profile.languages || ""} onChange={onChange} placeholder="English, Hindi" />
          </div>

          <div className="field">
            <label className="label">Gender</label>
            <select className="input" name="gender" value={profile.gender || ""} onChange={onChange}>
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="non-binary">Non-binary</option>
              <option value="other">Other</option>
            </select>
          </div>

          <button className="btn" type="submit">Save Changes</button>
          {msg && <div className="note">{msg}</div>}
        </form>
      </div>
    </div>
  );
}
