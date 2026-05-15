import { defineTilemap, gridLayer } from '../../core/tilemaps/tilemap.js';
import { terrainLayer } from '../../core/tilemaps/terrain-layer.js';
import { normalizeDraft } from '../../core/tilemaps/draft.js';
import { finishGateObject, playerSpawner, slimeSpawner, spikeHazard } from './objects.js';

export const SYMBOLS = {
  entities: { P: playerSpawner, E: slimeSpawner, G: finishGateObject },
  hazards: { '^': spikeHazard }
};

export function toDefinition(draft) {
  const normalized = normalizeDraft(draft);
  return {
    ...normalized,
    layers: normalized.layers.map(layer => layer.type === 'terrain' || layer.id === 'terrain'
      ? terrainLayer({ id: 'terrain', cellSize: layer.cellSize, rows: layer.rows })
      : gridLayer({
        id: layer.id,
        cellSize: layer.cellSize,
        symbols: SYMBOLS[layer.id] ?? {},
        rows: layer.rows
      }))
  };
}

export function compileDraft(draft) {
  return defineTilemap(toDefinition(draft));
}
