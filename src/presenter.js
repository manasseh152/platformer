import { calculateViewport } from './core/viewport.js';

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

function makeRenderCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

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

function createWebGlPresenter(canvas) {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    preserveDrawingBuffer: false,
    stencil: false
  });
  if (!gl) return null;

  const program = createProgram(gl);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 0, 0,
     1, -1, 1, 0,
    -1,  1, 0, 1,
     1,  1, 1, 1
  ]), gl.STATIC_DRAW);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  const positionLocation = gl.getAttribLocation(program, 'a_position');
  const texcoordLocation = gl.getAttribLocation(program, 'a_texcoord');
  const offsetLocation = gl.getUniformLocation(program, 'u_offset');
  const paddingLocation = gl.getUniformLocation(program, 'u_padding');

  return {
    mode: 'webgl',
    present(source, viewport, subpixelOffsetX = 0, subpixelOffsetY = 0) {
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
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  };
}

function create2dPresenter(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return {
    mode: '2d',
    present(source, viewport, subpixelOffsetX = 0, subpixelOffsetY = 0) {
      ctx.imageSmoothingEnabled = false;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#080b11';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        source,
        viewport.offsetX + subpixelOffsetX * viewport.scale,
        viewport.offsetY + subpixelOffsetY * viewport.scale,
        Math.round(source.width * viewport.scale),
        Math.round(source.height * viewport.scale)
      );
    }
  };
}

export function createPresenter(canvas, width, height) {
  const renderCanvas = makeRenderCanvas(width, height);
  const renderCtx = renderCanvas.getContext('2d');
  renderCtx.imageSmoothingEnabled = false;

  let output;
  try {
    output = createWebGlPresenter(canvas) || create2dPresenter(canvas);
  } catch (error) {
    console.warn('WebGL presenter unavailable; falling back to 2D canvas.', error);
    output = create2dPresenter(canvas);
  }

  return {
    canvas,
    renderCanvas,
    renderCtx,
    viewport: { scale: 1, offsetX: 0, offsetY: 0 },
    mode: output.mode,
    resize(displayWidth, displayHeight) {
      this.viewport = calculateViewport(displayWidth, displayHeight, width, height);
    },
    present(subpixelOffsetX = 0, subpixelOffsetY = 0) {
      output.present(renderCanvas, this.viewport, subpixelOffsetX, subpixelOffsetY);
    }
  };
}
