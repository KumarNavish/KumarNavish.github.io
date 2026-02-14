import { describe, expect, it, vi } from "vitest";
import {
  SAFE_DEFAULT_MODELS,
  WebLlmClient,
  isWebGpuSupported,
  type JsonSchema,
  type WebLlmApi,
} from "./webllm_client";

describe("WebLlmClient", () => {
  it("reports no WebGPU in node test environment", () => {
    expect(isWebGpuSupported()).toBe(false);
  });

  it("returns fallback model list when prebuilt config is unavailable", () => {
    const api = {
      CreateMLCEngine: vi.fn(),
    } as unknown as WebLlmApi;

    const client = new WebLlmClient(api);
    expect(client.listAvailableModels()).toEqual(SAFE_DEFAULT_MODELS);
  });

  it("initializes engine and generates JSON using schema mode", async () => {
    const create = vi.fn(async (_modelId: string, config?: { initProgressCallback?: (report: { progress: number; timeElapsed: number; text: string }) => void }) => {
      config?.initProgressCallback?.({ progress: 1, timeElapsed: 1, text: "loaded" });
      return {
        chat: {
          completions: {
            create: vi.fn(async () => ({
              choices: [
                {
                  message: {
                    content: '{"process_id":"access_request","actions":["verify","approve"]}',
                  },
                },
              ],
            })),
          },
        },
        unload: vi.fn(async () => undefined),
      };
    });

    const api: WebLlmApi = {
      CreateMLCEngine: create as unknown as WebLlmApi["CreateMLCEngine"],
      prebuiltAppConfig: {
        model_list: [{ model_id: "mock-model" }],
      },
    };

    const client = new WebLlmClient(api);
    expect(client.listAvailableModels()).toEqual(["mock-model"]);

    let lastProgress = 0;
    await client.init("mock-model", (report) => {
      lastProgress = report.progress;
    });
    expect(lastProgress).toBe(1);

    const schema: JsonSchema = {
      type: "object",
      properties: {
        process_id: { type: "string" },
        actions: { type: "array", items: { type: "string" } },
      },
      required: ["process_id", "actions"],
      additionalProperties: false,
    };

    const output = await client.generatePlan(
      [
        {
          role: "user",
          content: "Plan access request automation.",
        },
      ],
      schema,
    );

    expect(output.process_id).toBe("access_request");
    expect(output.actions).toEqual(["verify", "approve"]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(client.isReady()).toBe(true);
  });
});
