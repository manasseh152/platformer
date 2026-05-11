export const act01Level3Scenario = {
  id: 'act-01-level-3',
  name: 'Act 01 Level 3',
  source: 'campaigns',
  visibility: 'public',
  categories: ['levels', 'act-01'],
  description: 'Scale the broken grass-and-stone climb to reach the high gate.',
  composition: {
    type: 'tilemap-gameplay',
    stack: [
      {
        scene: 'gameplay',
        props: {
          tilemapId: 'act-01-level-3',
          goal: { type: 'finish-gate' }
        }
      }
    ]
  }
};
