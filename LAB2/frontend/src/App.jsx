// src/App.jsx
import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import Signup from "./Signup";
import Login from "./Login";
import Profile from "./Profile";
import Listings from "./Listings";
import OwnerSignup from "./owner/OwnerSignup";
import OwnerDashboard from "./owner/OwnerDashboard";
import MyTrips from "./MyTrips";

import {
  selectCurrentUser,
  selectAuthToken,
} from "./store";

import {
  authStart,
  setUserFromMe,
  authFailure,
  logout as logoutAction,
} from "./store/authSlice";

export default function App() {
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const token = useSelector(selectAuthToken);

  // simple view switcher
  const [view, setView] = useState("search");

  // check existing session on load
  useEffect(() => {
    async function loadMe() {
      dispatch(authStart());
      try {
        const r = await fetch("http://localhost:4000/api/auth/me", {
          credentials: "include",
        });
        const d = await r.json();
        if (d?.authenticated) {
          dispatch(setUserFromMe({ user: d.user }));
        }
      } catch (err) {
        dispatch(authFailure(err.message));
      }
    }
    loadMe();
  }, [dispatch]);

  // when login/signup completes
  function handleAuthed(u) {
    dispatch(setUserFromMe({ user: u }));
  }

  function handleLogoutClick() {
    fetch("http://localhost:4000/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).finally(() => {
      dispatch(logoutAction());
      setView("search");
    });
  }

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

        {/* Traveler Trips */}
        {user && user.role !== "owner" && (
          <button className="btn btn-outline" onClick={() => setView("history")}>
            Trips
          </button>
        )}

        {user && (
          <button
            className="btn btn-outline"
            style={{ marginLeft: "auto" }}
            onClick={handleLogoutClick}
          >
            Logout
          </button>
        )}
      </div>

      <p className="subtle">
        {user ? (
          <>
            Logged in as <strong>{user.name}</strong> ({user.email}) — role:{" "}
            <b>{user.role || "user"}</b>
            {token && (
              <>
                {" "}
                — <span style={{ fontSize: 12 }}>JWT stored in Redux</span>
              </>
            )}
          </>
        ) : (
          <>You’re not logged in.</>
        )}
      </p>

      {/* Screens */}
      {view === "search" && <Listings />}

      {view === "auth" && (
        <div className="grid">
          <div className="card">
            <h2 className="title">Traveler Signup</h2>
            <Signup />
          </div>

          <div className="card">
            <h2 className="title">Login</h2>
            <Login onAuthed={handleAuthed} />
          </div>

          <div className="card">
            <h2 className="title">Owner Signup</h2>
            <OwnerSignup
              onAuthed={(u) => {
                handleAuthed(u);
                setView("owner");
              }}
            />
          </div>
        </div>
      )}

      {view === "profile" && user && <Profile />}

      {view === "owner" && user?.role === "owner" && (
        <OwnerDashboard user={user} />
      )}

      {view === "history" && user && <MyTrips />}

      {view === "owner" && !user?.role && (
        <div className="card">You need an owner account to view this.</div>
      )}
    </div>
  );
}
