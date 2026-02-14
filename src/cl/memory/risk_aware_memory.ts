import type { RiskTag } from "../../domain/types";
import type { MemoryInput, MemoryItem, MemoryStrategy } from "./types";
import { cloneItem, mulberry32, toMemoryItem } from "./utils";

const RISK_ORDER: RiskTag[] = ["high", "medium", "low"];

const RISK_WEIGHT: Record<RiskTag, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function allocateQuotas(capacity: number): Record<RiskTag, number> {
  const totalWeight = RISK_ORDER.reduce((sum, risk) => sum + RISK_WEIGHT[risk], 0);
  const quotas: Record<RiskTag, number> = {
    high: Math.floor((capacity * RISK_WEIGHT.high) / totalWeight),
    medium: Math.floor((capacity * RISK_WEIGHT.medium) / totalWeight),
    low: Math.floor((capacity * RISK_WEIGHT.low) / totalWeight),
  };

  let remaining = capacity - (quotas.high + quotas.medium + quotas.low);
  for (const risk of RISK_ORDER) {
    if (remaining === 0) {
      break;
    }
    quotas[risk] += 1;
    remaining -= 1;
  }
  return quotas;
}

function sampleBucket(items: MemoryItem[], count: number, seed: number): MemoryItem[] {
  if (count <= 0 || items.length === 0) {
    return [];
  }
  if (items.length <= count) {
    return [...items];
  }

  const rand = mulberry32(seed);
  return items
    .map((item) => ({
      item,
      score: rand(),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.item.seen_at - b.item.seen_at;
    })
    .slice(0, count)
    .map((entry) => entry.item);
}

export class RiskAwareMemoryStrategy implements MemoryStrategy {
  readonly name = "risk-aware";
  private stream: MemoryItem[] = [];
  private memory: MemoryItem[] = [];
  private seen = 0;

  constructor(
    readonly capacity: number,
    private readonly options?: {
      seed?: number;
    },
  ) {
    if (capacity <= 0) {
      throw new Error("Risk-aware memory capacity must be positive.");
    }
  }

  addExamples(examplesWithEmbeddings: MemoryInput[]) {
    for (const example of examplesWithEmbeddings) {
      this.seen += 1;
      this.stream.push(toMemoryItem(example, this.seen));
    }
    this.recomputeMemory();
  }

  getMemory(): MemoryItem[] {
    return this.memory.map(cloneItem);
  }

  private recomputeMemory() {
    const byRisk: Record<RiskTag, MemoryItem[]> = {
      high: [],
      medium: [],
      low: [],
    };
    for (const item of this.stream) {
      byRisk[item.risk_tag].push(item);
    }

    const seed = this.options?.seed ?? 1;
    const quotas = allocateQuotas(this.capacity);
    const selected = new Map<string, MemoryItem>();

    for (let i = 0; i < RISK_ORDER.length; i += 1) {
      const risk = RISK_ORDER[i];
      const sampled = sampleBucket(byRisk[risk], quotas[risk], seed + i * 997);
      for (const item of sampled) {
        selected.set(item.id, item);
      }
    }

    if (selected.size < this.capacity) {
      const remaining = this.stream.filter((item) => !selected.has(item.id));
      const fillRand = mulberry32(seed + 4096);
      const fill = remaining
        .map((item) => ({
          item,
          weight: RISK_WEIGHT[item.risk_tag],
          tie: fillRand(),
        }))
        .sort((a, b) => {
          if (b.weight !== a.weight) {
            return b.weight - a.weight;
          }
          if (b.tie !== a.tie) {
            return b.tie - a.tie;
          }
          return a.item.seen_at - b.item.seen_at;
        })
        .slice(0, this.capacity - selected.size)
        .map((entry) => entry.item);

      for (const item of fill) {
        selected.set(item.id, item);
      }
    }

    this.memory = [...selected.values()]
      .sort((a, b) => a.seen_at - b.seen_at)
      .slice(0, this.capacity);
  }
}
