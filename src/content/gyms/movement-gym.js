import { movementMachines } from './movement-machines.js';

export const movementGymScenario = {
  id: 'movement-gym',
  name: 'Movement Gym',
  source: 'gyms',
  categories: ['movement'],
  visibility: 'developer',
  description: 'Validates focused movement systems through in-engine gym machines.',
  docs: ['docs/patterns/gyms.md', 'docs/adr/0007-machine-based-gyms.md'],
  tests: ['tests/gyms/movement.gym.spec.js'],
  covers: [
    'movement.run-max-speed',
    'movement.jump-gap',
    'movement.run-jump-coupling',
    'movement.air-correction',
    'movement.dash-burst',
    'movement.npc-patrol'
  ],
  machines: movementMachines,
  machinePolicy: { autoStart: true },
  ci: true,
  composition: {
    type: 'tilemap-gameplay',
    seed: 'movement-gym',
    stack: [
      {
        scene: 'gameplay',
        props: {
          tilemapId: 'movement-gym-map',
          goal: null
        }
      }
    ]
  }
};
