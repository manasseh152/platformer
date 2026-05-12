export const WEBGL2_DEFERRED_BACKEND_UNAVAILABLE_REASON = 'webgl2 deferred native-frame backend unavailable';

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
  return Array.from(ctx.getImageData(0, 0, 1, 1).data);
}

function resolveColor(fill) {
  if (Array.isArray(fill)) return fill.length === 3 ? [fill[0], fill[1], fill[2], 255] : fill;
  if (typeof fill === 'string') return parseCssColor(fill);
  if (fill?.kind === 'color') return parseCssColor(fill.value);
  return null;
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
      const drawable = assetRegistry?.resolveDrawable?.(packet.assetId) ?? { image: assetRegistry?.getImage?.(packet.assetId) };
      if (!drawable?.image || !assetRegistry?.isLoaded(packet.assetId)) return;
      const source = packet.sourceRect ?? drawable.rect ?? { x: 0, y: 0, w: drawable.image.naturalWidth ?? drawable.image.width, h: drawable.image.naturalHeight ?? drawable.image.height };
      ctx.drawImage(drawable.image, source.x, source.y, source.w, source.h, packet.x, packet.y, packet.w, packet.h);
    }
  });
}

function isOpaqueLitRect(packet) {
  return packet?.kind === 'rect' && packet.lighting === 'lit' && (packet.alpha == null || packet.alpha === 1) && Boolean(resolveColor(packet.fill));
}

function addDiagnostic(issues, packet, reason) {
  issues.push({ packetId: packet.id, kind: packet.kind, reason });
}

function writeLitRect(albedo, width, height, packet) {
  const color = resolveColor(packet.fill);
  if (!color) return;
  const x0 = Math.max(0, Math.floor(packet.x));
  const y0 = Math.max(0, Math.floor(packet.y));
  const x1 = Math.min(width, Math.ceil(packet.x + packet.w));
  const y1 = Math.min(height, Math.ceil(packet.y + packet.h));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      albedo[i] = color[0];
      albedo[i + 1] = color[1];
      albedo[i + 2] = color[2];
      albedo[i + 3] = 255;
    }
  }
}

function lightPixel(albedo, output, width, height, lights) {
  const ambient = [0, 0, 0];
  const points = [];
  for (const light of lights) {
    const color = light.color ?? [255, 255, 255, 255];
    const alpha = (color[3] ?? 255) / 255;
    const intensity = (light.intensity ?? 1) * alpha;
    if (light.lightKind === 'ambient') {
      ambient[0] += color[0] / 255 * intensity;
      ambient[1] += color[1] / 255 * intensity;
      ambient[2] += color[2] / 255 * intensity;
    } else if (light.lightKind === 'point') {
      points.push({ ...light, cr: color[0] / 255, cg: color[1] / 255, cb: color[2] / 255, intensity });
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (!albedo[i + 3]) continue;
      let lr = ambient[0], lg = ambient[1], lb = ambient[2];
      let vr = 0, vg = 0, vb = 0;
      for (const p of points) {
        const dx = x + 0.5 - p.x;
        const dy = y + 0.5 - p.y;
        const radius = Math.max(0.0001, p.radius ?? 0);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > radius) continue;
        const falloff = Math.max(0, 1 - d / radius);
        const shaped = falloff * falloff;
        lr += p.cr * p.intensity * shaped;
        lg += p.cg * p.intensity * shaped;
        lb += p.cb * p.intensity * shaped;
        const v = (p.volumetricIntensity ?? 0) * p.intensity * shaped;
        vr += p.cr * v * 255;
        vg += p.cg * v * 255;
        vb += p.cb * v * 255;
      }
      output[i] = Math.min(255, Math.round(albedo[i] * lr + vr));
      output[i + 1] = Math.min(255, Math.round(albedo[i + 1] * lg + vg));
      output[i + 2] = Math.min(255, Math.round(albedo[i + 2] * lb + vb));
      output[i + 3] = 255;
    }
  }
}

export function createWebGl2DeferredNativeFrameBackend({ width, height, canvas = document.createElement('canvas'), assetRegistry } = {}) {
  canvas.width = width;
  canvas.height = height;
  const glCanvas = document.createElement('canvas');
  glCanvas.width = width;
  glCanvas.height = height;
  const gl = glCanvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, preserveDrawingBuffer: true, premultipliedAlpha: false, stencil: false });
  if (!gl) return null;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const litCanvas = document.createElement('canvas');
  litCanvas.width = width;
  litCanvas.height = height;
  const litCtx = litCanvas.getContext('2d');
  let diagnostics = [];

  return {
    kind: 'webgl2-deferred-native-frame-backend',
    canvas,
    glCanvas,
    gl,
    ctx,
    get diagnostics() { return diagnostics; },
    resize(nextWidth, nextHeight) {
      if (canvas.width !== nextWidth) canvas.width = nextWidth;
      if (canvas.height !== nextHeight) canvas.height = nextHeight;
      if (glCanvas.width !== nextWidth) glCanvas.width = nextWidth;
      if (glCanvas.height !== nextHeight) glCanvas.height = nextHeight;
      if (litCanvas.width !== nextWidth) litCanvas.width = nextWidth;
      if (litCanvas.height !== nextHeight) litCanvas.height = nextHeight;
      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    },
    supportsFrame() { return { supported: true, issues: diagnostics }; },
    draw(frame) {
      this.resize(frame.width ?? width, frame.height ?? height);
      diagnostics = [];
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const albedo = new Uint8ClampedArray(canvas.width * canvas.height * 4);
      const lightOutput = new Uint8ClampedArray(canvas.width * canvas.height * 4);
      const lights = frame.packets.filter(packet => packet.kind === 'light2d');
      const litPackets = [];
      const overlayPackets = [];
      let seenLit = false;

      for (const packet of frame.packets) {
        if (packet.kind === 'light2d') continue;
        if (isOpaqueLitRect(packet)) {
          seenLit = true;
          litPackets.push(packet);
          writeLitRect(albedo, canvas.width, canvas.height, packet);
        } else if (packet.lighting === 'lit') {
          addDiagnostic(diagnostics, packet, packet.kind === 'rect' ? 'semi-transparent or unsupported lit rect rendered forward/unlit' : `unsupported lit packet kind rendered forward/unlit: ${packet.kind}`);
          overlayPackets.push(packet);
        } else if (seenLit) {
          overlayPackets.push(packet);
        } else {
          drawForwardPacket(ctx, packet, assetRegistry);
        }
      }

      if (litPackets.length) {
        lightPixel(albedo, lightOutput, canvas.width, canvas.height, lights);
        litCtx.clearRect(0, 0, litCanvas.width, litCanvas.height);
        litCtx.putImageData(new ImageData(lightOutput, canvas.width, canvas.height), 0, 0);
        ctx.drawImage(litCanvas, 0, 0);
      }
      for (const packet of overlayPackets) drawForwardPacket(ctx, packet, assetRegistry);
      gl.clearColor(0, 0, 0, 0);
      gl.flush();
    },
    getSource() { return { kind: 'canvas2d', width: canvas.width, height: canvas.height, canvas }; },
    destroy() {}
  };
}
