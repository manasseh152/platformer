import { getPreferredCanvasFormat } from '../device.js';

const PRESENT_SHADER = `
struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2f, 4>(
    vec2f(-1.0, -1.0),
    vec2f( 1.0, -1.0),
    vec2f(-1.0,  1.0),
    vec2f( 1.0,  1.0)
  );
  var texcoords = array<vec2f, 4>(
    vec2f(0.0, 1.0),
    vec2f(1.0, 1.0),
    vec2f(0.0, 0.0),
    vec2f(1.0, 0.0)
  );
  var out: VertexOut;
  out.position = vec4f(positions[vertexIndex], 0.0, 1.0);
  out.texcoord = texcoords[vertexIndex];
  return out;
}

@group(0) @binding(0) var sourceTexture: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;

@fragment
fn fs(in: VertexOut) -> @location(0) vec4f {
  return textureSample(sourceTexture, sourceSampler, in.texcoord);
}
`;

export async function createWebGpuPresenter(canvas, gpuContext) {
  if (!gpuContext?.enabled || !gpuContext.device) return null;

  const { gpu, device } = gpuContext;
  const context = canvas.getContext('webgpu');
  if (!context) return null;

  const format = getPreferredCanvasFormat(gpu);
  context.configure({ device, format, alphaMode: 'opaque' });

  const shader = device.createShaderModule({ label: 'present shader', code: PRESENT_SHADER });
  const sampler = device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' });
  const pipeline = device.createRenderPipeline({
    label: 'pixel present pipeline',
    layout: 'auto',
    vertex: { module: shader, entryPoint: 'vs' },
    fragment: { module: shader, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-strip' }
  });

  let sourceTexture = null;
  let sourceView = null;
  let bindGroup = null;
  function ensureSourceTexture(width, height) {
    if (sourceTexture?.width === width && sourceTexture?.height === height) return;
    sourceTexture?.destroy();
    sourceTexture = device.createTexture({
      label: 'present source texture',
      size: [width, height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    sourceTexture.width = width;
    sourceTexture.height = height;
    sourceView = sourceTexture.createView();
    bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sourceView },
        { binding: 1, resource: sampler }
      ]
    });
  }

  return {
    mode: 'webgpu',
    device,
    context,
    present(source, viewport) {
      ensureSourceTexture(source.width, source.height);
      device.queue.copyExternalImageToTexture({ source }, { texture: sourceTexture }, [source.width, source.height]);

      const encoder = device.createCommandEncoder({ label: 'present encoder' });
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.03, g: 0.045, b: 0.07, a: 1 },
          loadOp: 'clear',
          storeOp: 'store'
        }]
      });
      pass.setViewport(viewport.offsetX, viewport.offsetY, Math.round(source.width * viewport.scale), Math.round(source.height * viewport.scale), 0, 1);
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(4);
      pass.end();
      device.queue.submit([encoder.finish()]);
    },
    destroy() {
      sourceTexture?.destroy();
    }
  };
}
