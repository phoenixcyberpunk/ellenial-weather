// Temporary: checks SMHI's measurement API (metobs). Removed before merging.
const LAT = 57.71, LON = 11.97;
const UA = "EllenialWeather/0.3 (+https://github.com/phoenixcyberpunk/ellenial-weather)";
const BASE = "https://opendata-download-metobs.smhi.se/api/version/1.0";
const km = (a, b, c, d) => { const r = Math.PI / 180, x = (d - b) * r * Math.cos(((a + c) / 2) * r), y = (c - a) * r; return Math.sqrt(x * x + y * y) * 6371; };
async function j(url) { const r = await fetch(url, { headers: { "User-Agent": UA } }); if (!r.ok) throw new Error(r.status + " " + url); return r.json(); }
module.exports = async (req, res) => {
  const out = {};
  for (const p of [1, 4, 7, 16, 19, 20, 5]) {
    try {
      const meta = await j(`${BASE}/parameter/${p}.json`);
      const st = (meta.station || []).filter((s) => s.active).map((s) => ({ id: s.id || s.key, key: s.key, name: s.name, km: Math.round(km(LAT, LON, s.latitude, s.longitude) * 10) / 10, to: s.to }))
        .sort((a, b) => a.km - b.km).slice(0, 3);
      const info = { title: meta.title, summary: meta.summary, unit: meta.unit, nearest: st };
      try {
        const data = await j(`${BASE}/parameter/${p}/station/${st[0].key}/period/latest-months/data.json`);
        const v = data.value || [];
        info.count = v.length; info.first = v[0]; info.last3 = v.slice(-3);
        info.keys = Object.keys(data); info.period = data.period; info.position = data.position && data.position[0];
      } catch (e) { info.dataError = String(e); }
      out[p] = info;
    } catch (e) { out[p] = { error: String(e) }; }
  }
  res.setHeader("Content-Type", "application/json"); res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(out, null, 1));
};
