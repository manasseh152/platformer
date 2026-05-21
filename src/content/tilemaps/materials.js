import { defineMaterial } from '../../core/tilemaps/brushes.js';

export const grassMaterial = defineMaterial({ id: 'grass', label: 'Grass', containedAutotile: { connectsTo: ['grass'], baseColor: '#a7643b', edgeColor: '#4f9f3a', innerCornerColor: '#3f7f36', edgeThickness: 4 } });
export const dirtMaterial = defineMaterial({ id: 'dirt', label: 'Dirt', containedAutotile: { connectsTo: ['dirt'], baseColor: '#8f5634', edgeColor: '#b86f3d', innerCornerColor: '#6f3f25', edgeThickness: 4 } });
export const stoneMaterial = defineMaterial({ id: 'stone', label: 'Stone', containedAutotile: { connectsTo: ['stone'], baseColor: '#66717d', edgeColor: '#9aa7b2', innerCornerColor: '#4b5660', edgeThickness: 4 } });
export const sandMaterial = defineMaterial({ id: 'sand', label: 'Sand', containedAutotile: { connectsTo: ['sand'], baseColor: '#d9b86f', edgeColor: '#f0d58a', innerCornerColor: '#b8914d', edgeThickness: 4 } });
export const logMaterial = defineMaterial({ id: 'log', label: 'Log', containedAutotile: { connectsTo: ['log'], baseColor: '#7a4a2a', edgeColor: '#a66a3f', innerCornerColor: '#4f2f1d', edgeThickness: 4 } });
export const leavesMaterial = defineMaterial({ id: 'leaves', label: 'Leaves', containedAutotile: { connectsTo: ['leaves'], baseColor: '#3f8f4c', edgeColor: '#62bd63', innerCornerColor: '#2e6538', edgeThickness: 4 } });

export const BUILTIN_MATERIALS = Object.freeze([grassMaterial, dirtMaterial, stoneMaterial, sandMaterial, logMaterial, leavesMaterial]);
export const BUILTIN_MATERIAL_BY_ID = new Map(BUILTIN_MATERIALS.map(material => [material.id, material]));
