// Shared by the map outlines in indiaMapPaths.js and the markers drawn on top of them.
// These numbers must match the generator that produced indiaMapPaths.js.
const ORIGIN_LONGITUDE = 68;
const TOP_LATITUDE = 37.5;
const SCALE = 20;
const LONGITUDE_FACTOR = Math.cos((22 * Math.PI) / 180);

export const INDIA_MAP_SIZE = Object.freeze({ width: 549, height: 620 });

export function projectToIndiaMap(latitude, longitude) {
  return {
    x: (longitude - ORIGIN_LONGITUDE) * LONGITUDE_FACTOR * SCALE,
    y: (TOP_LATITUDE - latitude) * SCALE,
  };
}

// The outlines are about 130 KB, so they load only when a map is shown.
export function loadIndiaMapPaths() {
  return import("./indiaMapPaths.js");
}
