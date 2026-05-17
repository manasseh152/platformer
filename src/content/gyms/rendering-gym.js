import { renderingMachines } from './rendering-machines.js';

export const renderingGymScenario = {
  id: 'rendering-gym',
  name: 'Rendering Gym',
  source: 'gyms',
  categories: ['rendering'],
  visibility: 'developer',
  description: 'Showcases and validates gameplay render read models through gym machines.',
  docs: ['docs/patterns/gyms.md', 'docs/adr/0007-machine-based-gyms.md'],
  tests: ['tests/gyms/rendering.gym.spec.js'],
  covers: [
    'rendering.actor-states',
    'rendering.effects-fixture',
    'rendering.read-model',
    'rendering.actors',
    'rendering.effects'
  ],
  machines: renderingMachines,
  machinePolicy: { autoStart: true },
  ci: true,
  composition: {
    type: 'tilemap-gameplay',
    seed: 'rendering-gym',
    stack: [
      {
        scene: 'gameplay',
        props: {
          tilemapId: 'rendering-gym-map',
          goal: null
        }
      }
    ]
  }
};
