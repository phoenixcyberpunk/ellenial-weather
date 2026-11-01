// What usually happens: odds from past weather, never predictions.
// Pure functions over daily records, so they can be tested without the network.
//   days: [{ date: "YYYY-MM-DD", tmin, tmax, mm, sun }]  (°C, mm, hours of sunshine; null = missing)
//   uv:   [{ date: "YYYY-MM-DD", uv }]                    (daily max UV index)
//
// Choices (see README):
// - Odds lean on recent years: the last 20 complete years, because older decades no longer
//   match today's climate. "How it's changing" compares the 1990s with the last 10 years.
// - Frost = a night below 0 °C at 2 m. Ground frost often comes earlier; the page says so.
// - A frost season runs 1 July to 30 June, so a first frost in January still counts.
// - "In 7 of 10 years" style numbers are percentiles over the years we have, rounded honestly:
//   with no frost at all in some seasons, those count as "not by then".

const ODDS_YEARS = 20;
const NOW_YEARS = 10;
const THEN = [1991, 2000];
const FROST = 0;        // below this at night = frost
const SUNNY_HOURS = 6;  // a sunny day has at least this much sunshine
const WET_MM = 1;       // a rainy day has at least this much rain
const UV_SUN_CARE = 3;  // UV 3+ = sun protection advised (WHO)

const year = (iso) => +iso.slice(0, 4);
const month = (iso) => +iso.slice(5, 7);
const ok = (v) => v !== null && v !== undefined && Number.isFinite(v);
const round = (v, d = 0) => (ok(v) ? Math.round(v * 10 ** d) / 10 ** d : null);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);

function median(a) {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Day-of-year slot in a leap year (0 = 1 Jan, 59 = 29 Feb, 365 = 31 Dec), so every date has a home.
const LEAP_STARTS = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
const slot = (iso) => LEAP_STARTS[month(iso) - 1] + +iso.slice(8, 10) - 1;
function slotToMonthDay(s) {
  let m = 11;
  while (LEAP_STARTS[m] > s) m--;
  return { month: m + 1, day: s - LEAP_STARTS[m] + 1 };
}

// Complete calendar years present (at least 330 days with a low), newest last.
function completeYears(days, field = "tmin") {
  const count = new Map();
  for (const d of days) if (ok(d[field])) count.set(year(d.date), (count.get(year(d.date)) || 0) + 1);
  return [...count].filter(([, n]) => n >= 330).map(([y]) => y).sort((a, b) => a - b);
}

// ---- Usually: one entry per day of the year, smoothed over a week -------------------------
// For each date: typical high and low (medians), the chance of a rainy day, and average sunshine,
// over the odds years, using the 7 days centred on that date (so one odd year can't dominate).
function climatology(days, years) {
  const keep = new Set(years);
  const bySlot = Array.from({ length: 366 }, () => []);
  for (const d of days) if (keep.has(year(d.date))) bySlot[slot(d.date)].push(d);
  const out = [];
  for (let s = 0; s < 366; s++) {
    const pool = [];
    for (let k = -3; k <= 3; k++) pool.push(...bySlot[(s + k + 366) % 366]);
    const hi = pool.map((d) => d.tmax).filter(ok), lo = pool.map((d) => d.tmin).filter(ok);
    const mm = pool.map((d) => d.mm).filter(ok), sun = pool.map((d) => d.sun).filter(ok);
    out.push([
      round(median(hi), 1),
      round(median(lo), 1),
      mm.length ? round(mm.filter((v) => v >= WET_MM).length / mm.length, 2) : null,
      sun.length ? round(mean(sun), 1) : null
    ]);
  }
  return out; // [hi, lo, rainChance 0–1, sunHours] per slot
}

// ---- Frost -------------------------------------------------------------------------------
// Season y = 1 July y to 30 June y+1. Index = days since 1 July.
function frostSeasons(days) {
  const seasons = new Map();
  for (const d of days) {
    if (!ok(d.tmin)) continue;
    const y = year(d.date), m = month(d.date);
    const season = m >= 7 ? y : y - 1;
    const s = seasons.get(season) || { season, n: 0, first: null, last: null, nights: 0 };
    s.n++;
    if (d.tmin < FROST) {
      const idx = seasonDay(d.date);
      if (s.first === null || idx < s.first) s.first = idx;
      if (s.last === null || idx > s.last) s.last = idx;
      s.nights++;
    }
    seasons.set(season, s);
  }
  return [...seasons.values()].filter((s) => s.n >= 330).sort((a, b) => a.season - b.season);
}

// The date by which something had happened in at least `share` of the seasons.
// Seasons where it never happened count as "later than any date" (Infinity).
function byShare(values, share) {
  if (!values.length) return null;
  const s = values.slice().sort((a, b) => a - b);
  const v = s[Math.ceil(share * s.length) - 1];
  return Number.isFinite(v) ? v : null;
}

// Days since 1 July on the leap-year calendar (29 Feb has its own slot every year), so the same
// date always gets the same number and leap years don't shift spring dates by a day.
const JULY1 = 182;
const seasonDay = (iso) => (slot(iso) - JULY1 + 366) % 366;
const seasonIndexToDate = (idx) => slotToMonthDay((idx + JULY1) % 366);

function frost(days, seasonsWanted) {
  const all = frostSeasons(days);
  const seasons = all.slice(-seasonsWanted);
  if (seasons.length < 10) return null;
  const firsts = seasons.map((s) => (s.first === null ? Infinity : s.first));
  const lasts = seasons.map((s) => (s.last === null ? -Infinity : s.last));
  const none = seasons.filter((s) => s.first === null).length;
  const pick = (v) => (v === null ? null : seasonIndexToDate(v));
  // Last spring frost: "after this date only 1 year in 10" = the 90th percentile of last frosts.
  const sortedLast = lasts.slice().sort((a, b) => a - b);
  const lastBy = (share) => {
    const v = sortedLast[Math.ceil(share * sortedLast.length) - 1];
    return Number.isFinite(v) ? seasonIndexToDate(v) : null;
  };
  return {
    seasons: seasons.length,
    from: seasons[0].season,
    to: seasons[seasons.length - 1].season + 1,
    noFrostSeasons: none,
    firstAutumn: {
      // "Frost had come by <date> in 3 / 5 / 7 / 9 of 10 years"
      early: pick(byShare(firsts, 0.3)),
      typical: pick(byShare(firsts, 0.5)),
      late: pick(byShare(firsts, 0.7))
    },
    lastSpring: {
      typical: lastBy(0.5),
      safe: lastBy(0.9) // after this, frost came in only 1 year in 10
    },
    nightsPerYear: round(mean(seasons.map((s) => s.nights)), 0)
  };
}

// ---- Sun ---------------------------------------------------------------------------------
function sunnyDays(days, years) {
  const keep = new Set(years);
  const months = Array.from({ length: 12 }, () => ({ sunny: 0, hours: 0, n: 0 }));
  for (const d of days) {
    if (!keep.has(year(d.date)) || !ok(d.sun)) continue;
    const m = months[month(d.date) - 1];
    m.n++; m.hours += d.sun;
    if (d.sun >= SUNNY_HOURS) m.sunny++;
  }
  const yearsCounted = years.length || 1;
  return months.map((m, i) => ({
    month: i + 1,
    sunnyDays: m.n ? round(m.sunny / yearsCounted, 0) : null, // average count per month
    hoursPerDay: m.n ? round(m.hours / m.n, 1) : null
  }));
}

// ---- UV ----------------------------------------------------------------------------------
// UV records are short (forecast archives from 2021), so this is a rough guide and says so.
function uvByMonth(uv) {
  const vals = uv.filter((d) => ok(d.uv));
  if (vals.length < 365) return null;
  const months = Array.from({ length: 12 }, () => []);
  for (const d of vals) months[month(d.date) - 1].push(d.uv);
  const per = months.map((a, i) => ({
    month: i + 1,
    typical: a.length ? round(median(a), 0) : null,
    // share of days at UV 3+, as "x in 10 days"
    careDays: a.length ? round((a.filter((v) => v >= UV_SUN_CARE).length / a.length) * 10, 0) : null
  }));
  const over = per.filter((m) => m.typical !== null && m.typical >= UV_SUN_CARE).map((m) => m.month);
  const years = [...new Set(vals.map((d) => year(d.date)))];
  return {
    from: vals[0].date,
    to: vals[vals.length - 1].date,
    years: years.length,
    months: per,
    // Months where a typical day reaches UV 3 or more
    careFrom: over.length ? over[0] : null,
    careTo: over.length ? over[over.length - 1] : null
  };
}

// ---- How it's changing ---------------------------------------------------------------------
function decade(days, from, to) {
  const inRange = days.filter((d) => year(d.date) >= from && year(d.date) <= to);
  const years = completeYears(inRange, "tmin").filter((y) => y >= from && y <= to);
  if (years.length < Math.min(8, to - from + 1)) return null;
  const keep = new Set(years);
  const ds = inRange.filter((d) => keep.has(year(d.date)));
  const temps = ds.filter((d) => ok(d.tmin) && ok(d.tmax)).map((d) => (d.tmin + d.tmax) / 2);
  const frostNights = ds.filter((d) => ok(d.tmin) && d.tmin < FROST).length / years.length;
  const sunDays = ds.filter((d) => ok(d.sun) && d.sun >= SUNNY_HOURS).length / years.length;
  const wetDays = ds.filter((d) => ok(d.mm) && d.mm >= WET_MM).length / years.length;
  const summerDays = ds.filter((d) => ok(d.tmax) && d.tmax >= 25).length / years.length;
  return {
    from: years[0], to: years[years.length - 1], years: years.length,
    meanTemp: round(mean(temps), 1),
    frostNights: round(frostNights, 0),
    sunnyDays: round(sunDays, 0),
    rainyDays: round(wetDays, 0),
    summerDays: round(summerDays, 0)
  };
}

function firstFrostTypical(days, fromSeason, toSeason) {
  const s = frostSeasons(days).filter((x) => x.season >= fromSeason && x.season <= toSeason);
  if (s.length < 8) return null;
  return byShare(s.map((x) => (x.first === null ? Infinity : x.first)), 0.5);
}

function changing(temps, other) {
  // temps: days with tmin/tmax (station or model); other: days with sun/mm (model)
  const tYears = completeYears(temps, "tmin");
  if (!tYears.length) return null;
  const nowTo = tYears[tYears.length - 1];
  const then = decade(temps, THEN[0], THEN[1]);
  const now = decade(temps, nowTo - NOW_YEARS + 1, nowTo);
  if (!then || !now) return null;
  const thenO = decade(other, THEN[0], THEN[1]);
  const nowO = decade(other, nowTo - NOW_YEARS + 1, nowTo);
  if (thenO && nowO) {
    then.sunnyDays = thenO.sunnyDays; now.sunnyDays = nowO.sunnyDays;
    then.rainyDays = thenO.rainyDays; now.rainyDays = nowO.rainyDays;
  }
  const a = firstFrostTypical(temps, THEN[0], THEN[1] - 1);
  const b = firstFrostTypical(temps, nowTo - NOW_YEARS, nowTo - 1);
  return {
    then, now,
    warmer: round(now.meanTemp - then.meanTemp, 1),
    firstFrostLaterDays: a !== null && b !== null ? b - a : null
  };
}

// ---- Everything at once -------------------------------------------------------------------
// temps: daily lows/highs (an SMHI station where there is one, else the model).
// model: the model's daily records (rain, sunshine, and highs/lows as a fallback).
function summarise({ temps, model, uv }) {
  const tYears = completeYears(temps, "tmin");
  const oddsT = tYears.slice(-ODDS_YEARS);
  const mYears = completeYears(model, "tmin");
  const oddsM = mYears.slice(-ODDS_YEARS);

  // Highs and lows from `temps`, rain and sun from the model, merged per date.
  const byDate = new Map(model.map((d) => [d.date, { date: d.date, mm: d.mm, sun: d.sun, tmin: d.tmin, tmax: d.tmax }]));
  if (temps !== model) {
    for (const d of temps) {
      const m = byDate.get(d.date) || { date: d.date, mm: null, sun: null };
      m.tmin = d.tmin; m.tmax = d.tmax;
      byDate.set(d.date, m);
    }
  }
  const merged = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    years: { from: oddsT[0] || null, to: oddsT[oddsT.length - 1] || null, count: oddsT.length },
    days: climatology(merged, oddsT.length ? oddsT : oddsM),
    frost: frost(temps, ODDS_YEARS),
    sun: { from: oddsM[0] || null, to: oddsM[oddsM.length - 1] || null, months: sunnyDays(model, oddsM) },
    uv: uv ? uvByMonth(uv) : null,
    changing: changing(temps, model)
  };
}

module.exports = {
  summarise, climatology, frost, frostSeasons, sunnyDays, uvByMonth, changing, completeYears,
  slot, slotToMonthDay, median, byShare
};
