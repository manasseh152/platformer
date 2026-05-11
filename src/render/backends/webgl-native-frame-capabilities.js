const SUPPORTED_PACKET_KINDS = new Set(['clear', 'rect', 'image', 'sprite', 'texturedQuad']);
const IMAGE_PACKET_KINDS = new Set(['image', 'sprite', 'texturedQuad']);

function fillKind(fill) {
  if (fill == null) return 'none';
  if (typeof fill === 'string') return 'css-color';
  if (fill.kind === 'color') return 'color';
  return fill.kind ?? typeof fill;
}

function isColorFill(fill) {
  return fill == null || typeof fill === 'string' || fill.kind === 'color';
}

function issue(packet, reason) {
  return {
    sequence: packet.sequence,
    layer: packet.layer ?? 0,
    order: packet.order ?? 0,
    kind: packet.kind,
    reason
  };
}

export function getWebGlNativeFramePacketSupportIssues(packet) {
  if (!packet || typeof packet !== 'object') return [{ kind: undefined, reason: 'packet is not an object' }];
  const issues = [];
  if (!SUPPORTED_PACKET_KINDS.has(packet.kind)) issues.push(issue(packet, `unsupported packet kind: ${packet.kind}`));
  if ((packet.kind === 'clear' || packet.kind === 'rect') && !isColorFill(packet.fill ?? packet.color)) {
    issues.push(issue(packet, `unsupported fill kind for ${packet.kind}: ${fillKind(packet.fill ?? packet.color)}`));
  }
  if (IMAGE_PACKET_KINDS.has(packet.kind) && packet.rotation) issues.push(issue(packet, 'image rotation is not supported'));
  return issues;
}

export function analyzeWebGlNativeFrameSupport(frame) {
  const issues = [];
  for (const packet of frame?.packets ?? []) issues.push(...getWebGlNativeFramePacketSupportIssues(packet));
  return Object.freeze({
    supported: issues.length === 0,
    issues: Object.freeze(issues)
  });
}
