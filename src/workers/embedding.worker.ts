/// <reference lib="webworker" />

import { env, pipeline, type FeatureExtractionPipelineType, type Tensor } from "@huggingface/transformers";

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

class EmbeddingPipelineSingleton {
  private static task = "feature-extraction" as const;
  private static model = "Xenova/all-MiniLM-L6-v2";
  private static instance: Promise<FeatureExtractionPipelineType> | null = null;

  static getInstance() {
    if (this.instance === null) {
      const createFeatureExtractor = pipeline as (
        task: "feature-extraction",
        model: string,
      ) => Promise<FeatureExtractionPipelineType>;
      env.allowLocalModels = false;
      this.instance = createFeatureExtractor(this.task, this.model);
    }
    return this.instance;
  }
}

async function embedTexts(texts: string[]): Promise<Float32Array[]> {
  const extractor = await EmbeddingPipelineSingleton.getInstance();
  const embeddings: Float32Array[] = [];

  for (const text of texts) {
    const output = (await extractor(text, {
      pooling: "mean",
      normalize: true,
    })) as Tensor;
    embeddings.push(new Float32Array(output.data as Float32Array | number[]));
  }

  return embeddings;
}

addEventListener("message", async (event: MessageEvent<EmbedWorkerRequest>) => {
  const payload = event.data;
  if (payload.type !== "embed") {
    return;
  }

  try {
    const embeddings = await embedTexts(payload.texts);
    const response: EmbedWorkerSuccess = {
      id: payload.id,
      type: "embed_result",
      embeddings,
    };
    postMessage(response);
  } catch (error) {
    const response: EmbedWorkerError = {
      id: payload.id,
      type: "error",
      error: error instanceof Error ? error.message : "Unknown embedding worker error",
    };
    postMessage(response satisfies EmbedWorkerResponse);
  }
});

export {};
