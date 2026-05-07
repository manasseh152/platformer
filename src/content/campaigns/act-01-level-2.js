export const act01Level2Scenario = {
  id: 'act-01-level-2',
  name: 'Act 01 Level 2',
  source: 'campaigns',
  visibility: 'public',
  categories: ['levels', 'act-01'],
  description: 'Climb through the cave and reach the gate above.',
  composition: {
    type: 'tilemap-gameplay',
    stack: [
      {
        scene: 'gameplay',
        props: {
          tilemapId: 'act-01-level-2',
          goal: { type: 'finish-gate' }
        }
      }
    ]
  }
};
