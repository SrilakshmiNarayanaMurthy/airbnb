// src/store/authSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  user: null,      // traveler / owner object
  token: null,     // JWT token from backend (if you return one)
  status: "idle",  // "idle" | "loading" | "succeeded" | "failed"
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    authStart(state) {
      state.status = "loading";
      state.error = null;
    },
    loginSuccess(state, action) {
      state.status = "succeeded";
      state.user = action.payload.user;
      state.token = action.payload.token || null; // if backend sends `token`
    },
    signupSuccess(state, action) {
      state.status = "succeeded";
      state.user = action.payload.user || null;
      state.token = action.payload.token || null;
    },
    setUserFromMe(state, action) {
      // when /api/auth/me says authenticated
      state.user = action.payload.user;
      state.status = "succeeded";
    },
    authFailure(state, action) {
      state.status = "failed";
      state.error = action.payload || "Authentication failed";
    },
    logout(state) {
      state.user = null;
      state.token = null;
      state.status = "idle";
      state.error = null;
    },
  },
});

export const {
  authStart,
  loginSuccess,
  signupSuccess,
  setUserFromMe,
  authFailure,
  logout,
} = authSlice.actions;

export default authSlice.reducer;
