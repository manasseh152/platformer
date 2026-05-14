import { createCapabilityIssue, createCapabilityResult } from './native-frame-capabilities.js';

const SUPPORTED_PACKET_KINDS = new Set(['clear', 'rect', 'roundRect', 'ellipse', 'path', 'image', 'sprite', 'texturedQuad', 'light2d']);
const IMAGE_PACKET_KINDS = new Set(['image', 'sprite', 'texturedQuad']);
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

function issue(packet, reason, feature) {
  return createCapabilityIssue({ packet, reason, feature, severity: 'required' });
}

export function getWebGlNativeFramePacketSupportIssues(packet) {
  if (!packet || typeof packet !== 'object') return [{ kind: undefined, reason: 'packet is not an object' }];
  const issues = [];
  if (!SUPPORTED_PACKET_KINDS.has(packet.kind)) issues.push(issue(packet, `unsupported packet kind: ${packet.kind}`, 'packet-kind'));
  if ((packet.kind === 'clear' || packet.kind === 'rect' || packet.kind === 'roundRect' || packet.kind === 'ellipse' || packet.kind === 'path') && !isSupportedFill(packet.fill ?? packet.color)) {
    issues.push(issue(packet, `unsupported fill kind for ${packet.kind}: ${fillKind(packet.fill ?? packet.color)}`, 'fill'));
  }
  if (IMAGE_PACKET_KINDS.has(packet.kind) && packet.rotation) issues.push(issue(packet, 'image rotation is not supported', 'rotation'));
  return issues;
}

export function analyzeWebGlNativeFrameSupport(frame) {
  const issues = [];
  for (const packet of frame?.packets ?? []) issues.push(...getWebGlNativeFramePacketSupportIssues(packet));
  return createCapabilityResult({
    backendKind: 'webgl',
    supported: issues.length === 0,
    issues
  });
}
