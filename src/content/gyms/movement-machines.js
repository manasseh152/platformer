const RUN_DURATION_SECONDS = 1.2;
const MIN_EXPECTED_MAX_VX = 105;
const MAX_EXPECTED_FINAL_VX = 114;
const MIN_EXPECTED_DISTANCE = 95;
const MAX_EXPECTED_DISTANCE = 150;

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : value;
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
      const observations = {
        startX: round(startX),
        endX: round(player.x),
        y: round(player.y),
        vx: round(player.vx),
        maxVx: round(maxVx),
        distance: round(distance),
        grounded: Boolean(player.grounded)
      };

      if (player.dead) return { status: 'failed', message: 'Player died during max-speed run.', observations };
      if (session.outcome !== 'active') return { status: 'failed', message: `Unexpected gameplay outcome: ${session.outcome}.`, observations };
      if (record.elapsed < RUN_DURATION_SECONDS) return { observations };

      if (!player.grounded) return { status: 'failed', message: 'Player should remain grounded on the runway.', observations };
      if (maxVx < MIN_EXPECTED_MAX_VX) return { status: 'failed', message: `Expected max vx >= ${MIN_EXPECTED_MAX_VX}.`, observations };
      if (player.vx > MAX_EXPECTED_FINAL_VX) return { status: 'failed', message: `Expected final vx <= ${MAX_EXPECTED_FINAL_VX}.`, observations };
      if (distance < MIN_EXPECTED_DISTANCE || distance > MAX_EXPECTED_DISTANCE) {
        return { status: 'failed', message: `Expected distance between ${MIN_EXPECTED_DISTANCE} and ${MAX_EXPECTED_DISTANCE}.`, observations };
      }
      return { status: 'passed', message: 'Reached expected max speed on flat runway.', observations };
    }
  }
];
