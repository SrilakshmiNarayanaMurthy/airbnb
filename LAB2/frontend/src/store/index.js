// src/store/index.js
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import listingsReducer from "./listingsSlice";
import bookingReducer from "./bookingSlice";

const store = configureStore({
  reducer: {
    auth: authReducer,
    listings: listingsReducer,
    booking: bookingReducer,
  },
});

export default store;

// --- Selectors ---
export const selectCurrentUser = (state) => state.auth.user;
export const selectAuthToken = (state) => state.auth.token;

export const selectListings = (state) => state.listings.items;
export const selectListingsLoading = (state) => state.listings.loading;

export const selectFavorites = (state) => state.booking.favorites;
export const selectMyBookings = (state) => state.booking.myBookings;
