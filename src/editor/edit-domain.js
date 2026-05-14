import { CELL_SIZE } from '../core/constants.js';
import { TERRAIN_KIND } from '../core/tilemaps/terrain-layer.js';
import { EMPTY } from './tilemap-draft.js';

export const EDIT_LAYERS = Object.freeze([
  {
    id: 'terrain',
    label: 'Terrain',
    description: 'Solid authored ground',
    gridLabel: '16 px build grid',
    cellSize: CELL_SIZE.BUILD,
    packTitle: 'Starter asset pack',
    hint: 'LB/RB changes terrain while the panel is hidden. A paints the selected cell.'
  },
  {
    id: 'entities',
    label: 'Entities',
    description: 'Gameplay objects',
    gridLabel: '32 px gameplay grid',
    cellSize: CELL_SIZE.GRID,
    packTitle: 'Starter asset pack',
    hint: 'Entity stamps snap to the gameplay grid. Hide the panel for controller placement.'
  },
  { id: 'lights', label: 'Lights', description: 'Mood and visibility', gridLabel: 'Gridless', disabled: true },
  { id: 'decor', label: 'Decor', description: 'Non-colliding dressing', gridLabel: '8 px / gridless', disabled: true }
]);

export const EDIT_PACKS = Object.freeze([
  {
    id: 'starter',
    label: 'Starter',
    description: 'Core terrain materials, spawn points, and hazards',
    brushIds: ['grass', 'dirt', 'stone', 'invisibleTerrain', 'eraseTerrain', 'player', 'slime', 'gate', 'eraseEntity']
  }
]);

export const BRUSHES = Object.freeze([
  { id: 'grass', label: 'Grass', shortLabel: 'Grass', layerId: 'terrain', symbol: TERRAIN_KIND.GRASS, cellSize: CELL_SIZE.BUILD, cursor: '#79f0c5', swatch: '#79f0c5' },
  { id: 'dirt', label: 'Dirt', shortLabel: 'Dirt', layerId: 'terrain', symbol: TERRAIN_KIND.DIRT, cellSize: CELL_SIZE.BUILD, cursor: '#b86f3d', swatch: '#b86f3d' },
  { id: 'stone', label: 'Stone', shortLabel: 'Stone', layerId: 'terrain', symbol: TERRAIN_KIND.STONE, cellSize: CELL_SIZE.BUILD, cursor: '#9aa7b2', swatch: '#9aa7b2' },
  { id: 'invisibleTerrain', label: 'Invisible', shortLabel: 'Ghost', layerId: 'terrain', symbol: TERRAIN_KIND.INVISIBLE, cellSize: CELL_SIZE.BUILD, cursor: '#a78bfa', swatch: '#a78bfa' },
  { id: 'eraseTerrain', label: 'Erase terrain', shortLabel: 'Erase', layerId: 'terrain', symbol: null, cellSize: CELL_SIZE.BUILD, cursor: '#ff8f8f', swatch: '#ff8f8f' },
  { id: 'player', label: 'Player P', shortLabel: 'Player', layerId: 'entities', symbol: 'P', cellSize: CELL_SIZE.GRID, cursor: '#78a8ff', swatch: '#78a8ff' },
  { id: 'slime', label: 'Slime E', shortLabel: 'Slime', layerId: 'entities', symbol: 'E', cellSize: CELL_SIZE.GRID, cursor: '#ff7bd5', swatch: '#ff7bd5' },
  { id: 'gate', label: 'Gate G', shortLabel: 'Gate', layerId: 'entities', symbol: 'G', cellSize: CELL_SIZE.GRID, cursor: '#ffd36a', swatch: '#ffd36a' },
  { id: 'eraseEntity', label: 'Erase entity', shortLabel: 'Erase', layerId: 'entities', symbol: EMPTY, cellSize: CELL_SIZE.GRID, cursor: '#ff8f8f', swatch: '#ff8f8f' }
]);

export function layerById(layerId) {
  return EDIT_LAYERS.find(layer => layer.id === layerId) ?? EDIT_LAYERS[0];
}

export function packsForLayer(layerId) {
  return EDIT_PACKS.filter(pack => pack.brushIds.map(brushById).some(brush => brush?.layerId === layerId));
}

export function defaultPackForLayer(layerId) {
  return packsForLayer(layerId)[0] ?? null;
}

export function brushById(brushId) {
  return BRUSHES.find(brush => brush.id === brushId) ?? null;
}

export function brushesForPack(packId) {
  const pack = EDIT_PACKS.find(candidate => candidate.id === packId);
  if (!pack) return [];
  return pack.brushIds.map(brushById).filter(Boolean);
}
