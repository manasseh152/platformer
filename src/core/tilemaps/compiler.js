import { CELL_SIZE, GRID_SIZE } from '../constants.js';
import { defineScene } from '../../engine/scene/scene.js';
import { sceneObject } from '../../engine/scene/objects.js';
import { isAllowedCellSize, layerCellSize, layerObjectSize, EMPTY } from './layers.js';
import { normalizeTerrain } from './terrain-model.js';
import { buildContainedTerrainCollisionLayers } from './collision.js';
import { buildContainedTerrainTiles } from './render-artifacts.js';

const DEFAULT_ART_TILE_SIZE = CELL_SIZE.BUILD;
const TERRAIN_RENDER_MODE = 'contained-autotile';
const DEFAULT_THEME = 'contained-terrain:grass';

function objectFromCell(scene, layer, symbol, definition, col, row) {
  const cellSize = layerCellSize(scene, layer);
  const objectSize = layerObjectSize(scene, layer);
  return sceneObject({
    id: `${layer.id}:${col},${row}`,
    layerId: layer.id,
    symbol,
    definitionId: definition.id,
    transform: { col, row, cellSize, objectSize, x: col * cellSize, y: (row + 1) * cellSize - objectSize, w: objectSize, h: objectSize },
    components: definition.components
  });
}

export function withTilemapMeta(parsedScene, meta) { return Object.assign(parsedScene, meta); }

function validateTerrainDefinition(definition) {
  if (definition.terrainRenderMode !== undefined && definition.terrainRenderMode !== TERRAIN_RENDER_MODE) {
    throw new Error(`terrainRenderMode must be ${TERRAIN_RENDER_MODE}`);
  }
  for (const layer of definition.layers) {
    if (layer.id === 'buildTerrain') throw new Error('buildTerrain layer is archived; use terrainLayer');
  }
  const terrainLayers = definition.layers.filter(layer => layer.id === 'terrain');
  if (terrainLayers.length !== 1) throw new Error('defineTilemap requires exactly one terrain layer');
  for (const layer of definition.layers) {
    if (layer.id === 'terrain' && layer.type !== 'terrain') throw new Error('terrain layer must be created with terrainLayer');
    if (layer.type === 'terrain' && layer.id !== 'terrain') throw new Error('terrain layer id must be terrain');
    if (layer.type === 'terrain' && layer.cellSize !== CELL_SIZE.BUILD) throw new Error('terrain layer must use CELL_SIZE.BUILD');
  }
}

export function defineTilemap(definition) {
  const tileSize = GRID_SIZE;
  const artTileSize = definition.artTileSize ?? DEFAULT_ART_TILE_SIZE;
  const artTilesPerTile = tileSize / artTileSize;
  if (!Number.isInteger(artTilesPerTile)) throw new Error(`gridSize ${tileSize} must be an integer multiple of artTileSize ${artTileSize}`);
  if (!Number.isInteger(definition.cols) || definition.cols < 1) throw new Error('defineTilemap requires positive integer cols');
  if (!Number.isInteger(definition.rows) || definition.rows < 1) throw new Error('defineTilemap requires positive integer rows');
  if (!Array.isArray(definition.layers) || definition.layers.length === 0) throw new Error('defineTilemap requires layers');
  validateTerrainDefinition(definition);

  const cols = definition.cols;
  const rows = definition.rows;
  for (const layer of definition.layers) {
    const cellSize = layer.cellSize ?? CELL_SIZE.GRID;
    const objectSize = layer.objectSize ?? (layer.id === 'entities' ? tileSize : cellSize);
    if (!isAllowedCellSize(cellSize)) throw new Error(`${layer.id} layer has unsupported cellSize ${cellSize}`);
    if (!isAllowedCellSize(objectSize)) throw new Error(`${layer.id} layer has unsupported objectSize ${objectSize}`);
    if (!Number.isInteger(tileSize / cellSize)) throw new Error(`${layer.id} layer cellSize ${cellSize} must divide gridSize ${tileSize}`);
    const cellsPerGrid = tileSize / cellSize;
    const expectedRows = rows * cellsPerGrid;
    const expectedCols = cols * cellsPerGrid;
    if (layer.rows.length !== expectedRows) throw new Error(`${layer.id} layer must contain ${expectedRows} rows`);
    layer.rows.forEach((row, index) => { if (row.length !== expectedCols) throw new Error(`${layer.id} layer row ${index} must be ${expectedCols} cells wide`); });
  }

  const scene = {
    ...definition,
    id: definition.id ?? 'anonymous-tilemap',
    kind: definition.kind ?? 'tilemap',
    tileSize,
    gridSize: GRID_SIZE,
    artTileSize,
    artTilesPerTile,
    terrainRenderMode: TERRAIN_RENDER_MODE,
    theme: definition.theme ?? DEFAULT_THEME,
    cols,
    rows,
    worldWidth: cols * tileSize,
    worldHeight: rows * tileSize,
    layers: definition.layers.map(layer => ({
      ...layer,
      cellSize: layer.cellSize ?? CELL_SIZE.GRID,
      ...(layer.objectSize === undefined && layer.id !== 'entities' ? {} : { objectSize: layer.objectSize ?? tileSize }),
      rows: [...layer.rows],
      symbols: { ...layer.symbols }
    }))
  };

  const objects = [];
  for (const layer of scene.layers) {
    if (layer.type === 'terrain') continue;
    layer.rows.forEach((line, row) => [...line].forEach((symbol, col) => {
      if (symbol === EMPTY) return;
      objects.push(objectFromCell(scene, layer, symbol, layer.symbols[symbol], col, row));
    }));
  }
  Object.assign(scene, defineScene({ ...scene, objects: [...objects, ...(definition.objects ?? [])] }));

  scene.terrain = normalizeTerrain(scene);
  scene.collisionLayers = buildContainedTerrainCollisionLayers(scene);
  scene.renderLayers = { containedTerrainTiles: buildContainedTerrainTiles(scene) };
  scene.tiles = Object.fromEntries(scene.layers.map(layer => [`${layer.id}Rows`, layer.rows]));
  return scene;
}
