import { compileDraft, hasEntitySymbol, normalizeDraft } from '../../editor/tilemap-draft.js';
import { isKebabCaseId } from '../id.js';

export const LOCAL_DRAFT_STORAGE_PREFIX = 'chibi.tilemap-editor.';
export const LOCAL_DRAFT_VIEW_STORAGE_PREFIX = 'chibi.tilemap-editor-view.';

export function localDraftStorageKey(id) { return `${LOCAL_DRAFT_STORAGE_PREFIX}${id}`; }
export function localDraftViewStorageKey(id) { return `${LOCAL_DRAFT_VIEW_STORAGE_PREFIX}${id}`; }

function storageKeys(storage) {
  if (typeof storage?.keys === 'function') return storage.keys();
  return [];
}

const listCacheByStorage = new WeakMap();
const fallbackListCache = { recordsByKey: new Map() };

function listCacheFor(storage) {
  if (!storage || (typeof storage !== 'object' && typeof storage !== 'function')) return fallbackListCache;
  let cache = listCacheByStorage.get(storage);
  if (!cache) {
    cache = { recordsByKey: new Map() };
    listCacheByStorage.set(storage, cache);
  }
  return cache;
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

export function readLocalDraft(storage, id) {
  const raw = storage?.getItem?.(localDraftStorageKey(id));
  if (!raw) return { ok: false, id, draft: null, reason: 'missing-local-draft', message: 'Local draft not found.' };
  try {
    const draft = normalizeDraft(JSON.parse(raw));
    return { ok: true, id: draft?.id || id, draft, raw };
  } catch (error) {
    return { ok: false, id, draft: null, reason: 'invalid-json', message: 'Saved JSON is malformed.', error };
  }
}

export function saveLocalDraft(storage, draft, { now = Date.now } = {}) {
  if (!isKebabCaseId(draft?.id)) return { ok: false, reason: 'invalid-id', message: 'Draft id must be kebab-case.' };
  const saved = { ...clone(draft), updatedAt: now() };
  storage?.setItem?.(localDraftStorageKey(saved.id), JSON.stringify(saved));
  return { ok: true, draft: saved, key: localDraftStorageKey(saved.id) };
}

export function validateLocalDraftForPlay(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return { ok: false, playable: false, reason: 'invalid-draft', message: 'Invalid draft.' };
  if (!isKebabCaseId(draft.id)) return { ok: false, playable: false, reason: 'invalid-id', message: 'Draft id must be kebab-case.' };
  let tilemap;
  try {
    tilemap = compileDraft({
      ...draft,
      id: `local:${draft.id}`,
      visibility: 'public',
      categories: ['local'],
      description: draft.description || 'Local draft saved on this device.'
    });
  } catch (error) {
    return { ok: false, playable: false, reason: 'compile-failed', message: error.message, error };
  }
  if (!hasEntitySymbol(draft, 'P')) return { ok: true, playable: false, reason: 'missing-player', message: 'Needs Player P.', tilemap };
  const warning = hasEntitySymbol(draft, 'G') ? null : 'No finish gate.';
  return { ok: true, playable: true, reason: null, message: warning || 'Ready to play.', warning, tilemap };
}

export function localDraftScenarioId(id) { return `local:${id}`; }
export function localDraftIdFromScenarioId(id) { return typeof id === 'string' && id.startsWith('local:') ? id.slice('local:'.length) : null; }

export function scenarioFromLocalDraft(draft, validation = validateLocalDraftForPlay(draft)) {
  const scenarioId = localDraftScenarioId(draft.id);
  return {
    id: scenarioId,
    source: 'local',
    name: draft.name || draft.id,
    categories: ['local'],
    visibility: 'public',
    description: draft.description || 'Local draft saved on this device.',
    localDraft: { id: draft.id, updatedAt: draft.updatedAt ?? null, cols: draft.cols, rows: draft.rows, validation },
    composition: validation.playable ? {
      type: 'tilemap-gameplay',
      stack: [{ scene: 'gameplay', props: { tilemap: validation.tilemap, scenarioId, goal: { type: 'finish-gate' } } }]
    } : { type: 'unplayable-local-draft', stack: [] }
  };
}

export function countLocalDraftRecords(storage) {
  const prefix = LOCAL_DRAFT_STORAGE_PREFIX;
  return storageKeys(storage)
    .filter(key => typeof key === 'string' && key.startsWith(prefix) && !key.startsWith(LOCAL_DRAFT_VIEW_STORAGE_PREFIX))
    .length;
}

function recordForLocalDraftKey(storage, key, cache) {
  const id = key.slice(LOCAL_DRAFT_STORAGE_PREFIX.length);
  const raw = storage?.getItem?.(key);
  const cached = cache.recordsByKey.get(key);
  if (cached?.raw === raw) return cached.record;

  let record;
  if (!raw) {
    const read = { ok: false, id, draft: null, reason: 'missing-local-draft', message: 'Local draft not found.' };
    record = { id, key, draft: null, error: read, validation: { ok: false, playable: false, reason: read.reason, message: read.message } };
  } else {
    try {
      const draft = normalizeDraft(JSON.parse(raw));
      const validation = validateLocalDraftForPlay(draft);
      record = { id: draft?.id || id, key, draft, validation };
    } catch (error) {
      const read = { ok: false, id, draft: null, reason: 'invalid-json', message: 'Saved JSON is malformed.', error };
      record = { id, key, draft: null, error: read, validation: { ok: false, playable: false, reason: read.reason, message: read.message } };
    }
  }
  cache.recordsByKey.set(key, { raw, record });
  return record;
}

export function listLocalDraftRecords(storage) {
  const prefix = LOCAL_DRAFT_STORAGE_PREFIX;
  const keys = storageKeys(storage)
    .filter(key => typeof key === 'string' && key.startsWith(prefix) && !key.startsWith(LOCAL_DRAFT_VIEW_STORAGE_PREFIX));
  const cache = listCacheFor(storage);
  const liveKeys = new Set(keys);
  for (const key of cache.recordsByKey.keys()) if (!liveKeys.has(key)) cache.recordsByKey.delete(key);
  const records = keys.map(key => recordForLocalDraftKey(storage, key, cache));
  return records.sort((a, b) => {
    const at = Number.isFinite(a.draft?.updatedAt) ? a.draft.updatedAt : -Infinity;
    const bt = Number.isFinite(b.draft?.updatedAt) ? b.draft.updatedAt : -Infinity;
    if (at !== bt) return bt - at;
    return String(a.draft?.name || a.id).localeCompare(String(b.draft?.name || b.id)) || String(a.id).localeCompare(String(b.id));
  });
}

export function getLocalDraftScenarioById(storage, scenarioId) {
  const draftId = localDraftIdFromScenarioId(scenarioId);
  if (!draftId) return null;
  const read = readLocalDraft(storage, draftId);
  if (!read.ok) return null;
  return scenarioFromLocalDraft(read.draft);
}

export function getAllLocalDraftScenarios(storage) {
  return listLocalDraftRecords(storage)
    .filter(record => record.draft)
    .map(record => scenarioFromLocalDraft(record.draft, record.validation));
}
