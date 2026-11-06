const test = require("node:test");
const assert = require("node:assert");
const { canonical, round } = require("../lib/coords");

const GBG = { lat: 57.7, lon: 12 };
const req = (q) => ({ url: "/api/forecast" + q });

test("rounded addresses pass straight through", () => {
  assert.deepStrictEqual(canonical(req("?lat=57.7&lon=12"), GBG), { lat: 57.7, lon: 12 });
  assert.deepStrictEqual(canonical(req("?lat=-33.9&lon=151.2"), GBG), { lat: -33.9, lon: 151.2 });
  assert.deepStrictEqual(canonical(req("?lat=0&lon=0"), GBG), { lat: 0, lon: 0 });
});

test("unrounded or padded addresses are sent on to the rounded one", () => {
  assert.deepStrictEqual(canonical(req("?lat=57.712&lon=11.97"), GBG), { redirect: "/api/forecast?lat=57.7&lon=12" });
  assert.deepStrictEqual(canonical(req("?lat=57.70&lon=12.0"), GBG), { redirect: "/api/forecast?lat=57.7&lon=12" });
  assert.deepStrictEqual(canonical(req("?lat=-0.01&lon=0"), GBG), { redirect: "/api/forecast?lat=0&lon=0" });
});

test("extra parameters can't be used to dodge the cache", () => {
  assert.deepStrictEqual(canonical(req("?lat=57.7&lon=12&x=1"), GBG), { redirect: "/api/forecast?lat=57.7&lon=12" });
});

test("missing coordinates answer for Gothenburg (one fixed address)", () => {
  assert.deepStrictEqual(canonical(req(""), GBG), { lat: 57.7, lon: 12 });
});

test("bad input is refused", () => {
  for (const q of ["?lat=abc&lon=12", "?lat=91&lon=12", "?lat=57&lon=181", "?lat=&lon=12", "?lat=Infinity&lon=1"]) {
    assert.ok(canonical(req(q), GBG).error, q);
  }
});

test("the page's rounding matches the server's", () => {
  for (const n of [57.71, 11.97, -0.04, 59.33, 18.07, 0.05, -122.42]) {
    const page = Math.round(n * 10) / 10 || 0;
    assert.strictEqual(String(page), String(round(n)), String(n));
  }
});
