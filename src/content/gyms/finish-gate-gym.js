import { finishGateMachines } from './finish-gate-machines.js';

export const finishGateGymScenario = {
  id: 'finish-gate-gym',
  name: 'Finish Gate Gym',
  source: 'gyms',
  categories: ['finish-gate'],
  visibility: 'developer',
  description: 'Validates finish-gate trigger geometry and gameplay completion through in-engine gym machines.',
  docs: ['docs/patterns/gyms.md', 'docs/adr/0006-machine-based-gyms.md'],
  tests: ['tests/gyms/finish-gate.gym.spec.js'],
  covers: [
    'finish-gate.geometry',
    'finish-gate.transition',
    'gameplay.outcome'
  ],
  machines: finishGateMachines,
  machinePolicy: { autoStart: true },
  ci: true,
  composition: {
    type: 'tilemap-gameplay',
    seed: 'finish-gate-gym',
    stack: [
      {
        scene: 'gameplay',
        props: {
          tilemapId: 'finish-gate-gym-map',
          goal: { type: 'finish-gate' }
        }
      }
    ]
  }
};
