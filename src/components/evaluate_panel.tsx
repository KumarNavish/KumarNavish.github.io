import { useRef, useState } from "react";
import { LinearSoftmaxClassifier } from "../cl/router";
import { PROCESS_IDS, type Example, type ProcessDefinition, type ProcessId } from "../domain/types";
import { runAutomationPipeline } from "../agent/pipeline";
import { VectorStore } from "../retrieval/vector_store";
import { EvaluationSnapshotStore, forgettingCurve, runRegression, type EvalSnapshot } from "../eval/runner";

const STAGE_ORDER: ProcessId[][] = [
  ["access_request"],
  ["access_request", "purchase_request"],
  ["access_request", "purchase_request", "vendor_onboarding"],
  ["access_request", "purchase_request", "vendor_onboarding", "incident_escalation"],
];

function makeRouter(): LinearSoftmaxClassifier {
  const model = new LinearSoftmaxClassifier(4, 4, { seed: 23, initScale: 0.001 });
  model.setParams({
    W: new Float32Array([
      6, 0, 0, 0,
      0, 6, 0, 0,
      0, 0, 6, 0,
      0, 0, 0, 6,
    ]),
    b: new Float32Array([0, 0, 0, 0]),
  });
  return model;
}

function keywordEmbed(text: string): Float32Array {
  const lower = text.toLowerCase();
  return new Float32Array([
    Number(
      lower.includes("access") ||
        lower.includes("permission") ||
        lower.includes("provision") ||
        lower.includes("entitlement"),
    ),
    Number(
      lower.includes("vendor") ||
        lower.includes("supplier") ||
        lower.includes("onboard") ||
        lower.includes("third-party"),
    ),
    Number(
      lower.includes("purchase") ||
        lower.includes("spend") ||
        lower.includes("budget") ||
        lower.includes("procurement"),
    ),
    Number(
      lower.includes("incident") ||
        lower.includes("outage") ||
        lower.includes("sev") ||
        lower.includes("escalate"),
    ),
  ]);
}

async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return (await response.json()) as T;
}

function toProcessMap(
  processes: Array<ProcessDefinition & { target_schema?: unknown }>,
): Record<ProcessId, ProcessDefinition> {
  const result = {} as Record<ProcessId, ProcessDefinition>;
  for (const process of processes) {
    if (PROCESS_IDS.includes(process.process_id)) {
      result[process.process_id] = {
        process_id: process.process_id,
        display_name: process.display_name,
        description: process.description,
        required_fields: process.required_fields,
        default_owner_role: process.default_owner_role,
        default_sla_hours: process.default_sla_hours,
        required_approvals: process.required_approvals,
      };
    }
  }
  return result;
}

function buildMemoryStore(trainSets: Partial<Record<ProcessId, Example[]>>): VectorStore<Example> {
  const store = new VectorStore<Example>();
  for (const processId of PROCESS_IDS) {
    const rows = trainSets[processId] ?? [];
    for (const example of rows.slice(0, 10)) {
      store.add(example.id, keywordEmbed(example.request_text), example);
    }
  }
  return store;
}

function curveToPolyline(curve: Array<{ step: number; value: number }>, width: number, height: number): string {
  if (curve.length === 0) {
    return "";
  }
  const padding = 24;
  const xSpan = Math.max(1, curve.length - 1);
  const maxY = Math.max(0.01, ...curve.map((point) => point.value));
  return curve
    .map((point, index) => {
      const x = padding + (index / xSpan) * (width - 2 * padding);
      const y = height - padding - (point.value / maxY) * (height - 2 * padding);
      return `${x},${y}`;
    })
    .join(" ");
}

export function EvaluatePanel() {
  const snapshotStoreRef = useRef(new EvaluationSnapshotStore());
  const [stateText, setStateText] = useState("Idle");
  const [snapshots, setSnapshots] = useState<EvalSnapshot[]>([]);
  const [errorText, setErrorText] = useState("");

  const runHarness = async () => {
    setStateText("Loading datasets and running staged regression...");
    setErrorText("");
    snapshotStoreRef.current.clear();

    try {
      const processPayload = await loadJson<{
        version: string;
        processes: Array<ProcessDefinition & { target_schema?: unknown }>;
      }>("data/processes.json");
      const processMap = toProcessMap(processPayload.processes);

      const trainSets = {} as Partial<Record<ProcessId, Example[]>>;
      const testSets = {} as Partial<Record<ProcessId, Example[]>>;
      for (const processId of PROCESS_IDS) {
        trainSets[processId] = await loadJson<Example[]>(`data/datasets/${processId}.train.json`);
        testSets[processId] = await loadJson<Example[]>(`data/datasets/${processId}.test.json`);
      }

      const router = makeRouter();
      const memoryStore = buildMemoryStore(trainSets);

      const predictor = async (example: Example) => {
        const result = await runAutomationPipeline(example.request_text, {
          mode: "template",
          retrievalK: 3,
          intentOrder: PROCESS_IDS,
          processDefinitions: processMap,
          router,
          memoryStore,
          embed: async (texts) => texts.map((text) => keywordEmbed(text)),
        });
        return {
          predictedIntent: result.predictedIntent,
          predictedPlan: result.plan,
        };
      };

      for (let i = 0; i < STAGE_ORDER.length; i += 1) {
        const seen = STAGE_ORDER[i];
        const report = await runRegression(seen, testSets, processMap, predictor);
        snapshotStoreRef.current.addSnapshot(report, `teach_update_${i + 1}`);
      }

      const completedSnapshots = snapshotStoreRef.current.listSnapshots();
      setSnapshots(completedSnapshots);
      setStateText(`Evaluation complete with ${completedSnapshots.length} snapshots.`);
    } catch (error) {
      setStateText("Evaluation failed.");
      setErrorText(error instanceof Error ? error.message : "Unknown evaluation error");
    }
  };

  const latestSnapshot = snapshots[snapshots.length - 1];
  const curve = forgettingCurve(snapshots);
  const chartPolyline = curveToPolyline(curve, 440, 180);

  return (
    <div className="smoke-box">
      <h3>Evaluate</h3>
      <button type="button" onClick={runHarness}>
        Run regression harness
      </button>
      <p className="status">{stateText}</p>
      {errorText ? <p className="warning">{errorText}</p> : null}

      {latestSnapshot ? (
        <>
          <table className="eval-table">
            <thead>
              <tr>
                <th>Process</th>
                <th>Intent Acc.</th>
                <th>Field Exact</th>
                <th>Overall</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(latestSnapshot.report.perProcess).map((metrics) =>
                metrics ? (
                  <tr key={metrics.processId}>
                    <td>{metrics.processId}</td>
                    <td>{(metrics.intentAccuracy * 100).toFixed(1)}%</td>
                    <td>{(metrics.requiredFieldExactMatchRate * 100).toFixed(1)}%</td>
                    <td>{(metrics.overallScore * 100).toFixed(1)}%</td>
                  </tr>
                ) : null,
              )}
            </tbody>
          </table>

          <div className="chart-wrap">
            <p className="status">Forgetting curve (mean forgetting per snapshot)</p>
            <svg width="440" height="180" viewBox="0 0 440 180" role="img" aria-label="Forgetting curve">
              <line x1="24" y1="156" x2="416" y2="156" stroke="#94a3b8" strokeWidth="1" />
              <line x1="24" y1="24" x2="24" y2="156" stroke="#94a3b8" strokeWidth="1" />
              {chartPolyline ? (
                <polyline fill="none" stroke="#1e3a8a" strokeWidth="2" points={chartPolyline} />
              ) : null}
              {curve.map((point, index) => {
                const x = 24 + (index / Math.max(1, curve.length - 1)) * (440 - 48);
                const yMax = Math.max(0.01, ...curve.map((entry) => entry.value));
                const y = 156 - (point.value / yMax) * (180 - 48);
                return <circle key={`p-${point.step}`} cx={x} cy={y} r="3" fill="#ef6c00" />;
              })}
            </svg>
          </div>
        </>
      ) : null}
    </div>
  );
}
