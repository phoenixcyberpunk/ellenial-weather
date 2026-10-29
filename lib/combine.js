// Combines several forecasts into one reading per hour.
// Plain average to start (weighting by recent skill can come later).
// "How sure" comes from how much the forecasts agree: never a warning, just 1–3 dots.

const { HOUR } = require("./sources/http");

const RAIN_MM = 0.1; // an hour counts as rainy for a forecast at 0.1 mm or more

// Collect every source's values into one map: slot start → { sourceId → values }.
function toSlots(sources) {
  const slots = new Map();
  for (const src of sources) {
    for (const h of src.hours) {
      const t = Math.floor(h.t / HOUR) * HOUR;
      if (!slots.has(t)) slots.set(t, {});
      const slot = slots.get(t);
      slot[src.id] = Object.assign(slot[src.id] || {}, strip(h));
    }
  }
  return slots;
}

function strip(h) {
  const out = {};
  for (const k of ["temp", "mm", "wind", "gust", "cloud"]) if (h[k] !== undefined && h[k] !== null) out[k] = h[k];
  return out;
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round1 = (x) => Math.round(x * 10) / 10;

// Rough sun height in degrees, good enough to tell day from night for the weather word.
function sunElevation(t, lat, lon) {
  const d = new Date(t + HOUR / 2);
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const day = (d - start) / 86400000;
  const decl = 23.44 * Math.sin((2 * Math.PI * (284 + day)) / 365);
  const solarHours = d.getUTCHours() + d.getUTCMinutes() / 60 + lon / 15;
  const hourAngle = 15 * (solarHours - 12);
  const rad = Math.PI / 180;
  const sin = Math.sin(lat * rad) * Math.sin(decl * rad) + Math.cos(lat * rad) * Math.cos(decl * rad) * Math.cos(hourAngle * rad);
  return Math.asin(Math.max(-1, Math.min(1, sin))) / rad;
}

// One word per hour, until hand-made icons exist.
function weatherWord({ temp, mm, rainShare, wind, cloud, day }) {
  if (rainShare >= 0.5 && mm >= RAIN_MM) return temp !== null && temp <= 0.5 ? "SNOW" : "RAIN";
  if (wind !== null && wind >= 10) return "WIND";
  if (cloud === null) return "–";
  if (cloud >= 80) return "CLOUDY";
  if (cloud >= 30) return "MIX";
  return day ? "SUN" : "CLEAR";
}

function howSure(temps, rainVotes) {
  if (temps.length < 2) return 1;
  const spread = Math.max(...temps) - Math.min(...temps);
  const agree = rainVotes.total ? Math.max(rainVotes.yes, rainVotes.total - rainVotes.yes) / rainVotes.total : 1;
  let sure = 1;
  if (spread <= 2 && agree >= 0.8) sure = 3;
  else if (spread <= 4 && agree >= 0.6) sure = 2;
  if (temps.length < 3) sure = Math.min(sure, 2);
  return sure;
}

function combine(sources, lat, lon) {
  const slots = toSlots(sources);
  const hours = [];
  for (const t of [...slots.keys()].sort((a, b) => a - b)) {
    const bySource = slots.get(t);
    const vals = Object.values(bySource);
    const temps = vals.map((x) => x.temp).filter((x) => x !== undefined);
    if (!temps.length) continue;

    const mmBySource = {};
    const tempBySource = {};
    for (const [id, x] of Object.entries(bySource)) {
      if (x.mm !== undefined) mmBySource[id] = round1(x.mm);
      if (x.temp !== undefined) tempBySource[id] = x.temp;
    }
    const mms = Object.values(mmBySource);
    const rainVotes = { yes: mms.filter((x) => x >= RAIN_MM).length, total: mms.length };
    const winds = vals.map((x) => x.wind).filter((x) => x !== undefined);
    const gusts = vals.map((x) => x.gust).filter((x) => x !== undefined);
    const clouds = vals.map((x) => x.cloud).filter((x) => x !== undefined);

    const hour = {
      t,
      temp: round1(mean(temps)),
      tempLow: round1(Math.min(...temps)),
      tempHigh: round1(Math.max(...temps)),
      mm: mms.length ? round1(mean(mms)) : null,
      rainShare: mms.length ? round1(rainVotes.yes / mms.length) : null,
      wind: winds.length ? Math.round(mean(winds)) : null,
      gust: gusts.length ? Math.round(mean(gusts)) : null,
      cloud: clouds.length ? Math.round(mean(clouds)) : null,
      forecasts: temps.length,
      mmBySource,
      tempBySource, // used for the daily How sure; not sent to the page
      day: sunElevation(t, lat, lon) > -0.833
    };
    hour.word = weatherWord(hour);
    hour.sure = howSure(temps, rainVotes);
    hours.push(hour);
  }
  return hours;
}

module.exports = { combine, sunElevation, weatherWord, howSure, RAIN_MM };
