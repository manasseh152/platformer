export async function createGpuDevice({ powerPreference = 'high-performance' } = {}) {
  if (!globalThis.navigator?.gpu) return null;
  const adapter = await navigator.gpu.requestAdapter({ powerPreference });
  if (!adapter) return null;
  const device = await adapter.requestDevice();
  return { gpu: navigator.gpu, adapter, device };
}

export function getPreferredCanvasFormat(gpu = globalThis.navigator?.gpu) {
  return gpu?.getPreferredCanvasFormat?.() || 'bgra8unorm';
}
