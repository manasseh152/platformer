export const enemyZooScenario = {
  id: 'enemy-zoo',
  name: 'Enemy Zoo',
  source: 'zoos',
  categories: ['enemy'],
  visibility: 'developer',
  description: 'Documents enemy combinations in a reusable tilemap fixture.',
  docs: [],
  tests: [],
  covers: ['enemy.composition-showcase', 'enemy.patrol-variety'],
  ci: false,
  composition: {
    type: 'tilemap-gameplay',
    seed: 'enemy-zoo',
    stack: [
      {
        scene: 'gameplay',
        props: {
          tilemapLevelDefinitionId: 'enemy-zoo-map',
          goal: { type: 'finish-gate' }
        }
      }
    ]
  },
  targetId: 'enemy-zoo-map'
};
