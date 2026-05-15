import { CELL_SIZE } from '#/core/constants.js';
import { defineObject, finishGateObject, playerSpawner, slimeSpawner, spikeHazard } from '#/content/tilemaps/objects.js';
import { defineTilemap, gridLayer } from '#/core/tilemaps/tilemap.js';
import { TERRAIN_KIND, terrainLayer } from '#/core/tilemaps/terrain-layer.js';

const EMPTY = '.';
const solidSymbols = new Set(['#', '=', 'B']);

const marker = id => defineObject({ id, components: [] });

const BACKDROP_SYMBOLS = { a: marker('backdrop-a'), k: marker('backdrop-k'), c: marker('backdrop-c'), d: marker('backdrop-d') };
const DECOR_SYMBOLS = { r: marker('decor-r'), g: marker('decor-g'), f: marker('decor-f'), t: marker('decor-t') };
const ENTITY_SYMBOLS = { P: playerSpawner, E: slimeSpawner, G: finishGateObject, '<': finishGateObject, '>': finishGateObject };

function blankRows(cols, rows) { return Array.from({ length: rows }, () => EMPTY.repeat(cols)); }
function assertRows(rows, name, expectedRows = rows.length, expectedCols = rows[0]?.length) {
  if (!Array.isArray(rows) || rows.length !== expectedRows) throw new Error(`${name} must contain ${expectedRows} rows`);
  rows.forEach((row, index) => {
    if (typeof row !== 'string' || row.length !== expectedCols) throw new Error(`${name} row ${index} must be ${expectedCols} chars wide`);
  });
}
function buildRowsFromTerrainRows(terrainRows) {
  return terrainRows.flatMap(row => {
    const buildRow = [...row].flatMap(ch => {
      if (solidSymbols.has(ch)) return [TERRAIN_KIND.GRASS, TERRAIN_KIND.GRASS];
      return [null, null];
    });
    return [buildRow, [...buildRow]];
  });
}
function hazardRowsFromTerrainRows(terrainRows) {
  return terrainRows.flatMap(row => {
    const buildRow = [...row].flatMap(ch => ch === '^' ? ['^', EMPTY] : [EMPTY, EMPTY]).join('');
    return [buildRow, EMPTY.repeat(buildRow.length)];
  });
}

export function defineContainedTestTilemap({ id = 'contained-test-tilemap', terrainRows, objectRows, decorRows, backdropRows }) {
  assertRows(terrainRows, 'terrainRows');
  const rows = terrainRows.length;
  const cols = terrainRows[0].length;
  objectRows ??= blankRows(cols, rows);
  decorRows ??= blankRows(cols, rows);
  backdropRows ??= blankRows(cols, rows);
  assertRows(objectRows, 'objectRows', rows, cols);
  assertRows(decorRows, 'decorRows', rows, cols);
  assertRows(backdropRows, 'backdropRows', rows, cols);

  return defineTilemap({
    id,
    cols,
    rows,
    terrainRenderMode: 'contained-autotile',
    layers: [
      gridLayer({ id: 'backdrop', cellSize: CELL_SIZE.GRID, symbols: BACKDROP_SYMBOLS, rows: backdropRows }),
      terrainLayer({ cellSize: CELL_SIZE.BUILD, rows: buildRowsFromTerrainRows(terrainRows) }),
      gridLayer({ id: 'entities', cellSize: CELL_SIZE.GRID, symbols: ENTITY_SYMBOLS, rows: objectRows }),
      gridLayer({ id: 'decor', cellSize: CELL_SIZE.GRID, symbols: DECOR_SYMBOLS, rows: decorRows }),
      gridLayer({ id: 'hazards', cellSize: CELL_SIZE.BUILD, symbols: { '^': spikeHazard }, rows: hazardRowsFromTerrainRows(terrainRows) })
    ]
  });
}
