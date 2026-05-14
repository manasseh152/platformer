import { createCapabilityIssue, createCapabilityResult } from './native-frame-capabilities.js';

const SUPPORTED_PACKET_KINDS = new Set(['clear', 'rect', 'roundRect', 'ellipse', 'path', 'image', 'sprite', 'texturedQuad', 'light2d']);
const IMAGE_LIKE_PACKET_KINDS = new Set(['image', 'sprite', 'texturedQuad']);
const SUPPORTED_FILL_KINDS = new Set(['color', 'linearGradient', 'radialGradient']);

function fillKind(fill) {
  if (fill == null) return 'none';
  if (typeof fill === 'string') return 'css-color';
  if (fill.kind === 'color') return 'color';
  return fill.kind ?? typeof fill;
}

function isSupportedFill(fill) {
  return fill == null || typeof fill === 'string' || SUPPORTED_FILL_KINDS.has(fill.kind);
}

function issue(packet, reason, feature, severity = 'required') {
  return createCapabilityIssue({ packet, reason, feature, severity });
}

function lightSupportIssues(packet) {
  if (packet.kind !== 'light2d') return [];
  if (packet.defaultLight && packet.lightKind === 'ambient') return [];
  return [issue(packet, `forward WebGL renders authored ${packet.lightKind ?? 'unknown'} light2d as unlit; use webgl2-deferred for lighting`, 'lighting', 'optional')];
}

function assetSupportIssues(packet, assetRegistry) {
  if (!IMAGE_LIKE_PACKET_KINDS.has(packet.kind)) return [];
  if (!assetRegistry) return [issue(packet, 'asset registry unavailable', 'asset')];
  if (!packet.assetId) return [issue(packet, `missing assetId for ${packet.kind}`, 'asset')];
  if (!assetRegistry.isLoaded?.(packet.assetId)) return [issue(packet, `asset not loaded: ${packet.assetId}`, 'asset')];
  const drawable = assetRegistry.resolveDrawable?.(packet.assetId) ?? { image: assetRegistry.getImage?.(packet.assetId) };
  if (!drawable?.image) return [issue(packet, `asset image unavailable: ${packet.assetId}`, 'asset')];
  return [];
}

export function getWebGlNativeFramePacketSupportIssues(packet, { assetRegistry } = {}) {
  if (!packet || typeof packet !== 'object') return [createCapabilityIssue({ reason: 'packet is not an object', feature: 'packet' })];
  const issues = [];
  if (!SUPPORTED_PACKET_KINDS.has(packet.kind)) issues.push(issue(packet, `unsupported packet kind: ${packet.kind}`, 'packet-kind'));
  if ((packet.kind === 'clear' || packet.kind === 'rect' || packet.kind === 'roundRect' || packet.kind === 'ellipse' || packet.kind === 'path') && !isSupportedFill(packet.fill ?? packet.color)) {
    issues.push(issue(packet, `unsupported fill kind for ${packet.kind}: ${fillKind(packet.fill ?? packet.color)}`, 'fill'));
  }
  issues.push(...lightSupportIssues(packet));
  issues.push(...assetSupportIssues(packet, assetRegistry));
  return issues;
}

export function analyzeWebGlNativeFrameSupport(frame, { assetRegistry } = {}) {
  const issues = [];
  for (const packet of frame?.packets ?? []) issues.push(...getWebGlNativeFramePacketSupportIssues(packet, { assetRegistry }));
  return createCapabilityResult({
    backendKind: 'webgl',
    supported: !issues.some(issue => issue.severity !== 'optional'),
    issues
  });
}
