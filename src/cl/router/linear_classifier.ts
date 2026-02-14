import { mulberry32 } from "./random";
import type { RouterParams } from "./types";

export class LinearSoftmaxClassifier {
  private readonly numClasses: number;
  private readonly inputDim: number;
  private readonly W: Float32Array;
  private readonly b: Float32Array;

  constructor(
    numClasses: number,
    inputDim: number,
    options?: {
      seed?: number;
      initScale?: number;
    },
  ) {
    if (numClasses <= 1) {
      throw new Error("numClasses must be greater than 1.");
    }
    if (inputDim <= 0) {
      throw new Error("inputDim must be positive.");
    }
    this.numClasses = numClasses;
    this.inputDim = inputDim;
    this.W = new Float32Array(numClasses * inputDim);
    this.b = new Float32Array(numClasses);

    const random = mulberry32(options?.seed ?? 1);
    const scale = options?.initScale ?? 0.01;
    for (let i = 0; i < this.W.length; i += 1) {
      this.W[i] = (random() * 2 - 1) * scale;
    }
  }

  getNumClasses(): number {
    return this.numClasses;
  }

  getInputDim(): number {
    return this.inputDim;
  }

  getWeightReference(): Float32Array {
    return this.W;
  }

  getBiasReference(): Float32Array {
    return this.b;
  }

  getParams(): RouterParams {
    return {
      W: new Float32Array(this.W),
      b: new Float32Array(this.b),
    };
  }

  setParams(params: RouterParams) {
    if (params.W.length !== this.W.length || params.b.length !== this.b.length) {
      throw new Error("Parameter shape mismatch.");
    }
    this.W.set(params.W);
    this.b.set(params.b);
  }

  predictProba(x: Float32Array): Float32Array {
    if (x.length !== this.inputDim) {
      throw new Error("Input dimension mismatch.");
    }

    const logits = new Float32Array(this.numClasses);
    for (let c = 0; c < this.numClasses; c += 1) {
      let score = this.b[c];
      const offset = c * this.inputDim;
      for (let d = 0; d < this.inputDim; d += 1) {
        score += this.W[offset + d] * x[d];
      }
      logits[c] = score;
    }

    let maxLogit = Number.NEGATIVE_INFINITY;
    for (let c = 0; c < this.numClasses; c += 1) {
      if (logits[c] > maxLogit) {
        maxLogit = logits[c];
      }
    }

    let denom = 0;
    for (let c = 0; c < this.numClasses; c += 1) {
      logits[c] = Math.exp(logits[c] - maxLogit);
      denom += logits[c];
    }

    for (let c = 0; c < this.numClasses; c += 1) {
      logits[c] /= denom;
    }

    return logits;
  }

  predict(x: Float32Array): number {
    const probs = this.predictProba(x);
    let bestClass = 0;
    let bestProb = probs[0];
    for (let c = 1; c < probs.length; c += 1) {
      if (probs[c] > bestProb) {
        bestProb = probs[c];
        bestClass = c;
      }
    }
    return bestClass;
  }
}
