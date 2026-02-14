export interface VectorStoreHit<TPayload> {
  id: string;
  score: number;
  payload: TPayload;
}

interface VectorStoreEntry<TPayload> {
  id: string;
  embedding: Float32Array;
  payload: TPayload;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error("Embedding dimensions must match for cosine similarity.");
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class VectorStore<TPayload> {
  private entries: VectorStoreEntry<TPayload>[] = [];

  add(id: string, embedding: Float32Array, payload: TPayload) {
    this.entries.push({
      id,
      embedding: new Float32Array(embedding),
      payload,
    });
  }

  topK(queryEmbedding: Float32Array, k: number): VectorStoreHit<TPayload>[] {
    if (k <= 0 || this.entries.length === 0) {
      return [];
    }

    return this.entries
      .map((entry) => ({
        id: entry.id,
        score: cosineSimilarity(queryEmbedding, entry.embedding),
        payload: entry.payload,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(k, this.entries.length));
  }

  size(): number {
    return this.entries.length;
  }

  clear() {
    this.entries = [];
  }
}
