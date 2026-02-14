import { LinearSoftmaxClassifier } from "./linear_classifier";
import { mulberry32, shuffleInPlace } from "./random";
import type { EwcState, IntentExample, TrainOptions, TrainResult } from "./types";

function softmaxLoss(probability: number): number {
  return -Math.log(Math.max(probability, 1e-12));
}

function buildEpochDataset(
  currentTaskData: IntentExample[],
  options: TrainOptions,
  random: () => number,
): IntentExample[] {
  if (options.mode !== "rehearsal" || !options.replayData || options.replayData.length === 0) {
    return [...currentTaskData];
  }

  const replayRatio = Math.max(0, options.replayRatio ?? 1);
  const replayCount = Math.floor(currentTaskData.length * replayRatio);
  const replaySamples: IntentExample[] = [];
  for (let i = 0; i < replayCount; i += 1) {
    const index = Math.floor(random() * options.replayData.length);
    replaySamples.push(options.replayData[index]);
  }

  return [...currentTaskData, ...replaySamples];
}

function applySgdStep(
  model: LinearSoftmaxClassifier,
  sample: IntentExample,
  learningRate: number,
  ewcState?: EwcState,
  ewcScale = 0,
): number {
  const probs = model.predictProba(sample.x);
  const weights = model.getWeightReference();
  const bias = model.getBiasReference();
  const dim = model.getInputDim();
  const classes = model.getNumClasses();

  const loss = softmaxLoss(probs[sample.y]);

  for (let c = 0; c < classes; c += 1) {
    const diff = probs[c] - (c === sample.y ? 1 : 0);
    const offset = c * dim;
    for (let d = 0; d < dim; d += 1) {
      const idx = offset + d;
      let gradient = diff * sample.x[d];
      if (ewcState) {
        gradient +=
          ewcScale * ewcState.lambda * ewcState.fisherW[idx] * (weights[idx] - ewcState.refW[idx]);
      }
      weights[idx] -= learningRate * gradient;
    }

    let biasGradient = diff;
    if (ewcState) {
      biasGradient +=
        ewcScale * ewcState.lambda * ewcState.fisherB[c] * (bias[c] - ewcState.refB[c]);
    }
    bias[c] -= learningRate * biasGradient;
  }

  return loss;
}

export function trainIntentRouter(
  model: LinearSoftmaxClassifier,
  currentTaskData: IntentExample[],
  options: TrainOptions,
): TrainResult {
  if (currentTaskData.length === 0) {
    return { epochLosses: [] };
  }
  if (options.mode === "ewc" && !options.ewcState) {
    throw new Error("EWC mode requires ewcState.");
  }

  const random = mulberry32(options.seed ?? 1);
  const epochLosses: number[] = [];
  const epochs = Math.max(1, options.epochs);

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const epochData = buildEpochDataset(currentTaskData, options, random);
    if (options.shuffle ?? true) {
      shuffleInPlace(epochData, random);
    }

    let epochLoss = 0;
    const ewcScale = 1 / Math.max(1, epochData.length);
    for (const sample of epochData) {
      epochLoss += applySgdStep(
        model,
        sample,
        options.learningRate,
        options.mode === "ewc" ? options.ewcState : undefined,
        ewcScale,
      );
    }
    epochLosses.push(epochLoss / epochData.length);
  }

  return { epochLosses };
}

export function estimateFisherDiagonal(
  model: LinearSoftmaxClassifier,
  data: IntentExample[],
): Pick<EwcState, "fisherW" | "fisherB"> {
  const dim = model.getInputDim();
  const classes = model.getNumClasses();
  const fisherW = new Float32Array(dim * classes);
  const fisherB = new Float32Array(classes);

  if (data.length === 0) {
    return { fisherW, fisherB };
  }

  for (const sample of data) {
    const probs = model.predictProba(sample.x);
    for (let c = 0; c < classes; c += 1) {
      const diff = probs[c] - (c === sample.y ? 1 : 0);
      const offset = c * dim;
      for (let d = 0; d < dim; d += 1) {
        const idx = offset + d;
        const grad = diff * sample.x[d];
        fisherW[idx] += grad * grad;
      }
      fisherB[c] += diff * diff;
    }
  }

  const scale = 1 / data.length;
  for (let i = 0; i < fisherW.length; i += 1) {
    fisherW[i] *= scale;
  }
  for (let i = 0; i < fisherB.length; i += 1) {
    fisherB[i] *= scale;
  }

  return { fisherW, fisherB };
}
