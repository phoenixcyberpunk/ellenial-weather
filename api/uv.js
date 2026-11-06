// GET /api/uv?lat=57.7&lon=12.0
// Typical daily UV per month, from Open-Meteo's forecast archive (spring 2021 onwards).
// Kept apart from /api/history because the archive can be slow for a new place: the rest of
// "What usually happens" shows straight away and UV fills in when it's ready. Cached 30 days per 0.1°.

const { uvDays } = require("../lib/sources/historySources");
const { uvByMonth } = require("../lib/history");

const { canonical, answered } = require("../lib/coords");

module.exports = async (req, res) => {
  // Only rounded (0.1°) addresses reach the source; see lib/coords.js.
  const c = canonical(req, { lat: 57.7, lon: 12 });
  if (answered(res, c)) return;
  const { lat, lon } = c;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    const uv = uvByMonth(await uvDays(lat, lon));
    res.setHeader("Cache-Control", uv
      ? "public, s-maxage=2592000, stale-while-revalidate=2592000"
      : "public, s-maxage=86400");
    res.end(JSON.stringify({ uv }));
  } catch (e) {
    res.statusCode = 502;
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ error: "UV history couldn't be reached" }));
  }
};
