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

  let lost = false;
  let program = null;
  let buffer = null;
  let locations = null;
  const textureCache = new Map();

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

  function drawQuad({ x, y, w, h, u0 = 0, v0 = 0, u1 = 1, v1 = 1, color = [1, 1, 1, 1], texture = null, alpha = 1 }) {
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      x, y, u0, v0,
      x + w, y, u1, v0,
      x, y + h, u0, v1,
      x + w, y + h, u1, v1
    ]), gl.STREAM_DRAW);
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
    drawQuad({ x: packet.x, y: packet.y, w: packet.w, h: packet.h, u0, v0, u1, v1, texture: ensureTexture(packet.assetId, image), alpha: packet.alpha ?? 1 });
  }

  function drawPacket(packet) {
    if (packet.kind === 'clear') {
      const color = resolveColor(packet.fill ?? packet.color) ?? [0, 0, 0, 1];
      gl.clearColor(color[0], color[1], color[2], color[3]);
      gl.clear(gl.COLOR_BUFFER_BIT);
    } else if (packet.kind === 'rect') {
      const color = resolveColor(packet.fill);
      if (color) drawQuad({ x: packet.x, y: packet.y, w: packet.w, h: packet.h, color, alpha: packet.alpha ?? 1 });
      if (packet.stroke) {
        const stroke = resolveColor(packet.stroke);
        const line = packet.lineWidth ?? 1;
        if (stroke) {
          drawQuad({ x: packet.x, y: packet.y, w: packet.w, h: line, color: stroke, alpha: packet.alpha ?? 1 });
          drawQuad({ x: packet.x, y: packet.y + packet.h - line, w: packet.w, h: line, color: stroke, alpha: packet.alpha ?? 1 });
          drawQuad({ x: packet.x, y: packet.y, w: line, h: packet.h, color: stroke, alpha: packet.alpha ?? 1 });
          drawQuad({ x: packet.x + packet.w - line, y: packet.y, w: line, h: packet.h, color: stroke, alpha: packet.alpha ?? 1 });
        }
      }
    } else if (packet.kind === 'image' || packet.kind === 'sprite' || packet.kind === 'texturedQuad') {
      drawImageLikePacket(packet);
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
    destroy() { clearResources(); }
  };
}
