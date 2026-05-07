export const TERRAIN_MASK = Object.freeze({
  N: 1,
  NE: 2,
  E: 4,
  SE: 8,
  S: 16,
  SW: 32,
  W: 64,
  NW: 128
});

const { N, NE, E, SE, S, SW, W, NW } = TERRAIN_MASK;
const CARDINAL_MASK = N | E | S | W;

function has(mask, bit) { return (mask & bit) !== 0; }

export function normalizeTerrainMask(rawMask) {
  let mask = rawMask & CARDINAL_MASK;
  if (has(rawMask, NE) && has(mask, N) && has(mask, E)) mask |= NE;
  if (has(rawMask, SE) && has(mask, S) && has(mask, E)) mask |= SE;
  if (has(rawMask, SW) && has(mask, S) && has(mask, W)) mask |= SW;
  if (has(rawMask, NW) && has(mask, N) && has(mask, W)) mask |= NW;
  return mask;
}
