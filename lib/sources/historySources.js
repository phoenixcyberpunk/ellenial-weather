// Sources for "What usually happens". All CC BY 4.0; the page credits them.
//
// - SMHI measurements from the nearest long-running station (within 30 km, 20+ years), corrected
//   archive (quality-controlled, ends a few months back): daily lows and highs (19, 20), daily
//   rain (5) and hourly sunshine (10, only ~30 stations in Sweden). Each is used where it exists.
// - Open-Meteo historical archive (ERA5 reanalysis; we use 1991 on): the fallback for each of
//   those where no station is near. ERA5's sunshine runs high (about 1.5× SMHI's measured hours
//   in Gothenburg), so the page says so when it has to use it.
// - Open-Meteo historical forecast archive: daily max UV, only kept since spring 2021, so UV
//   is a rough guide and the page says so.

const { getJson } = require("./http");

const SMHI = "https://opendata-download-metobs.smhi.se/api/version/1.0";
const UA = "EllenialWeather/0.2 (+https://github.com/phoenixcyberpunk/ellenial-weather)";
const MAX_KM = 30;
const MIN_YEARS = 20;
const SLOW = { timeoutMs: 25000 };

function km(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const x = (lon2 - lon1) * r * Math.cos(((lat1 + lat2) / 2) * r);
  const y = (lat2 - lat1) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

const iso = (t) => new Date(t).toISOString().slice(0, 10);

// SMHI's archive CSV: a few header blocks, then rows like
// "2026-07-30 18:00:01;2026-07-31 18:00:00;2026-07-31;16.0;Y" (the third field is the day it belongs to).
const ROW = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d;\d{4}-\d\d-\d\d \d\d:\d\d:\d\d;(\d{4}-\d\d-\d\d);(-?\d+(?:\.\d+)?);([GY])/;
function parseSmhiDaily(text) {
  const out = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = ROW.exec(line);
    if (m) out.set(m[1], Number(m[2]));
  }
  return out;
}

async function getText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SLOW.timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Station lists per parameter, kept per function instance for a day.
const lists = new Map();
async function stationList(param) {
  const hit = lists.get(param);
  if (hit && Date.now() - hit.at < 86400000) return hit.list;
  const json = await getJson(`${SMHI}/parameter/${param}.json`);
  lists.set(param, { at: Date.now(), list: json.station || [] });
  return json.station || [];
}

// Nearest active station within MAX_KM that has measured this parameter for MIN_YEARS or more.
async function longStation(param, lat, lon) {
  const cutoff = Date.now() - MIN_YEARS * 365.25 * 86400000;
  let best = null;
  for (const s of await stationList(param)) {
    if (!s.active || s.from > cutoff) continue;
    const d = km(lat, lon, s.latitude, s.longitude);
    if (d <= MAX_KM && (!best || d < best.km)) best = { key: s.key, name: s.name, km: Math.round(d * 10) / 10 };
  }
  return best;
}

const archive = (param, key) => `${SMHI}/parameter/${param}/station/${key}/period/corrected-archive/data.csv`;
const recent = ([date]) => date >= "1991-01-01";

// Daily lows and highs (19, 20): { station, days: [{date, tmin, tmax}] } or null.
async function smhiTemps(lat, lon) {
  const st = await longStation(19, lat, lon);
  if (!st) return null;
  const [lows, highs] = await Promise.all([getText(archive(19, st.key)), getText(archive(20, st.key))]).then((t) => t.map(parseSmhiDaily));
  const days = [...lows].filter(recent).map(([date, tmin]) => ({ date, tmin, tmax: highs.has(date) ? highs.get(date) : null }));
  days.sort((a, b) => (a.date < b.date ? -1 : 1));
  return days.length ? { station: st, days } : null;
}

// Daily rain, 06–06 (5): { station, days: [{date, mm}] } or null.
async function smhiRain(lat, lon) {
  const st = await longStation(5, lat, lon);
  if (!st) return null;
  const days = [...parseSmhiDaily(await getText(archive(5, st.key)))].filter(recent).map(([date, mm]) => ({ date, mm }));
  days.sort((a, b) => (a.date < b.date ? -1 : 1));
  return days.length ? { station: st, days } : null;
}

// Sunshine (10) is measured per hour, in seconds: "1983-07-28;12:00:00;3600;G". Summed per (UTC) day;
// the few night hours that fall on the other side of midnight have no sun anyway.
const SUN_ROW = /^(\d{4}-\d\d-\d\d);\d\d:\d\d:\d\d;(\d+(?:\.\d+)?);[GY]/;
function parseSmhiSun(text) {
  const out = new Map();
  const count = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = SUN_ROW.exec(line);
    if (!m) continue;
    out.set(m[1], (out.get(m[1]) || 0) + Number(m[2]) / 3600);
    count.set(m[1], (count.get(m[1]) || 0) + 1);
  }
  // A day needs (nearly) all its hours, or its total would be too low.
  for (const [d, n] of count) if (n < 22) out.delete(d);
  return out;
}

async function smhiSun(lat, lon) {
  const st = await longStation(10, lat, lon);
  if (!st) return null;
  const days = [...parseSmhiSun(await getText(archive(10, st.key)))].filter(recent).map(([date, sun]) => ({ date, sun: Math.round(sun * 10) / 10 }));
  days.sort((a, b) => (a.date < b.date ? -1 : 1));
  return days.length ? { station: st, days } : null;
}

// ERA5 daily from 1991 to the end of last year.
async function modelDays(lat, lon) {
  const end = `${new Date().getUTCFullYear() - 1}-12-31`;
  const url = "https://archive-api.open-meteo.com/v1/archive" +
    `?latitude=${lat}&longitude=${lon}&start_date=1991-01-01&end_date=${end}` +
    "&daily=temperature_2m_min,temperature_2m_max,precipitation_sum,sunshine_duration&timezone=auto";
  const j = await getJson(url, SLOW);
  const d = j.daily || {};
  const days = (d.time || []).map((date, i) => ({
    date,
    tmin: d.temperature_2m_min[i],
    tmax: d.temperature_2m_max[i],
    mm: d.precipitation_sum[i],
    sun: d.sunshine_duration[i] === null ? null : d.sunshine_duration[i] / 3600
  }));
  return { timezone: j.timezone || null, days };
}

// Daily max UV from the forecast archive (spring 2021 to yesterday).
async function uvDays(lat, lon) {
  const end = iso(Date.now() - 86400000);
  const url = "https://historical-forecast-api.open-meteo.com/v1/forecast" +
    `?latitude=${lat}&longitude=${lon}&start_date=2021-01-01&end_date=${end}&daily=uv_index_max&timezone=auto`;
  const j = await getJson(url, SLOW);
  const d = j.daily || {};
  return (d.time || []).map((date, i) => ({ date, uv: d.uv_index_max[i] })).filter((x) => x.uv !== null);
}

module.exports = { smhiTemps, smhiRain, smhiSun, modelDays, uvDays, parseSmhiDaily, parseSmhiSun };
