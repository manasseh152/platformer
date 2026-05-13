function countBy(values, keyFn) {
  const counts = new Map();
  for (const value of values ?? []) {
    const key = keyFn(value) ?? 'unknown';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

export function summarizeRenderFrame(frame) {
  const packets = frame?.packets ?? [];
  return Object.freeze({
    width: frame?.width ?? 0,
    height: frame?.height ?? 0,
    coordinateSpace: frame?.coordinateSpace ?? 'unknown',
    packetCount: packets.length,
    packetsByKind: Object.freeze(countBy(packets, packet => packet.kind)),
    packetsByLayer: Object.freeze(countBy(packets, packet => packet.layer)),
    lightCount: packets.filter(packet => packet.kind === 'light2d').length,
    litPacketCount: packets.filter(packet => packet.lighting === 'lit').length,
    unlitPacketCount: packets.filter(packet => packet.lighting === 'unlit').length
  });
}
