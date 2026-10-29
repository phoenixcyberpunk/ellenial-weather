// GET /api/forecast?lat=57.71&lon=11.97
// Fetches every source at once and combines them per hour and per day.
// A source that fails just drops out. Cached at Vercel's edge for 30 minutes,
// so most visitors never reach the sources at all.

const smhi = require("../lib/sources/smhi");
const met = require("../lib/sources/met");
const openMeteo = require("../lib/sources/openmeteo");
const smhiObserved = require("../lib/sources/smhiObs");
const { combine } = require("../lib/combine");
const { buildDays, localClock } = require("../lib/days");

const HOUR = 3600 * 1000;
const GOTHENBURG = { lat: 57.71, lon: 11.97 };
const FALLBACK_TZ = "Europe/Stockholm";

function parseCoord(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : null;
}

const reason = (r) => String((r.reason && r.reason.message) || r.reason);

// The page needs hour-level detail only for today and the next two days.
function hoursForPage(hours, tz, now) {
  const clock = localClock(tz);
  const today = clock(now).date;
  const end = now + 48 * HOUR;
  return hours
    .filter((h) => h.t <= end && (h.t >= now - HOUR || clock(h.t).date === today))
    .map(({ tempBySource, ...rest }) => rest);
}

module.exports = async (req, res) => {
  const url = new URL(req.url, "http://local");
  const lat = parseCoord(url.searchParams.get("lat") ?? GOTHENBURG.lat, -90, 90);
  const lon = parseCoord(url.searchParams.get("lon") ?? GOTHENBURG.lon, -180, 180);
  if (lat === null || lon === null) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "lat and lon must be numbers" }));
  }

  const [smhiRes, metRes, omRes, obsRes] = await Promise.allSettled([
    smhi(lat, lon), met(lat, lon), openMeteo(lat, lon), smhiObserved(lat, lon)
  ]);

  const sources = [];
  const status = [];
  const note = (id, name, r) => status.push({ id, name, ok: r.status === "fulfilled", error: r.status === "rejected" ? reason(r) : undefined });

  note("smhi", "SMHI", smhiRes);
  if (smhiRes.status === "fulfilled") sources.push(smhiRes.value);
  note("met", "MET Norway", metRes);
  if (metRes.status === "fulfilled") sources.push(metRes.value);
  let timezone = null;
  if (omRes.status === "fulfilled") {
    timezone = omRes.value.timezone;
    for (const m of omRes.value.models) {
      const ok = m.hours.length > 0;
      status.push({ id: m.id, name: m.name, ok, error: ok ? undefined : "no data" });
      if (ok) sources.push(m);
    }
  } else {
    for (const [id, name] of [["ecmwf", "ECMWF"], ["icon", "DWD ICON"], ["dmi", "DMI"], ["gfs", "NOAA GFS"]]) {
      status.push({ id, name, ok: false, error: reason(omRes) });
    }
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (!sources.length) {
    res.statusCode = 502;
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify({ error: "No forecasts could be reached", sources: status }));
  }

  const tz = timezone || FALLBACK_TZ;
  const now = Date.now();
  const hours = combine(sources, lat, lon);
  const observed = obsRes.status === "fulfilled" ? obsRes.value : null;

  const body = {
    place: { lat, lon, timezone: tz },
    generatedAt: new Date(now).toISOString(),
    sources: status,
    observedAt: observed ? observed.station : null,
    observedError: obsRes.status === "rejected" ? reason(obsRes) : undefined,
    hours: hoursForPage(hours, tz, now),
    days: buildDays(hours, observed, tz, now)
  };

  res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=3600");
  res.end(JSON.stringify(body));
};
