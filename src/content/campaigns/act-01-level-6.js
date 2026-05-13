export const act01Level6Scenario = {
  id: 'act-01-level-6',
  name: 'Act 01 Level 6',
  source: 'campaigns',
  visibility: 'public',
  categories: ['levels', 'act-01'],
  description: 'Descend through a rugged cavern gauntlet and reach the upper-left gate.',
  composition: {
    type: 'tilemap-gameplay',
    stack: [
      {
        scene: 'gameplay',
        props: {
          tilemapId: 'act-01-level-6',
          goal: { type: 'finish-gate' }
        }
      }
    ]
  }
};
