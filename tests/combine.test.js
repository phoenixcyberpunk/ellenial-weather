// Run with: node --test
const test = require("node:test");
const assert = require("node:assert");
const { combine, sunElevation, weatherWord, howSure } = require("../lib/combine");

const H = 3600 * 1000;
const T0 = Date.UTC(2026, 9, 29, 12); // 29 Oct 2026, 12 UTC (13 local), daytime in Gothenburg

test("averages the forecasts and counts rain votes", () => {
  const sources = [
    { id: "a", hours: [{ t: T0, temp: 10, wind: 4, cloud: 90 }, { t: T0, mm: 1.0 }] },
    { id: "b", hours: [{ t: T0, temp: 12, wind: 6, cloud: 100 }, { t: T0, mm: 0.4 }] },
    { id: "c", hours: [{ t: T0, temp: 11, wind: 5, cloud: 80 }, { t: T0, mm: 0 }] }
  ];
  const [h] = combine(sources, 57.71, 11.97);
  assert.strictEqual(h.temp, 11);
  assert.strictEqual(h.mm, 0.5);
  assert.strictEqual(h.rainShare, 0.7); // 2 of 3, rounded
  assert.strictEqual(h.wind, 5);
  assert.strictEqual(h.word, "RAIN");
  assert.deepStrictEqual(h.mmBySource, { a: 1, b: 0.4, c: 0 });
  assert.strictEqual(h.forecasts, 3);
});

test("a source with rain only for some hours still counts for temperature", () => {
  const sources = [
    { id: "a", hours: [{ t: T0, temp: 5 }] },
    { id: "b", hours: [{ t: T0, temp: 7 }, { t: T0, mm: 0 }] }
  ];
  const [h] = combine(sources, 57.71, 11.97);
  assert.strictEqual(h.temp, 6);
  assert.strictEqual(h.forecasts, 2);
  assert.deepStrictEqual(h.mmBySource, { b: 0 });
});

test("how sure: agreement gives 3 dots, disagreement 1, never 3 with fewer than 3 forecasts", () => {
  assert.strictEqual(howSure([10, 11, 10.5], { yes: 0, total: 3 }), 3);
  assert.strictEqual(howSure([10, 13, 11], { yes: 2, total: 3 }), 2);
  assert.strictEqual(howSure([5, 12, 9], { yes: 1, total: 2 }), 1);
  assert.strictEqual(howSure([10, 10], { yes: 0, total: 2 }), 2);
});

test("weather words", () => {
  assert.strictEqual(weatherWord({ temp: 0, mm: 0.5, rainShare: 0.6, wind: 3, cloud: 100, day: true }), "SNOW");
  assert.strictEqual(weatherWord({ temp: 8, mm: 0, rainShare: 0, wind: 12, cloud: 50, day: true }), "WIND");
  assert.strictEqual(weatherWord({ temp: 8, mm: 0, rainShare: 0, wind: 3, cloud: 10, day: true }), "SUN");
  assert.strictEqual(weatherWord({ temp: 8, mm: 0, rainShare: 0, wind: 3, cloud: 10, day: false }), "CLEAR");
  assert.strictEqual(weatherWord({ temp: 8, mm: 0, rainShare: 0, wind: 3, cloud: 50, day: true }), "MIX");
});

test("sun is up at noon and down at midnight in Gothenburg in late October", () => {
  assert.ok(sunElevation(Date.UTC(2026, 9, 29, 10, 30) - H / 2, 57.71, 11.97) > 10);
  assert.ok(sunElevation(Date.UTC(2026, 9, 29, 23), 57.71, 11.97) < -20);
});

test("thunder needs two forecasts and a third of the votes", () => {
  const base = { temp: 14, mm: 2, rainShare: 1, wind: 5, cloud: 100, day: true };
  assert.strictEqual(weatherWord({ ...base, thunderVotes: 2, thunderShare: 0.4 }), "THUNDER");
  assert.strictEqual(weatherWord({ ...base, thunderVotes: 1, thunderShare: 1 }), "RAIN");
  assert.strictEqual(weatherWord({ ...base, thunderVotes: 2, thunderShare: 0.3 }), "RAIN");
  const sources = ["a", "b", "c", "d", "e"].map((id, i) => ({ id, hours: [{ t: T0, temp: 15, cloud: 100, thunder: i < 2 }] }));
  const [h] = combine(sources, 57.71, 11.97);
  assert.strictEqual(h.thunderVotes, 2);
  assert.strictEqual(h.word, "THUNDER");
});

test("light rain is drizzle, from 0.5 mm an hour it's rain", () => {
  const base = { temp: 8, rainShare: 1, wind: 3, cloud: 100, day: true };
  assert.strictEqual(weatherWord({ ...base, mm: 0.2 }), "DRIZZLE");
  assert.strictEqual(weatherWord({ ...base, mm: 0.5 }), "RAIN");
  assert.strictEqual(weatherWord({ ...base, temp: 0, mm: 0.2 }), "SNOW");
});

test("wet and just above freezing is sleet", () => {
  const base = { mm: 1, rainShare: 1, wind: 3, cloud: 100, day: true };
  assert.strictEqual(weatherWord({ ...base, temp: 0.5 }), "SNOW");
  assert.strictEqual(weatherWord({ ...base, temp: 1.5 }), "SLEET");
  assert.strictEqual(weatherWord({ ...base, temp: 2.5 }), "RAIN");
});

test("fog needs two forecasts, like thunder, and keeps the weather word", () => {
  const sources = ["a", "b", "c", "d"].map((id, i) => ({ id, hours: [{ t: T0, temp: 6, cloud: 20, fog: i < 2 }] }));
  const [h] = combine(sources, 57.71, 11.97);
  assert.strictEqual(h.fog, true);
  assert.strictEqual(h.word, "SUN");
  const one = ["a", "b", "c"].map((id, i) => ({ id, hours: [{ t: T0, temp: 6, cloud: 20, fog: i === 0 }] }));
  assert.strictEqual(combine(one, 57.71, 11.97)[0].fog, false);
});
