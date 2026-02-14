import type { MemoryInput, MemoryItem, MemoryStrategy } from "./types";
import { cloneItem, mulberry32, toMemoryItem } from "./utils";

export class ReservoirMemoryStrategy implements MemoryStrategy {
  readonly name = "reservoir";
  private memory: MemoryItem[] = [];
  private seen = 0;
  private random: () => number;

  constructor(
    readonly capacity: number,
    options?: {
      seed?: number;
    },
  ) {
    if (capacity <= 0) {
      throw new Error("Reservoir memory capacity must be positive.");
    }
    this.random = mulberry32(options?.seed ?? 1);
  }

  addExamples(examplesWithEmbeddings: MemoryInput[]) {
    for (const example of examplesWithEmbeddings) {
      this.seen += 1;
      const item = toMemoryItem(example, this.seen);

      if (this.memory.length < this.capacity) {
        this.memory.push(item);
        continue;
      }

      const replacementIndex = Math.floor(this.random() * this.seen);
      if (replacementIndex < this.capacity) {
        this.memory[replacementIndex] = item;
      }
    }
  }

  getMemory(): MemoryItem[] {
    return this.memory.map(cloneItem);
  }
}
