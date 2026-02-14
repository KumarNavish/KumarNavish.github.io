import { describe, expect, it } from "vitest";
import { VectorStore, cosineSimilarity } from "./vector_store";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 6);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([0, 1]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 6);
  });

  it("throws for mismatched dimensions", () => {
    expect(() => cosineSimilarity(new Float32Array([1, 2]), new Float32Array([1]))).toThrow(
      /dimensions must match/i,
    );
  });
});

describe("VectorStore", () => {
  it("returns topK sorted by descending similarity", () => {
    const store = new VectorStore<{ label: string }>();
    store.add("a", new Float32Array([1, 0]), { label: "alpha" });
    store.add("b", new Float32Array([0, 1]), { label: "beta" });
    store.add("c", new Float32Array([0.8, 0.2]), { label: "gamma" });

    const hits = store.topK(new Float32Array([1, 0]), 2);
    expect(hits).toHaveLength(2);
    expect(hits[0].id).toBe("a");
    expect(hits[1].id).toBe("c");
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
  });

  it("caps topK at current store size", () => {
    const store = new VectorStore<string>();
    store.add("item", new Float32Array([1, 1]), "payload");
    const hits = store.topK(new Float32Array([1, 1]), 10);
    expect(hits).toHaveLength(1);
    expect(store.size()).toBe(1);
  });
});
