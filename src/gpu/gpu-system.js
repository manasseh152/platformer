import { createGpuDevice } from './device.js';
import { GpuFallback } from './feature.js';

export function createGpuSystem({ settings } = {}) {
  const features = new Map();
  const system = {
    enabled: false,
    backend: 'disabled',
    gpu: null,
    adapter: null,
    device: null,
    ready: null,
    async register(factory) {
      const ctx = await this.ready;
      const descriptor = typeof factory === 'function' ? factory(ctx) : factory;
      if (!descriptor?.id) throw new Error('GPU feature requires an id.');
      if (features.has(descriptor.id)) throw new Error(`GPU feature duplicate id: ${descriptor.id}`);

      let feature = null;
      let backend = 'disabled';
      try {
        if (ctx.enabled && descriptor.webgpu) {
          feature = await descriptor.webgpu(ctx);
          backend = feature ? 'webgpu' : 'disabled';
        }
      } catch (error) {
        console.warn(`GPU feature ${descriptor.id} unavailable.`, error);
        if (descriptor.fallback === GpuFallback.ERROR) throw error;
      }

      if (!feature && descriptor.fallback === GpuFallback.CPU && descriptor.cpu) {
        feature = await descriptor.cpu(ctx);
        backend = 'cpu';
      }
      if (!feature && descriptor.fallback === GpuFallback.ERROR) throw new Error(`GPU feature ${descriptor.id} requires WebGPU.`);

      const entry = { id: descriptor.id, backend, feature };
      features.set(descriptor.id, entry);
      return entry;
    },
    getFeature(id) {
      return features.get(id) ?? null;
    },
    update(dt) {
      for (const entry of features.values()) entry.feature?.update?.(dt);
    },
    render(frame) {
      for (const entry of features.values()) entry.feature?.render?.(frame);
    },
    destroy() {
      for (const entry of features.values()) entry.feature?.destroy?.();
      features.clear();
      this.device?.destroy?.();
      this.enabled = false;
      this.backend = 'disabled';
    }
  };

  system.ready = (async () => {
    if (settings?.gpuExtras === 'off') return system;
    const deviceContext = await createGpuDevice();
    if (!deviceContext) return system;
    Object.assign(system, deviceContext, { enabled: true, backend: 'webgpu' });
    return system;
  })();

  return system;
}
