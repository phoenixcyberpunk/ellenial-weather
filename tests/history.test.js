const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("../lib/history");
const { parseSmhiDaily } = require("../lib/sources/historySources");

// A made-up climate: a smooth yearly temperature curve, frost on a few known nights each season.
function makeDays(fromYear, toYear, opts = {}) {
  const days = [];
  for (let t = Date.UTC(fromYear, 0, 1); t <= Date.UTC(toYear, 11, 31); t += 86400000) {
    const d = new Date(t);
    const date = d.toISOString().slice(0, 10);
    const doy = Math.floor((t - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000);
    const warm = 9 + 8 * Math.sin(((doy - 110) / 365) * 2 * Math.PI) + (opts.warming || 0) * (d.getUTCFullYear() - fromYear);
    days.push({ date, tmin: warm - 4, tmax: warm + 4, mm: doy % 3 === 0 ? 2 : 0, sun: doy % 2 === 0 ? 7 : 2 });
  }
  return days;
}

test("slot gives every date a home in a leap-year calendar", () => {
  assert.equal(h.slot("2025-01-01"), 0);
  assert.equal(h.slot("2024-02-29"), 59);
  assert.equal(h.slot("2025-03-01"), 60);
  assert.equal(h.slot("2025-12-31"), 365);
  assert.deepEqual(h.slotToMonthDay(60), { month: 3, day: 1 });
});

test("byShare: dates by which something happened in a share of seasons; never = later than any date", () => {
  assert.equal(h.byShare([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 0.7), 70);
  assert.equal(h.byShare([10, 20, Infinity, Infinity], 0.7), null);
  assert.equal(h.median([3, 1, 2]), 2);
  assert.equal(h.median([1, 2, 3, 4]), 2.5);
});

test("frost odds: first autumn and last spring frost from known nights", () => {
  const days = makeDays(2000, 2025).map((d) => ({ ...d, tmin: 5 }));
  // Each season: first frost on 10 Nov + (year % 10) days, last frost on 1 Apr + (year % 10) days.
  for (const d of days) {
    const y = +d.date.slice(0, 4);
    const first = new Date(Date.UTC(y, 10, 10 + (y % 10))).toISOString().slice(0, 10);
    const last = new Date(Date.UTC(y, 3, 1 + (y % 10))).toISOString().slice(0, 10);
    if (d.date === first || d.date === last) d.tmin = -2;
  }
  const f = h.frost(days, 20);
  assert.equal(f.seasons, 20);
  assert.equal(f.noFrostSeasons, 0);
  // offsets 0..9 twice: the 7-in-10 date is offset 6 → 16 Nov
  assert.deepEqual(f.firstAutumn.late, { month: 11, day: 16 });
  assert.deepEqual(f.firstAutumn.typical, { month: 11, day: 14 });
  // 9-in-10 last spring frost: offset 8 → 9 Apr (season index counts from 1 July)
  assert.deepEqual(f.lastSpring.safe, { month: 4, day: 9 });
  assert.equal(f.nightsPerYear, 2);
});

test("frost: seasons without frost count as 'not by then'", () => {
  const days = makeDays(2000, 2025).map((d) => ({ ...d, tmin: 5 }));
  const f = h.frost(days, 20);
  assert.equal(f.noFrostSeasons, 20);
  assert.equal(f.firstAutumn.late, null);
  assert.equal(f.lastSpring.safe, null);
});

test("climatology: 366 days of [high, low, rain chance, sun hours]", () => {
  const days = makeDays(2006, 2025);
  const c = h.climatology(days, h.completeYears(days).slice(-20));
  assert.equal(c.length, 366);
  const july = c[h.slot("2025-07-20")], jan = c[h.slot("2025-01-20")];
  assert.ok(july[0] > jan[0], "July highs above January highs");
  assert.ok(july[1] < july[0], "lows below highs");
  assert.ok(c[100][2] > 0.2 && c[100][2] < 0.5, "about one rainy day in three");
  assert.ok(c[100][3] > 4 && c[100][3] < 5, "sun averages 4.5 h");
});

test("sunny days per month count days with 6+ hours of sun", () => {
  const days = makeDays(2006, 2025);
  const s = h.sunnyDays(days, h.completeYears(days).slice(-20));
  assert.equal(s.length, 12);
  assert.ok(s[0].sunnyDays >= 15 && s[0].sunnyDays <= 16); // every other day in January
  assert.equal(s[0].hoursPerDay, 4.6); // 16 days of 7 h and 15 of 2 h
});

test("UV by month: typical max and when it passes 3; too little data gives null", () => {
  assert.equal(h.uvByMonth([{ date: "2025-06-01", uv: 6 }]), null);
  const uv = [];
  for (let t = Date.UTC(2022, 0, 1); t <= Date.UTC(2024, 11, 31); t += 86400000) {
    const d = new Date(t), m = d.getUTCMonth() + 1;
    uv.push({ date: d.toISOString().slice(0, 10), uv: [0, 1, 2, 3, 5, 6, 6, 5, 3, 1, 0, 0][m - 1] });
  }
  const u = h.uvByMonth(uv);
  assert.equal(u.careFrom, 4);
  assert.equal(u.careTo, 9);
  assert.equal(u.months[5].typical, 6);
  assert.equal(u.months[5].careDays, 10);
  assert.equal(u.years, 3);
});

test("changing: the 1990s against the last 10 years", () => {
  const days = makeDays(1991, 2025, { warming: 0.05 });
  const c = h.changing(days, days);
  assert.equal(c.then.from, 1991);
  assert.equal(c.now.to, 2025);
  assert.ok(c.warmer > 1.2 && c.warmer < 1.4, `warmer by about 1.3°, got ${c.warmer}`);
});

test("summarise ties it together and survives missing UV", () => {
  const days = makeDays(1991, 2025);
  const s = h.summarise({ temps: days, model: days, uv: null });
  assert.equal(s.years.count, 20);
  assert.equal(s.years.to, 2025);
  assert.equal(s.days.length, 366);
  assert.equal(s.uv, null);
  assert.ok(s.changing);
});

test("SMHI archive CSV: rows keyed by the day they belong to", () => {
  const csv = [
    "Stationsnamn;Stationsnummer;Stationsnät;Mäthöjd (meter över marken)",
    "Göteborg A;71420;SMHIs stationsnät;2.0",
    "",
    "Från Datum Tid (UTC);Till Datum Tid (UTC);Representativt dygn;Lufttemperatur;Kvalitet;;Tidsutsnitt:",
    "1961-01-01 06:00:01;1961-01-02 06:00:00;1961-01-01;-3.4;G;;Kvalitetskontrollerade historiska data",
    "2026-07-30 18:00:01;2026-07-31 18:00:00;2026-07-31;16.0;Y"
  ].join("\n");
  const m = parseSmhiDaily(csv);
  assert.equal(m.size, 2);
  assert.equal(m.get("1961-01-01"), -3.4);
  assert.equal(m.get("2026-07-31"), 16);
});
