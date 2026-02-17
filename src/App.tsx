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

const PRESETS: Preset[] = [
  {
    id: "balanced",
    label: "Balanced",
    clMode: "rehearsal",
    memoryStrategyId: "reservoir",
  },
  {
    id: "fast",
    label: "Fast Adaptation",
    clMode: "naive",
    memoryStrategyId: "fifo",
  },
  {
    id: "retention",
    label: "Retention-first",
    clMode: "ewc",
    memoryStrategyId: "risk-aware",
  },
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

function selectedModeKey(mode: RouterMode): RouterMode {
  return mode === "naive" ? "naive" : mode === "rehearsal" ? "rehearsal" : "ewc";
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
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [inboxStatus, setInboxStatus] = useState("Ready");
  const [inboxError, setInboxError] = useState("");
  const [inboxResult, setInboxResult] = useState<PipelineResult | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ContinualComparisonResult | null>(null);
  const [copyStatus, setCopyStatus] = useState("");

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

        const normalizedData: AppData = {
          processDefinitions,
          trainSets,
          testSets,
          streamSchedule: sortedSteps,
        };

        routerRef.current = makeRouter(31);
        ewcStateRef.current = null;
        trainIntentRouter(routerRef.current, initialExamples.map(toIntentExample), {
          mode: "naive",
          epochs: 36,
          learningRate: 0.09,
          seed: 111,
        });

        setAppData(normalizedData);
        setSeenProcesses([firstProcess]);
        setTrainStream(initialExamples);
        setSelectedWorkflowId(firstProcess);
        setInboxRequest(BIS_WORKFLOW_BY_PROCESS[firstProcess]?.sampleRequest ?? DEFAULT_REQUEST);
        setInboxStatus("Ready");
      } catch (error) {
        if (!active) {
          return;
        }
        setLoadError(error instanceof Error ? error.message : "Failed to load datasets.");
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

  const activeWorkflow = useMemo(() => {
    const predicted = inboxResult?.predictedIntent;
    if (predicted && BIS_WORKFLOW_BY_PROCESS[predicted]) {
      return BIS_WORKFLOW_BY_PROCESS[predicted];
    }
    return BIS_WORKFLOW_BY_PROCESS[selectedWorkflowId] ?? DEFAULT_WORKFLOW;
  }, [selectedWorkflowId, inboxResult]);

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

    setInboxStatus("Running automation...");
    setInboxError("");
    setCopyStatus("");

    try {
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

      const taughtProcess = performTeachUpdate();
      const evaluationProcesses =
        taughtProcess && !seenProcesses.includes(taughtProcess)
          ? [...seenProcesses, taughtProcess]
          : seenProcesses;
      runSafetyCheck(evaluationProcesses);

      setInboxStatus("Automation packet ready.");
    } catch (error) {
      setInboxStatus("Automation failed.");
      setInboxError(error instanceof Error ? error.message : "Unknown automation error.");
    }
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
    setInboxStatus("Ready");
    setInboxError("");
    setInboxResult(null);
    setComparisonResult(null);
    setCopyStatus("");
  };

  const handleWorkflowChange = (processId: ProcessId) => {
    setSelectedWorkflowId(processId);
    setInboxRequest(BIS_WORKFLOW_BY_PROCESS[processId]?.sampleRequest ?? DEFAULT_REQUEST);
  };

  const handleCopy = async (label: string, payload: unknown) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopyStatus(`${label} copied.`);
    } catch {
      setCopyStatus("Clipboard blocked in this browser.");
    }
  };

  const modeKey = selectedModeKey(activePreset.clMode);
  const forgettingReduction = comparisonResult
    ? Math.max(0, comparisonResult.modes.naive.meanForgetting - comparisonResult.modes[modeKey].meanForgetting)
    : 0;

  const plan = inboxResult?.plan ?? null;
  const manualMinutes = activeWorkflow.manualCycleMinutes;
  const automatedMinutes = activeWorkflow.automatedCycleMinutes;
  const savedMinutes = Math.max(0, manualMinutes - automatedMinutes);
  const savedPercent = manualMinutes > 0 ? Math.round((savedMinutes / manualMinutes) * 100) : 0;
  const requiredFieldsFilled = plan ? Object.keys(plan.required_fields).length : 0;
  const approvalCount = plan?.approvals.length ?? 0;

  const charter = plan
    ? {
        title: plan.title,
        process_id: plan.process_id,
        problem_statement: activeWorkflow.manualPain,
        goal: `Reduce intake-to-plan turnaround from ${manualMinutes}m to ${automatedMinutes}m.`,
        owner: plan.owner_role,
        baseline_metric_minutes: manualMinutes,
        target_metric_minutes: automatedMinutes,
        risk_tag: plan.risk_tag,
      }
    : null;

  const blueprint = plan
    ? {
        triggers: [`${activeWorkflow.workflowName} request intake`],
        connectors: activeWorkflow.systemTargets,
        steps: [
          "Classify request",
          "Extract required fields",
          "Validate policy constraints",
          "Assign approvals and SLA",
          "Create handoff payloads",
        ],
        controls: plan.controls,
        monitoring: [
          `SLA threshold: ${plan.sla_hours} hours`,
          "Missing field alerts",
          "Approval timeout alert",
        ],
      }
    : null;

  const exportsPayload = plan
    ? {
        jira: {
          project: "BIS",
          issuetype: "Task",
          summary: `[Process Optimisation] ${plan.title}`,
          description: plan.next_actions.join(" | "),
          priority: plan.risk_tag === "high" ? "High" : "Medium",
          labels: [plan.process_id, "automation-packet"],
          fields: plan.required_fields,
        },
        serviceNow: {
          category: "process_automation",
          short_description: plan.title,
          assignment_group: plan.owner_role,
          impact: plan.risk_tag,
          sla_hours: plan.sla_hours,
          approvals: plan.approvals,
          required_fields: plan.required_fields,
        },
        tracker: {
          workflow: activeWorkflow.workflowName,
          process_id: plan.process_id,
          owner: plan.owner_role,
          target_sla_hours: plan.sla_hours,
          controls: plan.controls.length,
          status: "ready_for_execution",
        },
      }
    : null;

  const beforeSteps = [
    "Request arrives in ticket or email",
    "Manual triage and clarification",
    "Approval chase across teams",
    "Manual tracker update",
  ];

  const afterSteps = [
    `Auto-classify as ${activeWorkflow.workflowName}`,
    "Extract and validate required fields",
    "Attach approvals and SLA ownership",
    "Generate export payloads",
  ];

  if (loadingData) {
    return (
      <main className="app-shell">
        <section className="frame loading-frame">
          <h1>Loading BIS demo...</h1>
        </section>
      </main>
    );
  }

  if (loadError || !appData) {
    return (
      <main className="app-shell">
        <section className="frame loading-frame">
          <h1>Unable to load demo</h1>
          <p className="warning">{loadError || "Unknown initialization error."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="frame">
        <header className="hero">
          <p className="kicker">BIS Process Optimisation</p>
          <h1>Automate one intake request end-to-end.</h1>
          <p className="subtitle">Input a messy request. Get a ready packet in one click.</p>

          <div className="top-controls">
            <label className="field">
              Workflow
              <select
                value={selectedWorkflowId}
                onChange={(event) => handleWorkflowChange(event.target.value as ProcessId)}
              >
                {BIS_WORKFLOWS.map((workflow) => (
                  <option key={workflow.processId} value={workflow.processId}>
                    {workflow.workflowName}
                  </option>
                ))}
              </select>
            </label>

            <div className="preset-group" role="radiogroup" aria-label="Learning preset">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={presetId === preset.id ? "preset-btn active" : "preset-btn"}
                  onClick={() => setPresetId(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <button type="button" className="primary-btn" onClick={() => void handleStartDemo()}>
              Start demo
            </button>
            <button type="button" className="ghost-btn" onClick={handleReset}>
              Reset
            </button>
          </div>

          <label className="field request-field">
            Request
            <textarea
              value={inboxRequest}
              onChange={(event) => setInboxRequest(event.target.value)}
              rows={3}
            />
          </label>

          <div className="status-row">
            <p className="status-pill">{inboxStatus}</p>
            {copyStatus ? <p className="status-pill">{copyStatus}</p> : null}
            {inboxError ? <p className="warning">{inboxError}</p> : null}
          </div>
        </header>

        <section className="moment-grid">
          <article className="moment-card before">
            <h2>Before (manual)</h2>
            <p className="metric">{manualMinutes} min</p>
            <p className="micro">Typical cycle time</p>
            <p className="plain">{activeWorkflow.manualPain}</p>
          </article>

          <article className="moment-card after">
            <h2>After (automated)</h2>
            {plan ? (
              <>
                <p className="metric">{automatedMinutes} min</p>
                <p className="micro">Ready packet turnaround</p>
                <div className="signal-grid">
                  <div>
                    <p className="signal-value">-{savedPercent}%</p>
                    <p className="signal-label">Cycle time</p>
                  </div>
                  <div>
                    <p className="signal-value">{requiredFieldsFilled}</p>
                    <p className="signal-label">Fields captured</p>
                  </div>
                  <div>
                    <p className="signal-value">{approvalCount}</p>
                    <p className="signal-label">Approvals routed</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="plain">Run the demo to generate the automation packet.</p>
            )}
          </article>
        </section>

        <section className="outputs-panel">
          <h2>Your outputs</h2>
          {plan && charter && blueprint && exportsPayload ? (
            <div className="outputs-grid">
              <article className="output-card">
                <h3>Triage result</h3>
                <p>
                  <strong>{activeWorkflow.workflowName}</strong>
                </p>
                <p>Risk: {plan.risk_tag}</p>
                <p>Owner: {plan.owner_role}</p>
                <p>SLA: {plan.sla_hours}h</p>
              </article>

              <article className="output-card">
                <h3>Charter snapshot</h3>
                <p>{charter.problem_statement}</p>
                <p>
                  Target: {charter.baseline_metric_minutes}m {"->"} {charter.target_metric_minutes}m
                </p>
                <button type="button" className="mini-btn" onClick={() => void handleCopy("Charter JSON", charter)}>
                  Copy charter JSON
                </button>
              </article>

              <article className="output-card">
                <h3>Automation blueprint</h3>
                <ul>
                  {blueprint.steps.slice(0, 4).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="mini-btn"
                  onClick={() => void handleCopy("Blueprint JSON", blueprint)}
                >
                  Copy blueprint JSON
                </button>
              </article>

              <article className="output-card">
                <h3>Export payloads</h3>
                <p>Jira + ServiceNow + tracker row ready.</p>
                <div className="copy-row">
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => void handleCopy("Jira JSON", exportsPayload.jira)}
                  >
                    Copy Jira
                  </button>
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => void handleCopy("ServiceNow JSON", exportsPayload.serviceNow)}
                  >
                    Copy ServiceNow
                  </button>
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => void handleCopy("Tracker JSON", exportsPayload.tracker)}
                  >
                    Copy tracker
                  </button>
                </div>
              </article>
            </div>
          ) : (
            <div className="empty-state">Click "Start demo" to generate outputs.</div>
          )}
        </section>

        <details className="details-panel" open={showAdvanced} onToggle={(event) => setShowAdvanced(event.currentTarget.open)}>
          <summary>{showAdvanced ? "Hide details" : "Open full packet details"}</summary>

          <div className="details-content">
            <section className="flow-panel">
              <article>
                <h3>Before flow</h3>
                <ol>
                  {beforeSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </article>
              <article>
                <h3>After flow</h3>
                <ol>
                  {afterSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </article>
            </section>

            <section className="advanced-controls">
              <label className="field compact">
                Retrieval k
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={retrievalK}
                  onChange={(event) => setRetrievalK(Number(event.target.value))}
                />
              </label>
              <label className="field compact">
                Memory budget
                <input
                  type="range"
                  min={8}
                  max={80}
                  step={2}
                  value={memoryBudget}
                  onChange={(event) => setMemoryBudget(Number(event.target.value))}
                />
              </label>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={driftEnabled}
                  onChange={(event) => setDriftEnabled(event.target.checked)}
                />
                Simulate wording drift
              </label>
            </section>

            {comparisonResult ? (
              <section className="safety-panel">
                <h3>Regression safety</h3>
                <p>
                  Preset: <strong>{activePreset.label}</strong>
                </p>
                <p>
                  Retention gain vs naive: <strong>{(forgettingReduction * 100).toFixed(2)}%</strong>
                </p>
              </section>
            ) : null}

            {plan ? (
              <section className="json-grid">
                <article>
                  <h3>Plan JSON</h3>
                  <pre>{JSON.stringify(plan, null, 2)}</pre>
                </article>
                {exportsPayload ? (
                  <article>
                    <h3>Export JSON</h3>
                    <pre>{JSON.stringify(exportsPayload, null, 2)}</pre>
                  </article>
                ) : null}
              </section>
            ) : null}
          </div>
        </details>
      </section>
    </main>
  );
}

export default App;
