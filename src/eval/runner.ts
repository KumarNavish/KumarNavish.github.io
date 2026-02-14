import type { Example, ProcessDefinition, ProcessId } from "../domain/types";
import { validateAndRepairPlan } from "./validate";
import {
  computeOverallScore,
  forgettingFromScoreHistory,
  meanScore,
  requiredFieldExactMatch,
} from "./metrics";

export interface ProcessRegressionMetrics {
  processId: ProcessId;
  sampleCount: number;
  intentAccuracy: number;
  requiredFieldExactMatchRate: number;
  overallScore: number;
}

export interface RegressionReport {
  processesSeen: ProcessId[];
  perProcess: Partial<Record<ProcessId, ProcessRegressionMetrics>>;
  macroOverallScore: number;
}

export interface PredictorOutput {
  predictedIntent: ProcessId;
  predictedPlan: unknown;
}

export type ExamplePredictor = (example: Example) => Promise<PredictorOutput>;

export async function runRegression(
  processesSeen: ProcessId[],
  testSets: Partial<Record<ProcessId, Example[]>>,
  processDefinitions: Record<ProcessId, ProcessDefinition>,
  predictor: ExamplePredictor,
): Promise<RegressionReport> {
  const perProcess: Partial<Record<ProcessId, ProcessRegressionMetrics>> = {};

  for (const processId of processesSeen) {
    const dataset = testSets[processId] ?? [];
    const definition = processDefinitions[processId];
    if (!definition) {
      continue;
    }

    let intentCorrect = 0;
    let requiredFieldExactMatches = 0;

    for (const example of dataset) {
      const prediction = await predictor(example);
      if (prediction.predictedIntent === processId) {
        intentCorrect += 1;
      }

      const repaired = validateAndRepairPlan(prediction.predictedPlan, definition, {
        defaultRiskTag: example.risk_tag,
        requestText: example.request_text,
      });
      const comparison = requiredFieldExactMatch(
        example.target.required_fields,
        repaired.plan.required_fields,
      );
      if (comparison.exact) {
        requiredFieldExactMatches += 1;
      }
    }

    const sampleCount = dataset.length;
    const intentAccuracy = sampleCount > 0 ? intentCorrect / sampleCount : 0;
    const requiredFieldExactMatchRate = sampleCount > 0 ? requiredFieldExactMatches / sampleCount : 0;
    const overallScore = computeOverallScore(intentAccuracy, requiredFieldExactMatchRate);

    perProcess[processId] = {
      processId,
      sampleCount,
      intentAccuracy,
      requiredFieldExactMatchRate,
      overallScore,
    };
  }

  const macroOverallScore = meanScore(
    Object.values(perProcess).map((metrics) => metrics?.overallScore ?? 0),
  );

  return {
    processesSeen,
    perProcess,
    macroOverallScore,
  };
}

export interface EvalSnapshot {
  step: number;
  label: string;
  timestamp: string;
  report: RegressionReport;
  forgettingByProcess: Record<string, number>;
  meanForgetting: number;
}

function buildScoreHistory(
  snapshots: EvalSnapshot[],
  currentReport?: RegressionReport,
): Record<string, number[]> {
  const history: Record<string, number[]> = {};
  for (const snapshot of snapshots) {
    for (const [processId, metrics] of Object.entries(snapshot.report.perProcess)) {
      history[processId] ??= [];
      history[processId].push(metrics?.overallScore ?? 0);
    }
  }
  if (currentReport) {
    for (const [processId, metrics] of Object.entries(currentReport.perProcess)) {
      history[processId] ??= [];
      history[processId].push(metrics?.overallScore ?? 0);
    }
  }
  return history;
}

export function makeSnapshot(
  snapshots: EvalSnapshot[],
  report: RegressionReport,
  label: string,
): EvalSnapshot {
  const history = buildScoreHistory(snapshots, report);
  const forgettingByProcess = forgettingFromScoreHistory(history);
  const meanForgetting = meanScore(Object.values(forgettingByProcess));

  return {
    step: snapshots.length + 1,
    label,
    timestamp: new Date().toISOString(),
    report,
    forgettingByProcess,
    meanForgetting,
  };
}

export class EvaluationSnapshotStore {
  private snapshots: EvalSnapshot[] = [];

  addSnapshot(report: RegressionReport, label: string): EvalSnapshot {
    const snapshot = makeSnapshot(this.snapshots, report, label);
    this.snapshots.push(snapshot);
    return snapshot;
  }

  listSnapshots(): EvalSnapshot[] {
    return [...this.snapshots];
  }

  clear() {
    this.snapshots = [];
  }
}

export function forgettingCurve(snapshots: EvalSnapshot[]): Array<{ step: number; value: number }> {
  return snapshots.map((snapshot) => ({
    step: snapshot.step,
    value: snapshot.meanForgetting,
  }));
}
