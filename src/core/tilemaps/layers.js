import { CELL_SIZE } from '../constants.js';

export const EMPTY = '.';

export function isAllowedCellSize(cellSize) { return Object.values(CELL_SIZE).includes(cellSize); }

export function gridLayer({ id, cellSize = CELL_SIZE.GRID, objectSize, symbols = {}, rows, resolution }) {
  if (!id) throw new Error('gridLayer requires an id');
  if (resolution !== undefined) throw new Error(`${id} layer uses deprecated resolution; use cellSize from CELL_SIZE instead`);
  if (!isAllowedCellSize(cellSize)) throw new Error(`${id} layer has unsupported cellSize ${cellSize}`);
  if (objectSize !== undefined && !isAllowedCellSize(objectSize)) throw new Error(`${id} layer has unsupported objectSize ${objectSize}`);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`${id} layer rows must contain at least one row`);
  const width = rows[0].length;
  rows.forEach((row, rowIndex) => {
    if (typeof row !== 'string' || row.length !== width) throw new Error(`${id} layer row ${rowIndex} must be ${width} chars wide`);
    for (const symbol of row) if (symbol !== EMPTY && !symbols[symbol]) throw new Error(`${id} layer contains unknown symbol '${symbol}'`);
  });
  return { id, type: 'grid', cellSize, ...(objectSize === undefined ? {} : { objectSize }), symbols, rows: [...rows] };
}

export function layerCellSize(scene, layer) { return layer.cellSize ?? scene.tileSize; }
export function layerObjectSize(scene, layer) { return layer.objectSize ?? (layer.id === 'entities' ? scene.tileSize : layerCellSize(scene, layer)); }
