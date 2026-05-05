export const act01Level1Scenario = {
  id: 'act-01-level-1',
  name: 'Act 01 Level 1',
  source: 'campaigns',
  visibility: 'public',
  categories: ['levels', 'act-01'],
  description: 'Reach the glowing gate beyond the crumbling platforms and spike pit.',
  composition: {
    type: 'tilemap-gameplay',
    stack: [
      {
        scene: 'gameplay',
        props: {
          tilemapLevelDefinitionId: 'act-01-level-1',
          goal: { type: 'finish-gate' }
        }
      }
    ]
  }
};
