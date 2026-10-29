// SMHI Open Data, measured weather (metobs). CC BY 4.0: credit SMHI, say the data is processed.
// Used for "what actually happened" on past days. Hourly values from the nearest active
// station within reach; outside Sweden there is none, and past days fall back to model data.
//   1 = air temperature (instant, hourly)   4 = wind speed (10-min mean, hourly)
//   7 = precipitation (sum of the hour ENDING at the time)

const { HOUR, getJson } = require("./http");

const BASE = "https://opendata-download-metobs.smhi.se/api/version/1.0";
const MAX_KM = 30;
const FRESH_MS = 6 * HOUR; // a station must have reported within the last 6 hours
const PARAMS = { temp: 1, wind: 4, mm: 7 };

// Station lists are large and change rarely: keep them per function instance for a day.
const stationCache = new Map();

function km(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const x = (lon2 - lon1) * r * Math.cos(((lat1 + lat2) / 2) * r);
  const y = (lat2 - lat1) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

async function stations(param) {
  const hit = stationCache.get(param);
  if (hit && Date.now() - hit.at < 24 * HOUR) return hit.list;
  const json = await getJson(`${BASE}/parameter/${param}.json`);
  const list = (json.station || []).filter((s) => s.active).map((s) => ({
    key: s.key, name: s.name, lat: s.latitude, lon: s.longitude, to: s.to
  }));
  stationCache.set(param, { at: Date.now(), list });
  return list;
}

async function nearest(param, lat, lon) {
  const now = Date.now();
  let best = null;
  for (const s of await stations(param)) {
    if (now - s.to > FRESH_MS) continue;
    const d = km(lat, lon, s.lat, s.lon);
    if (d <= MAX_KM && (!best || d < best.km)) best = Object.assign({}, s, { km: d });
  }
  return best;
}

// Returns { station: {name, km}, hours: [{t, temp?, wind?, mm?}] } or null when no station is near.
async function smhiObserved(lat, lon) {
  const found = {};
  await Promise.all(Object.entries(PARAMS).map(async ([field, param]) => {
    const st = await nearest(param, lat, lon);
    if (!st) return;
    const json = await getJson(`${BASE}/parameter/${param}/station/${st.key}/period/latest-months/data.json`);
    found[field] = { station: st, values: json.value || [] };
  }));
  if (!found.temp) return null;

  const slots = new Map();
  const put = (t, field, v) => {
    if (!slots.has(t)) slots.set(t, { t });
    slots.get(t)[field] = v;
  };
  const since = Date.now() - 10 * 24 * HOUR;
  for (const [field, { values }] of Object.entries(found)) {
    for (const v of values) {
      if (v.date < since || v.value === null || v.value === "" || v.quality === "R") continue;
      const n = Number(v.value);
      if (!Number.isFinite(n)) continue;
      // Rain is summed over the hour that ends at `date`: file it under the hour it fell in.
      put(field === "mm" ? v.date - HOUR : v.date, field, n);
    }
  }
  return {
    station: { name: found.temp.station.name, km: Math.round(found.temp.station.km * 10) / 10 },
    hours: [...slots.values()].sort((a, b) => a.t - b.t)
  };
}

module.exports = smhiObserved;
