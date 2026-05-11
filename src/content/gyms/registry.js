import { createCatalogRegistry } from '../../catalog/registry.js';
import { movementGymScenario } from './movement-gym.js';
import { renderingGymScenario } from './rendering-gym.js';
import { finishGateGymScenario } from './finish-gate-gym.js';

function assertGymScenario(gym) {
  if (gym.source !== 'gyms') throw new Error(`${gym.id} must use gyms source`);
  if (gym.visibility !== 'developer') throw new Error(`${gym.id} must be developer-visible`);
  if (gym.composition?.type !== 'tilemap-gameplay') throw new Error(`${gym.id} must use tilemap-gameplay composition`);
  if (!gym.composition?.stack?.some(layer => layer.scene === 'gameplay' && (layer.props?.tilemapId || layer.props?.tilemap))) throw new Error(`${gym.id} must launch a gameplay tilemap`);
  if (!Array.isArray(gym.machines) || gym.machines.length === 0) throw new Error(`${gym.id} must define at least one gym machine`);
  for (const machine of gym.machines) {
    if (!machine?.id || typeof machine.id !== 'string') throw new Error(`${gym.id} has a machine without a string id`);
    if (!machine.label || typeof machine.label !== 'string') throw new Error(`${machine.id} requires a label`);
    if (!['input', 'state-fixture', 'observer'].includes(machine.authority)) throw new Error(`${machine.id} requires a supported authority`);
    if (!Array.isArray(machine.validates) || machine.validates.some(cover => typeof cover !== 'string')) throw new Error(`${machine.id} validates must be strings`);
  }
  if (!Array.isArray(gym.tests) || gym.tests.some(test => typeof test !== 'string')) throw new Error(`${gym.id} tests must be strings`);
  if (!Array.isArray(gym.docs) || gym.docs.some(doc => typeof doc !== 'string')) throw new Error(`${gym.id} docs must be strings`);
  if (!Array.isArray(gym.covers) || gym.covers.some(cover => typeof cover !== 'string')) throw new Error(`${gym.id} covers must be strings`);
}

const registry = createCatalogRegistry({
  name: 'gyms',
  validateEntry: assertGymScenario
});

export const movementGym = registry.register(movementGymScenario);
export const renderingGym = registry.register(renderingGymScenario);
export const finishGateGym = registry.register(finishGateGymScenario);
export const gyms = Object.fromEntries(registry.getAll().map(entry => [entry.id, entry]));

export function getGymById(id) {
  return registry.getById(id);
}

export function getAllGyms() {
  return registry.getAll();
}
