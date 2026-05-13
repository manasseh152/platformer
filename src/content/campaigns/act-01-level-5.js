export const act01Level5Scenario = {
  id: 'act-01-level-5',
  name: 'Act 01 Level 5',
  source: 'campaigns',
  visibility: 'public',
  categories: ['levels', 'act-01'],
  description: 'Climb through a sprawling stone cavern toward the high gate.',
  composition: {
    type: 'tilemap-gameplay',
    stack: [
      {
        scene: 'gameplay',
        props: {
          tilemapId: 'act-01-level-5',
          goal: { type: 'finish-gate' }
        }
      }
    ]
  }
};
