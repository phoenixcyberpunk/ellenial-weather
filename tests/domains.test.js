const test = require("node:test");
const assert = require("node:assert");
const { runsOwnModel } = require("../lib/domains");

test("SMHI, MET Norway and DMI count in Gothenburg", () => {
  assert.ok(runsOwnModel("smhi", 57.71, 11.97));
  assert.ok(runsOwnModel("met", 57.71, 11.97));
  assert.ok(runsOwnModel("dmi", 57.71, 11.97));
});

test("in London DMI counts, MET Norway and SMHI are ECMWF", () => {
  assert.ok(runsOwnModel("dmi", 51.51, -0.13));
  assert.ok(!runsOwnModel("met", 51.51, -0.13));
  assert.ok(!runsOwnModel("smhi", 51.51, -0.13));
});

test("in Sydney both are ECMWF; the global models always count", () => {
  assert.ok(!runsOwnModel("met", -33.87, 151.21));
  assert.ok(!runsOwnModel("dmi", -33.87, 151.21));
  assert.ok(!runsOwnModel("smhi", -33.87, 151.21));
  for (const id of ["ecmwf", "icon", "gfs"]) assert.ok(runsOwnModel(id, -33.87, 151.21));
});
