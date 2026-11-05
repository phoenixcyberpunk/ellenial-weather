// Place search via Open-Meteo's geocoding API (GeoNames data, CC BY 4.0).
// Towns and villages, not street addresses, which is all a weather page needs.
// The page never calls Open-Meteo itself: /api/places fetches it, so the page makes no third-party requests.

const { getJson } = require("./sources/http");

const MAX_RESULTS = 8;

// Keep only what the page shows, with a short "region, country" line under each name.
function shapePlaces(json) {
  const seen = new Set();
  return ((json && json.results) || [])
    .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude) && r.name)
    .map((r) => {
      const sub = [r.admin1 !== r.name ? r.admin1 : null, r.country].filter(Boolean).join(", ");
      return {
        name: r.name,
        sub,
        lat: Math.round(r.latitude * 100) / 100,
        lon: Math.round(r.longitude * 100) / 100,
        country: r.country_code || null
      };
    })
    // The same town can come back twice (e.g. a town and its municipality); keep the first.
    .filter((p) => {
      const key = p.name + "|" + p.sub;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_RESULTS);
}

function cleanQuery(q) {
  const s = String(q || "").replace(/\s+/g, " ").trim();
  return s.length >= 2 && s.length <= 60 ? s : null;
}

async function searchPlaces(q, lang) {
  const language = /^[a-z]{2}$/.test(lang || "") ? lang : "en";
  const url = "https://geocoding-api.open-meteo.com/v1/search" +
    `?name=${encodeURIComponent(q)}&count=${MAX_RESULTS + 4}&language=${language}&format=json`;
  return shapePlaces(await getJson(url, { timeoutMs: 5000 }));
}

module.exports = { shapePlaces, cleanQuery, searchPlaces };
