export const DEFERRED_LIGHTING_BACKEND_KIND = 'webgl2-deferred';

function devFlagEnabled(flags, names) {
  return names.some(name => flags?.[name] === true);
}

export function getLightPackets(frame) {
  return Object.freeze((frame?.packets ?? []).filter(packet => packet?.kind === 'light2d'));
}

export function hasAuthoredLightPackets(frame) {
  return getLightPackets(frame).some(packet => !packet.defaultLight);
}

export function hasOnlyDefaultAmbientLight(frame) {
  const lights = getLightPackets(frame);
  return lights.length > 0 && lights.every(packet => packet.lightKind === 'ambient' && packet.defaultLight === true);
}

export function isDeferredLightingDisabled(flags = {}) {
  return devFlagEnabled(flags, ['disableDeferredLighting', 'deferredLightingDisabled']);
}

export function isDeferredLightingForced(flags = {}) {
  return devFlagEnabled(flags, ['forceDeferredLighting', 'deferredLightingForced']);
}

export function selectNativeFrameBackendKindForFrame(frame, { nativeBackendKind, devToolsFlags = {} } = {}) {
  if (isDeferredLightingDisabled(devToolsFlags)) return nativeBackendKind === 'webgl' ? 'webgl' : 'canvas2d';
  if (nativeBackendKind === 'webgl2-deferred' || nativeBackendKind === 'deferred') return DEFERRED_LIGHTING_BACKEND_KIND;
  if (nativeBackendKind === 'webgl' || nativeBackendKind === 'canvas2d') return nativeBackendKind;
  if (isDeferredLightingForced(devToolsFlags) || hasAuthoredLightPackets(frame)) return DEFERRED_LIGHTING_BACKEND_KIND;
  return 'canvas2d';
}
