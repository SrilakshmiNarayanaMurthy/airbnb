// src/MyTrips.jsx
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { api } from "./api";
import { setMyBookings } from "./store/bookingSlice";
import { selectMyBookings } from "./store";

function fmt(d) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}-${m}-${y}`;
}

function StatusPill({ status }) {
  const styles =
    {
      accepted: { bg: "#DCFCE7", fg: "#166534" },
      pending: { bg: "#FEF9C3", fg: "#854D0E" },
      cancelled: { bg: "#E5E7EB", fg: "#374151" },
    }[status] || { bg: "#E5E7EB", fg: "#374151" };

  return (
    <span
      style={{
        background: styles.bg,
        color: styles.fg,
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 999,
        fontWeight: 600,
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  );
}

function Section({ title, rows }) {
  return (
    <div className="card" style={{ display: "grid", gap: 12 }}>
      <h3 className="title" style={{ marginBottom: 0 }}>
        {title}
      </h3>
      {rows.length === 0 ? (
        <div className="subtle">None</div>
      ) : (
        <div className="grid">
          {rows.map((r) => (
            <div
              className="card"
              key={r.booking_id}
              style={{ display: "grid", gap: 10 }}
            >
              <img
                src={
                  r.image_url ||
                  "https://via.placeholder.com/800x500?text=Listing"
                }
                alt={r.title}
                style={{
                  width: "100%",
                  height: 140,
                  objectFit: "cover",
                  borderRadius: 12,
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <div style={{ fontWeight: 700 }}>{r.title}</div>
                <StatusPill status={r.status} />
              </div>
              <div className="subtle">
                {r.city}, {r.country}
              </div>
              <div className="subtle">
                {fmt(r.check_in)} → {fmt(r.check_out)} · {r.nights} night(s) · $
                {Number(r.total_price || 0).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MyTrips() {
  const dispatch = useDispatch();
  const items = useSelector(selectMyBookings);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api("/api/bookings/my");
      dispatch(setMyBookings(data || []));
    } catch (e) {
      alert(e.message);
      dispatch(setMyBookings([]));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const pending = items.filter((r) => r.status === "pending");
  const upcoming = items.filter(
    (r) => r.status === "accepted" && r.check_in >= today
  );
  const cancelled = items.filter((r) => r.status === "cancelled");
  const past = items.filter((r) => r.check_out < today);

  return (
    <div className="container" style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <h2 className="title" style={{ margin: 0, flex: 1 }}>
          My Trips
        </h2>
        <button className="btn btn-outline" onClick={load}>
          Refresh
        </button>
      </div>

      {loading && <div className="card">Loading…</div>}
      {!loading && (
        <>
          <Section title="Pending" rows={pending} />
          <Section title="Upcoming" rows={upcoming} />
          <Section title="Cancelled" rows={cancelled} />
          <Section title="Past trips" rows={past} />
        </>
      )}
    </div>
  );
}
