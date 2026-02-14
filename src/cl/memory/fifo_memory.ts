import type { MemoryInput, MemoryItem, MemoryStrategy } from "./types";
import { cloneItem, toMemoryItem } from "./utils";

export class FifoMemoryStrategy implements MemoryStrategy {
  readonly name = "fifo";
  private memory: MemoryItem[] = [];
  private seen = 0;

  constructor(readonly capacity: number) {
    if (capacity <= 0) {
      throw new Error("FIFO memory capacity must be positive.");
    }
  }

  addExamples(examplesWithEmbeddings: MemoryInput[]) {
    for (const example of examplesWithEmbeddings) {
      this.seen += 1;
      this.memory.push(toMemoryItem(example, this.seen));
      if (this.memory.length > this.capacity) {
        this.memory.shift();
      }
    }
  }

  getMemory(): MemoryItem[] {
    return this.memory.map(cloneItem);
  }
}
