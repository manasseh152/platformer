import { analyzeCanvas2DNativeFrameSupport } from './native-frame-capabilities.js';

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

function strokeAndFill(ctx, packet) {
  const fill = resolveFill(ctx, packet.fill);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (packet.stroke) {
    ctx.strokeStyle = packet.stroke;
    ctx.lineWidth = packet.lineWidth ?? 1;
    ctx.stroke();
  }
}

function drawImageLikePacket(ctx, packet, assetRegistry) {
  const drawable = assetRegistry?.resolveDrawable?.(packet.assetId) ?? { image: assetRegistry?.getImage?.(packet.assetId) };
  if (!drawable?.image || !assetRegistry?.isLoaded(packet.assetId)) return;
  const source = packet.sourceRect ?? drawable.rect ?? { x: 0, y: 0, w: drawable.image.naturalWidth ?? drawable.image.width, h: drawable.image.naturalHeight ?? drawable.image.height };
  const x = packet.x;
  const y = packet.y;
  const w = packet.w;
  const h = packet.h;
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
}

export function createCanvas2DNativeFrameBackend({ width, height, canvas = document.createElement('canvas'), assetRegistry } = {}) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  function drawPacket(packet) {
    withAlpha(ctx, packet.alpha, () => {
      if (packet.kind === 'clear') {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = resolveFill(ctx, packet.fill ?? packet.color) ?? '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (packet.kind === 'rect') {
        const fill = resolveFill(ctx, packet.fill);
        if (fill) { ctx.fillStyle = fill; ctx.fillRect(packet.x, packet.y, packet.w, packet.h); }
        if (packet.stroke) { ctx.strokeStyle = packet.stroke; ctx.lineWidth = packet.lineWidth ?? 1; ctx.strokeRect(packet.x, packet.y, packet.w, packet.h); }
      } else if (packet.kind === 'roundRect') {
        ctx.beginPath(); ctx.roundRect(packet.x, packet.y, packet.w, packet.h, packet.radius ?? 0); strokeAndFill(ctx, packet);
      } else if (packet.kind === 'ellipse') {
        ctx.beginPath(); ctx.ellipse(packet.x, packet.y, packet.radiusX, packet.radiusY, packet.rotation ?? 0, packet.startAngle ?? 0, packet.endAngle ?? Math.PI * 2); strokeAndFill(ctx, packet);
      } else if (packet.kind === 'path') {
        ctx.beginPath(); for (const command of packet.commands ?? []) applyPathCommand(ctx, command); strokeAndFill(ctx, packet);
      } else if (packet.kind === 'image' || packet.kind === 'sprite' || packet.kind === 'texturedQuad') {
        drawImageLikePacket(ctx, packet, assetRegistry);
      }
    });
  }

  return {
    kind: 'canvas2d-native-frame-backend',
    canvas,
    ctx,
    resize(nextWidth, nextHeight) {
      if (canvas.width !== nextWidth) canvas.width = nextWidth;
      if (canvas.height !== nextHeight) canvas.height = nextHeight;
      ctx.imageSmoothingEnabled = false;
    },
    supportsFrame(frame) {
      return analyzeCanvas2DNativeFrameSupport(frame);
    },
    draw(frame) {
      this.resize(frame.width ?? width, frame.height ?? height);
      ctx.imageSmoothingEnabled = false;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (const packet of frame.packets) drawPacket(packet);
    },
    getSource() {
      return { kind: 'canvas2d', width: canvas.width, height: canvas.height, canvas };
    }
  };
}
