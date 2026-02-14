import { useEffect, useMemo, useRef, useState } from "react";
import {
  WebLlmClient,
  isWebGpuSupported,
  type JsonSchema,
  type LlmMessage,
} from "../llm/webllm_client";

const SAMPLE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    process_id: { type: "string" },
    risk_tag: { type: "string", enum: ["low", "medium", "high"] },
    actions: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
    },
    owner_role: { type: "string" },
  },
  required: ["process_id", "risk_tag", "actions", "owner_role"],
  additionalProperties: false,
};

const SAMPLE_MESSAGES: LlmMessage[] = [
  {
    role: "system",
    content:
      "You are an automation planner. Reply with only valid JSON that matches the provided schema.",
  },
  {
    role: "user",
    content:
      "Create a plan for a high priority incident escalation for checkout failures impacting customers.",
  },
];

export function WebLlmPanel() {
  const webGpuAvailable = useMemo(() => isWebGpuSupported(), []);
  const clientRef = useRef<WebLlmClient | null>(null);

  if (!clientRef.current) {
    clientRef.current = new WebLlmClient();
  }

  const client = clientRef.current;
  const models = useMemo(() => client.listAvailableModels(), [client]);
  const [llmModeEnabled, setLlmModeEnabled] = useState(false);
  const [selectedModel, setSelectedModel] = useState(models[0] ?? "");
  const [loadState, setLoadState] = useState("Not loaded");
  const [loading, setLoading] = useState(false);
  const [jsonOutput, setJsonOutput] = useState("");
  const [requestState, setRequestState] = useState("Idle");

  useEffect(() => {
    return () => {
      void client.dispose();
    };
  }, [client]);

  const canUseLlm = webGpuAvailable && llmModeEnabled;

  const handleLoadModel = async () => {
    if (!selectedModel) {
      setLoadState("Select a model first.");
      return;
    }
    setLoading(true);
    setLoadState("Initializing model...");
    try {
      await client.init(selectedModel, (report) => {
        const pct = Math.round(report.progress * 100);
        setLoadState(`${pct}% - ${report.text}`);
      });
      setLoadState(`Loaded: ${selectedModel}`);
    } catch (error) {
      setLoadState(
        `Load failed: ${error instanceof Error ? error.message : "unknown initialization error"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setRequestState("Generating schema-constrained JSON...");
    setJsonOutput("");
    try {
      const result = await client.generatePlan(SAMPLE_MESSAGES, SAMPLE_SCHEMA);
      setRequestState("Generation complete.");
      setJsonOutput(JSON.stringify(result, null, 2));
      console.log("WebLLM JSON plan output", result);
    } catch (error) {
      setRequestState("Generation failed.");
      setJsonOutput(error instanceof Error ? error.message : "unknown generation error");
    }
  };

  return (
    <div className="smoke-box llm-panel">
      <h3>Optional WebLLM Mode</h3>
      <label className="inline-toggle">
        <input
          type="checkbox"
          checked={llmModeEnabled}
          onChange={(event) => setLlmModeEnabled(event.target.checked)}
          disabled={!webGpuAvailable}
        />
        Enable LLM mode
      </label>

      {!webGpuAvailable ? (
        <p className="warning">
          WebGPU is not available in this browser/device, so LLM mode is disabled. Deterministic
          mode will still work.
        </p>
      ) : null}

      <div className="row">
        <select
          value={selectedModel}
          onChange={(event) => setSelectedModel(event.target.value)}
          disabled={!canUseLlm}
        >
          {models.map((modelId) => (
            <option key={modelId} value={modelId}>
              {modelId}
            </option>
          ))}
        </select>
        <button type="button" onClick={handleLoadModel} disabled={!canUseLlm || loading}>
          Load LLM
        </button>
      </div>

      <p className="status">{loadState}</p>
      <button type="button" onClick={handleGenerate} disabled={!canUseLlm || !client.isReady()}>
        Generate JSON sample
      </button>
      <p className="status">{requestState}</p>
      {jsonOutput ? <pre className="summary summary-block">{jsonOutput}</pre> : null}
    </div>
  );
}
