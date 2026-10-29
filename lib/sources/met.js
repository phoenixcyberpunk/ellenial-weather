// MET Norway (Yr) Locationforecast 2.0 compact. CC BY 4.0 / NLOD.
// Terms: identifying User-Agent, at most 4 decimals in coordinates, cache responses.
// Hourly for about 2.5 days, then 6-hourly.

const { getJson } = require("./http");

async function met(lat, lon) {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
  const json = await getJson(url);
  const hours = [];
  for (const step of (json.properties && json.properties.timeseries) || []) {
    const t = Date.parse(step.time);
    const now = (step.data.instant && step.data.instant.details) || {};
    const next1 = step.data.next_1_hours;
    hours.push({
      t,
      temp: now.air_temperature ?? null,
      wind: now.wind_speed ?? null,
      cloud: now.cloud_area_fraction ?? null,
      // Rain for the hour starting at `time`; only present while steps are hourly.
      mm: next1 && next1.details ? next1.details.precipitation_amount ?? null : null
    });
  }
  return { id: "met", name: "MET Norway", hours };
}

module.exports = met;
