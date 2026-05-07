export function createEditorScheduler({ debounceMs = 250, requestFrame = requestAnimationFrame, clearFrame = cancelAnimationFrame, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let frame = 0;
  let timer = 0;
  let dirty = false;

  function cancelFrame() {
    if (!frame) return;
    clearFrame(frame);
    frame = 0;
  }

  function cancelTimer() {
    if (!timer) return;
    clearTimer(timer);
    timer = 0;
  }

  return {
    get dirty() { return dirty; },
    markDirty() { dirty = true; },
    scheduleFrame(task) {
      if (frame) return;
      frame = requestFrame(() => {
        frame = 0;
        task();
      });
    },
    scheduleDebounced(task) {
      dirty = true;
      cancelTimer();
      timer = setTimer(() => {
        timer = 0;
        dirty = false;
        task();
      }, debounceMs);
    },
    flush(task) {
      cancelFrame();
      cancelTimer();
      const wasDirty = dirty;
      dirty = false;
      task?.(wasDirty);
    },
    cancel() {
      cancelFrame();
      cancelTimer();
      dirty = false;
    }
  };
}
