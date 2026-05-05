export function ensureMenuDom(documentRef = document) {
  const gameShell = documentRef.getElementById('gameShell');
  if (gameShell && !documentRef.getElementById('scene-root')) {
    gameShell.insertAdjacentHTML('afterend', '<div id="scene-root"></div><div id="overlay-root"></div>');
  }

  const sceneRoot = documentRef.getElementById('scene-root') || documentRef.body;
  const overlayRoot = documentRef.getElementById('overlay-root') || documentRef.body;

  if (!documentRef.getElementById('startScreen')) sceneRoot.insertAdjacentHTML('beforeend', startScreenMarkup());
  if (!documentRef.getElementById('pauseScreen')) overlayRoot.insertAdjacentHTML('beforeend', pauseOverlayMarkup());
}

function startScreenMarkup() {
  return `<div id="startScreen" class="ds-screen ds-screen--hero scene-start-screen">
    <main class="start-stage menu-card ds-panel ds-panel--hero" aria-labelledby="startTitle">
      <section class="hero-copy" aria-label="Game introduction">
        <div class="eyebrow ds-overline">Gate run // local build</div>
        <h1 id="startTitle" class="ds-title">Chibi<br />Knight</h1>
        <p class="hero-lede">Sprint through a tiny moonlit keep, pop over spikes, and reach the glowing gate before the hollow gets brave.</p>
        <ul class="menu-meta ds-chip-list" aria-label="Game summary"><li class="ds-chip">Keyboard</li><li class="ds-chip">Controller</li><li class="ds-chip">Single player</li></ul>
        <div id="selectedLevelSummary" class="selected-level-summary" aria-live="polite">Selected level: Act 01 Level 1</div>
        <div class="menu-actions ds-action-stack"><button id="startButton" class="ds-button ds-button--primary">Start</button><button id="startLevelSelectButton" class="secondary ds-button ds-button--secondary">Level Select</button><button id="startSettingsButton" class="secondary ds-button ds-button--secondary">Settings</button></div>
      </section>
      <aside class="hero-scene" aria-label="Quest preview"><div class="moon" aria-hidden="true"></div><div class="hero-scene__badge">Act 01</div><div class="hero-scene__title">Hollow Gate</div><div class="hero-pixel hero-pixel--torch" aria-hidden="true"></div><div class="hero-runner" aria-hidden="true"><div class="runner-head"></div><div class="runner-body"></div><div class="runner-sword"></div></div><div class="hero-gate" aria-hidden="true"></div><div class="hero-ground" aria-hidden="true"></div><dl class="hero-loadout" aria-label="Run loadout"><div><dt>Objective</dt><dd>Reach gate</dd></div><div><dt>Threat</dt><dd>Spike floor</dd></div><div><dt>Skill</dt><dd>Dash ready</dd></div></dl></aside>
      <nav class="command-bar" aria-label="Menu shortcuts"><span class="input-hint" data-input-hint="accept"></span><span class="input-hint" data-input-hint="back"></span><span class="input-hint" data-input-hint="settings"></span></nav>
    </main>
  </div>`;
}

function pauseOverlayMarkup() {
  return `<div id="pauseScreen" class="ds-screen ds-screen--overlay scene-pause-overlay" data-menu-page="main" data-menu-direction="forward">
    <div class="menu-card ds-panel"><div class="eyebrow ds-overline" id="menuEyebrow">Paused</div><h2 id="menuTitle" class="ds-title">Paused</h2><div id="menuPages" class="menu-pages">
      <div id="pauseMainPage" class="pause-main menu-page" data-page="main"><p>Take a break, restart the run, or change settings.</p><div class="menu-actions ds-action-stack"><button id="resumeButton" class="ds-button ds-button--primary">Continue</button><button id="levelSelectButton" class="secondary ds-button ds-button--secondary">Level Select</button><button id="settingsButton" class="secondary ds-button ds-button--secondary">Settings</button><button id="restartButton" class="secondary ds-button ds-button--secondary">Restart</button><button id="mainMenuButton" class="secondary ds-button ds-button--secondary">Main Menu</button></div></div>
      <div id="levelSelectPage" class="menu-page settings-layout scene-scenario-browser" data-page="level-select"><p>Choose the level to load. Developer Mode reveals gyms, zoos, and other test maps.</p><div id="levelSelectStatus" class="status-line" aria-live="polite"></div><div id="levelSelectList" class="level-select-list" aria-label="Available levels"></div><div class="settings-actions ds-action-row"><button id="levelSelectBackButton" class="ds-button ds-button--primary" data-level-select-back>Back</button></div></div>
      <div id="settingsHubPage" class="menu-page settings-layout scene-settings-overlay" data-page="settings"><p>Tune how the game feels before jumping in.</p><div id="settingsRootRows" class="settings-root-rows"></div><div id="settingsCategoryList" class="settings-category-list" aria-label="Settings categories"></div><div class="settings-actions ds-action-row"><button id="settingsBackButton" class="ds-button ds-button--primary" data-settings-back="root">Back</button></div></div>
      <div id="settingsCategoryPage" class="menu-page settings-layout scene-settings-overlay" data-page="settings-category"><p id="settingsCategoryDescription">Adjust settings.</p><div id="settingsStatus" class="status-line" aria-live="polite"></div><div id="settingsCategoryBody" class="settings-category-body"></div><div class="settings-actions ds-action-row"><button id="settingsCategoryBackButton" class="ds-button ds-button--primary" data-settings-back="category">Back</button></div></div>
    </div></div>
  </div>`;
}
