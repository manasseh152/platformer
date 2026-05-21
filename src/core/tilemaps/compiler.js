import { CELL_SIZE, GRID_SIZE } from '../constants.js';
import { defineScene } from '../../engine/scene/scene.js';
import { sceneObject } from '../../engine/scene/objects.js';
import { brushGridLayer, isAllowedCellSize, layerCellSize, layerObjectSize, EMPTY, placedAssetsLayer } from './layers.js';
import { normalizeTerrain, normalizeSolid } from './terrain-model.js';
import { buildContainedTerrainCollisionLayers } from './collision.js';
import { buildContainedTerrainTiles } from './render-artifacts.js';
import { BRUSH_TRAIT, defineBrush, hazardTrait, solidTrait, visualTrait, brushTrait, indexDefinitions } from './brushes.js';
import { TERRAIN_KIND, TERRAIN_KINDS, brushIdToTerrainKind, terrainKindConfig, terrainKindToBrushId } from './terrain-layer.js';

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

function terrainBrushes() {
  return Object.values(TERRAIN_KIND).map(kind => defineBrush({
    id: terrainKindToBrushId(kind),
    label: kind,
    traits: [
      ...(terrainKindConfig(kind)?.solid ? [solidTrait()] : []),
      ...(terrainKindConfig(kind)?.visible ? [visualTrait({ renderer: 'contained-autotile', material: kind })] : [])
    ]
  })).concat([
    defineBrush({ id: 'spike-floor', label: 'Floor Spike', traits: [visualTrait({ renderer: 'sprite', assetId: 'spikes' }), hazardTrait({ kind: 'spike', contact: 'defeat', inset: { left: 2, right: 2, top: 2, bottom: 0 } })] })
  ]);
}

function defaultMaterials() {
  return Object.entries(TERRAIN_KINDS).filter(([, config]) => config.visual).map(([id, config]) => ({ id, containedAutotile: { connectsTo: config.connectsTo, ...config.visual } }));
}

function normalizeLayer(layer) {
  if (layer.id === 'buildTerrain') throw new Error('buildTerrain layer is archived; use solidLayer');
  if (layer.type === 'terrain' || layer.id === 'terrain') {
    if (layer.type !== 'terrain') throw new Error('terrain layer must be created with terrainLayer');
    return { ...brushGridLayer({ id: 'solid', cellSize: layer.cellSize ?? CELL_SIZE.BUILD, accepts: ['visual', 'solid'], z: 0, rows: layer.rows.map(row => row.map(terrainKindToBrushId)) }), legacyId: 'terrain' };
  }
  if (layer.id === 'entities') return { ...layer, type: 'placed-assets', objectSize: layer.objectSize ?? GRID_SIZE, rows: [...layer.rows], symbols: { ...layer.symbols } };
  if (layer.type === 'grid') return { ...layer, rows: [...layer.rows], symbols: { ...layer.symbols } };
  if (layer.type === 'placed-assets') return { ...layer, rows: [...layer.rows], symbols: { ...layer.symbols } };
  if (layer.type === 'brush-grid') return { ...layer, accepts: [...(layer.accepts ?? [])], rows: layer.rows.map(row => [...row]) };
  return { ...layer, rows: layer.rows?.map(row => Array.isArray(row) ? [...row] : row) };
}

function validateDefinition(definition) {
  if (definition.terrainRenderMode !== undefined && definition.terrainRenderMode !== TERRAIN_RENDER_MODE) throw new Error(`terrainRenderMode must be ${TERRAIN_RENDER_MODE}`);
  if (definition.layers.some(layer => layer.id === 'buildTerrain')) throw new Error('buildTerrain layer is archived; use solidLayer');
  if (!definition.layers.some(layer => layer.type === 'terrain' || layer.id === 'terrain' || layer.id === 'solid')) throw new Error('defineTilemap requires a solid layer');
}

function validateLayerDimensions(scene, layer) {
  const cellSize = layer.cellSize ?? CELL_SIZE.GRID;
  const objectSize = layer.objectSize ?? (layer.id === 'placedAssets' || layer.id === 'entities' ? scene.tileSize : cellSize);
  if (!isAllowedCellSize(cellSize)) throw new Error(`${layer.id} layer has unsupported cellSize ${cellSize}`);
  if (objectSize !== undefined && !isAllowedCellSize(objectSize)) throw new Error(`${layer.id} layer has unsupported objectSize ${objectSize}`);
  if (!Number.isInteger(scene.tileSize / cellSize)) throw new Error(`${layer.id} layer cellSize ${cellSize} must divide gridSize ${scene.tileSize}`);
  const cellsPerGrid = scene.tileSize / cellSize;
  const expectedRows = scene.rows * cellsPerGrid;
  const expectedCols = scene.cols * cellsPerGrid;
  const label = layer.legacyId ?? layer.id;
  if (layer.rows.length !== expectedRows) throw new Error(`${label} layer must contain ${expectedRows} rows`);
  layer.rows.forEach((row, index) => { if (row.length !== expectedCols) throw new Error(`${label} layer row ${index} must be ${expectedCols} cells wide`); });
}

function compileBrushTiles(scene, brushById) {
  const compiledTiles = [];
  const compiledTileLayers = {};
  for (const layer of scene.layers.filter(layer => layer.type === 'brush-grid')) {
    const cellSize = layer.cellSize;
    const tiles = [];
    layer.rows.forEach((rowCells, row) => rowCells.forEach((brushId, col) => {
      if (brushId === null) return;
      const brush = brushById.get(brushId);
      if (!brush) throw new Error(`${scene.id} references unknown brush '${brushId}' in ${layer.id} at ${col},${row}`);
      const traitTypes = brush.traits.map(trait => trait.type);
      const unsupported = traitTypes.filter(type => !(layer.accepts ?? []).includes(type));
      if (unsupported.length) throw new Error(`${layer.id} layer does not accept ${unsupported.join(', ')} brush traits from '${brushId}'`);
      const tile = { id: `${layer.id}:${col},${row}`, layerId: layer.id, brushId, brush, col, row, x: col * cellSize, y: row * cellSize, w: cellSize, h: cellSize, traits: brush.traits };
      tiles.push(tile);
      compiledTiles.push(tile);
    }));
    compiledTileLayers[layer.id] = { id: layer.id, cellSize, z: layer.z ?? 0, accepts: [...(layer.accepts ?? [])], tiles };
  }
  return { compiledTiles, compiledTileLayers };
}

function compileHazardTiles(compiledTiles) {
  return compiledTiles.flatMap(tile => tile.traits.filter(trait => trait.type === BRUSH_TRAIT.HAZARD).map(hazard => ({ ...tile, hazard })));
}

export function defineTilemap(definition) {
  const tileSize = GRID_SIZE;
  const artTileSize = definition.artTileSize ?? DEFAULT_ART_TILE_SIZE;
  const artTilesPerTile = tileSize / artTileSize;
  if (!Number.isInteger(artTilesPerTile)) throw new Error(`gridSize ${tileSize} must be an integer multiple of artTileSize ${artTileSize}`);
  if (!Number.isInteger(definition.cols) || definition.cols < 1) throw new Error('defineTilemap requires positive integer cols');
  if (!Number.isInteger(definition.rows) || definition.rows < 1) throw new Error('defineTilemap requires positive integer rows');
  if (!Array.isArray(definition.layers) || definition.layers.length === 0) throw new Error('defineTilemap requires layers');
  validateDefinition(definition);

  const brushById = indexDefinitions([...terrainBrushes(), ...(definition.brushes ?? [])]);
  const materialsById = new Map([...defaultMaterials(), ...(definition.materials ?? [])].map(material => [material.id, material]));
  const layers = definition.layers.map(normalizeLayer);
  const cols = definition.cols;
  const rows = definition.rows;
  const sceneBase = { tileSize, cols, rows };
  for (const layer of layers) validateLayerDimensions(sceneBase, layer);

  const scene = {
    ...definition,
    schemaVersion: definition.schemaVersion ?? 2,
    id: definition.id ?? 'anonymous-tilemap',
    kind: definition.kind ?? 'tilemap',
    tileSize,
    gridSize: GRID_SIZE,
    artTileSize,
    artTilesPerTile,
    terrainRenderMode: definition.terrainRenderMode ?? TERRAIN_RENDER_MODE,
    theme: definition.theme ?? DEFAULT_THEME,
    cols,
    rows,
    worldWidth: cols * tileSize,
    worldHeight: rows * tileSize,
    layers,
    brushes: [...brushById.values()],
    materials: [...materialsById.values()],
    brushById,
    materialsById
  };

  const { compiledTiles, compiledTileLayers } = compileBrushTiles(scene, brushById);
  scene.compiledTiles = compiledTiles;
  scene.compiledTileLayers = compiledTileLayers;
  scene.hazardTiles = compileHazardTiles(compiledTiles);

  const objects = [];
  for (const layer of scene.layers) {
    if (layer.type === 'brush-grid') continue;
    layer.rows.forEach((line, row) => [...line].forEach((symbol, col) => {
      if (symbol === EMPTY) return;
      objects.push(objectFromCell(scene, layer, symbol, layer.symbols[symbol], col, row));
    }));
  }
  Object.assign(scene, defineScene({ ...scene, objects: [...objects, ...(definition.objects ?? [])] }));

  scene.solid = normalizeSolid(scene);
  scene.terrain = normalizeTerrain(scene); // compatibility alias
  scene.collisionLayers = buildContainedTerrainCollisionLayers(scene);
  scene.renderLayers = { containedTerrainTiles: buildContainedTerrainTiles(scene) };
  scene.tiles = Object.fromEntries(scene.layers.map(layer => [`${layer.id}Rows`, layer.rows]));
  return scene;
}
