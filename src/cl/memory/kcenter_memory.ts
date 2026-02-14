import { cosineSimilarity } from "../../retrieval/vector_store";
import type { MemoryInput, MemoryItem, MemoryStrategy } from "./types";
import { cloneItem, toMemoryItem } from "./utils";

function positiveMod(value: number, mod: number): number {
  return ((value % mod) + mod) % mod;
}

function cosineDistance(a: Float32Array, b: Float32Array): number {
  return 1 - cosineSimilarity(a, b);
}

export class KCenterMemoryStrategy implements MemoryStrategy {
  readonly name = "kcenter";
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
      throw new Error("k-center memory capacity must be positive.");
    }
  }

  addExamples(examplesWithEmbeddings: MemoryInput[]) {
    for (const example of examplesWithEmbeddings) {
      this.seen += 1;
      this.stream.push(toMemoryItem(example, this.seen));
    }
    this.recomputeCoreset();
  }

  getMemory(): MemoryItem[] {
    return this.memory.map(cloneItem);
  }

  private recomputeCoreset() {
    const n = this.stream.length;
    if (n === 0) {
      this.memory = [];
      return;
    }

    const targetSize = Math.min(this.capacity, n);
    const selectedIndices: number[] = [];
    const selectedSet = new Set<number>();
    const seed = this.options?.seed ?? 1;
    const first = positiveMod(seed, n);

    selectedIndices.push(first);
    selectedSet.add(first);

    while (selectedIndices.length < targetSize) {
      let bestIndex = -1;
      let bestDistance = Number.NEGATIVE_INFINITY;

      for (let i = 0; i < n; i += 1) {
        if (selectedSet.has(i)) {
          continue;
        }

        let nearestDistance = Number.POSITIVE_INFINITY;
        for (const selected of selectedIndices) {
          const distance = cosineDistance(this.stream[i].embedding, this.stream[selected].embedding);
          if (distance < nearestDistance) {
            nearestDistance = distance;
          }
        }

        if (nearestDistance > bestDistance) {
          bestDistance = nearestDistance;
          bestIndex = i;
        } else if (nearestDistance === bestDistance && bestIndex >= 0) {
          if (this.stream[i].seen_at < this.stream[bestIndex].seen_at) {
            bestIndex = i;
          }
        }
      }

      if (bestIndex < 0) {
        break;
      }

      selectedIndices.push(bestIndex);
      selectedSet.add(bestIndex);
    }

    this.memory = selectedIndices.map((index) => this.stream[index]);
  }
}
