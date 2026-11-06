// One place = one 0.1° square (about 11 km). Every API takes lat/lon, and Vercel's edge cache
// keys on the exact address asked for, so "lat=57.712" and "lat=57.713" would be two misses that
// each reach the weather services. To stop scripts from walking around the cache, any address
// that isn't already rounded is sent on (308) to the rounded one, and only rounded addresses ever
// call the sources. The page rounds before asking, so normal visits never see the redirect.

const STEP = 10; // 1 / 0.1°

function round(n) {
  const r = Math.round(n * STEP) / STEP;
  return r === 0 ? 0 : r; // no "-0"
}

// Returns { lat, lon } when the address is already canonical, { redirect } when it should be
// sent on, or { error } when lat/lon aren't usable numbers.
function canonical(req, fallback) {
  const url = new URL(req.url, "http://local");
  const rawLat = url.searchParams.get("lat") ?? String(fallback.lat);
  const rawLon = url.searchParams.get("lon") ?? String(fallback.lon);
  const nLat = Number(rawLat), nLon = Number(rawLon);
  if (rawLat === "" || rawLon === "" || !Number.isFinite(nLat) || !Number.isFinite(nLon) ||
      nLat < -90 || nLat > 90 || nLon < -180 || nLon > 180) {
    return { error: "lat and lon must be numbers" };
  }
  const lat = round(nLat), lon = round(nLon);
  const extra = [...url.searchParams.keys()].some((k) => k !== "lat" && k !== "lon");
  if (rawLat !== String(lat) || rawLon !== String(lon) || extra) {
    return { redirect: url.pathname + "?lat=" + lat + "&lon=" + lon };
  }
  return { lat, lon };
}

// Handles the two non-happy outcomes; returns true when the response is already sent.
function answered(res, c) {
  if (c.error) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=86400");
    res.end(JSON.stringify({ error: c.error }));
    return true;
  }
  if (c.redirect) {
    res.statusCode = 308;
    res.setHeader("Location", c.redirect);
    res.setHeader("Cache-Control", "public, s-maxage=86400");
    res.end();
    return true;
  }
  return false;
}

module.exports = { round, canonical, answered };
