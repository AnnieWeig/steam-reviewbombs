/** Shared constants, mutable state object, and color helpers. */

export const MAX_BAR_HEIGHT = 5;

export const COLORS_NORMAL     = [0x00dd00, 0x00aaff, 0xffaa00, 0xff00aa];
export const COLORS_EA         = [0x88dd88, 0x88ccff, 0xffdd88, 0xff88cc];
export const COLORS_NORMAL_HEX = ["#00dd00", "#00aaff", "#ffaa00", "#ff00aa"];
export const COLORS_EA_HEX     = ["#88dd88", "#88ccff", "#ffdd88", "#ff88cc"];

export function getBarColor(keyIndex, earlyAccess, reviewBombed) {
  if (reviewBombed) return 0xff2200;
  return earlyAccess
    ? COLORS_EA[keyIndex % 4]
    : COLORS_NORMAL[keyIndex % 4];
}

export function getBarColorHex(keyIndex, earlyAccess, reviewBombed) {
  if (reviewBombed) return "#ff2200";
  return earlyAccess
    ? COLORS_EA_HEX[keyIndex % 4]
    : COLORS_NORMAL_HEX[keyIndex % 4];
}

/**
 * Single mutable state object — import this anywhere you need
 * to read or write shared runtime data.
 */
export const state = {
  rowGroups:        [],   // THREE.Group per dataset row
  allBars:          [],   // { mesh, date, group, reviewBombed, earlyAccess, wordClouds, gameName, values }
  loadedJsons:      [],   // raw JSON objects, kept for A-Frame rebuild
  globalChartT0:    0,    // earliest timestamp across all datasets
  globalChartScale: 1,    // world-units per review count
  globalTotalWidth: 0,    // X extent of the widest dataset
};