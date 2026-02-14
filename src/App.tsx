import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { runAutomationPipeline, keywordEmbedText, type PipelineResult } from "./agent/pipeline";
import {
  FifoMemoryStrategy,
  KCenterMemoryStrategy,
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
import { PROCESS_IDS, type Example, type ProcessDefinition, type ProcessId, type StreamStep } from "./domain/types";
import { runContinualComparison, type ContinualComparisonResult, type MemoryStrategyId } from "./eval/continual_comparison";
import { VectorStore } from "./retrieval/vector_store";
import {
  clearDemoState,
  loadDemoState,
  saveDemoState,
  type AuditEntryState,
  type DemoTabId,
  type EvalSnapshotState,
} from "./state/persistence";

type TabId = DemoTabId;

interface AppData {
  processDefinitions: Record<ProcessId, ProcessDefinition>;
  trainSets: Partial<Record<ProcessId, Example[]>>;
  testSets: Partial<Record<ProcessId, Example[]>>;
  streamSchedule: StreamStep[];
}

type AuditEntry = AuditEntryState;
type EvalSnapshot = EvalSnapshotState;

interface SampleRequestOption {
  label: string;
  text: string;
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "inbox", label: "Inbox" },
  { id: "teach", label: "Improve Model" },
  { id: "evaluate", label: "Results" },
  { id: "memory", label: "Memory" },
  { id: "audit", label: "Audit" },
];

const DEFAULT_INBOX_REQUEST = "Please escalate INC-9901 for checkout outage and treat as sev1.";
const DEFAULT_MEMORY_QUERY = "checkout outage sev1 incident";

function makeRouter(seed = 13): LinearSoftmaxClassifier {
  return new LinearSoftmaxClassifier(4, 4, { seed, initScale: 0.01 });
}

function createMemoryStrategy(
  strategyId: MemoryStrategyId,
  capacity: number,
  seed: number,
): MemoryStrategy {
  switch (strategyId) {
    case "fifo":
      return new FifoMemoryStrategy(capacity);
    case "reservoir":
      return new ReservoirMemoryStrategy(capacity, { seed });
    case "kcenter":
      return new KCenterMemoryStrategy(capacity, { seed });
    case "risk-aware":
      return new RiskAwareMemoryStrategy(capacity, { seed });
    default:
      return new ReservoirMemoryStrategy(capacity, { seed });
  }
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

function loadJson<T>(path: string): Promise<T> {
  return fetch(`${import.meta.env.BASE_URL}${path}`).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to load ${path} (${response.status})`);
    }
    return (await response.json()) as T;
  });
}

function countByRisk(memoryItems: MemoryItem[]): Record<string, number> {
  return memoryItems.reduce(
    (acc, item) => {
      acc[item.risk_tag] += 1;
      return acc;
    },
    { low: 0, medium: 0, high: 0 },
  );
}

function formatTimestamp(date = new Date()): string {
  return date.toISOString().replace("T", " ").replace("Z", " UTC");
}

function forgettingChartPoints(
  result: ContinualComparisonResult | null,
  mode: RouterMode,
  width: number,
  height: number,
): string {
  if (!result) {
    return "";
  }
  const values = result.modes[mode].forgettingCurve;
  if (values.length === 0) {
    return "";
  }
  const padding = 20;
  const xSpan = Math.max(1, values.length - 1);
  const maxY = Math.max(0.01, ...values);

  return values
    .map((value, index) => {
      const x = padding + (index / xSpan) * (width - padding * 2);
      const y = height - padding - (value / maxY) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");
}

function strategyLabel(mode: RouterMode): string {
  if (mode === "rehearsal") {
    return "Replay";
  }
  if (mode === "ewc") {
    return "EWC";
  }
  return "Naive";
}

function bootstrapSeed(
  streamSchedule: StreamStep[],
  trainSets: Partial<Record<ProcessId, Example[]>>,
): { firstProcess: ProcessId; initialExamples: Example[] } {
  const firstProcess = streamSchedule[0]?.process_id ?? "access_request";
  const initialExamples = (trainSets[firstProcess] ?? []).slice(0, 24);
  return { firstProcess, initialExamples };
}

function nextAuditId(entries: AuditEntry[]): number {
  const max = entries.reduce((best, entry) => (entry.id > best ? entry.id : best), 0);
  return max + 1;
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>("inbox");
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [firstTimeMode, setFirstTimeMode] = useState(true);
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);

  const [memoryStrategyId, setMemoryStrategyId] = useState<MemoryStrategyId>("reservoir");
  const [memoryBudget, setMemoryBudget] = useState(32);
  const [retrievalK, setRetrievalK] = useState(3);
  const [clMode, setClMode] = useState<RouterMode>("rehearsal");
  const [driftEnabled, setDriftEnabled] = useState(false);

  const [appData, setAppData] = useState<AppData | null>(null);
  const [seenProcesses, setSeenProcesses] = useState<ProcessId[]>([]);
  const [trainStream, setTrainStream] = useState<Example[]>([]);
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [evalSnapshots, setEvalSnapshots] = useState<EvalSnapshot[]>([]);
  const [teachStatus, setTeachStatus] = useState("Idle");

  const [inboxRequest, setInboxRequest] = useState(DEFAULT_INBOX_REQUEST);
  const [inboxStatus, setInboxStatus] = useState("Idle");
  const [inboxResult, setInboxResult] = useState<PipelineResult | null>(null);
  const [inboxError, setInboxError] = useState("");

  const [memoryQuery, setMemoryQuery] = useState(DEFAULT_MEMORY_QUERY);
  const [memoryHits, setMemoryHits] = useState<Array<{ id: string; score: number; example: Example }>>([]);

  const [evalStatus, setEvalStatus] = useState("Idle");
  const [comparisonResult, setComparisonResult] = useState<ContinualComparisonResult | null>(null);
  const [stateReady, setStateReady] = useState(false);

  const routerRef = useRef<LinearSoftmaxClassifier>(makeRouter());
  const ewcStateRef = useRef<EwcState | null>(null);
  const auditIdRef = useRef(1);
  const skipNextMemoryRebuildRef = useRef(false);

  const addAudit = (action: string, detail: string) => {
    const entry: AuditEntry = {
      id: auditIdRef.current++,
      timestamp: formatTimestamp(),
      action,
      detail,
    };
    setAuditLog((prev) => [...prev, entry]);
  };

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
        setAppData(normalizedData);

        const persisted = loadDemoState();
        if (persisted) {
          try {
            const restoredSeen = persisted.seenProcesses.filter((processId) => PROCESS_IDS.includes(processId));
            const restoredTrain = persisted.trainStream.filter((example) => PROCESS_IDS.includes(example.process_id));

            routerRef.current = makeRouter(31);
            routerRef.current.setParams(persisted.routerParams);
            ewcStateRef.current = persisted.ewcState;

            setActiveTab(persisted.activeTab);
            setMemoryStrategyId(persisted.controls.memoryStrategyId);
            setMemoryBudget(persisted.controls.memoryBudget);
            setRetrievalK(persisted.controls.retrievalK);
            setClMode(persisted.controls.clMode);
            setDriftEnabled(persisted.controls.driftEnabled);
            setFirstTimeMode(persisted.seenProcesses.length <= 1 && persisted.evalSnapshots.length === 0);
            setAdvancedSettingsOpen(false);

            setSeenProcesses(restoredSeen.length > 0 ? restoredSeen : [firstProcess]);
            setTrainStream(restoredTrain.length > 0 ? restoredTrain : initialExamples);

            if (persisted.memoryItems.length > 0) {
              skipNextMemoryRebuildRef.current = true;
              setMemoryItems(persisted.memoryItems);
            }

            setAuditLog(persisted.auditLog);
            setEvalSnapshots(persisted.evalSnapshots);
            setComparisonResult(persisted.comparisonResult);
            setInboxRequest(persisted.inboxRequest);
            setInboxResult(null);
            setInboxError("");
            setInboxStatus("Restored previous browser session.");
            setTeachStatus("Restored from browser storage.");
            setMemoryHits([]);
            setMemoryQuery(DEFAULT_MEMORY_QUERY);
            setEvalStatus("Idle");

            auditIdRef.current = nextAuditId(persisted.auditLog);
            setStateReady(true);
            return;
          } catch {
            clearDemoState();
          }
        }

        routerRef.current = makeRouter(31);
        ewcStateRef.current = null;
        trainIntentRouter(routerRef.current, initialExamples.map(toIntentExample), {
          mode: "naive",
          epochs: 36,
          learningRate: 0.09,
          seed: 111,
        });

        setActiveTab("inbox");
        setMemoryStrategyId("reservoir");
        setMemoryBudget(32);
        setRetrievalK(3);
        setClMode("rehearsal");
        setDriftEnabled(false);
        setFirstTimeMode(true);
        setAdvancedSettingsOpen(false);
        setSeenProcesses([firstProcess]);
        setTrainStream(initialExamples);
        setMemoryItems([]);
        setComparisonResult(null);
        setEvalSnapshots([]);
        setInboxRequest(DEFAULT_INBOX_REQUEST);
        setInboxResult(null);
        setInboxError("");
        setInboxStatus("Idle");
        setMemoryQuery(DEFAULT_MEMORY_QUERY);
        setMemoryHits([]);
        setEvalStatus("Idle");
        setTeachStatus("Idle");
        setAuditLog([]);
        auditIdRef.current = 1;
        addAudit("bootstrap", `Initialized with first process: ${firstProcess}`);
        setStateReady(true);
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
    if (skipNextMemoryRebuildRef.current) {
      skipNextMemoryRebuildRef.current = false;
      return;
    }
    const strategy = createMemoryStrategy(memoryStrategyId, memoryBudget, 79);
    strategy.addExamples(trainStream.map(toMemoryInput));
    setMemoryItems(strategy.getMemory());
  }, [trainStream, memoryStrategyId, memoryBudget]);

  useEffect(() => {
    if (!stateReady || !appData) {
      return;
    }

    saveDemoState({
      activeTab,
      controls: {
        memoryStrategyId,
        memoryBudget,
        retrievalK,
        clMode,
        driftEnabled,
      },
      seenProcesses,
      trainStream,
      memoryItems,
      routerParams: routerRef.current.getParams(),
      ewcState: ewcStateRef.current,
      auditLog,
      evalSnapshots,
      comparisonResult,
      inboxRequest,
    });
  }, [
    stateReady,
    appData,
    activeTab,
    memoryStrategyId,
    memoryBudget,
    retrievalK,
    clMode,
    driftEnabled,
    seenProcesses,
    trainStream,
    memoryItems,
    auditLog,
    evalSnapshots,
    comparisonResult,
    inboxRequest,
  ]);

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

  const sampleRequests = useMemo(() => {
    if (!appData) {
      return [] as SampleRequestOption[];
    }
    const options: SampleRequestOption[] = [];
    for (const processId of seenProcesses) {
      const sampleText = appData.testSets[processId]?.[0]?.request_text;
      if (sampleText) {
        options.push({ label: processId, text: sampleText });
      }
    }
    return options;
  }, [appData, seenProcesses]);

  const sampleRequestOptions = useMemo<SampleRequestOption[]>(
    () => [...sampleRequests, { label: "custom", text: inboxRequest }],
    [sampleRequests, inboxRequest],
  );

  const nextTeachStep = useMemo(() => {
    if (!appData) {
      return null;
    }
    return appData.streamSchedule.find((step) => !seenProcesses.includes(step.process_id)) ?? null;
  }, [appData, seenProcesses]);

  const handleTeachUpdate = () => {
    if (!appData || !nextTeachStep) {
      setTeachStatus("No remaining processes to teach.");
      return;
    }

    const nextProcess = nextTeachStep.process_id;
    const currentExamples = (appData.trainSets[nextProcess] ?? []).slice(0, 24);
    const replayData = memoryItems
      .map(memoryItemToExample)
      .filter((example): example is Example => example !== null)
      .map(toIntentExample);

    const mode: RouterMode = clMode;
    let trainOptions: TrainOptions;
    if (mode === "ewc" && ewcStateRef.current) {
      trainOptions = {
        mode: "ewc",
        epochs: 36,
        learningRate: 0.09,
        ewcState: ewcStateRef.current,
        seed: 700 + seenProcesses.length * 17,
      };
    } else if (mode === "rehearsal") {
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

    trainIntentRouter(
      routerRef.current,
      currentExamples.map(toIntentExample),
      trainOptions,
    );

    const fisherData = [
      ...replayData,
      ...currentExamples.map(toIntentExample),
    ];
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
    setTeachStatus(`Updated with ${nextProcess} using ${mode.toUpperCase()} mode.`);
    addAudit("teach_update", `Added ${nextProcess} with CL mode ${mode}.`);
  };

  const handleRunInbox = async () => {
    if (!appData) {
      return;
    }
    setInboxStatus("Running automation pipeline...");
    setInboxError("");
    setInboxResult(null);
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
      setInboxStatus("Pipeline succeeded.");
      addAudit(
        "inbox_run",
        `Request routed to ${result.predictedIntent} (${result.modeUsed}), repaired=${result.validation.repaired}.`,
      );
    } catch (error) {
      setInboxStatus("Pipeline failed.");
      setInboxError(error instanceof Error ? error.message : "Unknown pipeline error.");
      addAudit("inbox_error", error instanceof Error ? error.message : "Unknown inbox pipeline error.");
    }
  };

  const handleMemoryQuery = () => {
    const queryEmbedding = keywordEmbedText(memoryQuery);
    const hits = memoryStore.topK(queryEmbedding, retrievalK).map((hit) => ({
      id: hit.id,
      score: hit.score,
      example: hit.payload,
    }));
    setMemoryHits(hits);
  };

  const handleEvaluate = () => {
    if (!appData || seenProcesses.length === 0) {
      return;
    }
    setEvalStatus("Running continual comparison (naive/rehearsal/ewc)...");
    const previous = comparisonResult;
    const result = runContinualComparison(
      seenProcesses,
      appData.trainSets,
      appData.testSets,
      memoryStrategyId,
      memoryBudget,
    );
    setComparisonResult(result);
    setEvalStatus("Evaluation complete.");

    const naiveForget = result.modes.naive.meanForgetting;
    const rehForget = result.modes.rehearsal.meanForgetting;
    const ewcForget = result.modes.ewc.meanForgetting;
    const priorNaive = previous?.modes.naive.meanForgetting ?? 0;
    const delta = naiveForget - priorNaive;
    addAudit(
      "evaluate",
      `Naive forgetting=${naiveForget.toFixed(3)} (delta ${delta >= 0 ? "+" : ""}${delta.toFixed(
        3,
      )}), rehearsal=${rehForget.toFixed(3)}, ewc=${ewcForget.toFixed(3)}.`,
    );
    setEvalSnapshots((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        timestamp: formatTimestamp(),
        seenProcesses: [...seenProcesses],
        result,
      },
    ]);
  };

  const handleResetDemoState = () => {
    if (!appData) {
      return;
    }
    clearDemoState();
    const { firstProcess, initialExamples } = bootstrapSeed(appData.streamSchedule, appData.trainSets);

    routerRef.current = makeRouter(31);
    ewcStateRef.current = null;
    trainIntentRouter(routerRef.current, initialExamples.map(toIntentExample), {
      mode: "naive",
      epochs: 36,
      learningRate: 0.09,
      seed: 111,
    });

    setActiveTab("inbox");
    setMemoryStrategyId("reservoir");
    setMemoryBudget(32);
    setRetrievalK(3);
    setClMode("rehearsal");
    setDriftEnabled(false);
    setFirstTimeMode(true);
    setAdvancedSettingsOpen(false);
    setSeenProcesses([firstProcess]);
    setTrainStream(initialExamples);
    setMemoryItems([]);
    setAuditLog([]);
    setEvalSnapshots([]);
    setComparisonResult(null);
    setTeachStatus("Demo reset to initial state.");
    setInboxRequest(DEFAULT_INBOX_REQUEST);
    setInboxStatus("Idle");
    setInboxResult(null);
    setInboxError("");
    setMemoryQuery(DEFAULT_MEMORY_QUERY);
    setMemoryHits([]);
    setEvalStatus("Idle");
    auditIdRef.current = 1;
    addAudit("reset", `State cleared and reinitialized with ${firstProcess}.`);
  };

  const riskCounts = countByRisk(memoryItems);
  const hasRunPipeline = inboxResult !== null;
  const hasTaughtAdditionalProcess = seenProcesses.length > 1;
  const hasEvaluation = comparisonResult !== null;
  const firstTimeStep = !hasRunPipeline ? 1 : !hasTaughtAdditionalProcess ? 2 : !hasEvaluation ? 3 : 4;

  const rehearsalBeatsNaive = comparisonResult
    ? comparisonResult.modes.rehearsal.meanForgetting < comparisonResult.modes.naive.meanForgetting
    : false;
  const ewcBeatsNaive = comparisonResult
    ? comparisonResult.modes.ewc.meanForgetting < comparisonResult.modes.naive.meanForgetting
    : false;
  const selectedMode = clMode === "naive" ? "naive" : clMode === "rehearsal" ? "rehearsal" : "ewc";
  const selectedForgetting = comparisonResult ? comparisonResult.modes[selectedMode].meanForgetting : 0;
  const forgettingReduction = comparisonResult
    ? Math.max(0, comparisonResult.modes.naive.meanForgetting - selectedForgetting)
    : 0;
  const guidedActionLabel =
    firstTimeStep === 1
      ? "Step 1: Run Request"
      : firstTimeStep === 2
        ? "Step 2: Improve Model"
        : firstTimeStep === 3
          ? "Step 3: Compare Retention"
          : "Open Full Workspace";

  const handleGuidedPrimaryAction = async () => {
    if (firstTimeStep === 1) {
      await handleRunInbox();
      return;
    }
    if (firstTimeStep === 2) {
      handleTeachUpdate();
      return;
    }
    if (firstTimeStep === 3) {
      handleEvaluate();
      return;
    }
    setFirstTimeMode(false);
  };

  if (loadingData) {
    return (
      <main className="app-shell">
        <section className="hero">
          <h1>Continual Process Automation Copilot</h1>
          <p>Loading synthetic datasets and initializing demo state...</p>
        </section>
      </main>
    );
  }

  if (loadError || !appData) {
    return (
      <main className="app-shell">
        <section className="hero">
          <h1>Continual Process Automation Copilot</h1>
          <p className="warning">{loadError || "Unable to initialize app data."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero full-width">
        <p className="label">Interactive Demo</p>
        <h1>Continual Process Automation Copilot</h1>
        <p>Route requests, improve the intent model, and measure retention in a single browser session.</p>

        <div className="row wrap mode-row">
          <label className="compact-control">
            Learning strategy
            <select value={clMode} onChange={(event) => setClMode(event.target.value as RouterMode)}>
              <option value="naive">Naive</option>
              <option value="rehearsal">Replay</option>
              <option value="ewc">EWC</option>
            </select>
          </label>
          {firstTimeMode ? (
            <button type="button" className="secondary-btn" onClick={() => setFirstTimeMode(false)}>
              Open full workspace
            </button>
          ) : (
            <button type="button" className="secondary-btn" onClick={() => setFirstTimeMode(true)}>
              Return to guided mode
            </button>
          )}
          <button type="button" className="secondary-btn" onClick={handleResetDemoState}>
            Reset demo state
          </button>
        </div>

        {firstTimeMode ? (
          <>
            <section className="start-strip">
              <p className="label">Start Here</p>
              <h2>Complete these 3 steps to see continual learning in action.</h2>
              <p className="legend">
                Current step: {firstTimeStep} of 3 {firstTimeStep > 3 ? "(complete)" : ""}
              </p>
              <button type="button" onClick={() => void handleGuidedPrimaryAction()}>
                {guidedActionLabel}
              </button>
            </section>

            <section className="guided-grid">
              <article className={firstTimeStep === 1 ? "guided-step active" : "guided-step"}>
                <h3>1. Run a Request</h3>
                <label>
                  Scenario
                  <select onChange={(event) => setInboxRequest(event.target.value)} value={inboxRequest}>
                    {sampleRequestOptions.map((sample) => (
                      <option key={`${sample.label}-${sample.text.slice(0, 16)}`} value={sample.text}>
                        {sample.label}
                      </option>
                    ))}
                  </select>
                </label>
                <textarea
                  className="pipeline-input"
                  value={inboxRequest}
                  onChange={(event) => setInboxRequest(event.target.value)}
                />
                <button type="button" onClick={() => void handleRunInbox()}>
                  Run request
                </button>
                <p className="status">{inboxStatus}</p>
                {inboxError ? <p className="warning">{inboxError}</p> : null}
              </article>

              <article className={firstTimeStep === 2 ? "guided-step active" : "guided-step"}>
                <h3>2. Improve Model</h3>
                <p className="legend">Seen: {seenProcesses.join(", ")}</p>
                {nextTeachStep ? (
                  <>
                    <p>
                      Next process: <strong>{nextTeachStep.process_id}</strong>
                    </p>
                    <button type="button" onClick={handleTeachUpdate}>
                      Teach next process
                    </button>
                  </>
                ) : (
                  <p>All processes already taught.</p>
                )}
                <p className="status">{teachStatus}</p>
              </article>

              <article className={firstTimeStep === 3 ? "guided-step active" : "guided-step"}>
                <h3>3. Compare Retention</h3>
                <button type="button" onClick={handleEvaluate}>
                  Run comparison
                </button>
                <p className="status">{evalStatus}</p>
                {comparisonResult ? (
                  <div className="metric-grid">
                    <p>
                      Naive forgetting:{" "}
                      <strong>{(comparisonResult.modes.naive.meanForgetting * 100).toFixed(2)}%</strong>
                    </p>
                    <p>
                      {strategyLabel(selectedMode)} forgetting:{" "}
                      <strong>{(selectedForgetting * 100).toFixed(2)}%</strong>
                    </p>
                    <p>
                      Reduction vs naive: <strong>{(forgettingReduction * 100).toFixed(2)}%</strong>
                    </p>
                  </div>
                ) : null}
              </article>
            </section>

            {inboxResult ? (
              <section className="result-card">
                <h3>Action Plan</h3>
                <p className="legend">
                  Predicted process: <strong>{inboxResult.predictedIntent}</strong> | output repaired:{" "}
                  <strong>{inboxResult.validation.repaired ? "yes" : "no"}</strong>
                </p>
                <details>
                  <summary>View plan JSON</summary>
                  <pre className="summary summary-block">{JSON.stringify(inboxResult.plan, null, 2)}</pre>
                </details>
              </section>
            ) : null}

            <details
              className="advanced-settings"
              open={advancedSettingsOpen}
              onToggle={(event) => {
                const next = (event.currentTarget as HTMLDetailsElement).open;
                setAdvancedSettingsOpen(next);
              }}
            >
              <summary>Advanced settings</summary>
              <div className="control-grid">
                <label>
                  Memory strategy
                  <select
                    value={memoryStrategyId}
                    onChange={(event) => setMemoryStrategyId(event.target.value as MemoryStrategyId)}
                  >
                    <option value="fifo">FIFO</option>
                    <option value="reservoir">Reservoir</option>
                    <option value="kcenter">k-center</option>
                    <option value="risk-aware">Risk-aware</option>
                  </select>
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
                <label className="inline-toggle">
                  <input
                    type="checkbox"
                    checked={driftEnabled}
                    onChange={(event) => setDriftEnabled(event.target.checked)}
                  />
                  Drift toggle
                </label>
              </div>
            </details>
          </>
        ) : (
          <>
            <div className="control-grid">
              <label>
                Memory strategy
                <select
                  value={memoryStrategyId}
                  onChange={(event) => setMemoryStrategyId(event.target.value as MemoryStrategyId)}
                >
                  <option value="fifo">FIFO</option>
                  <option value="reservoir">Reservoir</option>
                  <option value="kcenter">k-center</option>
                  <option value="risk-aware">Risk-aware</option>
                </select>
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
              <label className="inline-toggle">
                <input
                  type="checkbox"
                  checked={driftEnabled}
                  onChange={(event) => setDriftEnabled(event.target.checked)}
                />
                Drift toggle
              </label>
            </div>

            <div className="tab-row">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={activeTab === tab.id ? "tab-btn active" : "tab-btn"}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "inbox" ? (
              <div className="panel">
                <h3>Inbox</h3>
                <div className="row wrap">
                  <label>
                    Sample request
                    <select onChange={(event) => setInboxRequest(event.target.value)} value={inboxRequest}>
                      {sampleRequestOptions.map((sample) => (
                        <option key={`${sample.label}-${sample.text.slice(0, 16)}`} value={sample.text}>
                          {sample.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <textarea
                  className="pipeline-input"
                  value={inboxRequest}
                  onChange={(event) => setInboxRequest(event.target.value)}
                />
                <button type="button" onClick={() => void handleRunInbox()}>
                  Run request
                </button>
                <p className="status">{inboxStatus}</p>
                {inboxError ? <p className="warning">{inboxError}</p> : null}
                {inboxResult ? <pre className="summary summary-block">{JSON.stringify(inboxResult.plan, null, 2)}</pre> : null}
              </div>
            ) : null}

            {activeTab === "teach" ? (
              <div className="panel">
                <h3>Improve Model</h3>
                <p className="status">Seen processes: {seenProcesses.join(", ")}</p>
                {nextTeachStep ? (
                  <>
                    <p>
                      Next process from stream: <strong>{nextTeachStep.process_id}</strong>{" "}
                      {nextTeachStep.drift ? "(drift-enabled step)" : ""}
                    </p>
                    <ul className="example-list">
                      {(appData.trainSets[nextTeachStep.process_id] ?? [])
                        .slice(0, 3)
                        .map((example) => (
                          <li key={example.id}>{example.request_text}</li>
                        ))}
                    </ul>
                    <button type="button" onClick={handleTeachUpdate}>
                      Update with next process
                    </button>
                  </>
                ) : (
                  <p>All scheduled processes already taught.</p>
                )}
                <p className="status">{teachStatus}</p>
              </div>
            ) : null}

            {activeTab === "evaluate" ? (
              <div className="panel">
                <h3>Results</h3>
                <button type="button" onClick={handleEvaluate}>
                  Run regression + forgetting comparison
                </button>
                <p className="status">{evalStatus}</p>
                {comparisonResult ? (
                  <>
                    <table className="eval-table">
                      <thead>
                        <tr>
                          <th>Mode</th>
                          <th>Mean Accuracy</th>
                          <th>Mean Forgetting</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Object.keys(comparisonResult.modes) as RouterMode[]).map((mode) => (
                          <tr key={mode}>
                            <td>{strategyLabel(mode)}</td>
                            <td>{(comparisonResult.modes[mode].meanAccuracy * 100).toFixed(1)}%</td>
                            <td>{(comparisonResult.modes[mode].meanForgetting * 100).toFixed(2)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="status">
                      Retention check: rehearsal {rehearsalBeatsNaive ? "improves" : "does not improve"} vs
                      naive, EWC {ewcBeatsNaive ? "improves" : "does not improve"} vs naive.
                    </p>
                    <svg width="460" height="190" viewBox="0 0 460 190" role="img" aria-label="Forgetting comparison curve">
                      <line x1="20" y1="170" x2="440" y2="170" stroke="#94a3b8" />
                      <line x1="20" y1="20" x2="20" y2="170" stroke="#94a3b8" />
                      <polyline
                        fill="none"
                        stroke="#8b1f1f"
                        strokeWidth="2"
                        points={forgettingChartPoints(comparisonResult, "naive", 460, 190)}
                      />
                      <polyline
                        fill="none"
                        stroke="#1e3a8a"
                        strokeWidth="2"
                        points={forgettingChartPoints(comparisonResult, "rehearsal", 460, 190)}
                      />
                      <polyline
                        fill="none"
                        stroke="#0f766e"
                        strokeWidth="2"
                        points={forgettingChartPoints(comparisonResult, "ewc", 460, 190)}
                      />
                    </svg>
                    <p className="legend">naive (red), replay (blue), ewc (teal)</p>
                    <p className="legend">Saved evaluation snapshots: {evalSnapshots.length}</p>
                  </>
                ) : null}
              </div>
            ) : null}

            {activeTab === "memory" ? (
              <div className="panel">
                <h3>Memory</h3>
                <p className="status">
                  Items retained: {memoryItems.length} | high={riskCounts.high}, medium={riskCounts.medium},
                  low={riskCounts.low}
                </p>
                <div className="row wrap">
                  <input
                    value={memoryQuery}
                    onChange={(event) => setMemoryQuery(event.target.value)}
                    placeholder="Query for retrieval"
                  />
                  <button type="button" onClick={handleMemoryQuery}>
                    Retrieve top-k
                  </button>
                </div>
                {memoryHits.length > 0 ? (
                  <ul className="example-list">
                    {memoryHits.map((hit) => (
                      <li key={hit.id}>
                        [{hit.score.toFixed(3)}] {hit.example.process_id}: {hit.example.request_text}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <details>
                  <summary>Show retained exemplars</summary>
                  <ul className="example-list">
                    {memoryItems.slice(0, 20).map((item) => {
                      const example = memoryItemToExample(item);
                      return (
                        <li key={item.id}>
                          {item.id} ({item.risk_tag}) - {example?.request_text ?? "missing payload"}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              </div>
            ) : null}

            {activeTab === "audit" ? (
              <div className="panel">
                <h3>Audit</h3>
                <ul className="example-list">
                  {auditLog.map((entry) => (
                    <li key={entry.id}>
                      [{entry.timestamp}] <strong>{entry.action}</strong>: {entry.detail}
                    </li>
                  ))}
                </ul>
                <details>
                  <summary>Evaluation snapshots ({evalSnapshots.length})</summary>
                  <ul className="example-list">
                    {evalSnapshots.map((snapshot) => (
                      <li key={snapshot.id}>
                        [{snapshot.timestamp}] seen={snapshot.seenProcesses.join(", ")} | naive forgetting=
                        {(snapshot.result.modes.naive.meanForgetting * 100).toFixed(2)}%
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}

export default App;
