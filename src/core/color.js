function assertByte(value, name) {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new Error(`${name} must be an integer byte between 0 and 255`);
  }
  return value;
}

function rgbaTuple(r, g, b, a) {
  return Object.freeze([
    assertByte(r, 'color.r'),
    assertByte(g, 'color.g'),
    assertByte(b, 'color.b'),
    assertByte(a, 'color.a')
  ]);
}

export function isRgba(value) {
  return Array.isArray(value) && value.length === 4 && value.every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255);
}

export function assertRgba(value, name = 'color') {
  if (!isRgba(value)) throw new Error(`${name} must be an RGBA byte tuple`);
  return value;
}

export const Color = Object.freeze({
  rgb(r, g, b) {
    return rgbaTuple(r, g, b, 255);
  },

  rgba(r, g, b, a) {
    return rgbaTuple(r, g, b, a);
  }
});
