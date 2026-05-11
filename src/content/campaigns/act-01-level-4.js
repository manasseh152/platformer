export const act01Level4Scenario = {
  id: 'act-01-level-4',
  name: 'Act 01 Level 4',
  source: 'campaigns',
  visibility: 'public',
  categories: ['levels', 'act-01'],
  description: 'Explore a tall broken stone-and-grass gauntlet from the editor draft.',
  composition: {
    type: 'tilemap-gameplay',
    stack: [
      {
        scene: 'gameplay',
        props: {
          tilemapId: 'act-01-level-4',
          goal: { type: 'finish-gate' }
        }
      }
    ]
  }
};
