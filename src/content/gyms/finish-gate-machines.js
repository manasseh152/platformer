import { getTransitionCompletionRatio, getTransitionRect } from '../../core/gameplay-scene-queries.js';
import { finishGateMinimumInsideRatio } from '../../core/physics.js';

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : value;
}

function rectObservation(rect) {
  return {
    x: round(rect.x),
    y: round(rect.y),
    w: round(rect.w),
    h: round(rect.h),
    col: rect.col,
    row: rect.row,
    cols: rect.cols,
    rows: rect.rows,
    kind: rect.kind
  };
}

function placePlayerOnRunway(player, tileSize) {
  Object.assign(player, {
    x: tileSize * 2,
    y: tileSize * 6 - player.h,
    vx: 0,
    vy: 0,
    dir: 1,
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

export const finishGateMachines = [
  {
    id: 'finish-gate.collider-coverage',
    label: 'Finish collider coverage',
    authority: 'observer',
    execution: 'parallel',
    validates: ['finish-gate.geometry', 'scene.transition', 'tilemap.entities'],
    afterUpdate({ session }) {
      const gate = getTransitionRect(session.tilemap, 'finish');
      const minimumRatio = finishGateMinimumInsideRatio(session.goal);
      const observations = {
        goal: session.goal?.type ?? null,
        gate: rectObservation(gate),
        minimumColliderInsideRatio: round(minimumRatio)
      };

      if (session.goal?.type !== 'finish-gate') return { status: 'failed', message: 'Finish Gate Gym must launch with a finish-gate goal.', observations };
      if (gate.cols !== 3 || gate.rows !== 1) return { status: 'failed', message: 'Expected a three-tile finish gate fixture.', observations };
      if (minimumRatio <= 0 || minimumRatio > 1) return { status: 'failed', message: 'Finish gate collider coverage threshold must be a 0-1 ratio.', observations };
      return { status: 'passed', message: 'Finish gate completes only after enough of the player collider is inside the gate.', observations };
    }
  },
  {
    id: 'finish-gate.complete-session',
    label: 'Complete session at gate',
    authority: 'input',
    execution: 'exclusive',
    validates: ['finish-gate.transition', 'gameplay.outcome', 'gameplay.input'],
    setup({ session, record }) {
      placePlayerOnRunway(session.player, session.tilemap.tileSize);
      record.observations = {
        startX: round(session.player.x),
        gate: rectObservation(getTransitionRect(session.tilemap, 'finish')),
        minimumColliderInsideRatio: round(finishGateMinimumInsideRatio(session.goal))
      };
    },
    beforeUpdate() {
      return { input: { moveX: 1 } };
    },
    afterUpdate({ session, record }) {
      const { player } = session;
      const startX = record.observations.startX ?? player.x;
      const coverage = getTransitionCompletionRatio(session.tilemap, player, 'finish');
      const observations = {
        startX: round(startX),
        x: round(player.x),
        y: round(player.y),
        vx: round(player.vx),
        grounded: Boolean(player.grounded),
        distance: round(player.x - startX),
        outcome: session.outcome,
        colliderInsideRatio: round(coverage),
        minimumColliderInsideRatio: round(finishGateMinimumInsideRatio(session.goal))
      };

      if (player.dead) return { status: 'failed', message: 'Player died before reaching the finish gate.', observations };
      if (session.outcome === 'completed') return { status: 'passed', message: 'Finish gate completed the gameplay session.', observations };
      if (record.elapsed > 4) return { status: 'failed', message: 'Player did not complete the finish gate fixture in time.', observations };
      return { observations };
    }
  }
];
