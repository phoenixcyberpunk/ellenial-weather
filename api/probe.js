// TEMPORARY (phase 4 data check): which history sources answer, how far back, and how big.
// Remove before merging to main.
const { getJson } = require("../lib/sources/http");

const LAT = 57.71, LON = 11.97;
const TESTS = {
  era5: `https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LON}&start_date=1991-01-01&end_date=2025-12-31&daily=temperature_2m_min,temperature_2m_max,temperature_2m_mean,precipitation_sum,sunshine_duration,daylight_duration&timezone=Europe%2FStockholm`,
  era5land: `https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LON}&start_date=2015-01-01&end_date=2015-01-03&daily=temperature_2m_min&models=era5_land&timezone=Europe%2FStockholm`,
  archiveUv: `https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LON}&start_date=2020-06-01&end_date=2020-06-03&daily=uv_index_max&timezone=Europe%2FStockholm`,
  histForecastUv: `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&start_date=2021-01-01&end_date=2025-12-31&daily=uv_index_max,uv_index_clear_sky_max&timezone=Europe%2FStockholm`,
  airQualityUv: `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&start_date=2014-06-01&end_date=2014-06-02&hourly=uv_index`,
  smhiMinTemp: `https://opendata-download-metobs.smhi.se/api/version/1.0/parameter/19.json`,
  smhiSun: `https://opendata-download-metobs.smhi.se/api/version/1.0/parameter/10.json`
};

function km(a, b, c, d) { const r = Math.PI / 180, x = (d - b) * r * Math.cos((a + c) / 2 * r), y = (c - a) * r; return Math.sqrt(x * x + y * y) * 6371; }

module.exports = async (req, res) => {
  const out = {};
  await Promise.all(Object.entries(TESTS).map(async ([k, url]) => {
    const t = Date.now();
    try {
      const j = await getJson(url, { timeoutMs: 25000 });
      if (j.station) {
        out[k] = j.station.map((s) => ({ key: s.key, name: s.name, km: Math.round(km(LAT, LON, s.latitude, s.longitude)), from: new Date(s.from).toISOString().slice(0, 10), to: new Date(s.to).toISOString().slice(0, 10), active: s.active }))
          .filter((s) => s.km < 60).sort((a, b) => a.km - b.km);
      } else {
        const block = j.daily || j.hourly || {};
        const summary = {};
        for (const [name, arr] of Object.entries(block)) {
          if (!Array.isArray(arr)) continue;
          const vals = arr.filter((v) => v !== null);
          const firstIdx = arr.findIndex((v) => v !== null);
          summary[name] = { n: arr.length, nonNull: vals.length, firstNonNull: block.time ? block.time[firstIdx] : null, sample: arr.slice(0, 3) };
        }
        out[k] = { ok: true, ms: Date.now() - t, keys: Object.keys(j), summary, reason: j.reason };
      }
    } catch (e) {
      out[k] = { ok: false, ms: Date.now() - t, error: String(e.message || e) };
    }
  }));
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(out, null, 1));
};
