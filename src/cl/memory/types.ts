import type { RiskTag } from "../../domain/types";

export interface MemoryInput {
  id: string;
  process_id: string;
  risk_tag: RiskTag;
  embedding: Float32Array;
  payload?: Record<string, unknown>;
}

export interface MemoryItem extends MemoryInput {
  seen_at: number;
}

export interface MemoryStrategy {
  readonly name: string;
  readonly capacity: number;
  addExamples(examplesWithEmbeddings: MemoryInput[]): void;
  getMemory(): MemoryItem[];
}
