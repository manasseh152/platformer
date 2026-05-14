const BACKEND_KIND_BY_CONTRACT = {
  'canvas2d-native-frame-backend': 'canvas2d',
  'webgl-native-frame-backend': 'webgl',
  'webgl2-deferred-native-frame-backend': 'webgl2-deferred',
  'webgpu-native-frame-backend': 'webgpu',
  'webgpu-deferred-native-frame-backend': 'webgpu-deferred'
};

export const NATIVE_FRAME_BACKEND_MATURITY = Object.freeze({
  canvas2d: Object.freeze({
    backendKind: 'canvas2d',
    tier: 'reference',
    automaticEligible: true,
    defaultEligible: true,
    summary: 'Reference backend for required gameplay visual correctness and fallback rendering.'
  }),
  webgl: Object.freeze({
    backendKind: 'webgl',
    tier: 'experimental',
    automaticEligible: false,
    defaultEligible: false,
    summary: 'Experimental forward GPU backend; available by request and gated by frame capability checks.'
  }),
  'webgl2-deferred': Object.freeze({
    backendKind: 'webgl2-deferred',
    tier: 'specialized',
    automaticEligible: true,
    defaultEligible: false,
    summary: 'Specialized deferred-lighting backend selected only for authored lighting frames.'
  }),
  webgpu: Object.freeze({
    backendKind: 'webgpu',
    tier: 'experimental',
    automaticEligible: false,
    defaultEligible: false,
    summary: 'Future WebGPU native-frame backend spike; must pass the same capability, diagnostics, and parity gates before automatic use.'
  }),
  'webgpu-deferred': Object.freeze({
    backendKind: 'webgpu-deferred',
    tier: 'specialized',
    automaticEligible: false,
    defaultEligible: false,
    summary: 'Future specialized WebGPU deferred backend; must declare pass limitations and deterministic downgrade behavior.'
  })
});

export function backendKindFromNativeBackend(backend) {
  return BACKEND_KIND_BY_CONTRACT[backend?.kind] ?? backend?.kind ?? 'unknown';
}

export function normalizeNativeFrameBackendKind(kindOrBackend) {
  if (typeof kindOrBackend === 'string') return BACKEND_KIND_BY_CONTRACT[kindOrBackend] ?? kindOrBackend;
  return backendKindFromNativeBackend(kindOrBackend);
}

export function getNativeFrameBackendMaturity(kindOrBackend) {
  const backendKind = normalizeNativeFrameBackendKind(kindOrBackend);
  return NATIVE_FRAME_BACKEND_MATURITY[backendKind] ?? Object.freeze({
    backendKind,
    tier: 'unknown',
    automaticEligible: false,
    defaultEligible: false,
    summary: 'Unknown native-frame backend maturity.'
  });
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
