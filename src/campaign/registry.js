// Deprecated adapter. Campaign scenarios will move to src/campaigns/registry.js;
// tilemap level definitions now live in src/tilemaps/registry.js.
export {
  act01Level1TilemapLevelDefinition as level,
  legacyMovementLabTilemapLevelDefinition as gymLevel,
  legacyHazardLabTilemapLevelDefinition as hazardGymLevel,
  legacyEnemyZooTilemapLevelDefinition as enemyZooLevel,
  gateLabTilemapLevelDefinition as gateLabLevel,
  tilemapLevelDefinitions as levels,
  getTilemapLevelDefinitionById as getLevelById,
  getAllTilemapLevelDefinitions as getAllLevels,
  getDefaultTilemapLevelDefinition as getDefaultLevel
} from '../tilemaps/registry.js';
