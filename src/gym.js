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
      id: 'level',
      kind: 'level'
    },
    level: game.level ? {
      id: game.level.id,
      name: game.level.name,
      kind: game.level.kind || 'tilemap-level',
      visibility: game.level.visibility || 'public',
      categories: [...(game.level.categories || [])]
    } : null,
    ui: {
      started: Boolean(game.flags.started),
      paused: Boolean(game.flags.paused),
      won: Boolean(game.flags.won),
      menuPage: game.menu.page,
      menuOrigin: game.menu.origin,
      bodyLevelId: document.body.dataset.levelId || null,
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
