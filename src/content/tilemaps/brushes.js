import { defineBrush, hazardTrait, solidTrait, visualTrait } from '../../core/tilemaps/brushes.js';

const contained = material => visualTrait({ renderer: 'contained-autotile', material });

export const grassBrush = defineBrush({ id: 'grass', label: 'Grass', traits: [solidTrait(), contained('grass')] });
export const dirtBrush = defineBrush({ id: 'dirt', label: 'Dirt', traits: [solidTrait(), contained('dirt')] });
export const stoneBrush = defineBrush({ id: 'stone', label: 'Stone', traits: [solidTrait(), contained('stone')] });
export const sandBrush = defineBrush({ id: 'sand', label: 'Sand', traits: [solidTrait(), contained('sand')] });
export const logBrush = defineBrush({ id: 'log', label: 'Log', traits: [solidTrait(), contained('log')] });
export const leavesBrush = defineBrush({ id: 'leaves', label: 'Leaves', traits: [solidTrait(), contained('leaves')] });
export const invisibleSolidBrush = defineBrush({ id: 'invisible-solid', label: 'Invisible Solid', traits: [solidTrait()] });
export const spikeFloorBrush = defineBrush({ id: 'spike-floor', label: 'Floor Spike', traits: [
  visualTrait({ renderer: 'sprite', assetId: 'spikes' }),
  hazardTrait({ kind: 'spike', contact: 'defeat', inset: { left: 2, right: 2, top: 2, bottom: 0 } })
] });

export const BUILTIN_BRUSHES = Object.freeze([grassBrush, dirtBrush, stoneBrush, sandBrush, logBrush, leavesBrush, invisibleSolidBrush, spikeFloorBrush]);
export const BUILTIN_BRUSH_BY_ID = new Map(BUILTIN_BRUSHES.map(brush => [brush.id, brush]));
