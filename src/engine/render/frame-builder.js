let nextSequence = 0;

export function createRenderFrameBuilder({ width, height, coordinateSpace = 'native' } = {}) {
  const packets = [];
  return {
    width,
    height,
    coordinateSpace,
    add(packet) {
      if (!packet || typeof packet !== 'object') throw new Error('Render packet must be an object');
      packets.push({ layer: 0, order: 0, ...packet, sequence: nextSequence++ });
      return this;
    },
    addMany(nextPackets = []) {
      for (const packet of nextPackets) this.add(packet);
      return this;
    },
    finalize() {
      const sorted = packets.slice().sort((a, b) =>
        (a.layer ?? 0) - (b.layer ?? 0) ||
        (a.order ?? 0) - (b.order ?? 0) ||
        a.sequence - b.sequence
      );
      return Object.freeze({
        width,
        height,
        coordinateSpace,
        packets: Object.freeze(sorted.map(packet => Object.freeze(packet)))
      });
    }
  };
}

export function resetRenderPacketSequenceForTests() {
  nextSequence = 0;
}
