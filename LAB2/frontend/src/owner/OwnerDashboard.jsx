import { useEffect, useState } from "react";

const AMENITY_LIST = ["wifi", "ac", "parking", "kitchen", "tv"];

export default function OwnerDashboard() {
  const [form, setForm] = useState({
    title: "", city: "", country: "",
    price_per_night: 50, max_guests: 2, bedrooms: 1, bathrooms: 1,
    image_url: "", description: "",
    property_type: "apartment",
    amenities: []
  });
  const [mine, setMine] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [photos, setPhotos] = useState({});  //Stores uploaded images grouped by listing ID
  const [blackouts, setBlackouts] = useState({});
  const [bo, setBo] = useState({ start: "", end: "" });

  // NEW: booking management state
  const [requests, setRequests] = useState([]); // pending
  const [recent, setRecent] = useState([]);     // accepted + cancelled

  function onChange(e) { 
    const { name, value } = e.target;
    setForm((f) => ({
      ...f,
      [name]:
        name === "price_per_night" || name === "bathrooms"
          ? Number(value)
          : name === "max_guests" || name === "bedrooms"
          ? parseInt(value || "0", 10) //Converts numeric fields like price and bedrooms to numbers for backend compatibility.
          : value,
    }));
  } //Adds or removes an amenity (e.g., “wifi”) from the array.
  function toggleAmenity(am) {
    setForm(f => {
      const has = f.amenities.includes(am);
      const next = has ? f.amenities.filter(x => x !== am) : [...f.amenities, am];
      return { ...f, amenities: next };
    });
  }
//Fetches all listings created by this owner.
  async function loadMine() {
    const r = await fetch("http://localhost:4000/api/owners/listings", {
      credentials: "include",
    });
    if (!r.ok) {
      setMine([]);
      return;
    }

    const rows = await r.json();

    // Handle both shapes safely (array OR comma string),
    // but for your current Mongo backend it will already be an array.
    rows.forEach((x) => {
      if (Array.isArray(x.amenities)) return;
      x.amenities = (x.amenities || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    });

    setMine(rows);
  }

  async function loadRequests() {
    const r = await fetch("http://localhost:4000/api/owners/requests?status=pending", { credentials: "include" });
    setRequests(r.ok ? await r.json() : []);
  }
  async function loadRecent() {
    const a = await fetch("http://localhost:4000/api/owners/requests?status=accepted", { credentials: "include" });
    const c = await fetch("http://localhost:4000/api/owners/requests?status=cancelled", { credentials: "include" });
    const A = a.ok ? await a.json() : [];
    const C = c.ok ? await c.json() : [];
    setRecent([...A, ...C].sort((x,y) => new Date(y.created_at) - new Date(x.created_at)));
  }

  async function createOrUpdate(e) {
    e.preventDefault();
    const payload = { ...form, amenities: form.amenities.join(",") };
    const url = editingId
      ? `http://localhost:4000/api/owners/listings/${editingId}`
      : `http://localhost:4000/api/owners/listings`;
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return alert(data?.error || "Save failed");
    await loadMine();
    setEditingId(null);
    setForm(f => ({ ...f, title: "", image_url: "", description: "", amenities: [] }));
    alert(editingId ? "✅ Listing updated" : "✅ Listing created");
  }
//Loads selected listing into the form for editing.
  function startEdit(it) {
    setEditingId(it.id);
    setForm({
      title: it.title, city: it.city, country: it.country,
      price_per_night: Number(it.price_per_night),
      max_guests: it.max_guests, bedrooms: it.bedrooms, bathrooms: Number(it.bathrooms),
      image_url: it.image_url || "", description: it.description || "",
      property_type: it.property_type || "apartment",
      amenities: it.amenities || [],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
//Deletes a listing after confirmation and reloads.
  async function delListing(id) {
    if (!confirm("Delete this listing?")) return;
    const r = await fetch(`http://localhost:4000/api/owners/listings/${id}`, {
      method: "DELETE", credentials: "include"
    });
    const d = await r.json();
    if (!r.ok) return alert(d?.error || "Delete failed");
    await loadMine();
  }
  
  async function uploadPhotos(listingId, files) {
    const fd = new FormData();
    [...files].forEach(f => fd.append("photos", f));
    const r = await fetch(`http://localhost:4000/api/owners/listings/${listingId}/photos`, {
      method: "POST", credentials: "include", body: fd
    });
    const d = await r.json();
    if (!r.ok) return alert(d?.error || "Upload failed");
    
    // Update main image with first photo
    if (d.urls && d.urls.length > 0) {
      const firstPhotoUrl = d.urls[0];
      await fetch(`http://localhost:4000/api/owners/listings/${listingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ image_url: firstPhotoUrl })
      });
      await loadMine(); // refresh main listing
    }
    
    await fetchPhotos(listingId);
    alert("✅ Photos uploaded! First photo set as main image.");
  }

  async function fetchPhotos(listingId) {
    const r = await fetch(`http://localhost:4000/api/owners/listings/${listingId}/photos`, {
      credentials: "include"
    });
    if (!r.ok) return;
    const rows = await r.json();
    setPhotos(p => ({ ...p, [listingId]: rows }));
  }

  async function fetchBlackouts(listingId) {
    const r = await fetch(`http://localhost:4000/api/owners/listings/${listingId}/blackouts`, {
      credentials: "include"
    });
    if (!r.ok) return;
    const rows = await r.json();
    setBlackouts(b => ({ ...b, [listingId]: rows }));
  }
  async function addBlackout(listingId) {
    if (!bo.start || !bo.end) return alert("Select start & end");
    const r = await fetch(`http://localhost:4000/api/owners/listings/${listingId}/blackouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ start_date: bo.start, end_date: bo.end })
    });
    const d = await r.json();
    if (!r.ok) return alert(d?.error || "Failed");
    setBo({ start: "", end: "" });
    await fetchBlackouts(listingId);
  }
  async function removeBlackout(bid, listingId) {
    const r = await fetch(`http://localhost:4000/api/owners/blackouts/${bid}`, {
      method: "DELETE", credentials: "include"
    });
    const d = await r.json();
    if (!r.ok) return alert(d?.error || "Failed");
    await fetchBlackouts(listingId);
  }

  // NEW: accept/cancel
  async function acceptBooking(id) {
    const r = await fetch(`http://localhost:4000/api/owners/bookings/${id}/accept`, {
      method: "POST", credentials: "include"
    });
    const d = await r.json();
    if (!r.ok) return alert(d?.error || "Failed");
    await Promise.all([loadRequests(), loadRecent()]);
    alert("✅ Booking accepted");
  }
  async function cancelBooking(id) {
    const r = await fetch(`http://localhost:4000/api/owners/bookings/${id}/cancel`, {
      method: "POST", credentials: "include"
    });
    const d = await r.json();
    if (!r.ok) return alert(d?.error || "Failed");
    await Promise.all([loadRequests(), loadRecent()]);
    alert("❌ Booking cancelled");
  }

  useEffect(() => { loadMine(); loadRequests(); loadRecent(); }, []);

  return (
    <div className="container" style={{ display: "grid", gap: 16 }}>
      <h2>Owner Dashboard</h2>

      {/* Booking Requests */}
      <div className="card" style={{ display: "grid", gap: 10 }}>
        <h3>Booking Requests</h3>
        {requests.length === 0 && <div className="subtle">No pending requests.</div>}
        {requests.map(r => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <b>{r.title}</b> — {r.check_in} → {r.check_out} · {r.guests} guest(s) · by {r.guest_name} ({r.guest_email})
              <div className="subtle">Total: ${Number(r.total_price).toFixed(2)}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => acceptBooking(r.id)}>Accept</button>
              <button className="btn btn-outline" onClick={() => cancelBooking(r.id)}>Cancel</button>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Bookings */}
      <div className="card" style={{ display: "grid", gap: 10 }}>
        <h3>Recent Bookings</h3>
        {recent.length === 0 && <div className="subtle">No recent items.</div>}
        {recent.map(r => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <b>{r.title}</b> — {r.check_in} → {r.check_out} · {r.guests} guest(s) · {r.guest_name}
              <div className="subtle">Total: ${Number(r.total_price).toFixed(2)}</div>
            </div>
            <span className="subtle" style={{ fontWeight: 700 }}>
              {r.status === "accepted" ? "ACCEPTED" : "CANCELLED"}
            </span>
          </div>
        ))}
      </div>

      {/* Create / Update Listing */}
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <b>{editingId ? "Edit Listing" : "Create Listing"}</b>
        <form onSubmit={createOrUpdate} className="grid" style={{ gap: 12 }}>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            <div>
              <label className="label">Title</label>
              <input className="input" name="title" value={form.title} onChange={onChange} required />
            </div>
            <div>
              <label className="label">City</label>
              <input className="input" name="city" value={form.city} onChange={onChange} required />
            </div>
            <div>
              <label className="label">Country</label>
              <input className="input" name="country" value={form.country} onChange={onChange} required />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" name="property_type" value={form.property_type} onChange={onChange}>
                <option>apartment</option>
                <option>house</option>
                <option>studio</option>
                <option>villa</option>
                <option>room</option>
              </select>
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            <div>
              <label className="label">Max guests</label>
              <input className="input" type="number" min="1" name="max_guests" value={form.max_guests} onChange={onChange} />
            </div>
            <div>
              <label className="label">Bedrooms</label>
              <input className="input" type="number" min="1" name="bedrooms" value={form.bedrooms} onChange={onChange} />
            </div>
            <div>
              <label className="label">Bathrooms</label>
              <input className="input" type="number" min="1" step="0.5" name="bathrooms" value={form.bathrooms} onChange={onChange} />
            </div>
            <div>
              <label className="label">Price / night</label>
              <input className="input" type="number" min="1" step="0.01" name="price_per_night" value={form.price_per_night} onChange={onChange} />
            </div>
          </div>

          <div>
            <label className="label">Amenities</label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {AMENITY_LIST.map(am => (
                <label key={am} className="subtle" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" checked={form.amenities.includes(am)} onChange={() => toggleAmenity(am)} />
                  {am}
                </label>
              ))}
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label className="label">Description (optional)</label>
              <textarea className="input" name="description" value={form.description} onChange={onChange} />
            </div>
            <div>
              <label className="label">Cover Image URL (optional)</label>
              <input className="input" name="image_url" value={form.image_url} onChange={onChange} placeholder="https://..." />
            </div>
          </div>

          <div>
            <button className="btn">{editingId ? "Update" : "Create"}</button>
            {editingId && (
              <button type="button" className="btn btn-outline" style={{ marginLeft: 8 }}
                onClick={() => { setEditingId(null); setForm(f => ({ ...f, title:"", image_url:"", description:"", amenities: [] })); }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* My listings */}
      <div>
        <h3>My Listings</h3>
        <div className="grid">
          {mine.map((it) => (
            <div className="card" key={it.id} style={{ display: "grid", gap: 10 }}>
              <img
                src={(photos[it.id]?.[0]?.url) || it.image_url || "https://via.placeholder.com/800x500?text=Listing"}
                alt={it.title} style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 12 }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <h4 style={{ margin: 0 }}>{it.title}</h4>
                <b>${Number(it.price_per_night).toFixed(2)}/night</b>
              </div>
              <div className="subtle">
                {it.city}, {it.country} · {it.property_type || "type"} · {it.bedrooms} bd · {it.bathrooms} ba · up to {it.max_guests} guests
              </div>
              {it.amenities?.length > 0 && (
                <div className="subtle">Amenities: {it.amenities.join(", ")}</div>
              )}
              <p style={{ margin: 0 }}>{it.description}</p>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-outline" onClick={() => startEdit(it)}>Edit</button>
                <button className="btn btn-outline" onClick={() => delListing(it.id)}>Delete</button>

                <label className="btn btn-outline">
                  Add photos
                  <input type="file" multiple style={{ display: "none" }} onChange={(e) => uploadPhotos(it.id, e.target.files)} />
                </label>
                <button className="btn btn-outline" onClick={() => fetchPhotos(it.id)}>Show photos</button>

                <input className="input" type="date" value={bo.start} onChange={(e)=>setBo(b=>({...b,start:e.target.value}))}/>
                <input className="input" type="date" value={bo.end} onChange={(e)=>setBo(b=>({...b,end:e.target.value}))}/>
                <button className="btn btn-outline" onClick={() => addBlackout(it.id)}>Add blackout</button>
                <button className="btn btn-outline" onClick={() => fetchBlackouts(it.id)}>Show blackouts</button>
              </div>

              {photos[it.id]?.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {photos[it.id].map(p => (
                    <img key={p.id} src={p.url} alt="" style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 8 }} />
                  ))}
                </div>
              )}
              {blackouts[it.id]?.length > 0 && (
                <div className="subtle" style={{ display: "grid", gap: 6 }}>
                  {blackouts[it.id].map(b => (
                    <div key={b.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span>Blackout: {b.start_date} → {b.end_date}</span>
                      <button className="btn btn-outline" onClick={()=>removeBlackout(b.id, it.id)}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {mine.length === 0 && <div className="card">No listings yet.</div>}
      </div>
    </div>
  );
}
