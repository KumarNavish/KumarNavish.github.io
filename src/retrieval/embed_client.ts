type EmbedWorkerRequest = {
  id: number;
  type: "embed";
  texts: string[];
};

type EmbedWorkerSuccess = {
  id: number;
  type: "embed_result";
  embeddings: Float32Array[];
};

type EmbedWorkerError = {
  id: number;
  type: "error";
  error: string;
};

type EmbedWorkerResponse = EmbedWorkerSuccess | EmbedWorkerError;

interface PendingRequest {
  resolve: (value: Float32Array[]) => void;
  reject: (reason?: unknown) => void;
}

export class EmbeddingClient {
  private worker: Worker;
  private pending = new Map<number, PendingRequest>();
  private nextId = 1;

  constructor() {
    this.worker = new Worker(new URL("../workers/embedding.worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.addEventListener("message", this.onMessage);
    this.worker.addEventListener("error", this.onWorkerError);
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) {
      return [];
    }
    const id = this.nextId++;
    const request: EmbedWorkerRequest = { id, type: "embed", texts };

    return new Promise<Float32Array[]>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage(request);
    });
  }

  dispose() {
    for (const { reject } of this.pending.values()) {
      reject(new Error("Embedding client disposed"));
    }
    this.pending.clear();
    this.worker.removeEventListener("message", this.onMessage);
    this.worker.removeEventListener("error", this.onWorkerError);
    this.worker.terminate();
  }

  private onMessage = (event: MessageEvent<EmbedWorkerResponse>) => {
    const response = event.data;
    const pending = this.pending.get(response.id);
    if (!pending) {
      return;
    }
    this.pending.delete(response.id);

    if (response.type === "embed_result") {
      pending.resolve(response.embeddings);
      return;
    }
    pending.reject(new Error(response.error));
  };

  private onWorkerError = (event: ErrorEvent) => {
    for (const { reject } of this.pending.values()) {
      reject(event.error ?? new Error(event.message));
    }
    this.pending.clear();
  };
}

let defaultClient: EmbeddingClient | null = null;

function getDefaultClient(): EmbeddingClient {
  if (typeof Worker === "undefined") {
    throw new Error("Web Workers are not available in this environment.");
  }
  if (defaultClient === null) {
    defaultClient = new EmbeddingClient();
  }
  return defaultClient;
}

export function embed(texts: string[]): Promise<Float32Array[]> {
  return getDefaultClient().embed(texts);
}
