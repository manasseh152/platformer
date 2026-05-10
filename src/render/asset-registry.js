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

function imageLoaded(asset) {
  return Boolean(asset?.complete && asset.naturalWidth > 0);
}

export function createAssetRegistry(source = {}) {
  return {
    getImage(assetId) {
      const key = assetIdToKey[assetId] ?? assetId;
      return source[key] ?? null;
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
