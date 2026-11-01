// Sources for "What usually happens". All CC BY 4.0; the page credits them.
//
// - SMHI daily lows and highs (metobs parameters 19 and 20) from the nearest long-running
//   station, corrected archive (quality-controlled, ends a few months back). Measured, so frost
//   odds rest on real nights. Only where a station within 30 km has 20+ years.
// - Open-Meteo historical archive (ERA5 reanalysis, from 1940; we use 1991 on): rain and
//   sunshine everywhere, and highs/lows where there is no station. One call per place, cached.
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

// Nearest active station that has daily lows for at least MIN_YEARS.
async function longStation(lat, lon) {
  const json = await getJson(`${SMHI}/parameter/19.json`);
  const cutoff = Date.now() - MIN_YEARS * 365.25 * 86400000;
  let best = null;
  for (const s of json.station || []) {
    if (!s.active || s.from > cutoff) continue;
    const d = km(lat, lon, s.latitude, s.longitude);
    if (d <= MAX_KM && (!best || d < best.km)) best = { key: s.key, name: s.name, km: Math.round(d * 10) / 10 };
  }
  return best;
}

// { station, days: [{date, tmin, tmax}] } or null when no long-running station is near.
async function smhiTemps(lat, lon) {
  const st = await longStation(lat, lon);
  if (!st) return null;
  const url = (p) => `${SMHI}/parameter/${p}/station/${st.key}/period/corrected-archive/data.csv`;
  const [lows, highs] = await Promise.all([getText(url(19)), getText(url(20))]).then((t) => t.map(parseSmhiDaily));
  const days = [];
  for (const [date, tmin] of lows) {
    if (date < "1991-01-01") continue;
    days.push({ date, tmin, tmax: highs.has(date) ? highs.get(date) : null });
  }
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

module.exports = { smhiTemps, modelDays, uvDays, parseSmhiDaily };
