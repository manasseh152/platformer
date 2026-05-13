export function createInputState() {
  return {
    inputScheme: 'keyboard-mouse',
    listeningFor: null,
    controllerBindAction: null,
    bindMode: 'replace',
    bindProfileId: null,
    bindCapture: null,
    bindDeadline: 0,
    bindError: null,
    suppressMenuInputOnce: false,
    controllerDebugLock: false,
    controllerDebugExitStartedAt: 0,
    keys: new Set(),
    pressed: new Set(),
    gamepadDown: new Set(),
    gamepadPressed: new Set(),
    previousGamepadDown: new Set(),
    latestRawGamepadPressed: []
  };
}
