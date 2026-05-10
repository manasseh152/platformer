export const ASSET_IDS = Object.freeze({
  TERRAIN_STONE_FILL: 'terrain.stone.fill',
  TERRAIN_STONE_TOP: 'terrain.stone.top',
  TERRAIN_STONE_BLOCK: 'terrain.stone.block',
  HAZARD_SPIKES: 'hazard.spikes',
  GOAL_GATE_SINGLE: 'goal.gate.single',
  GOAL_GATE_LEFT: 'goal.gate.left',
  GOAL_GATE_CENTER: 'goal.gate.center',
  GOAL_GATE_RIGHT: 'goal.gate.right',
  DECOR_TORCH: 'decor.torch',
  DECOR_BANNER_RED: 'decor.banner.red',
  DECOR_BANNER_GREEN: 'decor.banner.green',
  DECOR_FLAG: 'decor.flag'
});

export const ATLAS_SPRITE_DEFAULTS = Object.freeze({
  padding: 2,
  extrude: 1
});

const assetIdToKey = Object.freeze({
  [ASSET_IDS.TERRAIN_STONE_FILL]: 'stoneFill',
  [ASSET_IDS.TERRAIN_STONE_TOP]: 'stoneTop',
  [ASSET_IDS.TERRAIN_STONE_BLOCK]: 'stoneBlock',
  [ASSET_IDS.HAZARD_SPIKES]: 'spikes',
  [ASSET_IDS.GOAL_GATE_SINGLE]: 'gate',
  [ASSET_IDS.GOAL_GATE_LEFT]: 'gateLeft',
  [ASSET_IDS.GOAL_GATE_CENTER]: 'gateCenter',
  [ASSET_IDS.GOAL_GATE_RIGHT]: 'gateRight',
  [ASSET_IDS.DECOR_TORCH]: 'torch',
  [ASSET_IDS.DECOR_BANNER_RED]: 'bannerRed',
  [ASSET_IDS.DECOR_BANNER_GREEN]: 'bannerGreen',
  [ASSET_IDS.DECOR_FLAG]: 'flag'
});

const decorTypeToAssetId = Object.freeze({
  torch: ASSET_IDS.DECOR_TORCH,
  bannerRed: ASSET_IDS.DECOR_BANNER_RED,
  bannerGreen: ASSET_IDS.DECOR_BANNER_GREEN,
  flag: ASSET_IDS.DECOR_FLAG
});

export const DEFAULT_ASSET_METADATA = Object.freeze(Object.fromEntries(
  Object.entries(assetIdToKey).map(([assetId, imageKey]) => [assetId, Object.freeze({
    assetId,
    kind: 'standalone-image',
    imageKey
  })])
));

function imageLoaded(asset) {
  return Boolean(asset?.complete && asset.naturalWidth > 0);
}

function dimensionsFromImage(image) {
  return {
    w: image?.naturalWidth ?? image?.width ?? 0,
    h: image?.naturalHeight ?? image?.height ?? 0
  };
}

function normalizeSpriteRect(sprite, image) {
  const size = dimensionsFromImage(image);
  return Object.freeze({
    x: sprite?.x ?? 0,
    y: sprite?.y ?? 0,
    w: sprite?.w ?? sprite?.width ?? size.w,
    h: sprite?.h ?? sprite?.height ?? size.h
  });
}

function normalizeSpriteMetadata(assetId, metadata, image) {
  if (!metadata) return null;
  if (metadata.kind === 'atlas-sprite') {
    const sprite = metadata.sprite ?? metadata.rect ?? metadata;
    return Object.freeze({
      assetId,
      kind: 'atlas-sprite',
      atlasId: metadata.atlasId,
      imageKey: metadata.imageKey,
      rect: normalizeSpriteRect(sprite, image),
      padding: metadata.padding ?? ATLAS_SPRITE_DEFAULTS.padding,
      extrude: metadata.extrude ?? ATLAS_SPRITE_DEFAULTS.extrude
    });
  }
  return Object.freeze({
    assetId,
    kind: 'standalone-image',
    imageKey: metadata.imageKey ?? assetId,
    rect: normalizeSpriteRect(metadata.rect, image),
    padding: metadata.padding ?? 0,
    extrude: metadata.extrude ?? 0
  });
}

export function createAtlasSpriteMetadata({ atlasId, imageKey, x, y, w, h, padding = ATLAS_SPRITE_DEFAULTS.padding, extrude = ATLAS_SPRITE_DEFAULTS.extrude }) {
  if (!atlasId) throw new Error('Atlas sprite metadata requires atlasId');
  if (!imageKey) throw new Error('Atlas sprite metadata requires imageKey');
  for (const [name, value] of Object.entries({ x, y, w, h, padding, extrude })) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`Atlas sprite metadata ${name} must be a non-negative number`);
  }
  return Object.freeze({ kind: 'atlas-sprite', atlasId, imageKey, sprite: Object.freeze({ x, y, w, h }), padding, extrude });
}

export function createAssetRegistry(source = {}, { metadata = DEFAULT_ASSET_METADATA } = {}) {
  function metadataFor(assetId) {
    const fallbackKey = assetIdToKey[assetId] ?? assetId;
    return metadata[assetId] ?? { assetId, kind: 'standalone-image', imageKey: fallbackKey };
  }

  function imageForMetadata(entry) {
    const key = entry?.imageKey ?? assetIdToKey[entry?.assetId] ?? entry?.assetId;
    return source[key] ?? null;
  }

  return {
    getMetadata(assetId) {
      return normalizeSpriteMetadata(assetId, metadataFor(assetId), imageForMetadata(metadataFor(assetId)));
    },
    getImage(assetId) {
      return imageForMetadata(metadataFor(assetId));
    },
    getSprite(assetId) {
      const entry = this.getMetadata(assetId);
      if (!entry) return null;
      return Object.freeze({
        assetId,
        kind: entry.kind === 'atlas-sprite' ? 'atlas-sprite' : 'standalone-image',
        atlasId: entry.atlasId ?? assetId,
        image: this.getImage(assetId),
        rect: entry.rect,
        padding: entry.padding,
        extrude: entry.extrude
      });
    },
    resolveDrawable(assetId) {
      const sprite = this.getSprite(assetId);
      if (!sprite?.image) return null;
      return sprite;
    },
    isLoaded(assetId) {
      return imageLoaded(this.getImage(assetId));
    },
    decorAssetId(type) {
      return decorTypeToAssetId[type] ?? type ?? null;
    }
  };
}

export const emptyAssetRegistry = createAssetRegistry({});
