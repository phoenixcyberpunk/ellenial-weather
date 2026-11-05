// Daily summaries for the week tables: this week (from Monday), next week and the week after.
// Days ahead come from the combined forecasts. Past days come from what a station measured
// when one is near (cloud for the weather word still comes from the models, since stations
// rarely measure it); otherwise from the models' own past hours, marked as not measured.

const { weatherWord, RAIN_MM } = require("./combine");

const HOUR = 3600 * 1000;
const MIN_HOURS = 18; // a day needs this many hours of data to get a summary
const round1 = (x) => Math.round(x * 10) / 10;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Local calendar date and hour at the place, whatever time zone the server runs in.
function localClock(tz) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23"
  });
  return (t) => {
    const p = {};
    for (const x of fmt.formatToParts(new Date(t))) p[x.type] = x.value;
    return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
  };
}

// The 21 dates shown: Monday of this week to Sunday of the week after.
function weekDates(todayDate) {
  const [y, m, d] = todayDate.split("-").map(Number);
  const today = new Date(Date.UTC(y, m - 1, d));
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  const out = [];
  for (let i = 0; i < 21; i++) {
    const x = new Date(monday);
    x.setUTCDate(monday.getUTCDate() + i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

const DRIZZLE_DAY_MM = 3; // a rainy day with less than this in total shows drizzle

function dayWord({ mm, rainyHours, thunderHours = 0, hi, windMax, cloud, day }) {
  if (thunderHours >= 1) return "THUNDER";
  if (mm !== null && mm >= 1 && rainyHours >= 2) {
    if (hi !== null && hi <= 1) return "SNOW";
    if (hi !== null && hi <= 3) return "SLEET"; // the day's high, so a little warmer than the hourly 2 °C
    return mm < DRIZZLE_DAY_MM ? "DRIZZLE" : "RAIN"; // a wet but light day, typical Gothenburg drizzle
  }
  return weatherWord({ temp: hi, mm: 0, rainShare: 0, wind: windMax, cloud, day });
}

// How sure for a whole day: do the forecasts agree on the high, and on rain or no rain?
function daySure(dayHours) {
  const perSource = {};
  for (const h of dayHours) {
    for (const [id, temp] of Object.entries(h.tempBySource || {})) {
      const s = perSource[id] || (perSource[id] = { temps: [], mm: 0, mmHours: 0 });
      s.temps.push(temp);
    }
    for (const [id, mm] of Object.entries(h.mmBySource || {})) {
      const s = perSource[id] || (perSource[id] = { temps: [], mm: 0, mmHours: 0 });
      s.mm += mm;
      s.mmHours++;
    }
  }
  const highs = Object.values(perSource).filter((s) => s.temps.length >= MIN_HOURS).map((s) => Math.max(...s.temps));
  const rainers = Object.values(perSource).filter((s) => s.mmHours >= MIN_HOURS);
  if (highs.length < 2) return 1;
  const spread = Math.max(...highs) - Math.min(...highs);
  const wet = rainers.filter((s) => s.mm >= 1).length;
  const agree = rainers.length ? Math.max(wet, rainers.length - wet) / rainers.length : 1;
  let sure = 1;
  if (spread <= 2 && agree >= 0.8) sure = 3;
  else if (spread <= 4 && agree >= 0.6) sure = 2;
  if (highs.length < 3) sure = Math.min(sure, 2);
  return sure;
}

function summarize(dayHours, cloudHours) {
  const temps = dayHours.map((h) => h.temp).filter((x) => x !== undefined && x !== null);
  if (temps.length < MIN_HOURS) return null;
  const mms = dayHours.map((h) => h.mm).filter((x) => x !== undefined && x !== null);
  const winds = dayHours.map((h) => h.wind).filter((x) => x !== undefined && x !== null);
  const daylight = cloudHours.filter((h) => h.day && h.cloud !== null && h.cloud !== undefined);
  const hi = round1(Math.max(...temps));
  const mm = mms.length >= MIN_HOURS ? round1(mms.reduce((a, b) => a + b, 0)) : null;
  const windMax = winds.length ? Math.round(Math.max(...winds)) : null;
  const cloud = daylight.length ? mean(daylight.map((h) => h.cloud)) : null;
  const rainyHours = dayHours.filter((h) => h.mm !== null && h.mm !== undefined && h.mm >= RAIN_MM &&
    (h.rainShare === undefined || h.rainShare >= 0.5)).length;
  // Thunder comes from the forecasts only (stations here don't report it), so measured days never show it.
  const thunderHours = dayHours.filter((h) => h.word === "THUNDER").length;
  // A foggy day: fog for at least 3 hours of daylight (a misty morning counts, one foggy hour at 4 am doesn't).
  const fog = cloudHours.filter((h) => h.fog && h.day).length >= 3;
  return {
    hi, lo: round1(Math.min(...temps)), mm, wind: windMax, fog,
    word: dayWord({ mm, rainyHours, thunderHours, hi, windMax, cloud, day: true })
  };
}

// Every hour of the day that has data, shown as a scrollable chart when a day is tapped.
// Further out, some models only give every 3rd or 6th hour; those days simply have fewer hours.
function picks(byLocalHour, cloudByLocalHour) {
  const out = [];
  for (let hr = 0; hr < 24; hr++) {
    const h = byLocalHour.get(hr);
    if (!h || h.temp === undefined || h.temp === null) continue;
    const c = cloudByLocalHour.get(hr) || h;
    const rainy = h.mm !== null && h.mm !== undefined && h.mm >= RAIN_MM && (h.rainShare === undefined || h.rainShare >= 0.5);
    out.push({
      hour: hr,
      temp: round1(h.temp),
      mm: h.mm === null || h.mm === undefined ? null : round1(h.mm),
      wind: h.wind === null || h.wind === undefined ? null : Math.round(h.wind),
      day: c.day ?? true, // lets the page show the moon instead of the sun after dark
      fog: !!h.fog,
      word: h.word === "THUNDER" ? "THUNDER" : weatherWord({ temp: h.temp, mm: rainy ? h.mm : 0, rainShare: rainy ? 1 : 0, wind: h.wind ?? null, cloud: c.cloud ?? null, day: c.day ?? true })
    });
  }
  return out;
}

// forecastHours: combined hours (models' past hours included); observed: smhiObserved() or null.
function buildDays(forecastHours, observed, tz, now = Date.now()) {
  const clock = localClock(tz);
  const today = clock(now).date;
  const group = (hours) => {
    const m = new Map();
    for (const h of hours) {
      const c = clock(h.t);
      if (!m.has(c.date)) m.set(c.date, new Map());
      m.get(c.date).set(c.hour, h);
    }
    return m;
  };
  const fc = group(forecastHours);
  const obs = observed ? group(observed.hours) : new Map();

  return weekDates(today).map((date) => {
    const past = date < today;
    const fcDay = fc.get(date) || new Map();
    const obsDay = obs.get(date);
    const fcHours = [...fcDay.values()];
    const base = { date, past, today: date === today };

    if (past && obsDay && obsDay.size >= MIN_HOURS) {
      const s = summarize([...obsDay.values()], fcHours);
      if (s) return Object.assign(base, s, { measured: true, sure: null, hours: picks(obsDay, fcDay) });
    }
    const s = summarize(fcHours, fcHours);
    if (!s) return Object.assign(base, { empty: true });
    return Object.assign(base, s, { measured: false, sure: past ? null : daySure(fcHours), hours: picks(fcDay, fcDay) });
  });
}

module.exports = { buildDays, weekDates, localClock, daySure };
