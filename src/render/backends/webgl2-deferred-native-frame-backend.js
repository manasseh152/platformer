export const WEBGL2_DEFERRED_BACKEND_UNAVAILABLE_REASON = 'webgl2 deferred native-frame backend unavailable';

const ALPHA_MASK_CUTOFF = 1 / 255;

let colorParserCanvas = null;
let colorParserContext = null;
const cssColorCache = new Map();
const MAX_CSS_COLOR_CACHE_ENTRIES = 256;

function parseCssColor(value) {
  if (!value || typeof value !== 'string') return null;
  const cached = cssColorCache.get(value);
  if (cached) return cached;
  colorParserCanvas ??= document.createElement('canvas');
  colorParserCanvas.width = 1;
  colorParserCanvas.height = 1;
  colorParserContext ??= colorParserCanvas.getContext('2d', { willReadFrequently: true });
  colorParserContext.clearRect(0, 0, 1, 1);
  colorParserContext.fillStyle = '#000';
  colorParserContext.fillStyle = value;
  colorParserContext.fillRect(0, 0, 1, 1);
  const parsed = Object.freeze(Array.from(colorParserContext.getImageData(0, 0, 1, 1).data));
  if (cssColorCache.size >= MAX_CSS_COLOR_CACHE_ENTRIES) cssColorCache.clear();
  cssColorCache.set(value, parsed);
  return parsed;
}

function resolveColor(fill) {
  if (Array.isArray(fill)) return fill.length === 3 ? [fill[0], fill[1], fill[2], 255] : fill;
  if (typeof fill === 'string') return parseCssColor(fill);
  if (fill?.kind === 'color') return parseCssColor(fill.value);
  return null;
}

function resolveColorFloat(fill) {
  const color = resolveColor(fill);
  return color ? [color[0] / 255, color[1] / 255, color[2] / 255, (color[3] ?? 255) / 255] : null;
}

function resolveFill(ctx, fill) {
  if (!fill) return null;
  if (typeof fill === 'string') return fill;
  if (fill.kind === 'color') return fill.value;
  if (fill.kind === 'linearGradient') {
    const gradient = ctx.createLinearGradient(fill.x0, fill.y0, fill.x1, fill.y1);
    for (const stop of fill.stops ?? []) gradient.addColorStop(stop.offset, stop.color);
    return gradient;
  }
  if (fill.kind === 'radialGradient') {
    const gradient = ctx.createRadialGradient(fill.x0, fill.y0, fill.r0, fill.x1, fill.y1, fill.r1);
    for (const stop of fill.stops ?? []) gradient.addColorStop(stop.offset, stop.color);
    return gradient;
  }
  return null;
}

function applyPathCommand(ctx, command) {
  if (command.op === 'moveTo') ctx.moveTo(command.x, command.y);
  else if (command.op === 'lineTo') ctx.lineTo(command.x, command.y);
  else if (command.op === 'quadraticCurveTo') ctx.quadraticCurveTo(command.cpx, command.cpy, command.x, command.y);
  else if (command.op === 'bezierCurveTo') ctx.bezierCurveTo(command.cp1x, command.cp1y, command.cp2x, command.cp2y, command.x, command.y);
  else if (command.op === 'ellipse') ctx.ellipse(command.x, command.y, command.radiusX, command.radiusY, command.rotation ?? 0, command.startAngle ?? 0, command.endAngle ?? Math.PI * 2);
  else if (command.op === 'closePath') ctx.closePath();
}

function withAlpha(ctx, alpha, draw) {
  if (alpha == null || alpha === 1) return draw();
  const previous = ctx.globalAlpha;
  ctx.globalAlpha = previous * alpha;
  try { return draw(); }
  finally { ctx.globalAlpha = previous; }
}

function resolveImageDrawable(packet, assetRegistry) {
  const drawable = assetRegistry?.resolveDrawable?.(packet.assetId) ?? { image: assetRegistry?.getImage?.(packet.assetId) };
  if (!drawable?.image || !assetRegistry?.isLoaded(packet.assetId)) return null;
  const source = packet.sourceRect ?? drawable.rect ?? { x: 0, y: 0, w: drawable.image.naturalWidth ?? drawable.image.width, h: drawable.image.naturalHeight ?? drawable.image.height };
  if (!source.w || !source.h || !packet.w || !packet.h) return null;
  return { drawable, source };
}

function drawImageLikePacket(ctx, packet, assetRegistry) {
  const resolved = resolveImageDrawable(packet, assetRegistry);
  if (!resolved) return false;
  const { drawable, source } = resolved;
  const { x, y, w, h } = packet;
  ctx.save();
  if (packet.flipX || packet.flipY || packet.rotation) {
    ctx.translate(x + w / 2, y + h / 2);
    if (packet.rotation) ctx.rotate(packet.rotation);
    ctx.scale(packet.flipX ? -1 : 1, packet.flipY ? -1 : 1);
    ctx.drawImage(drawable.image, source.x, source.y, source.w, source.h, -w / 2, -h / 2, w, h);
  } else {
    ctx.drawImage(drawable.image, source.x, source.y, source.w, source.h, x, y, w, h);
  }
  ctx.restore();
  return true;
}

function drawForwardPacket(ctx, packet, assetRegistry) {
  withAlpha(ctx, packet.alpha, () => {
    if (packet.kind === 'clear') {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = resolveFill(ctx, packet.fill ?? packet.color) ?? '#000';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    } else if (packet.kind === 'rect') {
      const fill = resolveFill(ctx, packet.fill);
      if (fill) { ctx.fillStyle = fill; ctx.fillRect(packet.x, packet.y, packet.w, packet.h); }
      if (packet.stroke) { ctx.strokeStyle = packet.stroke; ctx.lineWidth = packet.lineWidth ?? 1; ctx.strokeRect(packet.x, packet.y, packet.w, packet.h); }
    } else if (packet.kind === 'roundRect') {
      ctx.beginPath(); ctx.roundRect(packet.x, packet.y, packet.w, packet.h, packet.radius ?? 0);
      const fill = resolveFill(ctx, packet.fill);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (packet.stroke) { ctx.strokeStyle = packet.stroke; ctx.lineWidth = packet.lineWidth ?? 1; ctx.stroke(); }
    } else if (packet.kind === 'ellipse') {
      ctx.beginPath(); ctx.ellipse(packet.x, packet.y, packet.radiusX, packet.radiusY, packet.rotation ?? 0, packet.startAngle ?? 0, packet.endAngle ?? Math.PI * 2);
      const fill = resolveFill(ctx, packet.fill);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (packet.stroke) { ctx.strokeStyle = packet.stroke; ctx.lineWidth = packet.lineWidth ?? 1; ctx.stroke(); }
    } else if (packet.kind === 'path') {
      ctx.beginPath(); for (const command of packet.commands ?? []) applyPathCommand(ctx, command);
      const fill = resolveFill(ctx, packet.fill);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (packet.stroke) { ctx.strokeStyle = packet.stroke; ctx.lineWidth = packet.lineWidth ?? 1; ctx.stroke(); }
    } else if (packet.kind === 'image' || packet.kind === 'sprite' || packet.kind === 'texturedQuad') {
      drawImageLikePacket(ctx, packet, assetRegistry);
    }
  });
}

function isOpaqueLitRect(packet) {
  return packet?.kind === 'rect' && packet.lighting === 'lit' && (packet.alpha == null || packet.alpha === 1) && Boolean(resolveColor(packet.fill));
}

function isImageLikePacket(packet) {
  return packet?.kind === 'image' || packet?.kind === 'sprite' || packet?.kind === 'texturedQuad';
}

function isOpaqueLitImageLike(packet, assetRegistry) {
  return isImageLikePacket(packet) && packet.lighting === 'lit' && (packet.alpha == null || packet.alpha === 1) && Boolean(resolveImageDrawable(packet, assetRegistry));
}

function addDiagnostic(issues, packet, reason) {
  issues.push({ packetId: packet.id, kind: packet.kind, reason });
}

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in vec2 a_texcoord;
uniform vec2 u_resolution;
out vec2 v_texcoord;
void main() {
  vec2 zeroToOne = a_position / u_resolution;
  vec2 clip = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
  v_texcoord = a_texcoord;
}`;

const ALBEDO_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform bool u_useTexture;
uniform sampler2D u_texture;
uniform vec4 u_color;
uniform float u_alphaCutoff;
in vec2 v_texcoord;
out vec4 outColor;
void main() {
  vec4 color = u_useTexture ? texture(u_texture, v_texcoord) : u_color;
  if (color.a < u_alphaCutoff) discard;
  outColor = vec4(color.rgb, 1.0);
}`;

const LIGHT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform int u_lightKind;
uniform vec2 u_resolution;
uniform vec2 u_lightPosition;
uniform float u_radius;
uniform vec3 u_color;
uniform float u_intensity;
uniform float u_volumetricIntensity;
in vec2 v_texcoord;
out vec4 outColor;
void main() {
  if (u_lightKind == 0) {
    outColor = vec4(u_color * u_intensity, 1.0);
    return;
  }
  vec2 pixel = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) + vec2(0.0, 0.0);
  float distToLight = distance(pixel, u_lightPosition);
  if (distToLight > u_radius) discard;
  float falloff = max(0.0, 1.0 - distToLight / max(u_radius, 0.0001));
  float shaped = falloff * falloff;
  outColor = vec4(u_color * u_intensity * shaped, 1.0);
}`;

const VOLUME_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform vec2 u_lightPosition;
uniform float u_radius;
uniform vec3 u_color;
uniform float u_intensity;
uniform float u_volumetricIntensity;
in vec2 v_texcoord;
out vec4 outColor;
void main() {
  vec2 pixel = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  float distToLight = distance(pixel, u_lightPosition);
  if (distToLight > u_radius) discard;
  float falloff = max(0.0, 1.0 - distToLight / max(u_radius, 0.0001));
  float shaped = falloff * falloff;
  outColor = vec4(u_color * u_intensity * u_volumetricIntensity * shaped, 1.0);
}`;

const COMPOSE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_albedo;
uniform sampler2D u_light;
uniform sampler2D u_volume;
in vec2 v_texcoord;
out vec4 outColor;
void main() {
  vec4 albedo = texture(u_albedo, v_texcoord);
  if (albedo.a <= 0.0) discard;
  vec3 light = texture(u_light, v_texcoord).rgb;
  vec3 volume = texture(u_volume, v_texcoord).rgb;
  outColor = vec4(clamp(albedo.rgb * light + volume, 0.0, 1.0), 1.0);
}`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Unknown WebGL2 deferred shader compile error';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl, fragmentSource) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'Unknown WebGL2 deferred program link error';
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

function createRenderTarget(gl, width, height, { float = false } = {}) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Incomplete WebGL2 deferred framebuffer');
  return { texture, framebuffer, width, height };
}

export function createWebGl2DeferredNativeFrameBackend({ width, height, canvas = document.createElement('canvas'), assetRegistry } = {}) {
  canvas.width = width;
  canvas.height = height;
  const glCanvas = document.createElement('canvas');
  glCanvas.width = width;
  glCanvas.height = height;
  const gl = glCanvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, preserveDrawingBuffer: true, premultipliedAlpha: false, stencil: false });
  if (!gl) return null;
  const loseContext = gl.getExtension('WEBGL_lose_context');
  const supportsFloatTargets = Boolean(gl.getExtension('EXT_color_buffer_float'));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let diagnostics = [];
  let lost = false;
  let albedoProgram, lightProgram, volumeProgram, composeProgram, quadBuffer;
  let albedoTarget, lightTarget, volumeTarget;
  const textureCache = new Map();
  let gpuFrameCount = 0;

  function initResources() {
    albedoProgram = createProgram(gl, ALBEDO_FRAGMENT_SHADER);
    lightProgram = createProgram(gl, LIGHT_FRAGMENT_SHADER);
    volumeProgram = createProgram(gl, VOLUME_FRAGMENT_SHADER);
    composeProgram = createProgram(gl, COMPOSE_FRAGMENT_SHADER);
    quadBuffer = gl.createBuffer();
    albedoTarget = createRenderTarget(gl, glCanvas.width, glCanvas.height);
    lightTarget = createRenderTarget(gl, glCanvas.width, glCanvas.height, { float: supportsFloatTargets });
    volumeTarget = createRenderTarget(gl, glCanvas.width, glCanvas.height, { float: supportsFloatTargets });
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
  }

  function deleteTarget(target) {
    if (!target) return;
    gl.deleteTexture(target.texture);
    gl.deleteFramebuffer(target.framebuffer);
  }

  function clearResources() {
    for (const entry of textureCache.values()) gl.deleteTexture(entry.texture);
    textureCache.clear();
    deleteTarget(albedoTarget); deleteTarget(lightTarget); deleteTarget(volumeTarget);
    if (quadBuffer) gl.deleteBuffer(quadBuffer);
    if (albedoProgram) gl.deleteProgram(albedoProgram);
    if (lightProgram) gl.deleteProgram(lightProgram);
    if (volumeProgram) gl.deleteProgram(volumeProgram);
    if (composeProgram) gl.deleteProgram(composeProgram);
    albedoTarget = lightTarget = volumeTarget = null;
    quadBuffer = albedoProgram = lightProgram = volumeProgram = composeProgram = null;
  }

  function ensureTargets() {
    if (albedoTarget?.width === glCanvas.width && albedoTarget?.height === glCanvas.height) return;
    deleteTarget(albedoTarget); deleteTarget(lightTarget); deleteTarget(volumeTarget);
    albedoTarget = createRenderTarget(gl, glCanvas.width, glCanvas.height);
    lightTarget = createRenderTarget(gl, glCanvas.width, glCanvas.height, { float: supportsFloatTargets });
    volumeTarget = createRenderTarget(gl, glCanvas.width, glCanvas.height, { float: supportsFloatTargets });
  }

  function locations(program) {
    return {
      position: gl.getAttribLocation(program, 'a_position'),
      texcoord: gl.getAttribLocation(program, 'a_texcoord'),
      resolution: gl.getUniformLocation(program, 'u_resolution')
    };
  }

  function setupVertices(program, vertices, setup = () => {}) {
    const loc = locations(program);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
    gl.enableVertexAttribArray(loc.position);
    gl.vertexAttribPointer(loc.position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(loc.texcoord);
    gl.vertexAttribPointer(loc.texcoord, 2, gl.FLOAT, false, 16, 8);
    if (loc.resolution) gl.uniform2f(loc.resolution, glCanvas.width, glCanvas.height);
    setup(program);
  }

  function drawQuad(program, vertices, setup = () => {}) {
    setupVertices(program, vertices, setup);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function drawTriangles(program, vertices, setup = () => {}) {
    setupVertices(program, vertices, setup);
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 4);
  }

  function rectVertices(x, y, w, h, u0 = 0, v0 = 0, u1 = 1, v1 = 1, rotation = 0) {
    if (!rotation) return [x, y, u0, v0, x + w, y, u1, v0, x, y + h, u0, v1, x + w, y + h, u1, v1];
    const cx = x + w / 2, cy = y + h / 2, c = Math.cos(rotation), s = Math.sin(rotation);
    const rot = (px, py) => [cx + px * c - py * s, cy + px * s + py * c];
    const [x0, y0] = rot(-w / 2, -h / 2);
    const [x1, y1] = rot(w / 2, -h / 2);
    const [x2, y2] = rot(-w / 2, h / 2);
    const [x3, y3] = rot(w / 2, h / 2);
    return [x0, y0, u0, v0, x1, y1, u1, v0, x2, y2, u0, v1, x3, y3, u1, v1];
  }

  function ensureTexture(assetId, image) {
    const existing = textureCache.get(assetId);
    const imageWidth = image.naturalWidth ?? image.width;
    const imageHeight = image.naturalHeight ?? image.height;
    if (existing?.image === image && existing.width === imageWidth && existing.height === imageHeight) return existing.texture;
    if (existing) gl.deleteTexture(existing.texture);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    textureCache.set(assetId, { image, width: imageWidth, height: imageHeight, texture });
    return texture;
  }

  function rectTriangleVertices(x, y, w, h, u0 = 0, v0 = 0, u1 = 1, v1 = 1) {
    return [
      x, y, u0, v0, x + w, y, u1, v0, x, y + h, u0, v1,
      x, y + h, u0, v1, x + w, y, u1, v0, x + w, y + h, u1, v1
    ];
  }

  function writeLitRectBatch(packets) {
    if (!packets.length) return;
    const batches = new Map();
    for (const packet of packets) {
      const color = resolveColorFloat(packet.fill);
      if (!color) continue;
      const key = color.join(',');
      let batch = batches.get(key);
      if (!batch) {
        batch = { color, vertices: [] };
        batches.set(key, batch);
      }
      batch.vertices.push(...rectTriangleVertices(packet.x, packet.y, packet.w, packet.h));
    }
    for (const batch of batches.values()) {
      drawTriangles(albedoProgram, batch.vertices, program => {
        gl.uniform1i(gl.getUniformLocation(program, 'u_useTexture'), 0);
        gl.uniform4f(gl.getUniformLocation(program, 'u_color'), batch.color[0], batch.color[1], batch.color[2], batch.color[3]);
        gl.uniform1f(gl.getUniformLocation(program, 'u_alphaCutoff'), 0);
      });
    }
  }

  function writeLitImageLike(packet) {
    const resolved = resolveImageDrawable(packet, assetRegistry);
    if (!resolved) return;
    const { drawable, source } = resolved;
    const image = drawable.image;
    const imageW = image.naturalWidth ?? image.width;
    const imageH = image.naturalHeight ?? image.height;
    let u0 = source.x / imageW, v0 = (source.y + source.h) / imageH, u1 = (source.x + source.w) / imageW, v1 = source.y / imageH;
    if (packet.flipX) [u0, u1] = [u1, u0];
    if (packet.flipY) [v0, v1] = [v1, v0];
    drawQuad(albedoProgram, rectVertices(packet.x, packet.y, packet.w, packet.h, u0, v0, u1, v1, packet.rotation ?? 0), program => {
      gl.uniform1i(gl.getUniformLocation(program, 'u_useTexture'), 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, ensureTexture(packet.assetId, image));
      gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0);
      gl.uniform4f(gl.getUniformLocation(program, 'u_color'), 1, 1, 1, 1);
      gl.uniform1f(gl.getUniformLocation(program, 'u_alphaCutoff'), ALPHA_MASK_CUTOFF);
    });
  }

  function accumulateLights(lights) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (const target of [lightTarget, volumeTarget]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    for (const light of lights) {
      const color = light.color ?? [255, 255, 255, 255];
      const alpha = (color[3] ?? 255) / 255;
      const intensity = (light.intensity ?? 1) * alpha;
      const cr = color[0] / 255, cg = color[1] / 255, cb = color[2] / 255;
      if (light.lightKind === 'ambient') {
        gl.bindFramebuffer(gl.FRAMEBUFFER, lightTarget.framebuffer);
        drawQuad(lightProgram, rectVertices(0, 0, glCanvas.width, glCanvas.height), program => {
          gl.uniform1i(gl.getUniformLocation(program, 'u_lightKind'), 0);
          gl.uniform3f(gl.getUniformLocation(program, 'u_color'), cr, cg, cb);
          gl.uniform1f(gl.getUniformLocation(program, 'u_intensity'), intensity);
          gl.uniform2f(gl.getUniformLocation(program, 'u_lightPosition'), 0, 0);
          gl.uniform1f(gl.getUniformLocation(program, 'u_radius'), 1);
          gl.uniform1f(gl.getUniformLocation(program, 'u_volumetricIntensity'), 0);
        });
      } else if (light.lightKind === 'point') {
        const x = light.x, y = light.y, r = Math.max(0.0001, light.radius ?? 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, lightTarget.framebuffer);
        drawQuad(lightProgram, rectVertices(x - r, y - r, r * 2, r * 2), program => {
          gl.uniform1i(gl.getUniformLocation(program, 'u_lightKind'), 1);
          gl.uniform3f(gl.getUniformLocation(program, 'u_color'), cr, cg, cb);
          gl.uniform1f(gl.getUniformLocation(program, 'u_intensity'), intensity);
          gl.uniform2f(gl.getUniformLocation(program, 'u_lightPosition'), x, y);
          gl.uniform1f(gl.getUniformLocation(program, 'u_radius'), r);
          gl.uniform1f(gl.getUniformLocation(program, 'u_volumetricIntensity'), light.volumetricIntensity ?? 0);
        });
        if ((light.volumetricIntensity ?? 0) > 0) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, volumeTarget.framebuffer);
          drawQuad(volumeProgram, rectVertices(x - r, y - r, r * 2, r * 2), program => {
            gl.uniform3f(gl.getUniformLocation(program, 'u_color'), cr, cg, cb);
            gl.uniform1f(gl.getUniformLocation(program, 'u_intensity'), intensity);
            gl.uniform2f(gl.getUniformLocation(program, 'u_lightPosition'), x, y);
            gl.uniform1f(gl.getUniformLocation(program, 'u_radius'), r);
            gl.uniform1f(gl.getUniformLocation(program, 'u_volumetricIntensity'), light.volumetricIntensity ?? 0);
          });
        }
      }
    }
    gl.disable(gl.BLEND);
  }

  function compose() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    drawQuad(composeProgram, rectVertices(0, 0, glCanvas.width, glCanvas.height), program => {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, albedoTarget.texture); gl.uniform1i(gl.getUniformLocation(program, 'u_albedo'), 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, lightTarget.texture); gl.uniform1i(gl.getUniformLocation(program, 'u_light'), 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, volumeTarget.texture); gl.uniform1i(gl.getUniformLocation(program, 'u_volume'), 2);
    });
  }

  initResources();
  glCanvas.addEventListener?.('webglcontextlost', event => { event.preventDefault(); lost = true; clearResources(); });
  glCanvas.addEventListener?.('webglcontextrestored', () => { lost = false; initResources(); });

  return {
    kind: 'webgl2-deferred-native-frame-backend',
    canvas,
    glCanvas,
    gl,
    ctx,
    get lost() { return lost || gl.isContextLost?.() === true; },
    get diagnostics() { return diagnostics; },
    get gpuDiagnostics() { return { frameCount: gpuFrameCount, floatLightTargets: supportsFloatTargets, albedoTexture: Boolean(albedoTarget?.texture), lightTexture: Boolean(lightTarget?.texture), volumeTexture: Boolean(volumeTarget?.texture), framebuffer: Boolean(albedoTarget?.framebuffer) }; },
    resize(nextWidth, nextHeight) {
      if (canvas.width !== nextWidth) canvas.width = nextWidth;
      if (canvas.height !== nextHeight) canvas.height = nextHeight;
      if (glCanvas.width !== nextWidth) glCanvas.width = nextWidth;
      if (glCanvas.height !== nextHeight) glCanvas.height = nextHeight;
      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      ensureTargets();
    },
    supportsFrame() { return this.lost ? { supported: false, issues: [{ reason: 'webgl2 deferred native-frame context lost' }] } : { supported: true, issues: diagnostics }; },
    draw(frame) {
      if (this.lost) return;
      this.resize(frame.width ?? width, frame.height ?? height);
      diagnostics = [];
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, albedoTarget.framebuffer);
      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const lights = frame.packets.filter(packet => packet.kind === 'light2d');
      const overlayPackets = [];
      let seenLit = false;
      let litPacketCount = 0;
      const pendingLitRects = [];
      const flushLitRects = () => {
        writeLitRectBatch(pendingLitRects);
        pendingLitRects.length = 0;
      };

      for (const packet of frame.packets) {
        if (packet.kind === 'light2d') continue;
        if (isOpaqueLitRect(packet)) {
          seenLit = true;
          litPacketCount++;
          pendingLitRects.push(packet);
        } else if (isOpaqueLitImageLike(packet, assetRegistry)) {
          flushLitRects();
          seenLit = true;
          litPacketCount++;
          writeLitImageLike(packet);
        } else if (packet.lighting === 'lit') {
          flushLitRects();
          const reason = packet.kind === 'rect'
            ? 'semi-transparent or unsupported lit rect rendered forward/unlit'
            : isImageLikePacket(packet)
              ? 'semi-transparent, unloaded, or unsupported lit image rendered forward/unlit'
              : `unsupported lit packet kind rendered forward/unlit: ${packet.kind}`;
          addDiagnostic(diagnostics, packet, reason);
          overlayPackets.push(packet);
        } else if (seenLit) {
          overlayPackets.push(packet);
        } else {
          drawForwardPacket(ctx, packet, assetRegistry);
        }
      }

      flushLitRects();

      if (litPacketCount) {
        accumulateLights(lights);
        compose();
        gl.flush();
        ctx.drawImage(glCanvas, 0, 0);
        gpuFrameCount++;
      }
      for (const packet of overlayPackets) drawForwardPacket(ctx, packet, assetRegistry);
    },
    getSource() { return { kind: 'canvas2d', width: canvas.width, height: canvas.height, canvas }; },
    destroy() { clearResources(); loseContext?.loseContext?.(); lost = true; }
  };
}
