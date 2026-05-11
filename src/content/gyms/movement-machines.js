const RUN_DURATION_SECONDS = 1.0;
const MIN_EXPECTED_MAX_VX = 105;
const MAX_EXPECTED_FINAL_VX = 114;
const MIN_EXPECTED_DISTANCE = 95;
const MAX_EXPECTED_DISTANCE = 150;

const RUN_LANE_GROUND_Y = 6 * 32;
const JUMP_LANE_GROUND_Y = 11 * 32;
const NPC_LANE_GROUND_Y = 17 * 32;

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : value;
}

function placePlayer(player, { x, groundY, dir = 1 }) {
  Object.assign(player, {
    x,
    y: groundY - player.h,
    vx: 0,
    vy: 0,
    dir,
    grounded: true,
    hp: 5,
    inv: 0,
    attack: 0,
    coyote: 0,
    jumpBuf: 0,
    dash: 0,
    dashCooldown: 0,
    wallDir: 0,
    wallSlide: false,
    dead: false
  });
}

function baseObservations(player, extra = {}) {
  return {
    x: round(player.x),
    y: round(player.y),
    vx: round(player.vx),
    vy: round(player.vy),
    grounded: Boolean(player.grounded),
    ...extra
  };
}

function failIfInvalidSession(session, observations) {
  if (session.player.dead) return { status: 'failed', message: 'Player died during movement validation.', observations };
  if (session.outcome !== 'active') return { status: 'failed', message: `Unexpected gameplay outcome: ${session.outcome}.`, observations };
  return null;
}

export const movementMachines = [
  {
    id: 'movement.run-max-speed',
    label: 'Run max speed',
    authority: 'input',
    execution: 'exclusive',
    validates: ['movement.input', 'movement.physics', 'movement.collision'],
    setup({ session, record }) {
      const { player } = session;
      placePlayer(player, { x: 96, groundY: RUN_LANE_GROUND_Y });
      record.observations = {
        startX: round(player.x),
        startY: round(player.y),
        maxVx: 0,
        distance: 0
      };
    },
    beforeUpdate() {
      return { input: { moveX: 1 } };
    },
    afterUpdate({ session, record }) {
      const { player } = session;
      const startX = record.observations.startX ?? player.x;
      const maxVx = Math.max(record.observations.maxVx ?? 0, player.vx);
      const distance = player.x - startX;
      const observations = baseObservations(player, {
        startX: round(startX),
        endX: round(player.x),
        maxVx: round(maxVx),
        distance: round(distance)
      });

      const invalid = failIfInvalidSession(session, observations);
      if (invalid) return invalid;
      if (record.elapsed < RUN_DURATION_SECONDS) return { observations };

      if (!player.grounded) return { status: 'failed', message: 'Player should remain grounded on the runway.', observations };
      if (maxVx < MIN_EXPECTED_MAX_VX) return { status: 'failed', message: `Expected max vx >= ${MIN_EXPECTED_MAX_VX}.`, observations };
      if (player.vx > MAX_EXPECTED_FINAL_VX) return { status: 'failed', message: `Expected final vx <= ${MAX_EXPECTED_FINAL_VX}.`, observations };
      if (distance < MIN_EXPECTED_DISTANCE || distance > MAX_EXPECTED_DISTANCE) {
        return { status: 'failed', message: `Expected distance between ${MIN_EXPECTED_DISTANCE} and ${MAX_EXPECTED_DISTANCE}.`, observations };
      }
      return { status: 'passed', message: 'Reached expected max speed on flat runway.', observations };
    }
  },
  {
    id: 'movement.jump-gap',
    label: 'Jump gap',
    authority: 'input',
    execution: 'exclusive',
    validates: ['movement.jump', 'movement.physics', 'movement.collision'],
    setup({ session, record }) {
      placePlayer(session.player, { x: 330, groundY: JUMP_LANE_GROUND_Y });
      record.observations = { startX: round(session.player.x), minY: round(session.player.y), wasAirborne: false };
    },
    beforeUpdate({ record }) {
      return { input: { moveX: 1, jumpPressed: record.elapsed < 0.05, jumpHeld: record.elapsed < 0.24 } };
    },
    afterUpdate({ session, record }) {
      const { player } = session;
      const startX = record.observations.startX ?? player.x;
      const wasAirborne = Boolean(record.observations.wasAirborne || !player.grounded);
      const minY = Math.min(record.observations.minY ?? player.y, player.y);
      const distance = player.x - startX;
      const observations = baseObservations(player, { startX: round(startX), distance: round(distance), minY: round(minY), wasAirborne });
      const invalid = failIfInvalidSession(session, observations);
      if (invalid) return invalid;
      if (record.elapsed < 0.5) return { observations };
      if (player.y > JUMP_LANE_GROUND_Y + 64) return { status: 'failed', message: 'Player fell into the jump gap.', observations };
      if (player.grounded && wasAirborne && player.x > 432) return { status: 'passed', message: 'Crossed and landed beyond the jump gap.', observations };
      if (record.elapsed > 1.8) return { status: 'failed', message: 'Player did not clear the jump gap in time.', observations };
      return { observations };
    }
  },
  {
    id: 'movement.run-jump-coupling',
    label: 'Run+jump coupling',
    authority: 'input',
    execution: 'exclusive',
    validates: ['movement.run', 'movement.jump', 'movement.physics'],
    setup({ session, record }) {
      placePlayer(session.player, { x: 128, groundY: RUN_LANE_GROUND_Y });
      record.observations = { startX: round(session.player.x), airborneMaxVx: 0, wasAirborne: false };
    },
    beforeUpdate({ record }) {
      return { input: { moveX: 1, jumpPressed: record.elapsed >= 0.24 && record.elapsed < 0.29, jumpHeld: record.elapsed >= 0.24 && record.elapsed < 0.5 } };
    },
    afterUpdate({ session, record }) {
      const { player } = session;
      const startX = record.observations.startX ?? player.x;
      const wasAirborne = Boolean(record.observations.wasAirborne || !player.grounded);
      const airborneMaxVx = !player.grounded ? Math.max(record.observations.airborneMaxVx ?? 0, player.vx) : (record.observations.airborneMaxVx ?? 0);
      const distance = player.x - startX;
      const observations = baseObservations(player, { startX: round(startX), distance: round(distance), airborneMaxVx: round(airborneMaxVx), wasAirborne });
      const invalid = failIfInvalidSession(session, observations);
      if (invalid) return invalid;
      if (record.elapsed < 0.95) return { observations };
      if (!wasAirborne) return { status: 'failed', message: 'Run+jump never left the ground.', observations };
      if (airborneMaxVx < 95) return { status: 'failed', message: 'Jump did not preserve enough running speed.', observations };
      if (distance < 100) return { status: 'failed', message: 'Run+jump did not cover expected distance.', observations };
      return { status: 'passed', message: 'Running speed carried through jump arc.', observations };
    }
  },
  {
    id: 'movement.air-correction',
    label: 'Air correction',
    authority: 'input',
    execution: 'exclusive',
    validates: ['movement.air-control', 'movement.physics'],
    setup({ session, record }) {
      placePlayer(session.player, { x: 416, groundY: RUN_LANE_GROUND_Y });
      record.observations = { positiveAirVx: 0, negativeAirVx: 0, wasAirborne: false };
    },
    beforeUpdate({ record }) {
      const t = record.elapsed;
      return { input: { moveX: t < 0.22 ? 1 : -1, jumpPressed: t < 0.05, jumpHeld: t < 0.28 } };
    },
    afterUpdate({ session, record }) {
      const { player } = session;
      const airborne = !player.grounded;
      const positiveAirVx = airborne ? Math.max(record.observations.positiveAirVx ?? 0, player.vx) : (record.observations.positiveAirVx ?? 0);
      const negativeAirVx = airborne ? Math.min(record.observations.negativeAirVx ?? 0, player.vx) : (record.observations.negativeAirVx ?? 0);
      const wasAirborne = Boolean(record.observations.wasAirborne || airborne);
      const observations = baseObservations(player, { positiveAirVx: round(positiveAirVx), negativeAirVx: round(negativeAirVx), wasAirborne });
      const invalid = failIfInvalidSession(session, observations);
      if (invalid) return invalid;
      if (record.elapsed < 0.65) return { observations };
      if (!wasAirborne) return { status: 'failed', message: 'Air correction never became airborne.', observations };
      if (positiveAirVx < 25 || negativeAirVx > -25) return { status: 'failed', message: 'Expected horizontal velocity to correct in both air directions.', observations };
      return { status: 'passed', message: 'Airborne input corrected horizontal velocity.', observations };
    }
  },
  {
    id: 'movement.dash-burst',
    label: 'Dash burst',
    authority: 'input',
    execution: 'exclusive',
    validates: ['movement.dash', 'movement.physics'],
    setup({ session, record }) {
      placePlayer(session.player, { x: 96, groundY: RUN_LANE_GROUND_Y, dir: 1 });
      record.observations = { startX: round(session.player.x), maxVx: 0, sawDash: false };
    },
    beforeUpdate({ record }) {
      return { input: { dashPressed: record.elapsed < 0.05 } };
    },
    afterUpdate({ session, record }) {
      const { player } = session;
      const startX = record.observations.startX ?? player.x;
      const maxVx = Math.max(record.observations.maxVx ?? 0, player.vx);
      const sawDash = Boolean(record.observations.sawDash || player.dash > 0 || player.dashCooldown > 0.4);
      const distance = player.x - startX;
      const observations = baseObservations(player, { startX: round(startX), distance: round(distance), maxVx: round(maxVx), sawDash, dashCooldown: round(player.dashCooldown) });
      const invalid = failIfInvalidSession(session, observations);
      if (invalid) return invalid;
      if (record.elapsed < 0.3) return { observations };
      if (!sawDash) return { status: 'failed', message: 'Dash state did not activate.', observations };
      if (maxVx < 240) return { status: 'failed', message: 'Dash did not produce expected burst speed.', observations };
      if (distance < 45) return { status: 'failed', message: 'Dash did not cover expected distance.', observations };
      return { status: 'passed', message: 'Dash produced a horizontal burst and cooldown.', observations };
    }
  },
  {
    id: 'movement.npc-patrol',
    label: 'NPC patrol movement',
    authority: 'observer',
    execution: 'parallel',
    validates: ['movement.npc', 'movement.physics', 'movement.collision'],
    setup({ session, record }) {
      placePlayer(session.player, { x: 32, groundY: RUN_LANE_GROUND_Y });
      const [enemy] = session.enemies ?? [];
      record.observations = { startX: round(enemy?.x), minX: round(enemy?.x), maxX: round(enemy?.x), vx: round(enemy?.vx) };
    },
    afterUpdate({ session, record }) {
      const [enemy] = session.enemies ?? [];
      if (!enemy) return { status: 'failed', message: 'NPC patrol fixture requires a slime enemy.', observations: {} };
      const startX = record.observations.startX ?? enemy.x;
      const minX = Math.min(record.observations.minX ?? enemy.x, enemy.x);
      const maxX = Math.max(record.observations.maxX ?? enemy.x, enemy.x);
      const observations = { startX: round(startX), x: round(enemy.x), y: round(enemy.y), vx: round(enemy.vx), minX: round(minX), maxX: round(maxX), patrolMin: round(enemy.min), patrolMax: round(enemy.max), groundY: NPC_LANE_GROUND_Y };
      if (enemy.hp <= 0) return { status: 'failed', message: 'NPC died during patrol observation.', observations };
      if (record.elapsed < 1.0) return { observations };
      if (maxX - minX < 35) return { status: 'failed', message: 'NPC did not patrol across expected distance.', observations };
      if (Math.abs(enemy.vx) < 1) return { status: 'failed', message: 'NPC patrol velocity stopped.', observations };
      return { status: 'passed', message: 'NPC patrolled within its platform bounds.', observations };
    }
  }
];
