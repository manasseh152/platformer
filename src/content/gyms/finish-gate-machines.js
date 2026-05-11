import { getTransitionRect, getTransitionTriggerRect } from '../../core/gameplay-scene-queries.js';

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
    id: 'finish-gate.trigger-geometry',
    label: 'Finish trigger geometry',
    authority: 'observer',
    execution: 'parallel',
    validates: ['finish-gate.geometry', 'scene.transition', 'tilemap.entities'],
    afterUpdate({ session }) {
      const gate = getTransitionRect(session.tilemap, 'finish');
      const trigger = getTransitionTriggerRect(session.tilemap, 'finish');
      const observations = {
        goal: session.goal?.type ?? null,
        gate: rectObservation(gate),
        trigger: rectObservation(trigger)
      };

      if (session.goal?.type !== 'finish-gate') return { status: 'failed', message: 'Finish Gate Gym must launch with a finish-gate goal.', observations };
      if (gate.cols !== 3 || gate.rows !== 1) return { status: 'failed', message: 'Expected a three-tile finish gate fixture.', observations };
      if (trigger.x !== gate.x - session.tilemap.tileSize / 2) return { status: 'failed', message: 'Finish trigger should pad the gate horizontally by half a tile.', observations };
      if (trigger.w !== gate.w + session.tilemap.tileSize) return { status: 'failed', message: 'Finish trigger width should include half-tile padding on both sides.', observations };
      if (trigger.h !== gate.h + session.tilemap.tileSize) return { status: 'failed', message: 'Finish trigger should extend one tile downward.', observations };
      return { status: 'passed', message: 'Finish gate trigger geometry matches the expected runtime bounds.', observations };
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
        trigger: rectObservation(getTransitionTriggerRect(session.tilemap, 'finish'))
      };
    },
    beforeUpdate() {
      return { input: { moveX: 1 } };
    },
    afterUpdate({ session, record }) {
      const { player } = session;
      const startX = record.observations.startX ?? player.x;
      const trigger = getTransitionTriggerRect(session.tilemap, 'finish');
      const observations = {
        startX: round(startX),
        x: round(player.x),
        y: round(player.y),
        vx: round(player.vx),
        grounded: Boolean(player.grounded),
        distance: round(player.x - startX),
        outcome: session.outcome,
        trigger: rectObservation(trigger)
      };

      if (player.dead) return { status: 'failed', message: 'Player died before reaching the finish gate.', observations };
      if (session.outcome === 'completed') return { status: 'passed', message: 'Finish gate completed the gameplay session.', observations };
      if (record.elapsed > 4) return { status: 'failed', message: 'Player did not complete the finish gate fixture in time.', observations };
      return { observations };
    }
  }
];
