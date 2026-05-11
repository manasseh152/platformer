const DEFAULT_ACTIONS = Object.freeze({
  moveX: 0,
  jumpPressed: false,
  jumpHeld: false,
  attackPressed: false,
  dashPressed: false,
  restartPressed: false
});

export function createScriptedGameplayInput(initialActions = {}) {
  const state = { actions: { ...DEFAULT_ACTIONS, ...initialActions } };
  const route = {
    value(action) {
      if (action === 'player.moveX') return state.actions.moveX ?? 0;
      return 0;
    },
    wasPressed(action) {
      if (action === 'player.jump') return Boolean(state.actions.jumpPressed);
      if (action === 'player.attack') return Boolean(state.actions.attackPressed);
      if (action === 'player.dash') return Boolean(state.actions.dashPressed);
      if (action === 'system.restart') return Boolean(state.actions.restartPressed);
      return false;
    },
    isDown(action) {
      if (action === 'player.jump') return Boolean(state.actions.jumpHeld || state.actions.jumpPressed);
      if (action === 'player.attack') return Boolean(state.actions.attackPressed);
      if (action === 'player.dash') return Boolean(state.actions.dashPressed);
      return false;
    },
    consume() {}
  };

  return {
    pressed: { clear() {} },
    gamepadPressed: { clear() {} },
    setActions(actions = {}) {
      state.actions = { ...DEFAULT_ACTIONS, ...actions };
    },
    snapshot() {
      return { ...state.actions };
    },
    route() {
      return route;
    }
  };
}
