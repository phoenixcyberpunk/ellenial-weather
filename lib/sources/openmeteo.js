// Open-Meteo forecast API, several independent models in one request. Data CC BY 4.0.
// The free API is for non-commercial use (under ~10,000 calls a day): confirm before public launch.
// Hourly up to 16 days. Rain at time T is the amount over the hour ENDING at T.
// Left out on purpose: metno_seamless (same model as MET Norway) and ecmwf_ifs025 (same as ecmwf_ifs).

const { HOUR, getJson } = require("./http");

const MODELS = [
  { model: "ecmwf_ifs", id: "ecmwf", name: "ECMWF" },
  { model: "icon_seamless", id: "icon", name: "DWD ICON" },
  { model: "dmi_seamless", id: "dmi", name: "DMI" },
  { model: "gfs_seamless", id: "gfs", name: "NOAA GFS" }
];

async function openMeteo(lat, lon) {
  const url = "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    "&hourly=temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,cloud_cover" +
    `&models=${MODELS.map((m) => m.model).join(",")}` +
    "&wind_speed_unit=ms&timeformat=unixtime&timezone=auto&past_days=1&forecast_days=16";
  const json = await getJson(url);
  const h = json.hourly || {};
  const times = (h.time || []).map((s) => s * 1000);

  const results = MODELS.map(({ model, id, name }) => {
    const col = (k) => h[`${k}_${model}`] || [];
    const temp = col("temperature_2m"), mm = col("precipitation"), wind = col("wind_speed_10m"),
      gust = col("wind_gusts_10m"), cloud = col("cloud_cover");
    const hours = [];
    times.forEach((t, i) => {
      if (temp[i] === null || temp[i] === undefined) return;
      hours.push({ t, temp: temp[i], wind: wind[i] ?? null, gust: gust[i] ?? null, cloud: cloud[i] ?? null });
      if (mm[i] !== null && mm[i] !== undefined) hours.push({ t: t - HOUR, mm: mm[i] });
    });
    return { id, name, hours };
  });

  return { timezone: json.timezone || null, models: results };
}

module.exports = openMeteo;
