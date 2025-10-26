import { useEffect, useState } from "react";
import { api } from "./api";
import AIAgentPanel from "./components/AIAgentPanel";

function formatMoney(n) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
}
const fmtDate = (s) => new Date(s).toLocaleDateString();

export default function Listings() {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const [q, setQ] = useState({ city: "", start: today, end: tomorrow, guests: 1 });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // tabs: all | fav | history
  const [view, setView] = useState("all");

  // favourites
  const [favs, setFavs] = useState(new Set());

  // history trips
  const [trips, setTrips] = useState([]);

  // ---- search listings ----
  async function search() {
    setLoading(true);
    const qs = new URLSearchParams({
      city: q.city,
      start: q.start,
      end: q.end,
      guests: String(q.guests || 1),
    });
    try {
      const data = await api(`/api/listings?${qs.toString()}`);
      setItems(data);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ---- load favourites (IDs) ----
  async function loadFavs() {
    try {
      const ids = await api("/api/favorites"); // [id, id, ...]
      setFavs(new Set(ids));
    } catch {
      setFavs(new Set()); // not logged in -> ignore
    }
  }

  // ---- load history (past trips) ----
  async function loadHistory() {
    try {
      const data = await api("/api/bookings/history");
      setTrips(data);
    } catch {
      setTrips([]);
    }
  }

  useEffect(() => {
    search();
    loadFavs();
  }, []);

  useEffect(() => {
    if (view === "history") loadHistory();
  }, [view]);

  function onChange(e) {
    const { name, value } = e.target;
    setQ((prev) => ({ ...prev, [name]: name === "guests" ? Number(value) : value }));
  }

  // ---- book a listing ----
  async function book(listingId) {
    if (!q.start || !q.end) {
      alert("Pick start and end dates first.");
      return;
    }
    try {
      const res = await fetch("http://localhost:4000/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          listing_id: listingId,
          start: q.start, // YYYY-MM-DD
          end: q.end,
          guests: Number(q.guests || 1),
        }),
      });
      const data = await res.json();
      if (!res.ok) return alert(data?.error || "Booking failed");
      alert(`✅ Booking pending! Request sent. Check status under Trips. Total: ${formatMoney(data.total_price || 0)} for ${data.nights || "?"} night(s).`);
    } catch (e) {
      console.error(e);
      alert("Booking error");
    }
  }

  // ---- toggle favourite ----
  async function toggleFav(id) {
    try {
      await fetch(`http://localhost:4000/api/favorites/${id}`, {
        method: "POST",
        credentials: "include",
      });
      setFavs((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    } catch {
      alert("Please login to use favourites");
    }
  }
   // Build the booking object for the AI panel (from your search state)
  const bookingForAI = {
    start_date: q.start,              // already YYYY-MM-DD
    end_date: q.end,
    location: q.city || "Unknown",
    party_type: q.guests >= 3 ? `group of ${q.guests}` : `${q.guests} guest${q.guests === 1 ? "" : "s"}`,
  };

  // list to render on current tab
  const list = view === "fav" ? items.filter((it) => favs.has(it.id)) : items;

  return (
    <div className="container" style={{ display: "grid", gap: 20 }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn" style={view === "all" ? { fontWeight: 700 } : {}} onClick={() => setView("all")}>
          All
        </button>
        <button className="btn" style={view === "fav" ? { fontWeight: 700 } : {}} onClick={() => setView("fav")}>
          Favourites
        </button>
        <button className="btn" style={view === "history" ? { fontWeight: 700 } : {}} onClick={() => setView("history")}>
          History
        </button>
      </div>

      {/* Search card (hide on history tab) */}
      {view !== "history" && (
        <div className="card" style={{ display: "grid", gap: 12 }}>
          <h2 className="title">Search Properties</h2>

          <div className="grid">
            <div className="field">
              <label className="label">Location (city or country)</label>
              <input className="input" name="city" value={q.city} onChange={onChange} placeholder="e.g., Miami or India" />
            </div>

            <div className="field">
              <label className="label">Start date</label>
              <input className="input" type="date" name="start" value={q.start} onChange={onChange} />
            </div>

            <div className="field">
              <label className="label">End date</label>
              <input className="input" type="date" name="end" value={q.end} onChange={onChange} />
            </div>

            <div className="field">
              <label className="label">Guests</label>
              <input className="input" type="number" min="1" name="guests" value={q.guests} onChange={onChange} />
            </div>
          </div>

          <div>
            <button className="btn" onClick={search} disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </button>
          </div>
        </div>
      )}

      {/* Results for All / Favourites */}
      {view !== "history" && (
        <div className="grid">
          {list.map((it) => {
            const liked = favs.has(it.id);
            const tooManyGuests = Number(q.guests || 1) > it.max_guests;
            return (
              <div className="card" key={it.id} style={{ display: "grid", gap: 10 }}>
                <img
                  src={it.image_url || "https://via.placeholder.com/800x500?text=Listing"}
                  alt={it.title}
                  style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: 12 }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{it.title}</h3>
                  <div style={{ fontWeight: 700 }}>{formatMoney(it.price_per_night)}/night</div>
                </div>
                <div className="subtle" style={{ margin: 0 }}>
                  {it.city}, {it.country}
                  {it.bedrooms != null && ` · ${it.bedrooms} bd`}
                  {it.bathrooms != null && ` · ${it.bathrooms} ba`}
                  {` · up to ${it.max_guests} guests`}
                </div>
                <p style={{ margin: 0 }}>{it.description}</p>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button className="btn" onClick={() => book(it.id)} disabled={!q.start || !q.end || tooManyGuests}>
                    Book
                  </button>
                  <button
                    onClick={() => toggleFav(it.id)}
                    title={liked ? "Remove from favourites" : "Add to favourites"}
                    style={{ border: "none", background: "transparent", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 0 }}
                  >
                    {liked ? "❤️" : "🤍"}
                  </button>
                  {tooManyGuests && <small style={{ opacity: 0.7 }}>Guests exceed max ({it.max_guests})</small>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* History tab content */}
      {view === "history" && (
        <div className="grid">
          {trips.map((t) => (
            <div className="card" key={t.booking_id} style={{ display: "grid", gap: 10 }}>
              <img
                src={t.image_url || "https://via.placeholder.com/800x500?text=Trip"}
                alt={t.title}
                style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 12 }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{t.title}</h3>
                <div style={{ fontWeight: 700 }}>{formatMoney(t.total_price)}</div>
              </div>
              <div className="subtle" style={{ margin: 0 }}>
                {t.city}, {t.country}
                {t.bedrooms != null && ` · ${t.bedrooms} bd`}
                {t.bathrooms != null && ` · ${t.bathrooms} ba`}
              </div>
              <div style={{ margin: 0 }}>
                Stay: {fmtDate(t.check_in)} → {fmtDate(t.check_out)} · {t.nights} night(s) · Guests: {t.guests}
              </div>
              <p style={{ margin: 0 }}>{t.description}</p>
            </div>
          ))}
          {trips.length === 0 && <div className="card">No past trips found.</div>}
        </div>
      )}

      {!loading && view !== "history" && list.length === 0 && <div className="card">No listings match your filters.</div>}
      {/* ⬇️ AI panel receives the real booking context */}
      <AIAgentPanel booking={bookingForAI} />
    </div>
  );
}
