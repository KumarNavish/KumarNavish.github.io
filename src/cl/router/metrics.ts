import { LinearSoftmaxClassifier } from "./linear_classifier";
import type { IntentExample } from "./types";

export function accuracy(model: LinearSoftmaxClassifier, data: IntentExample[]): number {
  if (data.length === 0) {
    return 0;
  }
  let correct = 0;
  for (const sample of data) {
    if (model.predict(sample.x) === sample.y) {
      correct += 1;
    }
  }
  return correct / data.length;
}

export function accuracyByTask(
  model: LinearSoftmaxClassifier,
  taskDatasets: Record<string, IntentExample[]>,
): Record<string, number> {
  const output: Record<string, number> = {};
  for (const [taskId, dataset] of Object.entries(taskDatasets)) {
    output[taskId] = accuracy(model, dataset);
  }
  return output;
}

export function computeForgetting(historyByTask: Record<string, number[]>): Record<string, number> {
  const forgetting: Record<string, number> = {};
  for (const [taskId, history] of Object.entries(historyByTask)) {
    if (history.length === 0) {
      forgetting[taskId] = 0;
      continue;
    }
    const bestHistorical = Math.max(...history);
    const latest = history[history.length - 1];
    forgetting[taskId] = Math.max(0, bestHistorical - latest);
  }
  return forgetting;
}
