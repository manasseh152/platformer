import { TILE_SIZE } from '../../core/constants.js';
import { forEachLayerTile, getDecorType } from '../../core/tilemaps/tilemap.js';
import { findObjectsWithComponent, getComponent } from '../../engine/scene/queries.js';
import { planContainedTerrainTileVisuals } from '../contained-terrain.js';
import { ASSET_IDS, emptyAssetRegistry } from '../asset-registry.js';
import { GameplayRenderLayer as L } from './gameplay-render-layers.js';
import { addSpikeFallback, addWorldImage, addWorldRect, tileRect } from './primitive-builders.js';

export function identityRenderView(width, height) {
  return { cameraX: 0, cameraY: 0, worldToNativeX: 1, worldToNativeY: 1, bufferWidth: width, bufferHeight: height, worldWidth: width, worldHeight: height };
}

function tileNoise(col, row, salt = 0) {
  const n = Math.sin((col * 127.1 + row * 311.7 + salt * 74.7)) * 43758.5453;
  return n - Math.floor(n);
}

function addBackdropGlyph(builder, view, ch, x, y, col, row, layer) {
  const add = (rect, packet) => addWorldRect(builder, view, rect, { layer, ...packet });
  if (ch === 'd') {
    add({ x: x + 6, y: y + 8, w: TILE_SIZE - 12, h: TILE_SIZE - 16 }, { kind: 'rect', fill: 'rgba(3, 8, 11, .28)' });
    add({ x: x + 16, y: y + 18, w: 12, h: 10 }, { kind: 'rect', fill: 'rgba(255,255,255,.035)' });
  } else if (ch === 'a') {
    add({ x: x + 8, y: y + 18, w: TILE_SIZE - 16, h: TILE_SIZE + 26 }, { kind: 'roundRect', radius: 28, fill: 'rgba(0, 0, 0, .24)' });
  } else if (ch === 'c') {
    for (let i = 0; i < 4; i++) {
      builder.add({ kind: 'ellipse', layer, x: (x + TILE_SIZE / 2 - view.cameraX) * view.worldToNativeX, y: (y + i * 17 + 3 - view.cameraY) * view.worldToNativeY, radiusX: 7 * view.worldToNativeX, radiusY: 10 * view.worldToNativeY, rotation: i % 2 ? Math.PI / 2 : 0, stroke: 'rgba(121, 105, 77, .42)', lineWidth: 4 * view.worldToNativeX });
    }
  }
  if (tileNoise(col, row, 7) > .5) add({ x: x + 48, y: y + 14, w: 8, h: 8 }, { kind: 'rect', fill: 'rgba(185, 213, 207, .045)' });
}

export function addDungeonBackdropPackets(builder, view, layer = L.Backdrop) {
  builder.add({ kind: 'rect', layer, x: 0, y: 0, w: view.bufferWidth, h: view.bufferHeight, fill: { kind: 'linearGradient', x0: 0, y0: 0, x1: 0, y1: view.bufferHeight, stops: [{ offset: 0, color: '#080c13' }, { offset: .48, color: '#101a22' }, { offset: 1, color: '#18272a' }] } });
  const tile = 56;
  const parallaxX = Math.round(view.cameraX * .22) % tile;
  const parallaxY = Math.round(view.cameraY * .14) % tile;
  for (let y = -parallaxY - tile; y < view.worldHeight + tile * 2; y += tile) {
    for (let x = -parallaxX - tile; x < view.worldWidth + tile * 2; x += tile) {
      const stagger = ((Math.round((y + parallaxY + tile) / tile)) & 1) * tile / 2;
      const bx = x + stagger;
      addWorldRect(builder, view, { x: bx, y, w: tile - 2, h: tile - 2 }, { kind: 'rect', layer, fill: (((x / tile + y / tile) & 1) ? 'rgba(126, 159, 158, .105)' : 'rgba(187, 211, 205, .075)') });
      addWorldRect(builder, view, { x: bx + 10, y: y + 12, w: 8, h: 8 }, { kind: 'rect', layer, fill: 'rgba(255,255,255,.035)' });
      addWorldRect(builder, view, { x: bx + 26, y: y + 30, w: 14, h: 12 }, { kind: 'rect', layer, fill: 'rgba(0,0,0,.13)' });
    }
  }
  for (let i = -1; i < 6; i++) addWorldRect(builder, view, { x: i * 170 - (view.cameraX * .08 % 170) + 20, y: 86, w: 80, h: view.worldHeight, }, { kind: 'roundRect', layer, radius: 40 * view.worldToNativeX, fill: 'rgba(4, 8, 12, .34)' });
  for (let i = 0; i < 7; i++) builder.add({ kind: 'ellipse', layer, x: (80 + i * 210 - (view.cameraX * .16 % 210) - view.cameraX) * view.worldToNativeX, y: (view.worldHeight - 64 + Math.sin(i) * 12 - view.cameraY) * view.worldToNativeY, radiusX: 150 * view.worldToNativeX, radiusY: 62 * view.worldToNativeY, fill: 'rgba(124,169,166,.18)' });
  builder.add({ kind: 'rect', layer, x: 0, y: 0, w: view.bufferWidth, h: view.bufferHeight, fill: { kind: 'radialGradient', x0: view.bufferWidth * .54, y0: view.bufferHeight * .45, r0: 20, x1: view.bufferWidth * .54, y1: view.bufferHeight * .45, r1: view.bufferWidth * .78, stops: [{ offset: 0, color: 'rgba(255, 245, 205, .10)' }, { offset: .55, color: 'rgba(255, 245, 205, .025)' }, { offset: 1, color: 'rgba(0, 0, 0, .38)' }] } });
}

export function addTilemapVisualPackets(builder, tilemap, view, { assetRegistry = emptyAssetRegistry, includeBackdrop = true, layers = L, devToolsFlags = tilemap?.devToolsFlags } = {}) {
  if (includeBackdrop) {
    forEachLayerTile(tilemap, 'backdrop', (ch, col, row) => {
      if (ch !== '.') addBackdropGlyph(builder, view, ch, col * TILE_SIZE, row * TILE_SIZE, col, row, layers.Backdrop);
    });
  }

  forEachLayerTile(tilemap, 'decor', (ch, col, row) => {
    const type = getDecorType(ch);
    const assetId = assetRegistry.decorAssetId(type);
    if (assetId && assetRegistry.isLoaded(assetId)) addWorldImage(builder, view, tileRect(col, row, TILE_SIZE), assetId, { layer: layers.Decor });
  });

  for (const tile of tilemap.renderLayers?.containedTerrainTiles ?? []) {
    for (const primitive of planContainedTerrainTileVisuals(tile)) addWorldRect(builder, view, primitive, { kind: 'rect', layer: layers.Terrain, fill: primitive.color });
    if (devToolsFlags?.showBuildTerrainCells) addWorldRect(builder, view, tile, { kind: 'rect', layer: layers.DebugCollision, stroke: 'rgba(0,0,0,.26)', lineWidth: 1 });
  }

  addGoalPackets(builder, tilemap, view, { assetRegistry, layer: layers.Goal });
  addSpikePackets(builder, tilemap, view, { assetRegistry, layer: layers.Hazard });
}

function spawnedObjectHasComponent(object, type) {
  return getComponent(object, 'spawner')?.object?.components?.some(component => component.type === type);
}

function renderGoalObjects(tilemap) {
  return [
    ...findObjectsWithComponent(tilemap, 'render:goal'),
    ...findObjectsWithComponent(tilemap, 'spawner').filter(object => spawnedObjectHasComponent(object, 'render:goal'))
  ].filter((object, index, objects) => objects.indexOf(object) === index);
}

function getRenderGoalRects(tilemap) {
  const goals = renderGoalObjects(tilemap);
  if (!goals.length) return [];
  const minCol = Math.min(...goals.map(o => o.transform.col));
  const maxCol = Math.max(...goals.map(o => o.transform.col));
  const minRow = Math.min(...goals.map(o => o.transform.row));
  const maxRow = Math.max(...goals.map(o => o.transform.row));
  return [{ x: minCol * tilemap.tileSize, y: minRow * tilemap.tileSize, w: (maxCol - minCol + 1) * tilemap.tileSize, h: (maxRow - minRow + 1) * tilemap.tileSize, col: minCol, row: minRow, cols: maxCol - minCol + 1, rows: maxRow - minRow + 1, tileSize: tilemap.tileSize }];
}

export function addGoalPackets(builder, tilemap, view, { assetRegistry = emptyAssetRegistry, layer = L.Goal } = {}) {
  for (const goal of getRenderGoalRects(tilemap)) {
    const tileSize = goal.tileSize ?? TILE_SIZE;
    if (goal.cols >= 3 && assetRegistry.isLoaded(ASSET_IDS.GOAL_GATE_LEFT) && assetRegistry.isLoaded(ASSET_IDS.GOAL_GATE_CENTER) && assetRegistry.isLoaded(ASSET_IDS.GOAL_GATE_RIGHT)) {
      addWorldImage(builder, view, { x: goal.x, y: goal.y, w: tileSize, h: tileSize }, ASSET_IDS.GOAL_GATE_LEFT, { layer });
      addWorldImage(builder, view, { x: goal.x + tileSize, y: goal.y, w: tileSize, h: tileSize }, ASSET_IDS.GOAL_GATE_CENTER, { layer });
      addWorldImage(builder, view, { x: goal.x + tileSize * 2, y: goal.y, w: tileSize, h: tileSize }, ASSET_IDS.GOAL_GATE_RIGHT, { layer });
    } else if (assetRegistry.isLoaded(ASSET_IDS.GOAL_GATE_SINGLE)) {
      addWorldImage(builder, view, goal, ASSET_IDS.GOAL_GATE_SINGLE, { layer });
    } else {
      addWorldRect(builder, view, goal, { kind: 'roundRect', layer, radius: 18 * view.worldToNativeX, fill: '#2d3838' });
      addWorldRect(builder, view, { x: goal.x + 12, y: goal.y + 14, w: goal.w - 24, h: goal.h - 28 }, { kind: 'rect', layer, stroke: '#d7b15a', lineWidth: 3 * view.worldToNativeX });
    }
  }
}

export function addSpikePackets(builder, tilemap, view, { assetRegistry = emptyAssetRegistry, layer = L.Hazard } = {}) {
  for (const object of findObjectsWithComponent(tilemap, 'collision:hazard')) {
    const hazard = getComponent(object, 'collision:hazard');
    if (hazard?.kind !== 'spike') continue;
    const { x, y, w = tilemap.tileSize, h = tilemap.tileSize } = object.transform;
    if (assetRegistry.isLoaded(ASSET_IDS.HAZARD_SPIKES)) addWorldImage(builder, view, { x, y, w, h }, ASSET_IDS.HAZARD_SPIKES, { layer, flipY: true });
    else addSpikeFallback(builder, view, { x, y, w, h }, layer);
  }
}
