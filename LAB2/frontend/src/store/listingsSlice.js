// src/store/listingsSlice.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  items: [],       // property list from /api/listings
  loading: false,
  error: null,
};

const listingsSlice = createSlice({
  name: "listings",
  initialState,
  reducers: {
    listingsFetchStart(state) {
      state.loading = true;
      state.error = null;
    },
    listingsFetchSuccess(state, action) {
      state.loading = false;
      state.items = action.payload || [];
    },
    listingsFetchFailure(state, action) {
      state.loading = false;
      state.error = action.payload || "Failed to load listings";
    },
    clearListings(state) {
      state.items = [];
    },
  },
});

export const {
  listingsFetchStart,
  listingsFetchSuccess,
  listingsFetchFailure,
  clearListings,
} = listingsSlice.actions;

export default listingsSlice.reducer;
