import { analyzeWebGlNativeFrameSupport } from './webgl-native-frame-capabilities.js';

const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texcoord;
uniform vec2 u_resolution;
varying vec2 v_texcoord;
void main() {
  vec2 zeroToOne = a_position / u_resolution;
  vec2 clip = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
  v_texcoord = a_texcoord;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform bool u_useTexture;
uniform sampler2D u_texture;
uniform vec4 u_color;
uniform float u_alpha;
varying vec2 v_texcoord;
void main() {
  vec4 color = u_useTexture ? texture2D(u_texture, v_texcoord) : u_color;
  gl_FragColor = vec4(color.rgb, color.a * u_alpha);
}
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Unknown WebGL native shader compile error';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'Unknown WebGL native program link error';
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

let colorParserCanvas = null;
function parseCssColor(value) {
  if (!value || typeof value !== 'string') return null;
  colorParserCanvas ??= document.createElement('canvas');
  colorParserCanvas.width = 1;
  colorParserCanvas.height = 1;
  const ctx = colorParserCanvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = '#000';
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255, a / 255];
}

function resolveColor(fill) {
  if (typeof fill === 'string') return parseCssColor(fill);
  if (fill?.kind === 'color') return parseCssColor(fill.value);
  return null;
}

function resolveCanvasFill(ctx, fill) {
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

function fillAndStrokeCanvasPath(ctx, packet) {
  const fill = resolveCanvasFill(ctx, packet.fill);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (packet.stroke) {
    ctx.strokeStyle = packet.stroke;
    ctx.lineWidth = packet.lineWidth ?? 1;
    ctx.stroke();
  }
}

function imageLoaded(assetRegistry, assetId) {
  return Boolean(assetRegistry?.isLoaded?.(assetId));
}

function sourceRectFor(packet, drawable) {
  const image = drawable.image;
  return packet.sourceRect ?? drawable.rect ?? { x: 0, y: 0, w: image.naturalWidth ?? image.width, h: image.naturalHeight ?? image.height };
}

export function createWebGlNativeFrameBackend({ width, height, canvas = document.createElement('canvas'), assetRegistry } = {}) {
  canvas.width = width;
  canvas.height = height;
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
    stencil: false
  });
  if (!gl) return null;
  const loseContext = gl.getExtension('WEBGL_lose_context');

  let lost = false;
  let program = null;
  let buffer = null;
  let locations = null;
  const textureCache = new Map();
  const vectorCanvas = document.createElement('canvas');
  const vectorCtx = vectorCanvas.getContext('2d');
  let vectorTexture = null;

  function initResources() {
    program = createProgram(gl);
    buffer = gl.createBuffer();
    locations = {
      position: gl.getAttribLocation(program, 'a_position'),
      texcoord: gl.getAttribLocation(program, 'a_texcoord'),
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      useTexture: gl.getUniformLocation(program, 'u_useTexture'),
      texture: gl.getUniformLocation(program, 'u_texture'),
      color: gl.getUniformLocation(program, 'u_color'),
      alpha: gl.getUniformLocation(program, 'u_alpha')
    };
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  function clearResources() {
    for (const texture of textureCache.values()) gl.deleteTexture(texture.texture);
    textureCache.clear();
    if (vectorTexture) gl.deleteTexture(vectorTexture);
    vectorTexture = null;
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    buffer = null;
    program = null;
    locations = null;
  }

  function ensureTexture(assetId, image) {
    const existing = textureCache.get(assetId);
    const width = image.naturalWidth ?? image.width;
    const height = image.naturalHeight ?? image.height;
    if (existing?.image === image && existing.width === width && existing.height === height) return existing.texture;
    if (existing) gl.deleteTexture(existing.texture);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    textureCache.set(assetId, { image, width, height, texture });
    return texture;
  }

  function drawQuad({ x, y, w, h, u0 = 0, v0 = 0, u1 = 1, v1 = 1, color = [1, 1, 1, 1], texture = null, alpha = 1, rotation = 0 }) {
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    let vertices;
    if (rotation) {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const c = Math.cos(rotation);
      const s = Math.sin(rotation);
      const rotate = (px, py) => {
        const dx = px - cx;
        const dy = py - cy;
        return [cx + dx * c - dy * s, cy + dx * s + dy * c];
      };
      const topLeft = rotate(x, y);
      const topRight = rotate(x + w, y);
      const bottomLeft = rotate(x, y + h);
      const bottomRight = rotate(x + w, y + h);
      vertices = [
        topLeft[0], topLeft[1], u0, v0,
        topRight[0], topRight[1], u1, v0,
        bottomLeft[0], bottomLeft[1], u0, v1,
        bottomRight[0], bottomRight[1], u1, v1
      ];
    } else {
      vertices = [
        x, y, u0, v0,
        x + w, y, u1, v0,
        x, y + h, u0, v1,
        x + w, y + h, u1, v1
      ];
    }
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
    gl.enableVertexAttribArray(locations.position);
    gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(locations.texcoord);
    gl.vertexAttribPointer(locations.texcoord, 2, gl.FLOAT, false, 16, 8);
    gl.uniform2f(locations.resolution, canvas.width, canvas.height);
    gl.uniform1f(locations.alpha, alpha);
    gl.uniform4f(locations.color, color[0], color[1], color[2], color[3]);
    gl.uniform1i(locations.useTexture, texture ? 1 : 0);
    if (texture) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(locations.texture, 0);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function ensureVectorTexture() {
    if (vectorTexture) return vectorTexture;
    vectorTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, vectorTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return vectorTexture;
  }

  function drawCanvasPacket(packet) {
    if (vectorCanvas.width !== canvas.width) vectorCanvas.width = canvas.width;
    if (vectorCanvas.height !== canvas.height) vectorCanvas.height = canvas.height;
    vectorCtx.setTransform(1, 0, 0, 1, 0, 0);
    vectorCtx.clearRect(0, 0, vectorCanvas.width, vectorCanvas.height);
    vectorCtx.globalAlpha = packet.alpha ?? 1;
    if (packet.kind === 'clear') {
      vectorCtx.fillStyle = resolveCanvasFill(vectorCtx, packet.fill ?? packet.color) ?? '#000';
      vectorCtx.fillRect(0, 0, vectorCanvas.width, vectorCanvas.height);
    } else if (packet.kind === 'rect') {
      const fill = resolveCanvasFill(vectorCtx, packet.fill);
      if (fill) { vectorCtx.fillStyle = fill; vectorCtx.fillRect(packet.x, packet.y, packet.w, packet.h); }
      if (packet.stroke) { vectorCtx.strokeStyle = packet.stroke; vectorCtx.lineWidth = packet.lineWidth ?? 1; vectorCtx.strokeRect(packet.x, packet.y, packet.w, packet.h); }
    } else if (packet.kind === 'roundRect') {
      vectorCtx.beginPath(); vectorCtx.roundRect(packet.x, packet.y, packet.w, packet.h, packet.radius ?? 0); fillAndStrokeCanvasPath(vectorCtx, packet);
    } else if (packet.kind === 'ellipse') {
      vectorCtx.beginPath(); vectorCtx.ellipse(packet.x, packet.y, packet.radiusX, packet.radiusY, packet.rotation ?? 0, packet.startAngle ?? 0, packet.endAngle ?? Math.PI * 2); fillAndStrokeCanvasPath(vectorCtx, packet);
    } else if (packet.kind === 'path') {
      vectorCtx.beginPath(); for (const command of packet.commands ?? []) applyPathCommand(vectorCtx, command); fillAndStrokeCanvasPath(vectorCtx, packet);
    }
    vectorCtx.globalAlpha = 1;
    const texture = ensureVectorTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, vectorCanvas);
    drawQuad({ x: 0, y: 0, w: canvas.width, h: canvas.height, texture });
  }

  function drawImageLikePacket(packet) {
    if (!imageLoaded(assetRegistry, packet.assetId)) return;
    const drawable = assetRegistry?.resolveDrawable?.(packet.assetId) ?? { image: assetRegistry?.getImage?.(packet.assetId) };
    if (!drawable?.image) return;
    const image = drawable.image;
    const source = sourceRectFor(packet, drawable);
    const imageW = image.naturalWidth ?? image.width;
    const imageH = image.naturalHeight ?? image.height;
    if (!imageW || !imageH || !source.w || !source.h) return;
    let u0 = source.x / imageW;
    let v0 = source.y / imageH;
    let u1 = (source.x + source.w) / imageW;
    let v1 = (source.y + source.h) / imageH;
    if (packet.flipX) [u0, u1] = [u1, u0];
    if (packet.flipY) [v0, v1] = [v1, v0];
    drawQuad({ x: packet.x, y: packet.y, w: packet.w, h: packet.h, u0, v0, u1, v1, texture: ensureTexture(packet.assetId, image), alpha: packet.alpha ?? 1, rotation: packet.rotation ?? 0 });
  }

  function drawPacket(packet) {
    if (packet.kind === 'clear') {
      const color = resolveColor(packet.fill ?? packet.color);
      if (color && (packet.alpha == null || packet.alpha === 1)) {
        gl.clearColor(color[0], color[1], color[2], color[3]);
        gl.clear(gl.COLOR_BUFFER_BIT);
      } else {
        drawCanvasPacket(packet);
      }
    } else if (packet.kind === 'rect') {
      const color = resolveColor(packet.fill);
      const stroke = resolveColor(packet.stroke);
      if ((!packet.fill || color) && (!packet.stroke || stroke)) {
        if (color) drawQuad({ x: packet.x, y: packet.y, w: packet.w, h: packet.h, color, alpha: packet.alpha ?? 1 });
        if (stroke) {
          const line = packet.lineWidth ?? 1;
          drawQuad({ x: packet.x, y: packet.y, w: packet.w, h: line, color: stroke, alpha: packet.alpha ?? 1 });
          drawQuad({ x: packet.x, y: packet.y + packet.h - line, w: packet.w, h: line, color: stroke, alpha: packet.alpha ?? 1 });
          drawQuad({ x: packet.x, y: packet.y, w: line, h: packet.h, color: stroke, alpha: packet.alpha ?? 1 });
          drawQuad({ x: packet.x + packet.w - line, y: packet.y, w: line, h: packet.h, color: stroke, alpha: packet.alpha ?? 1 });
        }
      } else {
        drawCanvasPacket(packet);
      }
    } else if (packet.kind === 'roundRect' || packet.kind === 'ellipse' || packet.kind === 'path') {
      drawCanvasPacket(packet);
    } else if (packet.kind === 'image' || packet.kind === 'sprite' || packet.kind === 'texturedQuad') {
      drawImageLikePacket(packet);
    } else if (packet.kind === 'light2d') {
      // The forward WebGL backend does not apply lights; light packets are consumed by the deferred backend.
    }
  }

  initResources();
  canvas.addEventListener?.('webglcontextlost', event => { event.preventDefault(); lost = true; clearResources(); });
  canvas.addEventListener?.('webglcontextrestored', () => { lost = false; initResources(); });

  return {
    kind: 'webgl-native-frame-backend',
    canvas,
    gl,
    get lost() { return lost; },
    resize(nextWidth, nextHeight) {
      if (canvas.width !== nextWidth) canvas.width = nextWidth;
      if (canvas.height !== nextHeight) canvas.height = nextHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    supportsFrame(frame) {
      if (this.lost) return { supported: false, issues: [{ reason: 'webgl native-frame context lost' }] };
      return analyzeWebGlNativeFrameSupport(frame, { assetRegistry });
    },
    draw(frame) {
      if (lost) return;
      this.resize(frame.width ?? width, frame.height ?? height);
      gl.viewport(0, 0, canvas.width, canvas.height);
      for (const packet of frame.packets) drawPacket(packet);
      gl.flush();
    },
    getSource() {
      return { kind: 'canvas2d', width: canvas.width, height: canvas.height, canvas };
    },
    destroy() { clearResources(); loseContext?.loseContext?.(); lost = true; }
  };
}
