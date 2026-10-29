// Shared fetch helper for the forecast sources.
// MET Norway requires an identifying User-Agent; the others get the same one out of courtesy.

const HOUR = 3600 * 1000;
const UA = "EllenialWeather/0.2 (+https://github.com/phoenixcyberpunk/ellenial-weather)";
const TIMEOUT_MS = 8000;

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { HOUR, getJson };
