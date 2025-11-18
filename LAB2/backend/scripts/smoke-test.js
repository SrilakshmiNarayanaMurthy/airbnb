// backend/scripts/smoke-test.js
// Simple smoke test using axios. Maintains a simple cookie jar by storing the first Set-Cookie value.
// Runs: owner signup -> create listing -> traveler signup -> create booking -> owner list requests -> traveler my bookings -> toggle favorite

const axios = require('axios');
const BASE = process.env.BASE_URL || 'http://localhost:4000';

async function req(path, options = {}, jar = {}) {
  const method = (options.method || 'GET').toLowerCase();
  const headers = Object.assign({}, options.headers || {});
  if (jar.cookie) headers['Cookie'] = jar.cookie;

  let data = options.body !== undefined ? options.body : undefined;

  try {
    const resp = await axios({ method, url: BASE + path, headers, data, validateStatus: () => true });
    const setCookie = resp.headers['set-cookie'];
    if (setCookie && setCookie.length) {
      jar.cookie = String(setCookie[0]).split(';')[0];
    }
    return { status: resp.status, headers: resp.headers, data: resp.data };
  } catch (e) {
    throw new Error('request failed: ' + (e.message || e));
  }
}

(async () => {
  try {
    console.log('Starting smoke test against', BASE);

    const ownerJar = {};
    const travJar = {};

    console.log('\n1) Owner signup');
    const t = Date.now();
    const ownerEmail = `smoke_owner_${t}@example.com`;
    const ownerSignup = await req('/api/owners/signup', {
      method: 'POST',
      body: { name: 'Smoke Owner', email: ownerEmail, password: 'password123', city: 'TestCity', country: 'TC' }
    }, ownerJar);
    console.log('owner signup:', ownerSignup.status, ownerSignup.data);
    if (ownerSignup.status !== 201) throw new Error('Owner signup failed');

    console.log('\n2) Owner create listing');
    const createListing = await req('/api/owners/listings', {
      method: 'POST',
      body: {
        title: 'Smoke Listing', city: 'TestCity', country: 'TC', price_per_night: 50, max_guests: 2, bedrooms: 1, bathrooms: 1,
        image_url: 'https://example.com/img.jpg', property_type: 'apartment', amenities: 'wifi,parking'
      }
    }, ownerJar);
    console.log('create listing:', createListing.status, createListing.data);
    if (createListing.status !== 201) throw new Error('Create listing failed');
    const listingId = createListing.data?.id;

    console.log('\n3) Traveler signup');
    const travelerEmail = `smoke_traveler_${t}@example.com`;
    const travSignup = await req('/api/auth/signup', {
      method: 'POST',
      body: { name: 'Smoke Traveler', email: travelerEmail, password: 'password123' }
    }, travJar);
    console.log('traveler signup:', travSignup.status, travSignup.data);
    if (travSignup.status !== 201) throw new Error('Traveler signup failed');

    console.log('\n4) Create booking (traveler)');
    // use near-future dates (three/two days ahead) to avoid collisions
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3).toISOString().slice(0,10);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5).toISOString().slice(0,10);

    const createBooking = await req('/api/bookings', {
      method: 'POST',
      body: { listing_id: listingId, start, end, guests: 1 }
    }, travJar);
    console.log('create booking:', createBooking.status, createBooking.data);
    if (![200,201].includes(createBooking.status)) throw new Error('Create booking failed');
    const bookingId = createBooking.data?.id;

    console.log('\n5) Owner list requests (owner)');
    const ownerRequests = await req('/api/owners/requests?status=pending', { method: 'GET' }, ownerJar);
    console.log('owner requests:', ownerRequests.status, ownerRequests.data?.slice?.(0,5) || ownerRequests.data);

    console.log('\n6) Traveler my bookings');
    const travMy = await req('/api/bookings/my', { method: 'GET' }, travJar);
    console.log('traveler bookings:', travMy.status, travMy.data?.slice?.(0,5) || travMy.data);

    console.log('\n7) Toggle favorite (traveler)');
    const fav = await req(`/api/favorites/${listingId}`, { method: 'POST' }, travJar);
    console.log('favorite toggle:', fav.status, fav.data);

    console.log('\nSmoke test completed OK');
  } catch (e) {
    console.error('Smoke test failed:', e.message || e);
    process.exit(2);
  }
})();
