import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { runAutomationPipeline, keywordEmbedText, type PipelineResult } from "./agent/pipeline";
import {
  FifoMemoryStrategy,
  ReservoirMemoryStrategy,
  RiskAwareMemoryStrategy,
  type MemoryInput,
  type MemoryItem,
  type MemoryStrategy,
} from "./cl/memory";
import {
  LinearSoftmaxClassifier,
  estimateFisherDiagonal,
  trainIntentRouter,
  type EwcState,
  type IntentExample,
  type RouterMode,
  type TrainOptions,
} from "./cl/router";
import { applyTextDrift } from "./domain/drift";
import { BIS_WORKFLOW_BY_PROCESS, BIS_WORKFLOWS } from "./domain/bis_workflows";
import { PROCESS_IDS, type Example, type ProcessDefinition, type ProcessId, type StreamStep } from "./domain/types";
import { runContinualComparison, type ContinualComparisonResult, type MemoryStrategyId } from "./eval/continual_comparison";
import { VectorStore } from "./retrieval/vector_store";

interface AppData {
  processDefinitions: Record<ProcessId, ProcessDefinition>;
  trainSets: Partial<Record<ProcessId, Example[]>>;
  testSets: Partial<Record<ProcessId, Example[]>>;
  streamSchedule: StreamStep[];
}

interface Preset {
  id: "balanced" | "fast" | "retention";
  label: string;
  clMode: RouterMode;
  memoryStrategyId: MemoryStrategyId;
}

type RunStage = "idle" | "analyzing" | "training" | "ready" | "failed";

const PRESETS: Preset[] = [
  { id: "balanced", label: "Balanced", clMode: "rehearsal", memoryStrategyId: "reservoir" },
  { id: "fast", label: "Fast Adaptation", clMode: "naive", memoryStrategyId: "fifo" },
  { id: "retention", label: "Retention-first", clMode: "ewc", memoryStrategyId: "risk-aware" },
];

const DEFAULT_WORKFLOW = BIS_WORKFLOWS[0];
const DEFAULT_REQUEST = DEFAULT_WORKFLOW.sampleRequest;

function makeRouter(seed = 13): LinearSoftmaxClassifier {
  return new LinearSoftmaxClassifier(4, 4, { seed, initScale: 0.01 });
}

function loadJson<T>(path: string): Promise<T> {
  return fetch(`${import.meta.env.BASE_URL}${path}`).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to load ${path} (${response.status})`);
    }
    return (await response.json()) as T;
  });
}

function toIntentExample(example: Example): IntentExample {
  return {
    x: keywordEmbedText(example.request_text),
    y: PROCESS_IDS.indexOf(example.process_id),
    taskId: example.process_id,
  };
}

function toMemoryInput(example: Example): MemoryInput {
  return {
    id: example.id,
    process_id: example.process_id,
    risk_tag: example.risk_tag,
    embedding: keywordEmbedText(example.request_text),
    payload: { example },
  };
}

function memoryItemToExample(item: MemoryItem): Example | null {
  const raw = item.payload?.example;
  if (!raw || typeof raw !== "object") {
    return null;
  }
  return raw as Example;
}

function bootstrapSeed(
  streamSchedule: StreamStep[],
  trainSets: Partial<Record<ProcessId, Example[]>>,
): { firstProcess: ProcessId; initialExamples: Example[] } {
  const firstProcess = streamSchedule[0]?.process_id ?? "access_request";
  const initialExamples = (trainSets[firstProcess] ?? []).slice(0, 24);
  return { firstProcess, initialExamples };
}

function createMemoryStrategy(
  strategyId: MemoryStrategyId,
  capacity: number,
  seed: number,
): MemoryStrategy {
  switch (strategyId) {
    case "fifo":
      return new FifoMemoryStrategy(capacity);
    case "risk-aware":
      return new RiskAwareMemoryStrategy(capacity, { seed });
    default:
      return new ReservoirMemoryStrategy(capacity, { seed });
  }
}

function presetById(id: Preset["id"]): Preset {
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[0];
}

function modeKey(mode: RouterMode): RouterMode {
  return mode === "naive" ? "naive" : mode === "rehearsal" ? "rehearsal" : "ewc";
}

function stageOrder(stage: RunStage): number {
  switch (stage) {
    case "idle":
      return 0;
    case "analyzing":
      return 1;
    case "training":
      return 2;
    case "ready":
    case "failed":
      return 3;
  }
}

function fieldLabel(key: string): string {
  return key.replace(/_/g, " ");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function App() {
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [appData, setAppData] = useState<AppData | null>(null);

  const [selectedWorkflowId, setSelectedWorkflowId] = useState<ProcessId>(DEFAULT_WORKFLOW.processId);
  const [inboxRequest, setInboxRequest] = useState(DEFAULT_REQUEST);
  const [presetId, setPresetId] = useState<Preset["id"]>("balanced");
  const [retrievalK, setRetrievalK] = useState(3);
  const [memoryBudget, setMemoryBudget] = useState(32);
  const [driftEnabled, setDriftEnabled] = useState(false);

  const [runStage, setRunStage] = useState<RunStage>("idle");
  const [inboxError, setInboxError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [inboxResult, setInboxResult] = useState<PipelineResult | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ContinualComparisonResult | null>(null);

  const [seenProcesses, setSeenProcesses] = useState<ProcessId[]>([]);
  const [trainStream, setTrainStream] = useState<Example[]>([]);
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([]);

  const routerRef = useRef<LinearSoftmaxClassifier>(makeRouter(31));
  const ewcStateRef = useRef<EwcState | null>(null);

  const activePreset = presetById(presetId);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoadingData(true);
      setLoadError("");

      try {
        const processPayload = await loadJson<{
          version: string;
          processes: Array<ProcessDefinition & { target_schema?: unknown }>;
        }>("data/processes.json");
        const streamPayload = await loadJson<{ version: string; steps: StreamStep[] }>(
          "data/stream_schedule.json",
        );

        const trainSets: Partial<Record<ProcessId, Example[]>> = {};
        const testSets: Partial<Record<ProcessId, Example[]>> = {};
        for (const processId of PROCESS_IDS) {
          trainSets[processId] = await loadJson<Example[]>(`data/datasets/${processId}.train.json`);
          testSets[processId] = await loadJson<Example[]>(`data/datasets/${processId}.test.json`);
        }

        const processDefinitions = {} as Record<ProcessId, ProcessDefinition>;
        for (const process of processPayload.processes) {
          if (PROCESS_IDS.includes(process.process_id)) {
            processDefinitions[process.process_id] = {
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

        if (!active) {
          return;
        }

        const sortedSteps = [...streamPayload.steps].sort((a, b) => a.step - b.step);
        const { firstProcess, initialExamples } = bootstrapSeed(sortedSteps, trainSets);

        routerRef.current = makeRouter(31);
        ewcStateRef.current = null;
        trainIntentRouter(routerRef.current, initialExamples.map(toIntentExample), {
          mode: "naive",
          epochs: 36,
          learningRate: 0.09,
          seed: 111,
        });

        setAppData({
          processDefinitions,
          trainSets,
          testSets,
          streamSchedule: sortedSteps,
        });
        setSelectedWorkflowId(firstProcess);
        setInboxRequest(BIS_WORKFLOW_BY_PROCESS[firstProcess]?.sampleRequest ?? DEFAULT_REQUEST);
        setSeenProcesses([firstProcess]);
        setTrainStream(initialExamples);
      } catch (error) {
        if (!active) {
          return;
        }
        setLoadError(error instanceof Error ? error.message : "Failed to load demo data.");
      } finally {
        if (active) {
          setLoadingData(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const strategy = createMemoryStrategy(activePreset.memoryStrategyId, memoryBudget, 79);
    strategy.addExamples(trainStream.map(toMemoryInput));
    setMemoryItems(strategy.getMemory());
  }, [activePreset.memoryStrategyId, memoryBudget, trainStream]);

  const memoryStore = useMemo(() => {
    const store = new VectorStore<Example>();
    for (const item of memoryItems) {
      const example = memoryItemToExample(item);
      if (example) {
        store.add(item.id, item.embedding, example);
      }
    }
    return store;
  }, [memoryItems]);

  const nextTeachStep = useMemo(() => {
    if (!appData) {
      return null;
    }
    return appData.streamSchedule.find((step) => !seenProcesses.includes(step.process_id)) ?? null;
  }, [appData, seenProcesses]);

  const selectedWorkflow = BIS_WORKFLOW_BY_PROCESS[selectedWorkflowId] ?? DEFAULT_WORKFLOW;
  const predictedWorkflow =
    inboxResult && BIS_WORKFLOW_BY_PROCESS[inboxResult.predictedIntent]
      ? BIS_WORKFLOW_BY_PROCESS[inboxResult.predictedIntent]
      : selectedWorkflow;

  const performTeachUpdate = (): ProcessId | null => {
    if (!appData || !nextTeachStep) {
      return null;
    }

    const nextProcess = nextTeachStep.process_id;
    const currentExamples = (appData.trainSets[nextProcess] ?? []).slice(0, 24);
    const replayData = memoryItems
      .map(memoryItemToExample)
      .filter((example): example is Example => example !== null)
      .map(toIntentExample);

    let trainOptions: TrainOptions;
    if (activePreset.clMode === "ewc" && ewcStateRef.current) {
      trainOptions = {
        mode: "ewc",
        epochs: 36,
        learningRate: 0.09,
        ewcState: ewcStateRef.current,
        seed: 700 + seenProcesses.length * 17,
      };
    } else if (activePreset.clMode === "rehearsal") {
      trainOptions = {
        mode: "rehearsal",
        epochs: 36,
        learningRate: 0.09,
        replayData,
        replayRatio: 0.9,
        seed: 700 + seenProcesses.length * 17,
      };
    } else {
      trainOptions = {
        mode: "naive",
        epochs: 36,
        learningRate: 0.09,
        seed: 700 + seenProcesses.length * 17,
      };
    }

    trainIntentRouter(routerRef.current, currentExamples.map(toIntentExample), trainOptions);

    const fisherData = [...replayData, ...currentExamples.map(toIntentExample)];
    const fisher = estimateFisherDiagonal(routerRef.current, fisherData);
    const params = routerRef.current.getParams();
    ewcStateRef.current = {
      lambda: 38,
      fisherW: fisher.fisherW,
      fisherB: fisher.fisherB,
      refW: params.W,
      refB: params.b,
    };

    setSeenProcesses((prev) => [...prev, nextProcess]);
    setTrainStream((prev) => [...prev, ...currentExamples]);
    return nextProcess;
  };

  const runSafetyCheck = (processes: ProcessId[]) => {
    if (!appData || processes.length === 0) {
      return null;
    }

    const result = runContinualComparison(
      processes,
      appData.trainSets,
      appData.testSets,
      activePreset.memoryStrategyId,
      memoryBudget,
    );
    setComparisonResult(result);
    return result;
  };

  const handleStartDemo = async () => {
    if (!appData) {
      return;
    }

    setRunStage("analyzing");
    setInboxError("");
    setCopyStatus("");

    try {
      await sleep(140);

      const finalRequest = driftEnabled
        ? applyTextDrift(inboxRequest, { seed: 401, intensity: 0.45 })
        : inboxRequest;

      const result = await runAutomationPipeline(finalRequest, {
        mode: "template",
        retrievalK,
        intentOrder: PROCESS_IDS,
        processDefinitions: appData.processDefinitions,
        router: routerRef.current,
        memoryStore,
        embed: async (texts) => texts.map((text) => keywordEmbedText(text)),
      });

      setInboxResult(result);
      setRunStage("training");

      await sleep(140);

      const taughtProcess = performTeachUpdate();
      const evaluationProcesses =
        taughtProcess && !seenProcesses.includes(taughtProcess)
          ? [...seenProcesses, taughtProcess]
          : seenProcesses;
      runSafetyCheck(evaluationProcesses);

      setRunStage("ready");
    } catch (error) {
      setRunStage("failed");
      setInboxError(error instanceof Error ? error.message : "Automation failed.");
    }
  };

  const handleWorkflowChange = (processId: ProcessId) => {
    setSelectedWorkflowId(processId);
    const workflow = BIS_WORKFLOW_BY_PROCESS[processId] ?? DEFAULT_WORKFLOW;
    setInboxRequest(workflow.sampleRequest);
  };

  const handleReset = () => {
    if (!appData) {
      return;
    }

    const { firstProcess, initialExamples } = bootstrapSeed(appData.streamSchedule, appData.trainSets);

    routerRef.current = makeRouter(31);
    ewcStateRef.current = null;
    trainIntentRouter(routerRef.current, initialExamples.map(toIntentExample), {
      mode: "naive",
      epochs: 36,
      learningRate: 0.09,
      seed: 111,
    });

    setSelectedWorkflowId(firstProcess);
    setInboxRequest(BIS_WORKFLOW_BY_PROCESS[firstProcess]?.sampleRequest ?? DEFAULT_REQUEST);
    setSeenProcesses([firstProcess]);
    setTrainStream(initialExamples);
    setInboxResult(null);
    setComparisonResult(null);
    setCopyStatus("");
    setInboxError("");
    setRunStage("idle");
  };

  const handleCopy = async (label: string, payload: unknown) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopyStatus(`${label} copied.`);
    } catch {
      setCopyStatus("Clipboard blocked in this browser.");
    }
  };

  const plan = inboxResult?.plan ?? null;
  const manualMinutes = predictedWorkflow.manualCycleMinutes;
  const automatedMinutes = predictedWorkflow.automatedCycleMinutes;
  const savedMinutes = Math.max(0, manualMinutes - automatedMinutes);
  const savedPercent = manualMinutes > 0 ? Math.round((savedMinutes / manualMinutes) * 100) : 0;
  const requiredFields = plan ? Object.entries(plan.required_fields) : [];

  const retentionGain = comparisonResult
    ? Math.max(0, comparisonResult.modes.naive.meanForgetting - comparisonResult.modes[modeKey(activePreset.clMode)].meanForgetting)
    : 0;

  const charterOutput =
    plan !== null
      ? {
          title: plan.title,
          process: predictedWorkflow.workflowName,
          owner: plan.owner_role,
          baseline_minutes: manualMinutes,
          target_minutes: automatedMinutes,
          problem_statement: predictedWorkflow.manualPain,
          risk_level: plan.risk_tag,
        }
      : null;

  const blueprintOutput =
    plan !== null
      ? {
          triggers: [`${predictedWorkflow.workflowName} request intake`],
          connectors: predictedWorkflow.systemTargets,
          steps: [
            "Classify request",
            "Extract required fields",
            "Apply policy rules",
            "Route approvals",
            "Emit handoff payload",
          ],
          controls: plan.controls,
          monitoring: [`SLA ${plan.sla_hours}h`, "Approval timeout", "Missing field alert"],
        }
      : null;

  const exportOutput =
    plan !== null
      ? {
          jira: {
            project: "BIS",
            issueType: "Task",
            summary: `[Process Optimisation] ${plan.title}`,
            labels: [plan.process_id, "automation-packet"],
            fields: plan.required_fields,
          },
          serviceNow: {
            category: "process_automation",
            short_description: plan.title,
            assignment_group: plan.owner_role,
            sla_hours: plan.sla_hours,
            approvals: plan.approvals,
          },
          tracker: {
            workflow: predictedWorkflow.workflowName,
            process_id: plan.process_id,
            owner: plan.owner_role,
            status: "ready_for_execution",
          },
        }
      : null;

  const beforeFlow = [
    "Unstructured intake",
    "Manual clarification loops",
    "Approval chase",
    "Manual tracker update",
  ];

  const afterFlow =
    plan !== null
      ? [
          `Auto-classify: ${predictedWorkflow.workflowName}`,
          `${requiredFields.length} required fields captured`,
          `${plan.approvals.length} approvals attached`,
          "Export payloads generated",
        ]
      : ["Awaiting run", "Awaiting run", "Awaiting run", "Awaiting run"];

  const stageText =
    runStage === "idle"
      ? "Ready"
      : runStage === "analyzing"
        ? "Reading request"
        : runStage === "training"
          ? "Assembling packet"
          : runStage === "ready"
            ? "Packet ready"
            : "Run failed";

  if (loadingData) {
    return (
      <main className="app-shell">
        <section className="app-frame loading-frame">
          <h1>Loading BIS demo...</h1>
        </section>
      </main>
    );
  }

  if (loadError || !appData) {
    return (
      <main className="app-shell">
        <section className="app-frame loading-frame">
          <h1>Unable to load demo</h1>
          <p className="warning">{loadError || "Unknown initialization error."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="app-frame">
        <header className="hero-card">
          <p className="kicker">BIS Process Optimisation</p>
          <h1>From messy request to ready automation packet.</h1>

          <div className="workflow-row" role="tablist" aria-label="Workflows">
            {BIS_WORKFLOWS.map((workflow) => (
              <button
                key={workflow.processId}
                type="button"
                className={selectedWorkflowId === workflow.processId ? "chip active" : "chip"}
                onClick={() => handleWorkflowChange(workflow.processId)}
              >
                {workflow.workflowName}
              </button>
            ))}
          </div>

          <div className="control-row">
            <div className="preset-row" role="radiogroup" aria-label="Preset">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={presetId === preset.id ? "preset active" : "preset"}
                  onClick={() => setPresetId(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <button type="button" className="primary" onClick={() => void handleStartDemo()}>
              Start demo
            </button>
            <button type="button" className="secondary" onClick={handleReset}>
              Reset
            </button>
          </div>

          <label className="input-label">
            Request
            <textarea value={inboxRequest} rows={3} onChange={(event) => setInboxRequest(event.target.value)} />
          </label>

          <div className="status-row">
            <p className="status-pill">{stageText}</p>
            {copyStatus ? <p className="status-pill">{copyStatus}</p> : null}
            {inboxError ? <p className="warning">{inboxError}</p> : null}
          </div>

          <div className="run-rail" aria-label="Automation steps">
            <span className={stageOrder(runStage) >= 1 ? "rail-step active" : "rail-step"}>1. Intake</span>
            <span className={stageOrder(runStage) >= 2 ? "rail-step active" : "rail-step"}>2. Packet build</span>
            <span className={stageOrder(runStage) >= 3 ? "rail-step active" : "rail-step"}>3. Safety check</span>
          </div>
        </header>

        <section className={plan ? "moment-card ready" : "moment-card"}>
          <article className="moment before">
            <h2>Before</h2>
            <p className="big-number">{manualMinutes}m</p>
            <p className="small-label">manual cycle time</p>
            <p className="muted">{predictedWorkflow.manualPain}</p>
          </article>

          <div className="arrow" aria-hidden="true">
            →
          </div>

          <article className="moment after">
            <h2>After</h2>
            {plan ? (
              <>
                <p className="big-number">{automatedMinutes}m</p>
                <p className="small-label">packet ready</p>
                <div className="signal-row">
                  <p>
                    <strong>-{savedPercent}%</strong> time
                  </p>
                  <p>
                    <strong>{requiredFields.length}</strong> fields
                  </p>
                  <p>
                    <strong>{plan.approvals.length}</strong> approvals
                  </p>
                </div>
              </>
            ) : (
              <p className="muted">Click Start demo.</p>
            )}
          </article>
        </section>

        <section className="outputs-card">
          <h2>Your outputs</h2>

          {plan && charterOutput && blueprintOutput && exportOutput ? (
            <div className="outputs-grid">
              <article className="tile">
                <h3>Charter</h3>
                <p>{charterOutput.problem_statement}</p>
                <p>
                  Target: {charterOutput.baseline_minutes}m {"->"} {charterOutput.target_minutes}m
                </p>
                <button type="button" className="mini" onClick={() => void handleCopy("Charter JSON", charterOutput)}>
                  Copy charter JSON
                </button>
              </article>

              <article className="tile">
                <h3>Automation blueprint</h3>
                <ul>
                  {blueprintOutput.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="mini"
                  onClick={() => void handleCopy("Blueprint JSON", blueprintOutput)}
                >
                  Copy blueprint JSON
                </button>
              </article>

              <article className="tile">
                <h3>Required fields</h3>
                <div className="field-grid">
                  {requiredFields.map(([key, value]) => (
                    <p key={key}>
                      <span>{fieldLabel(key)}</span>
                      <strong>{value}</strong>
                    </p>
                  ))}
                </div>
              </article>

              <article className="tile">
                <h3>Export payloads</h3>
                <p>Jira + ServiceNow + tracker row are ready.</p>
                <div className="copy-row">
                  <button type="button" className="mini" onClick={() => void handleCopy("Jira JSON", exportOutput.jira)}>
                    Copy Jira
                  </button>
                  <button
                    type="button"
                    className="mini"
                    onClick={() => void handleCopy("ServiceNow JSON", exportOutput.serviceNow)}
                  >
                    Copy ServiceNow
                  </button>
                  <button
                    type="button"
                    className="mini"
                    onClick={() => void handleCopy("Tracker JSON", exportOutput.tracker)}
                  >
                    Copy tracker
                  </button>
                </div>
              </article>
            </div>
          ) : (
            <div className="empty">Run the demo to generate the output packet.</div>
          )}
        </section>

        <details className="details-card">
          <summary>Open full packet details</summary>

          <div className="details-grid">
            <section className="flow-grid">
              <article>
                <h3>Before flow</h3>
                <ol>
                  {beforeFlow.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </article>
              <article>
                <h3>After flow</h3>
                <ol>
                  {afterFlow.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </article>
            </section>

            <section className="advanced-controls">
              <label>
                Retrieval k: {retrievalK}
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={retrievalK}
                  onChange={(event) => setRetrievalK(Number(event.target.value))}
                />
              </label>
              <label>
                Memory budget: {memoryBudget}
                <input
                  type="range"
                  min={8}
                  max={80}
                  step={2}
                  value={memoryBudget}
                  onChange={(event) => setMemoryBudget(Number(event.target.value))}
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={driftEnabled}
                  onChange={(event) => setDriftEnabled(event.target.checked)}
                />
                Simulate wording drift
              </label>
            </section>

            {comparisonResult ? (
              <section className="safety-card">
                <h3>Regression safety</h3>
                <p>Preset: {activePreset.label}</p>
                <p>Retention gain vs naive: {(retentionGain * 100).toFixed(2)}%</p>
              </section>
            ) : null}

            {plan && exportOutput ? (
              <section className="json-grid">
                <article>
                  <h3>Plan JSON</h3>
                  <pre>{JSON.stringify(plan, null, 2)}</pre>
                </article>
                <article>
                  <h3>Export JSON</h3>
                  <pre>{JSON.stringify(exportOutput, null, 2)}</pre>
                </article>
              </section>
            ) : null}
          </div>
        </details>
      </section>
    </main>
  );
}

export default App;
