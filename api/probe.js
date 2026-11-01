// TEMPORARY (phase 4): SMHI daily rain stations and the hourly sunshine archive format. Remove before main.
const UA = "EllenialWeather/0.2 (+https://github.com/phoenixcyberpunk/ellenial-weather)";
const B = "https://opendata-download-metobs.smhi.se/api/version/1.0/parameter/";
function km(a, b, c, d) { const r = Math.PI / 180, x = (d - b) * r * Math.cos((a + c) / 2 * r), y = (c - a) * r; return Math.sqrt(x * x + y * y) * 6371; }
async function peek(url) {
  const t = Date.now(); const r = await fetch(url, { headers: { "User-Agent": UA } }); const text = await r.text();
  const lines = text.split(/\r?\n/);
  return { status: r.status, ms: Date.now() - t, bytes: text.length, lines: lines.length, head: lines.slice(0, 12), mid: lines.slice(5000, 5004), tail: lines.slice(-3) };
}
module.exports = async (req, res) => {
  const [rainList, sun] = await Promise.all([
    fetch(B + "5.json", { headers: { "User-Agent": UA } }).then((r) => r.json()),
    peek(B + "10/station/71415/period/corrected-archive/data.csv")
  ]);
  const rain = rainList.station.map((s) => ({ key: s.key, name: s.name, km: Math.round(km(57.7, 12, s.latitude, s.longitude)), from: new Date(s.from).toISOString().slice(0, 10), active: s.active }))
    .filter((s) => s.km < 25 && s.active).sort((a, b) => a.km - b.km);
  const rain71420 = await peek(B + "5/station/71420/period/corrected-archive/data.csv").catch((e) => String(e));
  res.setHeader("Content-Type", "application/json"); res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ rain, rain71420: { ...rain71420, mid: undefined }, sun }, null, 1));
};
