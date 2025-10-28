import { useState, useEffect } from "react"; //Imports all page components
import Signup from "./Signup";
import Login from "./Login";
import Profile from "./Profile";
import Listings from "./Listings";
import OwnerSignup from "./owner/OwnerSignup";
import OwnerDashboard from "./owner/OwnerDashboard";
import MyTrips from "./MyTrips";

export default function App() {
  // who is logged in (or null)
  const [user, setUser] = useState(null);

  // simple view switcher: "search" | "auth" | "profile" | "owner" | "history"
  const [view, setView] = useState("search");

  // on first load, check if there is an existing session
  useEffect(() => {
    fetch("http://localhost:4000/api/auth/me", { credentials: "include" }) //asks backend, if valid user, it sets true
      .then((r) => r.json())
      .then((d) => {
        if (d?.authenticated) setUser(d.user);
      })
      .catch(() => {});
  }, []);
//Displays the app title at the top.
//buttons on page
  return (
    <div className="container">
      <div className="header">
        <h1 className="h1">Airbnb Prototype</h1>  
      </div>

      <div className="actions" style={{ marginBottom: 10 }}>
        <button className="btn btn-outline" onClick={() => setView("search")}>   
          Search
        </button>
        <button className="btn btn-outline" onClick={() => setView("auth")}>
          Auth
        </button>
        {user && (
          <button className="btn btn-outline" onClick={() => setView("profile")}>
            Profile
          </button>
        )}
        {user?.role === "owner" && (
          <button className="btn btn-outline" onClick={() => setView("owner")}>
            Owner
          </button>
        )}
        {/* NEW: Trips button to open traveler bookings */}
        {user && user.role !== "owner" && (
          <button className="btn btn-outline" onClick={() => setView("history")}>
            Trips
          </button>
        )}
      </div>
      {/*only logged in can access*/}
      <p className="subtle">  
        {user ? (
          <>
            Logged in as <strong>{user.name}</strong> ({user.email}) — role:{" "}
            <b>{user.role || "user"}</b>
          </>
        ) : (
          <>You’re not logged in.</>
        )}
      </p>
      
      {/* Traveler search Shows all available listings with search filters*/}
      {view === "search" && <Listings />}

      {/* Auth area: Traveler Signup, Login, Owner Signup */}
      {view === "auth" && (
        <div className="grid">
          <div className="card">
            <h2 className="title">Traveler Signup</h2>
            <Signup />
          </div>

          <div className="card">
            <h2 className="title">Login</h2>
            {/* When login succeeds, Login will call onAuthed(user) */}
            <Login onAuthed={(u) => setUser(u)} />
          </div>

          <div className="card">
            <h2 className="title">Owner Signup</h2>
            {/* After owner signup, set user and jump to Owner view */}
            <OwnerSignup
              onAuthed={(u) => {
                setUser(u);
                setView("owner");
              }}
            />
          </div>
        </div>
      )}
       
      {/* Traveler profile renders particular pages based on roles*/}
      {view === "profile" && user && <Profile />}

      {/* Owner dashboard (owner-only) */}
      {view === "owner" && user?.role === "owner" && <OwnerDashboard user={user} />}

      {/* Traveler bookings (pending/accepted/cancelled/past) */}
      {view === "history" && user && <MyTrips />}

      {/* If someone tries Owner view without role=owner */}
      {view === "owner" && !user?.role && (
        <div className="card">You need an owner account to view this.</div>
      )}
      
    </div>
  );
}
