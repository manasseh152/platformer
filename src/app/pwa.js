import { registerSW } from 'virtual:pwa-register';

export const updateInstalledApp = registerSW({
  immediate: false,
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('chibi:pwa-update-available', { detail: { updateInstalledApp } }));
  },
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent('chibi:pwa-offline-ready'));
  },
  onRegisteredSW(swUrl, registration) {
    window.__CHIBI_PWA__ = { swUrl, registration, updateInstalledApp };
  }
});
