// GET /api/history?lat=57.7&lon=12.0
// What usually happens at a place: a smoothed "usual day" for every date of the year, frost odds,
// sunny days, UV and how the climate is changing. Built from 35 years of daily data, so it is
// heavy to make and changes slowly: Vercel's edge caches it for 30 days per place.
// Coordinates are rounded to 0.1° (about 10 km) so nearby visitors share one cached answer.

const { smhiTemps, smhiRain, smhiSun, modelDays, uvDays } = require("../lib/sources/historySources");
const { summarise } = require("../lib/history");

const GOTHENBURG = { lat: 57.7, lon: 12.0 };
const reason = (r) => String((r.reason && r.reason.message) || r.reason);

function parseCoord(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 10) / 10 : null;
}

module.exports = async (req, res) => {
  const started = Date.now();
  const url = new URL(req.url, "http://local");
  const lat = parseCoord(url.searchParams.get("lat") ?? GOTHENBURG.lat, -90, 90);
  const lon = parseCoord(url.searchParams.get("lon") ?? GOTHENBURG.lon, -180, 180);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (lat === null || lon === null) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "lat and lon must be numbers" }));
  }

  const [tRes, rRes, sRes, mRes, uvRes] = await Promise.allSettled([
    smhiTemps(lat, lon), smhiRain(lat, lon), smhiSun(lat, lon), modelDays(lat, lon), uvDays(lat, lon)
  ]);

  if (mRes.status === "rejected") {
    res.statusCode = 502;
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify({ error: "The weather history could not be reached", detail: reason(mRes) }));
  }

  const model = mRes.value.days;
  const got = (r) => (r.status === "fulfilled" && r.value ? r.value : null);
  const t = got(tRes), r = got(rRes), s = got(sRes);
  const uv = uvRes.status === "fulfilled" ? uvRes.value : null;
  const out = summarise({ temps: t && t.days, rain: r && r.days, sun: s && s.days, model, uv });

  const ERA5 = "ERA5 (Open-Meteo)";
  const src = (res, hit) => hit
    ? { kind: "station", name: `SMHI ${hit.station.name}`, km: hit.station.km }
    : { kind: "model", name: ERA5, why: res.status === "rejected" ? "station data unreachable" : "no long-running station nearby" };
  out.place = { lat, lon, timezone: mRes.value.timezone };
  out.sources = {
    temps: src(tRes, t),
    rain: src(rRes, r),
    sun: src(sRes, s),
    uv: uv ? { kind: "forecast archive", name: "Open-Meteo forecast archive" } : null,
    changing: out.changing ? (out.changing.from === "station" ? src(tRes, t) : { kind: "model", name: ERA5 }) : null
  };
  out.generatedAt = new Date().toISOString();
  out.tookMs = Date.now() - started;

  // Only cache a full answer for long; a fallback (station or UV missing) retries within a day.
  const complete = [tRes, rRes, sRes, uvRes].every((x) => x.status === "fulfilled");
  res.setHeader("Cache-Control", complete
    ? "public, s-maxage=2592000, stale-while-revalidate=2592000"
    : "public, s-maxage=86400, stale-while-revalidate=86400");
  res.end(JSON.stringify(out));
};
