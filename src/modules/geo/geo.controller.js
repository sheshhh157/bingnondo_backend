'use strict';

/**
 * geo.controller.js  —  Reverse geocoding + place search (OSM / Nominatim)
 * ─────────────────────────────────────────────────────────────────────────────
 *   GET /api/geo/reverse?lat=&lng=   → { address, display_name, latitude, longitude, components }
 *   GET /api/geo/search?q=&lat=&lng=&viewbox=&bounded=
 *                                    → { results: [ { display_name, address, latitude, longitude } ] }
 *
 * Provider: OpenStreetMap Nominatim (free, no API key).
 *
 * Nominatim's usage policy requires:
 *   - a descriptive User-Agent (set via GEO_USER_AGENT, see .env.example)
 *   - at most ~1 request per second
 *   - caching of results
 * This module enforces all three so the app never violates the policy.
 */

const NOMINATIM_BASE = process.env.GEO_NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
const USER_AGENT =
  process.env.GEO_USER_AGENT ||
  `BingnondoApp/1.0 (${process.env.SMTP_USER || 'noreply@bingnondo.app'})`;

const REQUEST_TIMEOUT_MS = 8000;
const MIN_INTERVAL_MS     = 1100; // ≤ 1 request/second
const CACHE_TTL_MS        = 10 * 60 * 1000;
const CACHE_MAX           = 500;

// ─── Tiny in-memory LRU-ish cache ─────────────────────────────────────────────
const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.exp) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX) {
    // drop the oldest entry
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, { value, exp: Date.now() + CACHE_TTL_MS });
}

// ─── Outbound throttle (1 req/sec across the process) ─────────────────────────
let lastRequestAt = 0;

async function throttle() {
  const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastRequestAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

async function nominatim(path, params) {
  await throttle();

  const url = new URL(NOMINATIM_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':      USER_AGENT,
        'Accept':          'application/json',
        'Accept-Language': 'en',
      },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ─── Address formatter ────────────────────────────────────────────────────────
// Builds a clean, PH-friendly "house street, barangay, city, province, zip"
// line from Nominatim's structured `address` object.
function composeAddress(a, fallback) {
  if (!a) return fallback || '';

  const road =
    a.road || a.pedestrian || a.footway || a.path || a.residential || a.street;

  const parts = [];
  const line1 = [a.house_number, road].filter(Boolean).join(' ').trim();
  if (line1) parts.push(line1);

  const barangay =
    a.barangay || a.suburb || a.quarter || a.neighbourhood || a.village || a.hamlet;
  if (barangay) parts.push(barangay);

  const city = a.city || a.town || a.municipality || a.city_district;
  if (city) parts.push(city);

  const province = a.state || a.province || a.region;
  if (province) parts.push(province);

  if (a.postcode) parts.push(a.postcode);
  if (a.country)  parts.push(a.country);

  const composed = parts.join(', ').trim();
  return composed || fallback || '';
}

function isValidLat(v) { return Number.isFinite(v) && v >= -90  && v <= 90; }
function isValidLng(v) { return Number.isFinite(v) && v >= -180 && v <= 180; }

/**
 * Parse a caller-supplied search box, formatted "west,north,east,south".
 * Returns the normalized string, or null when absent/invalid.
 *
 * The mobile app pins deliveries to a single municipality and sends that box
 * so Nominatim only returns places inside it.
 */
function parseSearchViewbox(raw) {
  if (!raw) return null;
  const parts = raw.toString().split(',').map((s) => parseFloat(s));
  if (parts.length !== 4 || !parts.every(Number.isFinite)) return null;

  const [west, north, east, south] = parts;
  if (!isValidLng(west) || !isValidLng(east)) return null;
  if (!isValidLat(south) || !isValidLat(north)) return null;
  if (west >= east || south >= north) return null;

  return [west, north, east, south].join(',');
}

// ─── GET /api/geo/reverse ─────────────────────────────────────────────────────
async function reverseGeocode(req, res, next) {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng ?? req.query.lon);

    if (!isValidLat(lat) || !isValidLng(lng)) {
      return res.status(422).json({ message: 'Invalid coordinates.' });
    }

    const key = `rev:${lat.toFixed(5)},${lng.toFixed(5)}`;
    let data = cacheGet(key);

    if (!data) {
      data = await nominatim('/reverse', {
        format:         'jsonv2',
        lat,
        lon:            lng,
        addressdetails: 1,
        zoom:           18,
        'accept-language': 'en',
      });
      cacheSet(key, data);
    }

    const address = composeAddress(data.address, data.display_name);

    return res.json({
      address,
      display_name: data.display_name || address,
      latitude:     lat,
      longitude:    lng,
      components:   data.address || {},
    });
  } catch (err) {
    if (err && (err.name === 'AbortError' || /Nominatim|fetch failed/i.test(err.message || ''))) {
      return res.status(502).json({
        message: 'Could not fetch the address right now. Please try again.',
        code:    'geocode_failed',
      });
    }
    next(err);
  }
}

// ─── GET /api/geo/search ──────────────────────────────────────────────────────
async function searchPlaces(req, res, next) {
  try {
    const q = (req.query.q || '').toString().trim();
    if (q.length < 3) {
      return res.status(422).json({ message: 'Please type at least 3 characters.' });
    }

    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng ?? req.query.lon);

    const params = {
      format:         'jsonv2',
      q,
      addressdetails: 1,
      limit:          6,
      countrycodes:   'ph',
      'accept-language': 'en',
    };

    // Optional caller-supplied search box: "west,north,east,south". The app
    // sends the delivery area so results stay local; invalid/absent values fall
    // back to the point bias below.
    const box = parseSearchViewbox(req.query.viewbox);

    if (box) {
      params.viewbox = box;
      // A request that passes an explicit box wants results *inside* it.
      params.bounded = req.query.bounded === '0' ? 0 : 1;
    } else if (isValidLat(lat) && isValidLng(lng)) {
      // Bias results around the given point (delivery is local), unbounded.
      params.viewbox = [
        (lng - 0.25).toFixed(5),
        (lat + 0.25).toFixed(5),
        (lng + 0.25).toFixed(5),
        (lat - 0.25).toFixed(5),
      ].join(',');
      params.bounded = 0;
    }

    const key = `search:${q.toLowerCase()}|${params.viewbox || ''}|${params.bounded ?? 0}`;
    let data = cacheGet(key);
    if (!data) {
      data = await nominatim('/search', params);
      cacheSet(key, data);
    }

    const results = (Array.isArray(data) ? data : []).map((r) => ({
      display_name: r.display_name || '',
      address:      composeAddress(r.address, r.display_name),
      latitude:     parseFloat(r.lat),
      longitude:    parseFloat(r.lon),
    }));

    return res.json({ results });
  } catch (err) {
    if (err && (err.name === 'AbortError' || /Nominatim|fetch failed/i.test(err.message || ''))) {
      return res.status(502).json({
        message: 'Could not search right now. Please try again.',
        code:    'geocode_failed',
      });
    }
    next(err);
  }
}

module.exports = { reverseGeocode, searchPlaces, composeAddress };
