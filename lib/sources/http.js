// Shared fetch helper for the forecast sources.
// MET Norway requires an identifying User-Agent; the others get the same one out of courtesy.

const HOUR = 3600 * 1000;
const UA = "EllenialWeather/0.2 (+https://github.com/phoenixcyberpunk/ellenial-weather)";
const TIMEOUT_MS = 8000;

async function getJson(url, opts) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), (opts && opts.timeoutMs) || TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: controller.signal });
    if (!res.ok) {
      let why = "";
      try { why = (await res.json()).reason || ""; } catch (e) { /* not JSON */ }
      throw new Error(`HTTP ${res.status}${why ? ": " + why : ""}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { HOUR, getJson };
