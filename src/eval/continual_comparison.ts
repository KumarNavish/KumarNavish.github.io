import {
  FifoMemoryStrategy,
  KCenterMemoryStrategy,
  ReservoirMemoryStrategy,
  RiskAwareMemoryStrategy,
  type MemoryInput,
  type MemoryStrategy,
} from "../cl/memory";
import {
  LinearSoftmaxClassifier,
  accuracy,
  computeForgetting,
  estimateFisherDiagonal,
  trainIntentRouter,
  type EwcState,
  type IntentExample,
  type RouterMode,
} from "../cl/router";
import type { Example, ProcessId } from "../domain/types";
import { keywordEmbedText } from "../agent/pipeline";

export type MemoryStrategyId = "fifo" | "reservoir" | "kcenter" | "risk-aware";

export interface ModeComparisonMetrics {
  mode: RouterMode;
  perProcessAccuracy: Record<string, number>;
  forgettingByProcess: Record<string, number>;
  meanAccuracy: number;
  meanForgetting: number;
  forgettingCurve: number[];
}

export interface ContinualComparisonResult {
  seenProcesses: ProcessId[];
  modes: Record<RouterMode, ModeComparisonMetrics>;
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function makeMemoryStrategy(
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

function toIntentExamples(examples: Example[]): IntentExample[] {
  return examples.map((example) => ({
    x: projectEmbedding(keywordEmbedText(example.request_text)),
    y: processIdToClass(example.process_id),
    taskId: example.process_id,
  }));
}

function processIdToClass(processId: ProcessId): number {
  const order: ProcessId[] = [
    "access_request",
    "vendor_onboarding",
    "purchase_request",
    "incident_escalation",
  ];
  const idx = order.indexOf(processId);
  return idx >= 0 ? idx : 0;
}

function projectEmbedding(raw: Float32Array): Float32Array {
  const projected = new Float32Array(4);
  projected[0] = raw[0] + 0.35 * raw[1] + 0.25 * raw[2] + 0.15 * raw[3];
  projected[1] = 0.2 * raw[0] + raw[1] + 0.3 * raw[2] + 0.25 * raw[3];
  projected[2] = 0.25 * raw[0] + 0.2 * raw[1] + raw[2] + 0.35 * raw[3];
  projected[3] = 0.3 * raw[0] + 0.2 * raw[1] + 0.3 * raw[2] + raw[3];

  let norm = 0;
  for (let i = 0; i < projected.length; i += 1) {
    norm += projected[i] * projected[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < projected.length; i += 1) {
      projected[i] /= norm;
    }
  }
  return projected;
}

function memoryItemToIntent(item: { payload?: Record<string, unknown>; embedding: Float32Array }): IntentExample | null {
  const payloadExample = item.payload?.example;
  if (!payloadExample || typeof payloadExample !== "object") {
    return null;
  }
  const example = payloadExample as Example;
  return {
    x: new Float32Array(item.embedding),
    y: processIdToClass(example.process_id),
    taskId: example.process_id,
  };
}

function toMemoryInput(example: Example): MemoryInput {
  return {
    id: example.id,
    process_id: example.process_id,
    risk_tag: example.risk_tag,
    embedding: projectEmbedding(keywordEmbedText(example.request_text)),
    payload: { example },
  };
}

function simulateMode(
  mode: RouterMode,
  seenProcesses: ProcessId[],
  trainSets: Partial<Record<ProcessId, Example[]>>,
  testSets: Partial<Record<ProcessId, Example[]>>,
  memoryStrategyId: MemoryStrategyId,
  memoryBudget: number,
): ModeComparisonMetrics {
  const model = new LinearSoftmaxClassifier(4, 4, { seed: 101, initScale: 0.01 });
  const memory = makeMemoryStrategy(memoryStrategyId, memoryBudget, 41);
  const historyByProcess: Record<string, number[]> = {};
  const forgettingCurve: number[] = [];
  let ewcState: EwcState | undefined;
  const learningRate = mode === "naive" ? 0.14 : mode === "ewc" ? 0.085 : 0.1;
  const epochs = mode === "naive" ? 64 : 52;

  for (let taskIndex = 0; taskIndex < seenProcesses.length; taskIndex += 1) {
    const processId = seenProcesses[taskIndex];
    const currentTrain = toIntentExamples((trainSets[processId] ?? []).slice(0, 30));
    const replayData = memory
      .getMemory()
      .map(memoryItemToIntent)
      .filter((item): item is IntentExample => item !== null);

    const effectiveMode =
      mode === "ewc" && !ewcState
        ? "naive"
        : mode;

    trainIntentRouter(model, currentTrain, {
      mode: effectiveMode,
      epochs,
      learningRate,
      replayData: mode === "rehearsal" ? replayData : undefined,
      replayRatio: mode === "rehearsal" ? 1.2 : undefined,
      ewcState: mode === "ewc" ? ewcState : undefined,
      seed: 1000 + taskIndex * 13,
    });

    const currentExamples = (trainSets[processId] ?? []).slice(0, 30).map(toMemoryInput);
    memory.addExamples(currentExamples);

    if (mode === "ewc") {
      const fisherData = memory
        .getMemory()
        .map(memoryItemToIntent)
        .filter((item): item is IntentExample => item !== null);
      const fisher = estimateFisherDiagonal(model, fisherData);
      const params = model.getParams();
      ewcState = {
        lambda: 2400,
        fisherW: fisher.fisherW,
        fisherB: fisher.fisherB,
        refW: params.W,
        refB: params.b,
      };
    }

    const seenSoFar = seenProcesses.slice(0, taskIndex + 1);
    for (const seenProcess of seenSoFar) {
      const testData = toIntentExamples(testSets[seenProcess] ?? []);
      const processAccuracy = accuracy(model, testData);
      historyByProcess[seenProcess] ??= [];
      historyByProcess[seenProcess].push(processAccuracy);
    }
    const currentForgetting = computeForgetting(historyByProcess);
    forgettingCurve.push(mean(Object.values(currentForgetting)));
  }

  const finalAccuracyByProcess: Record<string, number> = {};
  for (const processId of seenProcesses) {
    const series = historyByProcess[processId] ?? [0];
    finalAccuracyByProcess[processId] = series[series.length - 1];
  }

  const forgettingByProcess = computeForgetting(historyByProcess);
  return {
    mode,
    perProcessAccuracy: finalAccuracyByProcess,
    forgettingByProcess,
    meanAccuracy: mean(Object.values(finalAccuracyByProcess)),
    meanForgetting: mean(Object.values(forgettingByProcess)),
    forgettingCurve,
  };
}

export function runContinualComparison(
  seenProcesses: ProcessId[],
  trainSets: Partial<Record<ProcessId, Example[]>>,
  testSets: Partial<Record<ProcessId, Example[]>>,
  memoryStrategyId: MemoryStrategyId,
  memoryBudget: number,
): ContinualComparisonResult {
  return {
    seenProcesses,
    modes: {
      naive: simulateMode("naive", seenProcesses, trainSets, testSets, memoryStrategyId, memoryBudget),
      rehearsal: simulateMode(
        "rehearsal",
        seenProcesses,
        trainSets,
        testSets,
        memoryStrategyId,
        memoryBudget,
      ),
      ewc: simulateMode("ewc", seenProcesses, trainSets, testSets, memoryStrategyId, memoryBudget),
    },
  };
}
