import { isPaused, isStarted, isWon } from './app/app-state.js';

function activeElementSnapshot() {
  const active = document.activeElement;
  if (!active || active === document.body) return null;
  return {
    tag: active.tagName.toLowerCase(),
    id: active.id || null,
    text: active.textContent?.trim().replace(/\s+/g, ' ').slice(0, 120) || '',
    dataset: { ...active.dataset }
  };
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : value;
}

export function snapshotGame(game) {
  return {
    scene: game.runtime?.scenes?.snapshot?.() ?? {
      id: 'gameplay',
      kind: 'gameplay'
    },
    tilemap: game.tilemap ? {
      id: game.tilemap.id,
      name: game.tilemap.name,
      kind: game.tilemap.kind || 'tilemap',
      visibility: game.tilemap.visibility || 'public',
      categories: [...(game.tilemap.categories || [])]
    } : null,
    ui: {
      started: isStarted(game),
      paused: isPaused(game),
      won: isWon(game),
      menuPage: game.menu.page,
      menuOrigin: game.menu.origin,
      bodyTilemapId: document.body.dataset.tilemapId || null,
      bodyMenuOrigin: document.body.dataset.menuOrigin || null,
      focused: activeElementSnapshot()
    },
    player: game.player ? {
      x: round(game.player.x),
      y: round(game.player.y),
      vx: round(game.player.vx),
      vy: round(game.player.vy),
      hp: game.player.hp,
      dead: Boolean(game.player.dead),
      grounded: Boolean(game.player.grounded)
    } : null,
    camera: game.camera ? {
      x: round(game.camera.x),
      y: round(game.camera.y),
      shake: round(game.camera.shake)
    } : null,
    settings: {
      developerMode: Boolean(game.settings.developerMode),
      motion: game.settings.motion,
      controllerEnabled: Boolean(game.settings.controllerEnabled)
    },
    devTools: {
      open: Boolean(game.devTools?.open),
      visible: Boolean(game.devTools?.visible),
      sections: game.devTools?.registry?.snapshot?.() ?? []
    }
  };
}

export function syncGymApi(game, runtime = null) {
  if (!game.settings?.developerMode) {
    if (window.__gym) delete window.__gym;
    return;
  }

  window.__gym = {
    snapshot: () => snapshotGame(game),
    events: () => runtime?.events?.() ?? [],
    storage: () => runtime?.storage?.dump?.() ?? null,
    dehydrate: () => runtime?.scenes?.dehydrate?.() ?? null
  };
}
