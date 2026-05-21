import { CELL_SIZE } from '../core/constants.js';
import { EMPTY } from './tilemap-draft.js';

export const EDIT_LAYERS = Object.freeze([
  {
    id: 'solid',
    label: 'Solid',
    description: 'Solid authored ground',
    gridLabel: '16 px build grid',
    cellSize: CELL_SIZE.BUILD,
    packTitle: 'Starter asset pack',
    hint: 'LB/RB changes terrain while the panel is hidden. A paints the selected cell.'
  },
  {
    id: 'placedAssets',
    label: 'Placed Assets',
    description: 'Gameplay placements',
    gridLabel: '16 px placement grid / 32 px objects',
    cellSize: CELL_SIZE.BUILD,
    packTitle: 'Starter asset pack',
    hint: 'Entity stamps snap to the build grid while keeping gameplay-sized footprints. Hide the panel for controller placement.'
  },
  {
    id: 'hazards',
    label: 'Hazards',
    description: 'Damaging environmental tiles',
    gridLabel: '16 px build grid',
    cellSize: CELL_SIZE.BUILD,
    packTitle: 'Hazards pack',
    hint: 'Hazards are authored on the build grid and can overlap terrain.'
  },
  { id: 'lights', label: 'Lights', description: 'Mood and visibility', gridLabel: 'Gridless', disabled: true },
  { id: 'decor', label: 'Decor', description: 'Non-colliding dressing', gridLabel: '8 px / gridless', disabled: true }
]);

export const EDIT_PACKS = Object.freeze([
  {
    id: 'starter',
    label: 'Starter',
    description: 'Core terrain materials and spawn points',
    brushIds: ['grass', 'dirt', 'stone', 'sand', 'log', 'leaves', 'invisibleSolid', 'eraseSolid', 'player', 'slime', 'gate', 'erasePlacedAsset']
  },
  {
    id: 'hazards',
    label: 'Hazards',
    description: 'Damaging environmental tiles',
    brushIds: ['spike', 'eraseHazard']
  }
]);

export const BRUSHES = Object.freeze([
  { id: 'grass', label: 'Grass', shortLabel: 'Grass', layerId: 'solid', symbol: 'grass', cellSize: CELL_SIZE.BUILD, cursor: '#79f0c5', swatch: '#79f0c5' },
  { id: 'dirt', label: 'Dirt', shortLabel: 'Dirt', layerId: 'solid', symbol: 'dirt', cellSize: CELL_SIZE.BUILD, cursor: '#b86f3d', swatch: '#b86f3d' },
  { id: 'stone', label: 'Stone', shortLabel: 'Stone', layerId: 'solid', symbol: 'stone', cellSize: CELL_SIZE.BUILD, cursor: '#9aa7b2', swatch: '#9aa7b2' },
  { id: 'sand', label: 'Sand', shortLabel: 'Sand', layerId: 'solid', symbol: 'sand', cellSize: CELL_SIZE.BUILD, cursor: '#f0d58a', swatch: '#f0d58a' },
  { id: 'log', label: 'Log', shortLabel: 'Log', layerId: 'solid', symbol: 'log', cellSize: CELL_SIZE.BUILD, cursor: '#a66a3f', swatch: '#a66a3f' },
  { id: 'leaves', label: 'Leaves', shortLabel: 'Leaves', layerId: 'solid', symbol: 'leaves', cellSize: CELL_SIZE.BUILD, cursor: '#62bd63', swatch: '#62bd63' },
  { id: 'invisibleSolid', label: 'Invisible Solid', shortLabel: 'Ghost', layerId: 'solid', symbol: 'invisible-solid', cellSize: CELL_SIZE.BUILD, cursor: '#a78bfa', swatch: '#a78bfa' },
  { id: 'eraseSolid', label: 'Erase solid', shortLabel: 'Erase', layerId: 'solid', symbol: null, cellSize: CELL_SIZE.BUILD, cursor: '#ff8f8f', swatch: '#ff8f8f' },
  { id: 'player', label: 'Player P', shortLabel: 'Player', layerId: 'placedAssets', symbol: 'P', cellSize: CELL_SIZE.BUILD, cursor: '#78a8ff', swatch: '#78a8ff' },
  { id: 'slime', label: 'Slime E', shortLabel: 'Slime', layerId: 'placedAssets', symbol: 'E', cellSize: CELL_SIZE.BUILD, cursor: '#ff7bd5', swatch: '#ff7bd5' },
  { id: 'gate', label: 'Gate G', shortLabel: 'Gate', layerId: 'placedAssets', symbol: 'G', cellSize: CELL_SIZE.BUILD, cursor: '#ffd36a', swatch: '#ffd36a' },
  { id: 'erasePlacedAsset', label: 'Erase placed asset', shortLabel: 'Erase', layerId: 'placedAssets', symbol: EMPTY, cellSize: CELL_SIZE.BUILD, cursor: '#ff8f8f', swatch: '#ff8f8f' },
  { id: 'spike', label: 'Spike', shortLabel: 'Spike', layerId: 'hazards', symbol: 'spike-floor', cellSize: CELL_SIZE.BUILD, cursor: '#ff4d7d', swatch: '#ff4d7d' },
  { id: 'eraseHazard', label: 'Erase hazard', shortLabel: 'Erase', layerId: 'hazards', symbol: null, cellSize: CELL_SIZE.BUILD, cursor: '#ff8f8f', swatch: '#ff8f8f' }
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
