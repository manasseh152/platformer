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
    paletteTitle: 'Starter terrain palette',
    hint: 'LB/RB changes terrain while the panel is hidden. A paints the selected cell.'
  },
  {
    id: 'entities',
    label: 'Entities',
    description: 'Gameplay objects',
    gridLabel: '32 px gameplay grid',
    cellSize: CELL_SIZE.GRID,
    paletteTitle: 'Actor stamp palette',
    hint: 'Entity stamps snap to the gameplay grid. Hide the panel for controller placement.'
  },
  { id: 'lights', label: 'Lights', description: 'Mood and visibility', gridLabel: 'Gridless', disabled: true },
  { id: 'decor', label: 'Decor', description: 'Non-colliding dressing', gridLabel: '8 px / gridless', disabled: true }
]);

export const EDIT_PALETTES = Object.freeze([
  {
    id: 'starter-terrain',
    layerId: 'terrain',
    label: 'Starter terrain',
    description: 'Five core terrain materials',
    brushIds: ['grass', 'dirt', 'stone', 'invisibleTerrain', 'eraseTerrain']
  },
  {
    id: 'actors',
    layerId: 'entities',
    label: 'Actors',
    description: 'Spawn points and hazards',
    brushIds: ['player', 'slime', 'gate', 'eraseEntity']
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

export function palettesForLayer(layerId) {
  return EDIT_PALETTES.filter(palette => palette.layerId === layerId);
}

export function defaultPaletteForLayer(layerId) {
  return palettesForLayer(layerId)[0] ?? null;
}

export function brushById(brushId) {
  return BRUSHES.find(brush => brush.id === brushId) ?? null;
}

export function brushesForPalette(paletteId) {
  const palette = EDIT_PALETTES.find(candidate => candidate.id === paletteId);
  if (!palette) return [];
  return palette.brushIds.map(brushById).filter(Boolean);
}
