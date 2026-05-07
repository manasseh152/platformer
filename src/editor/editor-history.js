export function createHistory({ limit = 100 } = {}) {
  const undoStack = [];
  const redoStack = [];
  let current = null;

  function canUse(change) {
    return change && change.before !== change.after;
  }

  function trim() {
    while (undoStack.length > limit) undoStack.shift();
  }

  return {
    get canUndo() { return undoStack.length > 0; },
    get canRedo() { return redoStack.length > 0; },
    get undoCount() { return undoStack.length; },
    get redoCount() { return redoStack.length; },
    beginAction(label = 'Edit') {
      if (current) this.commitAction();
      current = { label, changes: [] };
    },
    recordCellChange(change) {
      if (!current || !canUse(change)) return;
      const existing = current.changes.find(candidate => candidate.layerId === change.layerId && candidate.col === change.col && candidate.row === change.row);
      if (existing) {
        existing.after = change.after;
        if (existing.before === existing.after) current.changes = current.changes.filter(candidate => candidate !== existing);
      } else {
        current.changes.push({ ...change });
      }
    },
    commitAction() {
      if (!current) return false;
      const action = current;
      current = null;
      if (!action.changes.length) return false;
      undoStack.push(action);
      trim();
      redoStack.length = 0;
      return true;
    },
    cancelAction() { current = null; },
    clear() {
      current = null;
      undoStack.length = 0;
      redoStack.length = 0;
    },
    undo(applyChange) {
      if (!undoStack.length) return null;
      if (current) this.commitAction();
      const action = undoStack.pop();
      for (let index = action.changes.length - 1; index >= 0; index--) applyChange({ ...action.changes[index], value: action.changes[index].before });
      redoStack.push(action);
      return action;
    },
    redo(applyChange) {
      if (!redoStack.length) return null;
      if (current) this.commitAction();
      const action = redoStack.pop();
      for (const change of action.changes) applyChange({ ...change, value: change.after });
      undoStack.push(action);
      trim();
      return action;
    }
  };
}
