export const GpuFallback = Object.freeze({
  DISABLED: 'disabled',
  CPU: 'cpu',
  ERROR: 'error'
});

export async function createGpuFeature({ id, webgpu, cpu, fallback = GpuFallback.DISABLED }) {
  try {
    const feature = await webgpu?.();
    if (feature) return { id, backend: 'webgpu', feature };
  } catch (error) {
    console.warn(`GPU feature ${id} unavailable.`, error);
    if (fallback === GpuFallback.ERROR) throw error;
  }

  if (fallback === GpuFallback.CPU && cpu) return { id, backend: 'cpu', feature: await cpu() };
  if (fallback === GpuFallback.ERROR) throw new Error(`GPU feature ${id} requires WebGPU.`);
  return { id, backend: 'disabled', feature: null };
}
