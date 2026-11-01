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
    med: a.length ? median(a) : null,
    typical: a.length ? round(median(a), 0) : null,
    // share of days at UV 3+, as "x in 10 days"
    careDays: a.length ? round((a.filter((v) => v >= UV_SUN_CARE).length / a.length) * 10, 0) : null
  }));
  // Judged on the unrounded median, so a month that only rounds up to 3 doesn't count.
  const over = per.filter((m) => m.med !== null && m.med >= UV_SUN_CARE).map((m) => m.month);
  per.forEach((m) => { m.care = m.med !== null && m.med >= UV_SUN_CARE; delete m.med; });
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
  // 7 of 10 years is still a fair decade (Göteborg A has gaps in the late 1990s); fewer is too thin.
  if (years.length < Math.min(7, to - from + 1)) return null;
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

// temps: days with tmin/tmax; rain: days with mm. Returns null if either decade is too thin
// (the caller then tries the model, which has no gaps or station moves).
function changing(temps, rain) {
  const tYears = completeYears(temps, "tmin");
  if (!tYears.length) return null;
  const nowTo = tYears[tYears.length - 1];
  const then = decade(temps, THEN[0], THEN[1]);
  const now = decade(temps, nowTo - NOW_YEARS + 1, nowTo);
  if (!then || !now) return null;
  const wet = (from, to) => {
    const ys = completeYears(rain, "mm").filter((y) => y >= from && y <= to);
    if (ys.length < 7) return null;
    const keep = new Set(ys);
    return round(rain.filter((d) => keep.has(year(d.date)) && ok(d.mm) && d.mm >= WET_MM).length / ys.length, 0);
  };
  then.rainyDays = wet(THEN[0], THEN[1]);
  now.rainyDays = wet(nowTo - NOW_YEARS + 1, nowTo);
  delete then.sunnyDays; delete now.sunnyDays;
  const a = firstFrostTypical(temps, THEN[0], THEN[1] - 1);
  const b = firstFrostTypical(temps, nowTo - NOW_YEARS, nowTo - 1);
  return {
    then, now,
    warmer: round(now.meanTemp - then.meanTemp, 1),
    firstFrostLaterDays: a !== null && b !== null ? b - a : null
  };
}

// ---- Everything at once -------------------------------------------------------------------
// Each field comes from its own best source: temps / rain / sun = SMHI station days where a
// long-running station is near, else the model's (ERA5) days. `model` is always the full ERA5 set.
function summarise({ temps, rain, sun, model, uv }) {
  temps = temps || model; rain = rain || model; sun = sun || model;
  const lastN = (days, field) => completeYears(days, field).slice(-ODDS_YEARS);
  const tYears = lastN(temps, "tmin"), rYears = lastN(rain, "mm"), sYears = lastN(sun, "sun");

  // One record per date, each field from its own source and only from that source's odds years.
  const byDate = new Map();
  const put = (days, years, fields) => {
    const keep = new Set(years);
    for (const d of days) {
      if (!keep.has(year(d.date))) continue;
      const m = byDate.get(d.date) || { date: d.date, tmin: null, tmax: null, mm: null, sun: null };
      for (const f of fields) m[f] = d[f];
      byDate.set(d.date, m);
    }
  };
  put(temps, tYears, ["tmin", "tmax"]);
  put(rain, rYears, ["mm"]);
  put(sun, sYears, ["sun"]);
  const merged = [...byDate.values()];
  const allYears = [...new Set([...tYears, ...rYears, ...sYears])];

  let change = changing(temps, rain);
  let changeFrom = temps === model ? "model" : "station";
  if (!change && temps !== model) { change = changing(model, model); changeFrom = "model"; }

  return {
    years: { from: tYears[0] || null, to: tYears[tYears.length - 1] || null, count: tYears.length },
    days: climatology(merged, allYears),
    frost: frost(temps, ODDS_YEARS),
    sun: { from: sYears[0] || null, to: sYears[sYears.length - 1] || null, months: sunnyDays(sun, sYears) },
    uv: uv ? uvByMonth(uv) : null,
    changing: change ? Object.assign(change, { from: changeFrom }) : null
  };
}

module.exports = {
  summarise, climatology, frost, frostSeasons, sunnyDays, uvByMonth, changing, completeYears,
  slot, slotToMonthDay, median, byShare
};
