// GET /api/places?q=lerum&lang=sv
// Finds towns and villages by name for the place search. Cached at Vercel's edge for a day,
// since place names don't change; the search itself is never logged or stored.

const { cleanQuery, searchPlaces } = require("../lib/places");

module.exports = async (req, res) => {
  const url = new URL(req.url, "http://local");
  const q = cleanQuery(url.searchParams.get("q"));
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (!q) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "q must be 2–60 characters" }));
  }
  try {
    const places = await searchPlaces(q, url.searchParams.get("lang"));
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    res.end(JSON.stringify({ places }));
  } catch (e) {
    res.statusCode = 502;
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ error: "Place search couldn't be reached" }));
  }
};
