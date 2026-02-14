export type RouterMode = "naive" | "rehearsal" | "ewc";

export interface IntentExample {
  x: Float32Array;
  y: number;
  taskId: string;
}

export interface EwcState {
  lambda: number;
  fisherW: Float32Array;
  fisherB: Float32Array;
  refW: Float32Array;
  refB: Float32Array;
}

export interface TrainOptions {
  mode: RouterMode;
  epochs: number;
  learningRate: number;
  replayData?: IntentExample[];
  replayRatio?: number;
  ewcState?: EwcState;
  seed?: number;
  shuffle?: boolean;
}

export interface TrainResult {
  epochLosses: number[];
}

export interface RouterParams {
  W: Float32Array;
  b: Float32Array;
}
