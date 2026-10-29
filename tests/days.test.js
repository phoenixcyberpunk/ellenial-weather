// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const { combine } = require("../lib/combine");
const { buildDays, weekDates } = require("../lib/days");

const H = 3600 * 1000;
const TZ = "Europe/Stockholm";
const NOW = Date.UTC(2026, 9, 29, 18); // Thu 29 Oct 2026, 19:00 in Gothenburg

test("the weeks run Monday to Sunday, three of them", () => {
  const d = weekDates("2026-10-29");
  assert.strictEqual(d.length, 21);
  assert.strictEqual(d[0], "2026-10-26");
  assert.strictEqual(d[20], "2026-11-15");
  assert.strictEqual(weekDates("2026-10-26")[0], "2026-10-26"); // a Monday stays itself
  assert.strictEqual(weekDates("2026-11-01")[0], "2026-10-26"); // a Sunday belongs to the week before
});

// Three forecasts from Monday 00:00 local until 10 days ahead; two agree, one runs 1° warmer.
function fakeForecast() {
  const start = Date.UTC(2026, 9, 25, 23); // Mon 26 Oct 00:00 local
  const end = NOW + 10 * 24 * H;
  return ["a", "b", "c"].map((id, j) => {
    const hours = [];
    for (let t = start; t < end; t += H) {
      const hr = new Date(t + H).getUTCHours();
      hours.push({ t, temp: 8 + 3 * Math.sin(((hr - 9) / 24) * 2 * Math.PI) + (j === 2 ? 1 : 0), wind: 4, cloud: 90 });
      // Rain on Saturday 31 Oct afternoon in every forecast
      const isSatAfternoon = t >= Date.UTC(2026, 9, 31, 12) && t < Date.UTC(2026, 9, 31, 17);
      hours.push({ t, mm: isSatAfternoon ? 0.8 : 0 });
    }
    return { id, hours };
  });
}

test("forecast days get a summary, How sure, and five hours", () => {
  const hours = combine(fakeForecast(), 57.71, 11.97);
  const days = buildDays(hours, null, TZ, NOW);
  const today = days.find((d) => d.today);
  assert.strictEqual(today.date, "2026-10-29");
  assert.ok(today.hi > today.lo);
  assert.strictEqual(today.sure, 3);
  assert.strictEqual(today.hours.length, 5);
  assert.deepStrictEqual(today.hours.map((h) => h.hour), [6, 10, 14, 18, 22]);

  const sat = days.find((d) => d.date === "2026-10-31");
  assert.strictEqual(sat.word, "RAIN");
  assert.strictEqual(sat.mm, 4); // 5 hours × 0.8 mm
  assert.strictEqual(days.find((d) => d.date === "2026-10-30").word, "CLOUDY");
});

test("days beyond the forecasts are empty, past days have no How sure", () => {
  const days = buildDays(combine(fakeForecast(), 57.71, 11.97), null, TZ, NOW);
  assert.ok(days.find((d) => d.date === "2026-11-15").empty);
  const mon = days[0];
  assert.strictEqual(mon.past, true);
  assert.strictEqual(mon.measured, false);
  assert.strictEqual(mon.sure, null);
});

test("past days use the station's measurements when there are any", () => {
  const obsHours = [];
  for (let t = Date.UTC(2026, 9, 26, 23); t < Date.UTC(2026, 9, 27, 23); t += H) {
    obsHours.push({ t, temp: 12, wind: 6, mm: t === Date.UTC(2026, 9, 27, 8) ? 3 : 0 });
  }
  const obsHoursRain = obsHours.map((h, i) => (i >= 8 && i < 10 ? Object.assign({}, h, { mm: 1.5 }) : h));
  const days = buildDays(combine(fakeForecast(), 57.71, 11.97), { station: { name: "Test", km: 1 }, hours: obsHoursRain }, TZ, NOW);
  const tue = days.find((d) => d.date === "2026-10-27");
  assert.strictEqual(tue.measured, true);
  assert.strictEqual(tue.hi, 12);
  assert.strictEqual(tue.mm, 3);
  assert.strictEqual(tue.word, "RAIN");
  // Monday had no measurements in this test: it falls back to the models, not measured.
  assert.strictEqual(days[0].measured, false);
});
