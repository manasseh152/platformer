import { resetGameplaySession, syncGameplaySessionToGame } from '#/core/gameplay-session.js';
import { compileDraft } from '#/content/tilemaps/draft-compiler.js';

export const PREVIEW_TILEMAP_PARAM = 'previewTilemapKey';
export const PREVIEW_STORAGE_PREFIX = 'chibi.tilemap-preview.';

function readPreviewKey(search = globalThis.location?.search ?? '') {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return params.get(PREVIEW_TILEMAP_PARAM) || null;
}

function storageKey(id) {
  return `${PREVIEW_STORAGE_PREFIX}${id}`;
}

export function isTilemapPreviewActive(game) {
  return Boolean(game?.session?.previewMode || (typeof document !== 'undefined' && document.body?.dataset?.previewTilemapStatus === 'loaded'));
}

function fail(reason, message, runtime, detail = {}) {
  runtime?.emit?.('tilemap.preview.failed', { reason, message, ...detail });
  console.warn(message);
  document.body.dataset.previewTilemapStatus = 'failed';
  document.body.dataset.previewTilemapFailure = reason;
  return { handled: true, ok: false, reason, message };
}

export function applyTilemapPreviewFromUrl(game, runtime = game.runtime, search = globalThis.location?.search ?? '') {
  const previewKey = readPreviewKey(search);
  if (!previewKey) return { handled: false, ok: true, reason: null };

  const key = storageKey(previewKey);
  const raw = localStorage.getItem(key);
  if (!raw) return fail('missing-payload', 'Preview tilemap payload missing.', runtime, { previewKey });

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    return fail('invalid-json', 'Preview tilemap payload invalid.', runtime, { previewKey, error: error.message });
  }

  try {
    const tilemap = compileDraft(payload.draft);
    game.session.developerModeOverride = true;
    game.session.previewMode = true;
    game.tilemap = tilemap;
    resetGameplaySession(game.gameplaySession, tilemap, {
      view: game.view,
      scenarioId: `preview:${payload.draft?.id ?? tilemap.id}`,
      goal: { type: 'finish-gate' }
    });
    syncGameplaySessionToGame(game, game.gameplaySession);
    document.body.dataset.tilemapId = tilemap.id;
    document.body.dataset.previewTilemapStatus = 'loaded';
    document.body.dataset.previewTilemapId = tilemap.id;
    localStorage.removeItem(key);
    runtime?.emit?.('tilemap.preview.loaded', { previewKey, tilemapId: tilemap.id });
    return { handled: true, ok: true, reason: null, tilemap };
  } catch (error) {
    return fail('compile-failed', error.message, runtime, { previewKey });
  }
}
