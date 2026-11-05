const test = require("node:test");
const assert = require("node:assert");
const { shapePlaces, cleanQuery } = require("../lib/places");

test("place results keep name, region/country line and rounded coordinates", () => {
  const out = shapePlaces({ results: [
    { name: "Lerum", admin1: "Västra Götaland", country: "Sverige", country_code: "SE", latitude: 57.77048, longitude: 12.26918 },
    { name: "Lerum", admin1: "Västra Götaland", country: "Sverige", country_code: "SE", latitude: 57.77, longitude: 12.27 },
    { name: "Göteborg", admin1: "Göteborg", country: "Sverige", latitude: 57.70716, longitude: 11.96679 },
    { name: "Broken", country: "Nowhere" }
  ] });
  assert.strictEqual(out.length, 2);
  assert.deepStrictEqual(out[0], { name: "Lerum", sub: "Västra Götaland, Sverige", lat: 57.77, lon: 12.27, country: "SE" });
  assert.strictEqual(out[1].sub, "Sverige"); // region left out when it repeats the name
});

test("no results is an empty list", () => {
  assert.deepStrictEqual(shapePlaces({}), []);
});

test("queries are trimmed and kept between 2 and 60 characters", () => {
  assert.strictEqual(cleanQuery("  ler  um "), "ler um");
  assert.strictEqual(cleanQuery("a"), null);
  assert.strictEqual(cleanQuery("x".repeat(61)), null);
});
