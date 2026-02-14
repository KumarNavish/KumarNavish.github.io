import { describe, expect, it } from "vitest";
import type { RiskTag } from "../../domain/types";
import {
  FifoMemoryStrategy,
  KCenterMemoryStrategy,
  ReservoirMemoryStrategy,
  RiskAwareMemoryStrategy,
  type MemoryInput,
  type MemoryStrategy,
} from "./index";

function makeEmbedding(seed: number): Float32Array {
  const x = Math.cos(seed);
  const y = Math.sin(seed);
  return new Float32Array([x, y]);
}

function makeItem(index: number, risk: RiskTag = "low"): MemoryInput {
  return {
    id: `item-${index}`,
    process_id: "access_request",
    risk_tag: risk,
    embedding: makeEmbedding(index / 3),
  };
}

function ids(strategy: MemoryStrategy): string[] {
  return strategy.getMemory().map((item) => item.id);
}

describe("memory strategies", () => {
  it("enforces capacity across all strategies", () => {
    const examples = Array.from({ length: 14 }, (_, index) => makeItem(index));
    const strategies: MemoryStrategy[] = [
      new FifoMemoryStrategy(5),
      new ReservoirMemoryStrategy(5, { seed: 7 }),
      new KCenterMemoryStrategy(5, { seed: 7 }),
      new RiskAwareMemoryStrategy(5, { seed: 7 }),
    ];

    for (const strategy of strategies) {
      strategy.addExamples(examples);
      expect(strategy.getMemory().length).toBe(5);
    }
  });

  it("is deterministic with the same seed", () => {
    const examples = Array.from({ length: 30 }, (_, index) =>
      makeItem(index, index % 3 === 0 ? "high" : index % 3 === 1 ? "medium" : "low"),
    );

    const strategies = [
      {
        left: new ReservoirMemoryStrategy(8, { seed: 11 }),
        right: new ReservoirMemoryStrategy(8, { seed: 11 }),
      },
      {
        left: new KCenterMemoryStrategy(8, { seed: 11 }),
        right: new KCenterMemoryStrategy(8, { seed: 11 }),
      },
      {
        left: new RiskAwareMemoryStrategy(8, { seed: 11 }),
        right: new RiskAwareMemoryStrategy(8, { seed: 11 }),
      },
    ];

    for (const pair of strategies) {
      pair.left.addExamples(examples);
      pair.right.addExamples(examples);
      expect(ids(pair.left)).toEqual(ids(pair.right));
    }
  });

  it("reservoir sampling has approximate uniformity over many seeds", () => {
    const total = 30;
    const capacity = 5;
    const runs = 300;
    const counts = Array.from({ length: total }, () => 0);
    const stream = Array.from({ length: total }, (_, index) => makeItem(index));

    for (let seed = 1; seed <= runs; seed += 1) {
      const strategy = new ReservoirMemoryStrategy(capacity, { seed });
      strategy.addExamples(stream);
      for (const item of strategy.getMemory()) {
        const index = Number(item.id.replace("item-", ""));
        counts[index] += 1;
      }
    }

    const expected = (runs * capacity) / total;
    const min = Math.min(...counts);
    const max = Math.max(...counts);

    expect(min).toBeGreaterThan(expected * 0.45);
    expect(max).toBeLessThan(expected * 1.6);
  });

  it("k-center coreset keeps diverse representatives in a toy example", () => {
    const strategy = new KCenterMemoryStrategy(3, { seed: 0 });
    const examples: MemoryInput[] = [
      { id: "a1", process_id: "access_request", risk_tag: "low", embedding: new Float32Array([1, 0]) },
      { id: "a2", process_id: "access_request", risk_tag: "low", embedding: new Float32Array([0.98, 0.02]) },
      { id: "b1", process_id: "access_request", risk_tag: "low", embedding: new Float32Array([0, 1]) },
      { id: "b2", process_id: "access_request", risk_tag: "low", embedding: new Float32Array([0.02, 0.98]) },
      { id: "c1", process_id: "access_request", risk_tag: "low", embedding: new Float32Array([-1, 0]) },
      { id: "c2", process_id: "access_request", risk_tag: "low", embedding: new Float32Array([-0.98, 0.02]) },
    ];
    strategy.addExamples(examples);

    const selected = strategy.getMemory().map((item) => item.id);
    const hasA = selected.some((id) => id.startsWith("a"));
    const hasB = selected.some((id) => id.startsWith("b"));
    const hasC = selected.some((id) => id.startsWith("c"));

    expect(selected).toHaveLength(3);
    expect(hasA).toBe(true);
    expect(hasB).toBe(true);
    expect(hasC).toBe(true);
  });

  it("risk-aware replay retains proportionally more high-risk samples", () => {
    const strategy = new RiskAwareMemoryStrategy(18, { seed: 19 });
    const stream: MemoryInput[] = [];

    for (let i = 0; i < 30; i += 1) {
      stream.push(makeItem(i, "high"));
      stream.push(makeItem(i + 100, "medium"));
      stream.push(makeItem(i + 200, "low"));
    }
    strategy.addExamples(stream);

    const memory = strategy.getMemory();
    const high = memory.filter((item) => item.risk_tag === "high").length;
    const medium = memory.filter((item) => item.risk_tag === "medium").length;
    const low = memory.filter((item) => item.risk_tag === "low").length;

    expect(memory).toHaveLength(18);
    expect(high).toBeGreaterThanOrEqual(medium);
    expect(medium).toBeGreaterThanOrEqual(low);
    expect(high).toBeGreaterThan(low);
  });
});
