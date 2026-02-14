import { describe, expect, it } from "vitest";
import { LinearSoftmaxClassifier } from "./linear_classifier";
import { accuracy } from "./metrics";
import { estimateFisherDiagonal, trainIntentRouter } from "./training";
import type { IntentExample } from "./types";

function point(x1: number, x2: number): Float32Array {
  return new Float32Array([x1, x2]);
}

function buildLinearlySeparableData(): IntentExample[] {
  const data: IntentExample[] = [];
  for (let i = 0; i < 30; i += 1) {
    const jitter = (i % 5) * 0.02;
    data.push({ x: point(1 + jitter, 0.2 + jitter), y: 0, taskId: "task_a" });
    data.push({ x: point(-1 - jitter, -0.2 - jitter), y: 1, taskId: "task_a" });
  }
  return data;
}

function flatten(params: { W: Float32Array; b: Float32Array }): Float32Array {
  const out = new Float32Array(params.W.length + params.b.length);
  out.set(params.W);
  out.set(params.b, params.W.length);
  return out;
}

function norm(vector: Float32Array): number {
  let acc = 0;
  for (let i = 0; i < vector.length; i += 1) {
    acc += vector[i] * vector[i];
  }
  return Math.sqrt(acc);
}

function subtract(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i += 1) {
    out[i] = a[i] - b[i];
  }
  return out;
}

describe("continual intent router", () => {
  it("reduces loss on a linearly separable dataset", () => {
    const model = new LinearSoftmaxClassifier(2, 2, { seed: 3, initScale: 0.01 });
    const data = buildLinearlySeparableData();

    const result = trainIntentRouter(model, data, {
      mode: "naive",
      epochs: 40,
      learningRate: 0.1,
      seed: 9,
    });

    expect(result.epochLosses[0]).toBeGreaterThan(result.epochLosses.at(-1) ?? 0);
    expect((result.epochLosses.at(-1) ?? 1) / result.epochLosses[0]).toBeLessThan(0.45);
    expect(accuracy(model, data)).toBeGreaterThan(0.95);
  });

  it("EWC penalty changes update direction and keeps params closer to reference", () => {
    const base = buildLinearlySeparableData();
    const shift: IntentExample[] = base.map((example) => ({
      ...example,
      y: example.y === 0 ? 1 : 0,
      taskId: "task_b",
    }));

    const model = new LinearSoftmaxClassifier(2, 2, { seed: 4, initScale: 0.01 });
    trainIntentRouter(model, base, {
      mode: "naive",
      epochs: 30,
      learningRate: 0.1,
      seed: 7,
    });
    const reference = model.getParams();
    const fisher = estimateFisherDiagonal(model, base.slice(0, 24));

    const naiveModel = new LinearSoftmaxClassifier(2, 2, { seed: 77, initScale: 0.01 });
    naiveModel.setParams(reference);
    trainIntentRouter(naiveModel, shift, {
      mode: "naive",
      epochs: 5,
      learningRate: 0.08,
      seed: 11,
    });

    const ewcModel = new LinearSoftmaxClassifier(2, 2, { seed: 88, initScale: 0.01 });
    ewcModel.setParams(reference);
    trainIntentRouter(ewcModel, shift, {
      mode: "ewc",
      epochs: 5,
      learningRate: 0.08,
      seed: 11,
      ewcState: {
        lambda: 40,
        fisherW: fisher.fisherW,
        fisherB: fisher.fisherB,
        refW: reference.W,
        refB: reference.b,
      },
    });

    const refFlat = flatten(reference);
    const naiveDelta = subtract(flatten(naiveModel.getParams()), refFlat);
    const ewcDelta = subtract(flatten(ewcModel.getParams()), refFlat);

    expect(norm(ewcDelta)).toBeLessThan(norm(naiveDelta));
    expect(norm(subtract(naiveDelta, ewcDelta))).toBeGreaterThan(1e-4);
  });

  it("rehearsal improves retention in a 2-task conflicting setup", () => {
    const task1: IntentExample[] = [];
    const task2: IntentExample[] = [];

    for (let i = 0; i < 25; i += 1) {
      const jitter = (i % 4) * 0.01;
      task1.push({ x: point(1 + jitter, 0), y: 0, taskId: "task_1" });
      task1.push({ x: point(-1 - jitter, 0), y: 1, taskId: "task_1" });
      task2.push({ x: point(1 + jitter, 0), y: 1, taskId: "task_2" });
      task2.push({ x: point(-1 - jitter, 0), y: 0, taskId: "task_2" });
    }

    const starter = new LinearSoftmaxClassifier(2, 2, { seed: 12, initScale: 0.01 });
    trainIntentRouter(starter, task1, {
      mode: "naive",
      epochs: 40,
      learningRate: 0.12,
      seed: 13,
    });

    const naive = new LinearSoftmaxClassifier(2, 2, { seed: 99, initScale: 0.01 });
    naive.setParams(starter.getParams());
    trainIntentRouter(naive, task2, {
      mode: "naive",
      epochs: 18,
      learningRate: 0.14,
      seed: 22,
    });
    const naiveRetention = accuracy(naive, task1);

    const rehearsal = new LinearSoftmaxClassifier(2, 2, { seed: 100, initScale: 0.01 });
    rehearsal.setParams(starter.getParams());
    trainIntentRouter(rehearsal, task2, {
      mode: "rehearsal",
      replayData: task1,
      replayRatio: 1,
      epochs: 18,
      learningRate: 0.14,
      seed: 22,
    });
    const rehearsalRetention = accuracy(rehearsal, task1);

    expect(rehearsalRetention).toBeGreaterThan(naiveRetention + 0.1);
  });
});
