// SMHI Open Data, snow1g point forecast. CC BY 4.0: credit SMHI, say the data is processed.
// Docs: https://opendata.smhi.se/metfcst/snow1gv1
// Hourly steps for about 2.5 days, then 6- and 12-hourly. Cloud is in eighths (octas).
// Missing values are 9999.

const { HOUR, getJson } = require("./http");

const MISSING = 9999;
const v = (x) => (x === undefined || x === null || x === MISSING ? null : x);

async function smhi(lat, lon) {
  const url = `https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/${lon.toFixed(4)}/lat/${lat.toFixed(4)}/data.json`;
  const json = await getJson(url);
  const hours = [];
  for (const step of json.timeSeries || []) {
    const d = step.data || {};
    const t = Date.parse(step.time);
    const start = step.intervalParametersStartTime ? Date.parse(step.intervalParametersStartTime) : null;
    const hourly = start !== null && t - start === HOUR;
    const cloud = v(d.cloud_area_fraction);
    // Instant values belong to the hour starting at `time`.
    hours.push({ t, temp: v(d.air_temperature), wind: v(d.wind_speed), gust: v(d.wind_speed_of_gust), cloud: cloud === null ? null : cloud * 12.5 });
    // Rain is the amount over the interval that ends at `time`; only use one-hour intervals.
    if (hourly) hours.push({ t: start, mm: v(d.precipitation_amount_mean) });
  }
  return { id: "smhi", name: "SMHI", hours };
}

module.exports = smhi;
