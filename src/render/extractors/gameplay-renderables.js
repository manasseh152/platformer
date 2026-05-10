function isFiniteRect(rect) {
  return rect && Number.isFinite(rect.x) && Number.isFinite(rect.y) && Number.isFinite(rect.w) && Number.isFinite(rect.h) && rect.w > 0 && rect.h > 0;
}

function runtimeActor({ role, actor, entity, layerHint = null }) {
  if (!isFiniteRect(entity)) return null;
  return {
    kind: 'runtime-actor',
    role,
    transform: { x: entity.x, y: entity.y, w: entity.w, h: entity.h },
    render: {
      type: 'render:actor',
      actor,
      layerHint,
      facing: entity.dir || 1,
      flickerMs: entity.inv > 0 ? 70 : 0,
      attack: entity.attack ?? 0,
      hurt: entity.hurt ?? 0
    },
    health: Number.isFinite(entity.hp) ? { hp: entity.hp } : null,
    source: entity
  };
}

export function playerActorRenderable(player) {
  return runtimeActor({ role: 'player', actor: 'player', entity: player });
}

export function enemyActorRenderable(enemy) {
  if (enemy?.hp <= 0) return null;
  return runtimeActor({ role: 'enemy', actor: 'slime', entity: enemy });
}

export function dustEffectRenderable(dust) {
  if (!dust || !Number.isFinite(dust.x) || !Number.isFinite(dust.y)) return null;
  return {
    kind: 'transient-effect',
    effect: 'dust',
    transform: { x: dust.x, y: dust.y, radiusX: 5, radiusY: 5 },
    render: { type: 'render:effect', shape: 'ellipse', fill: '#bfffff', alpha: Math.max(0, (dust.life ?? 0) * 3) },
    source: dust
  };
}

export function particleEffectRenderable(particle) {
  if (!particle || !Number.isFinite(particle.x) || !Number.isFinite(particle.y)) return null;
  return {
    kind: 'transient-effect',
    effect: 'particle',
    transform: { x: particle.x, y: particle.y, w: 4, h: 4 },
    render: { type: 'render:effect', shape: 'rect', fill: particle.color, alpha: Math.max(0, (particle.life ?? 0) * 2) },
    source: particle
  };
}

export function createGameplayRenderReadModel(game = {}) {
  const player = playerActorRenderable(game.player);
  const enemies = (game.enemies ?? []).map(enemyActorRenderable).filter(Boolean);
  return {
    authoredScene: {
      tilemap: game.tilemap,
      devToolsFlags: game.devTools?.flags
    },
    runtimeActors: [player, ...enemies].filter(Boolean),
    transientEffects: [
      ...(game.dust ?? []).map(dustEffectRenderable),
      ...(game.particles ?? []).map(particleEffectRenderable)
    ].filter(Boolean),
    debug: {
      devToolsFlags: game.devTools?.flags,
      physicsBodies: [player, ...enemies].filter(Boolean)
    }
  };
}
