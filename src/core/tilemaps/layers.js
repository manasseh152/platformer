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

export function brushGridLayer({ id, cellSize = CELL_SIZE.BUILD, accepts = [], z = 0, rows }) {
  if (!id) throw new Error('brushGridLayer requires an id');
  if (!isAllowedCellSize(cellSize)) throw new Error(`${id} layer has unsupported cellSize ${cellSize}`);
  if (!Array.isArray(accepts)) throw new Error(`${id} layer accepts must be an array`);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`${id} layer rows must contain at least one row`);
  const width = rows[0]?.length;
  if (!Number.isInteger(width) || width < 1) throw new Error(`${id} layer rows must contain at least one cell`);
  rows.forEach((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== width) throw new Error(`${id} layer row ${rowIndex} must be ${width} cells wide`);
    row.forEach((brushId, colIndex) => {
      if (brushId !== null && typeof brushId !== 'string') throw new Error(`${id} layer cell ${colIndex},${rowIndex} must be a brush id or null`);
    });
  });
  return { id, type: 'brush-grid', cellSize, accepts: [...accepts], z, rows: rows.map(row => [...row]) };
}

export function solidLayer({ id = 'solid', cellSize = CELL_SIZE.BUILD, rows }) {
  return brushGridLayer({ id, cellSize, accepts: ['visual', 'solid'], z: 0, rows });
}

export function placedAssetsLayer({ id = 'placedAssets', cellSize = CELL_SIZE.BUILD, objectSize = CELL_SIZE.GRID, symbols = {}, rows }) {
  return { ...gridLayer({ id, cellSize, objectSize, symbols, rows }), type: 'placed-assets' };
}

export function layerCellSize(scene, layer) { return layer.cellSize ?? scene.tileSize; }
export function layerObjectSize(scene, layer) { return layer.objectSize ?? (layer.id === 'entities' || layer.id === 'placedAssets' ? scene.tileSize : layerCellSize(scene, layer)); }
