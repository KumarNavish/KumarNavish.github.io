import * as webllm from "@mlc-ai/web-llm";
import type {
  ChatCompletion,
  ChatCompletionMessageParam,
  InitProgressCallback,
  InitProgressReport,
  MLCEngine,
} from "@mlc-ai/web-llm";

export type JsonSchema = Record<string, unknown>;
export type LlmMessage = ChatCompletionMessageParam;
export type LlmProgressCallback = (report: InitProgressReport) => void;

export interface WebLlmApi {
  CreateMLCEngine: (
    modelId: string,
    engineConfig?: { initProgressCallback?: InitProgressCallback },
  ) => Promise<MLCEngine>;
  prebuiltAppConfig?: {
    model_list?: Array<{ model_id: string }>;
  };
}

export const SAFE_DEFAULT_MODELS = [
  "Llama-3.2-1B-Instruct-q4f16_1-MLC",
  "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
];

function extractResponseText(response: ChatCompletion): string {
  const firstChoice = response.choices?.[0];
  const content = firstChoice?.message?.content as unknown;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part: unknown) => {
        if (typeof part === "string") {
          return part;
        }
        if (
          typeof part === "object" &&
          part !== null &&
          "text" in part &&
          typeof (part as { text?: unknown }).text === "string"
        ) {
          return (part as { text: string }).text;
        }
        return "";
      })
      .join("");
  }

  return "";
}

export function isWebGpuSupported(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export class WebLlmClient {
  private engine: MLCEngine | null = null;

  constructor(private readonly api: WebLlmApi = webllm as unknown as WebLlmApi) {}

  listAvailableModels(): string[] {
    const configModels = this.api.prebuiltAppConfig?.model_list ?? [];
    const modelIds = configModels
      .map((entry) => entry.model_id)
      .filter((modelId): modelId is string => typeof modelId === "string" && modelId.length > 0);

    return modelIds.length > 0 ? modelIds : SAFE_DEFAULT_MODELS;
  }

  async init(modelId: string, progressCallback?: LlmProgressCallback): Promise<void> {
    this.engine = await this.api.CreateMLCEngine(modelId, {
      initProgressCallback: progressCallback,
    });
  }

  isReady(): boolean {
    return this.engine !== null;
  }

  async generatePlan(messages: LlmMessage[], schema: JsonSchema): Promise<Record<string, unknown>> {
    if (!this.engine) {
      throw new Error("WebLLM engine is not initialized. Call init() first.");
    }

    const response = (await this.engine.chat.completions.create({
      messages,
      temperature: 0,
      response_format: {
        type: "json_object",
        schema: JSON.stringify(schema),
      },
    })) as ChatCompletion;

    const raw = extractResponseText(response).trim();
    if (!raw) {
      throw new Error("WebLLM returned an empty response.");
    }

    return JSON.parse(raw) as Record<string, unknown>;
  }

  async dispose(): Promise<void> {
    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
    }
  }
}
