const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texcoord;
uniform vec2 u_offset;
uniform vec2 u_padding;
varying vec2 v_texcoord;
void main() {
  gl_Position = vec4(a_position * (vec2(1.0) + u_padding) + u_offset, 0.0, 1.0);
  v_texcoord = a_texcoord;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D u_texture;
varying vec2 v_texcoord;
void main() {
  gl_FragColor = texture2D(u_texture, v_texcoord);
}
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Unknown shader compile error';
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
    const message = gl.getProgramInfoLog(program) || 'Unknown WebGL link error';
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

export function createWebGlPresentationBackend(canvas) {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    preserveDrawingBuffer: false,
    stencil: false
  });
  if (!gl) return null;
  const loseContext = gl.getExtension('WEBGL_lose_context');

  let lost = false;
  let program = null;
  let buffer = null;
  let texture = null;
  let positionLocation = -1;
  let texcoordLocation = -1;
  let offsetLocation = null;
  let paddingLocation = null;

  function initResources() {
    program = createProgram(gl);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 0, 0,
       1, -1, 1, 0,
      -1,  1, 0, 1,
       1,  1, 1, 1
    ]), gl.STATIC_DRAW);

    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    positionLocation = gl.getAttribLocation(program, 'a_position');
    texcoordLocation = gl.getAttribLocation(program, 'a_texcoord');
    offsetLocation = gl.getUniformLocation(program, 'u_offset');
    paddingLocation = gl.getUniformLocation(program, 'u_padding');
  }

  function clearResources() {
    if (texture) gl.deleteTexture(texture);
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    program = null;
    buffer = null;
    texture = null;
    positionLocation = -1;
    texcoordLocation = -1;
    offsetLocation = null;
    paddingLocation = null;
  }

  initResources();
  canvas.addEventListener?.('webglcontextlost', event => { event.preventDefault(); lost = true; clearResources(); });
  canvas.addEventListener?.('webglcontextrestored', () => { lost = false; initResources(); });

  return {
    kind: 'webgl-presentation-backend',
    mode: 'webgl',
    canvas,
    get lost() { return lost || gl.isContextLost?.() === true; },
    present(source, viewport, { subpixelOffsetX = 0, subpixelOffsetY = 0 } = {}) {
      if (source.kind !== 'canvas2d') throw new Error(`Unsupported native frame source: ${source.kind}`);
      if (this.lost || !program) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.03, 0.045, 0.07, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.viewport(viewport.offsetX, viewport.offsetY, Math.round(source.width * viewport.scale), Math.round(source.height * viewport.scale));
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(texcoordLocation);
      gl.vertexAttribPointer(texcoordLocation, 2, gl.FLOAT, false, 16, 8);
      gl.uniform2f(offsetLocation, 2 * subpixelOffsetX / source.width, -2 * subpixelOffsetY / source.height);
      gl.uniform2f(paddingLocation, 2 / source.width, 2 / source.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source.canvas);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    destroy() {
      clearResources();
      loseContext?.loseContext?.();
      lost = true;
    }
  };
}
