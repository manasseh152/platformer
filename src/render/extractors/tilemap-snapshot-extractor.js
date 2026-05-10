import { ACTOR_DRAW } from '../../core/constants.js';
import { createEnemies, createPlayer, getSpawnPoint } from '../../core/tilemaps/tilemap.js';
import { createRenderFrameBuilder } from '../../engine/render/frame-builder.js';
import { emptyAssetRegistry } from '../asset-registry.js';
import { GameplayRenderLayer as L } from './gameplay-render-layers.js';
import { addEnemyPackets, addPlayerPackets } from './primitive-builders.js';
import { addTilemapVisualPackets, identityRenderView } from './tilemap-render-extractor.js';

export function extractTilemapSnapshotRenderFrame(tilemap, { assetRegistry = emptyAssetRegistry } = {}) {
  const view = identityRenderView(tilemap.worldWidth, tilemap.worldHeight);
  const builder = createRenderFrameBuilder({ width: tilemap.worldWidth, height: tilemap.worldHeight, coordinateSpace: 'world-snapshot' });
  builder.add({ kind: 'clear', layer: L.Clear, color: '#080b11' });
  addTilemapVisualPackets(builder, tilemap, view, { assetRegistry, includeBackdrop: true, layers: L });
  for (const enemy of createEnemies(tilemap)) addEnemyPackets(builder, view, enemy, L.Enemy);
  addPlayerPackets(builder, view, createPlayer(getSpawnPoint(tilemap)), L.Player, 1);
  return builder.finalize();
}

export { ACTOR_DRAW };
