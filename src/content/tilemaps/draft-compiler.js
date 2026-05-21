import { brushGridLayer, defineTilemap, placedAssetsLayer } from '../../core/tilemaps/tilemap.js';
import { normalizeDraft } from '../../core/tilemaps/draft.js';
import { finishGateObject, playerSpawner, slimeSpawner } from './objects.js';
import { BUILTIN_BRUSHES } from './brushes.js';
import { BUILTIN_MATERIALS } from './materials.js';

export const SYMBOLS = {
  placedAssets: { P: playerSpawner, E: slimeSpawner, G: finishGateObject },
  entities: { P: playerSpawner, E: slimeSpawner, G: finishGateObject }
};

export function toDefinition(draft) {
  const normalized = normalizeDraft(draft);
  return {
    ...normalized,
    brushes: BUILTIN_BRUSHES,
    materials: BUILTIN_MATERIALS,
    layers: normalized.layers.map(layer => layer.type === 'brush-grid'
      ? brushGridLayer({ id: layer.id, cellSize: layer.cellSize, accepts: layer.accepts, z: layer.z, rows: layer.rows })
      : placedAssetsLayer({
        id: layer.id === 'entities' ? 'placedAssets' : layer.id,
        cellSize: layer.cellSize,
        objectSize: layer.objectSize,
        symbols: SYMBOLS[layer.id] ?? {},
        rows: layer.rows
      }))
  };
}

export function compileDraft(draft) { return defineTilemap(toDefinition(draft)); }
