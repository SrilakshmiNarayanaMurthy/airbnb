import React, { useState } from "react";

const API = import.meta.env.VITE_AI_AGENT_URL || "http://127.0.0.1:8001";

export default function AIAgentPanel({ booking }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!booking?.location || !booking?.start_date || !booking?.end_date) {
      alert("Please fill Location, Start date and End date above first.");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`${API}/ai/concierge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking: {
            start_date: booking.start_date,
            end_date: booking.end_date,
            location: booking.location,
            party_type: booking.party_type || "trip",
          },
          preferences: {
            budget: "moderate",
            interests: ["museums", "parks"],        // you can wire real prefs later
            mobility_needs: null,
            dietary_filters: [],
          },
          nlu_query: query || null,
        }),
      });

      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setResult({ error: String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: "40px", padding: "20px" }}>
      <h2>🧭 AI Concierge Planner</h2>
      <small>
        Using: <b>{booking?.location || "-"}</b> • {booking?.start_date} → {booking?.end_date} • {booking?.party_type}
      </small>

      <div style={{ display: "flex", gap: "10px", marginTop: 8 }}>
        <input
          type="text"
          placeholder="Ask the AI (e.g., budget trip, stroller friendly)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, padding: "8px" }}
        />
        <button onClick={handleGenerate} disabled={loading}>
          {loading ? "Loading..." : "Generate Plan"}
        </button>
      </div>

      {/* --- RESULTS --- */}
      {result && (
        <div style={{ marginTop: "25px" }}>
          {result.plan && (
            <>
              <h3>📅 Itinerary</h3>
              {result.plan.map((day, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "#f7f9fc",
                    padding: "12px",
                    marginBottom: "10px",
                    borderRadius: "10px",
                    boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
                  }}
                >
                  <h4>
                    Day {day.day} — {day.date}
                  </h4>
                  <p>🌅 <b>Morning:</b> {day.morning}</p>
                  <p>🌇 <b>Afternoon:</b> {day.afternoon}</p>
                  <p>🌙 <b>Evening:</b> {day.evening}</p>
                </div>
              ))}
            </>
          )}

          {result.activities && (
            <>
              <h3>🎟️ Activities</h3>
              <div>
                {result.activities.map((a, i) => (
                  <div
                    key={i}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: "8px",
                      marginBottom: "8px",
                      padding: "10px",
                    }}
                  >
                    <b>{a.title}</b>
                    <p>{a.address}</p>
                    <p>💲 {a.price_tier} | ⏱ {a.duration_min} mins</p>
                    <p>
                      Tags: {a.tags?.join(", ") || "-"} | Wheelchair:{" "}
                      {a.wheelchair_friendly ? "✅" : "❌"} | Child Friendly:{" "}
                      {a.child_friendly ? "✅" : "❌"}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
