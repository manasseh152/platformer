export const BRUSH_TRAIT = Object.freeze({
  VISUAL: 'visual',
  SOLID: 'solid',
  HAZARD: 'hazard'
});

export function visualTrait(options = {}) {
  if (!options.renderer) throw new Error('visualTrait requires renderer');
  return Object.freeze({ type: BRUSH_TRAIT.VISUAL, ...options });
}

export function solidTrait() { return Object.freeze({ type: BRUSH_TRAIT.SOLID }); }

export function hazardTrait({ kind, contact, inset } = {}) {
  if (!kind) throw new Error('hazardTrait requires kind');
  return Object.freeze({ type: BRUSH_TRAIT.HAZARD, kind, contact: contact ?? 'defeat', ...(inset ? { inset: { ...inset } } : {}) });
}

export function defineBrush({ id, label, traits = [] }) {
  if (!id) throw new Error('defineBrush requires id');
  if (!Array.isArray(traits)) throw new Error(`${id} brush traits must be an array`);
  return Object.freeze({ id, label: label ?? id, traits: Object.freeze(traits.map(trait => Object.freeze({ ...trait }))) });
}

export function defineMaterial({ id, label, containedAutotile } = {}) {
  if (!id) throw new Error('defineMaterial requires id');
  return Object.freeze({ id, label: label ?? id, ...(containedAutotile ? { containedAutotile: Object.freeze({ ...containedAutotile, connectsTo: Object.freeze([...(containedAutotile.connectsTo ?? [id])]) }) } : {}) });
}

export function brushTrait(brush, type) { return brush?.traits?.find(trait => trait.type === type) ?? null; }
export function brushTraits(brush, type) { return brush?.traits?.filter(trait => trait.type === type) ?? []; }
export function hasBrushTrait(brush, type) { return Boolean(brushTrait(brush, type)); }

export function indexDefinitions(definitions = []) {
  return new Map(definitions.map(definition => [definition.id, definition]));
}
