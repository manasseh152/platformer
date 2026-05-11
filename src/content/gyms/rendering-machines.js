import { createGameplayRenderReadModel } from '../../render/extractors/gameplay-renderables.js';

const GROUND_Y = 8 * 32;

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : value;
}

function pinShowcaseState(session) {
  const { player } = session;
  Object.assign(player, {
    x: 144,
    y: GROUND_Y - player.h,
    vx: 0,
    vy: 0,
    dir: 1,
    grounded: true,
    hp: 5,
    inv: 0,
    attack: 999,
    dash: 0,
    dashCooldown: 0,
    dead: false
  });

  const [enemy] = session.enemies ?? [];
  if (enemy) Object.assign(enemy, {
    x: 240,
    y: GROUND_Y - enemy.h,
    vx: 0,
    vy: 0,
    hp: 2,
    hurt: 999,
    min: 224,
    max: 304
  });

  session.dust.splice(0, session.dust.length, { x: 184, y: GROUND_Y - 4, vx: 0, life: 999 });
  session.particles.splice(0, session.particles.length,
    { x: 196, y: GROUND_Y - 28, vx: 0, vy: 0, life: 999, color: '#cfffff' },
    { x: 208, y: GROUND_Y - 38, vx: 0, vy: 0, life: 999, color: '#ffffff' }
  );
}

function fixtureObservations(session) {
  const [enemy] = session.enemies ?? [];
  return {
    player: {
      x: round(session.player.x),
      y: round(session.player.y),
      attack: round(session.player.attack),
      grounded: Boolean(session.player.grounded)
    },
    enemy: enemy ? { x: round(enemy.x), y: round(enemy.y), hp: enemy.hp, hurt: round(enemy.hurt) } : null,
    dustCount: session.dust.length,
    particleCount: session.particles.length
  };
}

export const renderingMachines = [
  {
    id: 'rendering.actor-state-fixture',
    label: 'Actor render state fixture',
    authority: 'state-fixture',
    execution: 'parallel',
    validates: ['rendering.actor-states', 'rendering.effects-fixture'],
    setup({ session }) {
      pinShowcaseState(session);
    },
    beforeUpdate({ session }) {
      pinShowcaseState(session);
    },
    afterUpdate({ session, record }) {
      pinShowcaseState(session);
      const observations = fixtureObservations(session);
      if (record.elapsed < 0.1) return { observations };
      if (!observations.enemy) return { status: 'failed', message: 'Rendering fixture requires a slime enemy.', observations };
      if (observations.dustCount < 1 || observations.particleCount < 2) return { status: 'failed', message: 'Rendering fixture did not pin transient effects.', observations };
      return { status: 'passed', message: 'Pinned showcase actor and effect state.', observations };
    }
  },
  {
    id: 'rendering.read-model-actors',
    label: 'Render read model actors/effects',
    authority: 'observer',
    execution: 'parallel',
    validates: ['rendering.read-model', 'rendering.actors', 'rendering.effects'],
    afterUpdate({ session, record }) {
      const readModel = createGameplayRenderReadModel(session);
      const roles = readModel.runtimeActors.map(actor => actor.role);
      const effects = readModel.transientEffects.map(effect => effect.effect);
      const player = readModel.runtimeActors.find(actor => actor.role === 'player');
      const enemy = readModel.runtimeActors.find(actor => actor.role === 'enemy');
      const observations = {
        roles,
        effects,
        playerRender: player?.render?.actor ?? null,
        playerAttack: round(player?.render?.attack),
        enemyRender: enemy?.render?.actor ?? null,
        enemyHurt: round(enemy?.render?.hurt),
        tilemapId: readModel.authoredScene.tilemap?.id ?? null
      };
      if (record.elapsed < 0.1) return { observations };
      if (!roles.includes('player') || !roles.includes('enemy')) return { status: 'failed', message: 'Render read model missing player or enemy actor.', observations };
      if (!effects.includes('dust') || !effects.includes('particle')) return { status: 'failed', message: 'Render read model missing transient effects.', observations };
      if (observations.playerRender !== 'player' || observations.enemyRender !== 'slime') return { status: 'failed', message: 'Render read model mapped actors to unexpected render assets.', observations };
      if (observations.playerAttack <= 0 || observations.enemyHurt <= 0) return { status: 'failed', message: 'Render read model did not expose showcase animation state.', observations };
      return { status: 'passed', message: 'Render read model exposes showcase actors and effects.', observations };
    }
  }
];
