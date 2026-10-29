# Ellenial Weather

A free weather page from [Ellenial](https://ellenial.app): **weather.ellenial.app**.

- **Forecast** opens first. Today's weather is the main feature: right now, today hour by hour, and the rain line. Below it, Mon–Sun tables for this week, next week and the week after. Past days show what was actually measured.
- **What usually happens** gives odds from past weather: frost dates, sunny days, UV, and how the climate is changing. Odds, never predictions.

Several independent forecasts are combined into one reading, with a "How sure" row showing how much they agree.

## Principles

Free. No ads, no trackers, no accounts, no cookies. No third-party requests from the page (fonts are hosted here). The chosen place stays in your browser. Open source.

## Data

| Source | Used for | Licence |
| --- | --- | --- |
| [SMHI Open Data](https://www.smhi.se/en/services/open-data) | Swedish forecast (snow1g), measured past days, station history | CC BY 4.0 |
| [MET Norway](https://api.met.no/) | One forecast | CC BY 4.0 / NLOD |
| [Open-Meteo](https://open-meteo.com/) | Several models (ECMWF, DWD ICON, DMI, NOAA GFS), history archive, UV | CC BY 4.0 data; free API is non-commercial |

Data is processed and combined by Ellenial.

## How it's built

A static page (`index.html`, `styles.css`, `app.js`), no build step. Small serverless functions in `api/` on Vercel fetch and combine the forecasts:

- `/api/forecast` — combined forecast per hour, cached 30–60 min
- `/api/observed` — measured past days from the nearest SMHI station
- `/api/history` — frost odds, sunny days, UV and then-vs-now, cached for weeks

Each source is its own small module in `lib/sources/`, so a broken source drops out instead of breaking the page. Six forecasts today: SMHI, MET Norway, ECMWF, DWD ICON, DMI and NOAA GFS (Open-Meteo's MET Norway copy and second ECMWF are left out so no model counts twice).

How sure: 3 dots when the forecasts are within 2° of each other and at least 80% agree on rain or no rain; 2 dots within 4° and 60%; otherwise 1. Never more than 2 dots with fewer than 3 forecasts.

Tests: `node --test`.

## Build plan

1. Skeleton: repo, Vercel project, domain, both views, credits ← *done*
2. Forecast for Gothenburg: right now, today hour by hour, rain line ← *done*
3. Week tables with measured past days
4. What usually happens
5. Place search
6. Friends test, then decide on release

## Fonts

[Fraunces](https://github.com/undercasetype/Fraunces) and [DM Sans](https://github.com/googlefonts/dm-fonts), SIL Open Font License 1.1 (licences in `fonts/`).

## Licence

AGPL-3.0, same as the [Ellenial site](https://github.com/phoenixcyberpunk/ellenial). See `LICENSE`.
