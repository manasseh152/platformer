const BACKEND_KIND_BY_CONTRACT = {
  'canvas2d-native-frame-backend': 'canvas2d',
  'webgl-native-frame-backend': 'webgl',
  'webgl2-deferred-native-frame-backend': 'webgl2-deferred'
};

export function backendKindFromNativeBackend(backend) {
  return BACKEND_KIND_BY_CONTRACT[backend?.kind] ?? backend?.kind ?? 'unknown';
}

export function createCapabilityIssue({ packet, packetKind, feature, reason, severity = 'required' } = {}) {
  return Object.freeze({
    sequence: packet?.sequence,
    layer: packet?.layer ?? 0,
    order: packet?.order ?? 0,
    packetKind: packetKind ?? packet?.kind,
    kind: packetKind ?? packet?.kind,
    feature,
    reason,
    severity
  });
}

export function createCapabilityResult({ backendKind, supported, issues = [] }) {
  const normalizedIssues = issues.map(issue => createCapabilityIssue(issue));
  return Object.freeze({
    backendKind,
    supported: Boolean(supported),
    issues: Object.freeze(normalizedIssues)
  });
}

export function analyzeCanvas2DNativeFrameSupport(frame) {
  return createCapabilityResult({
    backendKind: 'canvas2d',
    supported: true,
    issues: []
  });
}
