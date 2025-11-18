// src/store/bookingSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  favorites: [],    // [listingId, listingId, ...]
  myBookings: [],   // data from /api/bookings/my
  lastBooking: null,
};

const bookingSlice = createSlice({
  name: "booking",
  initialState,
  reducers: {
    setFavorites(state, action) {
      // expects array of IDs
      state.favorites = action.payload || [];
    },
    toggleFavoriteId(state, action) {
      const id = action.payload;
      if (state.favorites.includes(id)) {
        state.favorites = state.favorites.filter((x) => x !== id);
      } else {
        state.favorites.push(id);
      }
    },
    setMyBookings(state, action) {
      state.myBookings = action.payload || [];
    },
    setLastBooking(state, action) {
      state.lastBooking = action.payload;
    },
  },
});

export const {
  setFavorites,
  toggleFavoriteId,
  setMyBookings,
  setLastBooking,
} = bookingSlice.actions;

export default bookingSlice.reducer;
