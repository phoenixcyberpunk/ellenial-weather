// Temporary: fetches a small sample from each source so the real response shapes can be checked.
// Removed before phase 2 is merged.
const UA = "EllenialWeather/0.1 github.com/phoenixcyberpunk/ellenial-weather";
const LAT = 57.7089, LON = 11.9746; // Gothenburg

async function grab(name, url, headers) {
  try {
    const r = await fetch(url, { headers: Object.assign({ "User-Agent": UA }, headers || {}) });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) {}
    return { name, url, status: r.status, json, text: json ? undefined : text.slice(0, 600) };
  } catch (e) {
    return { name, url, error: String(e) };
  }
}

module.exports = async (req, res) => {
  const out = {};
  const smhi = await grab("smhi", `https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/${LON}/lat/${LAT}/data.json`);
  if (smhi.json) {
    const ts = smhi.json.timeSeries || [];
    smhi.topKeys = Object.keys(smhi.json);
    smhi.meta = Object.assign({}, smhi.json, { timeSeries: undefined });
    smhi.count = ts.length;
    smhi.sample = [ts[0], ts[1], ts[30], ts[50], ts[ts.length - 1]];
    smhi.times = ts.map((t) => t.time);
    delete smhi.json;
  }
  out.smhi = smhi;

  const met = await grab("met", `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${LAT}&lon=${LON}`);
  if (met.json) {
    const ts = met.json.properties.timeseries;
    met.meta = met.json.properties.meta;
    met.count = ts.length;
    met.sample = [ts[0], ts[1], ts[ts.length - 1]];
    delete met.json;
  }
  out.met = met;

  const models = ["ecmwf_ifs025", "icon_seamless", "dmi_seamless", "gfs_seamless", "metno_seamless", "ecmwf_ifs"];
  const om = await grab("openmeteo", `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&hourly=temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,weather_code,cloud_cover&models=${models.join(",")}&wind_speed_unit=ms&timezone=UTC&forecast_days=16`);
  if (om.json) {
    om.keys = Object.keys(om.json.hourly || {});
    om.reason = om.json.reason;
    om.count = (om.json.hourly && om.json.hourly.time || []).length;
    om.firstValues = {};
    om.lastNonNull = {};
    for (const k of om.keys) {
      const arr = om.json.hourly[k];
      om.firstValues[k] = arr.slice(0, 3);
      let last = -1; arr.forEach((v, i) => { if (v !== null) last = i; });
      om.lastNonNull[k] = last;
    }
    delete om.json;
  }
  out.openmeteo = om;

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(out, null, 1));
};
