import { createScriptedGameplayInput } from './scripted-gameplay-input.js';

const TERMINAL_STATUSES = new Set(['passed', 'failed']);
const VALID_AUTHORITIES = new Set(['input', 'state-fixture', 'observer']);

function assertMachine(machine) {
  if (!machine?.id || typeof machine.id !== 'string') throw new Error('Gym machine requires a string id.');
  if (!machine.label || typeof machine.label !== 'string') throw new Error(`Gym machine "${machine.id}" requires a label.`);
  if (!VALID_AUTHORITIES.has(machine.authority)) throw new Error(`Gym machine "${machine.id}" requires authority input, state-fixture, or observer.`);
  if (!Array.isArray(machine.validates) || machine.validates.some(item => typeof item !== 'string')) throw new Error(`Gym machine "${machine.id}" validates must be strings.`);
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : value;
}

function createMachineRecord(machine) {
  assertMachine(machine);
  return {
    definition: machine,
    id: machine.id,
    label: machine.label,
    authority: machine.authority,
    validates: [...machine.validates],
    execution: machine.execution || (machine.authority === 'input' ? 'exclusive' : 'parallel'),
    status: 'idle',
    elapsed: 0,
    message: '',
    observations: {}
  };
}

function aggregateStatus(records) {
  if (!records.length) return 'idle';
  if (records.some(record => record.status === 'failed')) return 'failed';
  if (records.some(record => record.status === 'running')) return 'running';
  if (records.some(record => record.status === 'paused')) return 'paused';
  if (records.every(record => record.status === 'passed')) return 'passed';
  return 'idle';
}

export function createGymMachineRunner({ id, name, machines = [], machinePolicy = {}, getSession, resetWorld = null } = {}) {
  if (!id) throw new Error('Gym machine runner requires a gym id.');
  if (typeof getSession !== 'function') throw new Error('Gym machine runner requires getSession.');
  const records = machines.map(createMachineRecord);
  const scriptedInput = createScriptedGameplayInput();
  let autoStarted = false;
  let activeInputActions = null;
  let runningExclusiveId = null;

  function call(record, method, args = []) {
    const fn = record.definition?.[method];
    if (typeof fn !== 'function') return null;
    return fn(...args);
  }

  function setup(record, runtime) {
    record.elapsed = 0;
    record.message = '';
    record.observations = {};
    call(record, 'setup', [{ session: getSession(), runtime, record }]);
  }

  function start(id, runtime) {
    const record = records.find(item => item.id === id);
    if (!record || TERMINAL_STATUSES.has(record.status) || record.status === 'running') return record ?? null;
    if (record.execution === 'exclusive') {
      const runningExclusive = records.find(item => item.execution === 'exclusive' && item.status === 'running' && item.id !== record.id);
      if (runningExclusive) return record;
      runningExclusiveId = record.id;
    }
    if (record.status === 'idle') setup(record, runtime);
    record.status = 'running';
    record.message = record.message || 'Running.';
    call(record, 'start', [{ session: getSession(), runtime, record }]);
    return record;
  }

  function pause(id, runtime) {
    const record = records.find(item => item.id === id);
    if (!record || record.status !== 'running') return record ?? null;
    record.status = 'paused';
    if (record.execution === 'exclusive' && runningExclusiveId === record.id) runningExclusiveId = null;
    record.message = 'Paused.';
    call(record, 'pause', [{ session: getSession(), runtime, record }]);
    return record;
  }

  function reset(id, runtime) {
    const record = records.find(item => item.id === id);
    if (!record) return null;
    record.status = 'idle';
    setup(record, runtime);
    call(record, 'reset', [{ session: getSession(), runtime, record }]);
    return record;
  }

  function startNextExclusive(runtime) {
    if (records.some(record => record.execution === 'exclusive' && record.status === 'running')) return null;
    const next = records.find(record => record.execution === 'exclusive' && !TERMINAL_STATUSES.has(record.status));
    if (!next) {
      runningExclusiveId = null;
      return null;
    }
    resetWorld?.();
    return start(next.id, runtime);
  }

  function startAll(runtime) {
    for (const record of records) {
      if (record.execution === 'exclusive') continue;
      start(record.id, runtime);
    }
    startNextExclusive(runtime);
    return snapshot();
  }

  function pauseAll(runtime) {
    records.forEach(record => pause(record.id, runtime));
    return snapshot();
  }

  function resetAll(runtime, { autoStart = machinePolicy.autoStart } = {}) {
    resetWorld?.();
    runningExclusiveId = null;
    records.forEach(record => {
      record.status = 'idle';
      setup(record, runtime);
      call(record, 'reset', [{ session: getSession(), runtime, record }]);
    });
    autoStarted = false;
    if (autoStart) startAll(runtime);
    return snapshot();
  }

  function beforeGameplayUpdate(runtime, dt) {
    if (machinePolicy.autoStart !== false && !autoStarted) {
      autoStarted = true;
      startAll(runtime);
    }

    activeInputActions = null;
    for (const record of records) {
      if (record.status !== 'running') continue;
      const result = call(record, 'beforeUpdate', [{ session: getSession(), runtime, dt, record }]);
      if (record.authority === 'input' && result?.input) activeInputActions = result.input;
    }
    scriptedInput.setActions(activeInputActions ?? {});
    return activeInputActions;
  }

  function afterGameplayUpdate(runtime, dt) {
    for (const record of records) {
      if (record.status !== 'running') continue;
      record.elapsed += dt;
      const result = call(record, 'afterUpdate', [{ session: getSession(), runtime, dt, record }]);
      if (result?.observations) record.observations = { ...record.observations, ...result.observations };
      if (result?.status === 'passed' || result?.status === 'failed') {
        record.status = result.status;
        if (record.execution === 'exclusive' && runningExclusiveId === record.id) runningExclusiveId = null;
        record.message = result.message || (result.status === 'passed' ? 'Passed.' : 'Failed.');
        if (result.observations) record.observations = { ...record.observations, ...result.observations };
      } else if (result?.message) {
        record.message = result.message;
      }
    }
    if (machinePolicy.autoStart !== false) startNextExclusive(runtime);
    activeInputActions = null;
    scriptedInput.setActions({});
  }

  function hasActiveInputAuthority() {
    return records.some(record => record.status === 'running' && record.authority === 'input');
  }

  function snapshot() {
    return {
      id,
      name: name || id,
      status: aggregateStatus(records),
      autoStart: machinePolicy.autoStart !== false,
      machines: records.map(record => ({
        id: record.id,
        label: record.label,
        authority: record.authority,
        validates: [...record.validates],
        execution: record.execution,
        status: record.status,
        elapsed: round(record.elapsed),
        message: record.message,
        observations: { ...record.observations }
      }))
    };
  }

  return {
    id,
    name,
    scriptedInput,
    beforeGameplayUpdate,
    afterGameplayUpdate,
    hasActiveInputAuthority,
    start,
    pause,
    reset,
    startAll,
    pauseAll,
    resetAll,
    snapshot
  };
}
