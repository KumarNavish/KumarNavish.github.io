import type { MemoryInput, MemoryItem } from "./types";

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function toMemoryItem(input: MemoryInput, seenAt: number): MemoryItem {
  return {
    ...input,
    embedding: new Float32Array(input.embedding),
    seen_at: seenAt,
  };
}

export function cloneItem(item: MemoryItem): MemoryItem {
  return {
    ...item,
    embedding: new Float32Array(item.embedding),
  };
}
