import { accuracyByTask, computeForgetting } from "./metrics";
import { LinearSoftmaxClassifier } from "./linear_classifier";
import { estimateFisherDiagonal, trainIntentRouter } from "./training";
import type { IntentExample } from "./types";

export interface RouterDemoResult {
  naive: {
    perTaskAccuracy: Record<string, number>;
    forgetting: Record<string, number>;
  };
  rehearsal: {
    perTaskAccuracy: Record<string, number>;
    forgetting: Record<string, number>;
  };
  ewc: {
    perTaskAccuracy: Record<string, number>;
    forgetting: Record<string, number>;
  };
}

function makeVec(...values: number[]): Float32Array {
  return new Float32Array(values);
}

function makeDataset(taskId: string, classLabel: number, center: Float32Array): IntentExample[] {
  const data: IntentExample[] = [];
  for (let i = 0; i < 20; i += 1) {
    const jitter = (i % 5) * 0.03;
    const x = makeVec(
      center[0] + jitter,
      center[1] - jitter,
      center[2] + jitter * 0.5,
      center[3] - jitter * 0.5,
    );
    data.push({ x, y: classLabel, taskId });
  }
  return data;
}

export function runRouterIncrementalDemo(seed = 17): RouterDemoResult {
  const taskA = [
    ...makeDataset("task_a", 0, makeVec(2, 0.2, 0, 0)),
    ...makeDataset("task_a", 1, makeVec(0.1, 2.2, 0, 0.1)),
  ];
  const taskB = [
    ...makeDataset("task_b", 2, makeVec(0, 0.2, 2.3, 0)),
    ...makeDataset("task_b", 3, makeVec(0, 0.1, 0, 2.4)),
  ];
  const taskSets = { task_a: taskA, task_b: taskB };

  const makeBaseModel = () => new LinearSoftmaxClassifier(4, 4, { seed, initScale: 0.02 });

  const naiveModel = makeBaseModel();
  trainIntentRouter(naiveModel, taskA, {
    mode: "naive",
    epochs: 80,
    learningRate: 0.06,
    seed: seed + 1,
  });
  const naiveHistory = { task_a: [accuracyByTask(naiveModel, { task_a: taskA }).task_a], task_b: [] as number[] };
  trainIntentRouter(naiveModel, taskB, {
    mode: "naive",
    epochs: 80,
    learningRate: 0.06,
    seed: seed + 2,
  });
  naiveHistory.task_a.push(accuracyByTask(naiveModel, { task_a: taskA }).task_a);
  naiveHistory.task_b.push(accuracyByTask(naiveModel, { task_b: taskB }).task_b);

  const rehearsalModel = makeBaseModel();
  trainIntentRouter(rehearsalModel, taskA, {
    mode: "naive",
    epochs: 80,
    learningRate: 0.06,
    seed: seed + 1,
  });
  const rehearsalHistory = {
    task_a: [accuracyByTask(rehearsalModel, { task_a: taskA }).task_a],
    task_b: [] as number[],
  };
  trainIntentRouter(rehearsalModel, taskB, {
    mode: "rehearsal",
    replayData: taskA.slice(0, 24),
    replayRatio: 1,
    epochs: 80,
    learningRate: 0.06,
    seed: seed + 2,
  });
  rehearsalHistory.task_a.push(accuracyByTask(rehearsalModel, { task_a: taskA }).task_a);
  rehearsalHistory.task_b.push(accuracyByTask(rehearsalModel, { task_b: taskB }).task_b);

  const ewcModel = makeBaseModel();
  trainIntentRouter(ewcModel, taskA, {
    mode: "naive",
    epochs: 80,
    learningRate: 0.06,
    seed: seed + 1,
  });
  const ewcHistory = { task_a: [accuracyByTask(ewcModel, { task_a: taskA }).task_a], task_b: [] as number[] };
  const params = ewcModel.getParams();
  const fisher = estimateFisherDiagonal(ewcModel, taskA.slice(0, 24));
  trainIntentRouter(ewcModel, taskB, {
    mode: "ewc",
    epochs: 80,
    learningRate: 0.06,
    seed: seed + 2,
    ewcState: {
      lambda: 45,
      fisherW: fisher.fisherW,
      fisherB: fisher.fisherB,
      refW: params.W,
      refB: params.b,
    },
  });
  ewcHistory.task_a.push(accuracyByTask(ewcModel, { task_a: taskA }).task_a);
  ewcHistory.task_b.push(accuracyByTask(ewcModel, { task_b: taskB }).task_b);

  return {
    naive: {
      perTaskAccuracy: accuracyByTask(naiveModel, taskSets),
      forgetting: computeForgetting(naiveHistory),
    },
    rehearsal: {
      perTaskAccuracy: accuracyByTask(rehearsalModel, taskSets),
      forgetting: computeForgetting(rehearsalHistory),
    },
    ewc: {
      perTaskAccuracy: accuracyByTask(ewcModel, taskSets),
      forgetting: computeForgetting(ewcHistory),
    },
  };
}
