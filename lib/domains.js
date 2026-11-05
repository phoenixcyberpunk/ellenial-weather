// Where a source runs its own model, and where it is really ECMWF underneath.
// MET Norway and SMHI both use MEPS (the Nordic model they run together in MetCoOp) over the Nordics
// and are built on ECMWF elsewhere.
// Open-Meteo's dmi_seamless uses DMI's HARMONIE model over northern and central Europe and fills the
// rest of the world with ECMWF. Outside those areas, counting them would make ECMWF vote two or three
// times, so agreement ("How sure") would look surer than it is. There they're left out and ECMWF
// counts once. The boxes are a little smaller than the real model areas, to stay on the safe side.

const OWN_MODEL_AREA = {
  met: { south: 54, north: 72, west: 0, east: 32 },   // MEPS: Nordics, Denmark, Baltics
  smhi: { south: 54, north: 72, west: 0, east: 32 },  // same MEPS area
  dmi: { south: 47, north: 66, west: -20, east: 30 }  // HARMONIE DINI: northern and central Europe
};

function runsOwnModel(id, lat, lon) {
  const a = OWN_MODEL_AREA[id];
  if (!a) return true; // every other source is its own model everywhere
  return lat >= a.south && lat <= a.north && lon >= a.west && lon <= a.east;
}

module.exports = { runsOwnModel, OWN_MODEL_AREA };
