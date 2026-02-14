import { intakeCategories, type IntakeCategory, type RiskLevel } from '../domain/types'

export interface LabeledTextExample {
  id?: string
  text: string
  label: IntakeCategory
  risk_level?: RiskLevel
}

interface TrainOptions {
  epochs?: number
  learningRate?: number
  l2?: number
  exampleWeight?: (example: LabeledTextExample) => number
}

interface ModelState {
  weights: number[][]
  bias: number[]
}

const TOKEN_PATTERN = /[a-z0-9]+/g

function hashToken(token: string): number {
  let hash = 2166136261
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function tokenize(text: string): string[] {
  const tokens = text.toLowerCase().match(TOKEN_PATTERN)
  return tokens ?? []
}

function softmax(scores: number[]): number[] {
  const maxScore = Math.max(...scores)
  const shifted = scores.map((score) => Math.exp(score - maxScore))
  const sum = shifted.reduce((acc, value) => acc + value, 0)
  return shifted.map((value) => value / sum)
}

export class OnlineCategoryModel {
  readonly labels: IntakeCategory[]
  readonly featureDim: number
  readonly baseLearningRate: number
  readonly baseL2: number
  private readonly labelToIndex: Record<IntakeCategory, number>
  private readonly weights: Float64Array[]
  private readonly bias: Float64Array

  constructor(
    featureDim = 256,
    labels: IntakeCategory[] = [...intakeCategories],
    learningRate = 0.2,
    l2 = 1e-4,
  ) {
    this.labels = labels
    this.featureDim = featureDim
    this.baseLearningRate = learningRate
    this.baseL2 = l2
    this.labelToIndex = Object.fromEntries(labels.map((label, index) => [label, index])) as Record<
      IntakeCategory,
      number
    >
    this.weights = labels.map(() => new Float64Array(featureDim))
    this.bias = new Float64Array(labels.length)
  }

  featurize(text: string): Float32Array {
    const vector = new Float32Array(this.featureDim)
    const tokens = tokenize(text)
    for (let i = 0; i < tokens.length; i += 1) {
      const unigram = tokens[i]
      const unigramIndex = hashToken(`u:${unigram}`) % this.featureDim
      vector[unigramIndex] += 1
      if (i > 0) {
        const bigramIndex = hashToken(`b:${tokens[i - 1]}_${unigram}`) % this.featureDim
        vector[bigramIndex] += 0.75
      }
    }

    let norm = 0
    for (let d = 0; d < vector.length; d += 1) {
      norm += vector[d] * vector[d]
    }
    norm = Math.sqrt(norm)
    if (norm > 0) {
      for (let d = 0; d < vector.length; d += 1) {
        vector[d] /= norm
      }
    }

    return vector
  }

  predictProba(text: string): Record<IntakeCategory, number> {
    const probabilities = this.predictProbaVector(this.featurize(text))
    return Object.fromEntries(this.labels.map((label, index) => [label, probabilities[index]])) as Record<
      IntakeCategory,
      number
    >
  }

  predict(text: string): IntakeCategory {
    const probabilities = this.predictProbaVector(this.featurize(text))
    let bestIndex = 0
    for (let i = 1; i < probabilities.length; i += 1) {
      if (probabilities[i] > probabilities[bestIndex]) {
        bestIndex = i
      }
    }
    return this.labels[bestIndex]
  }

  train(examples: LabeledTextExample[], options: TrainOptions = {}): void {
    if (examples.length === 0) {
      return
    }
    const epochs = options.epochs ?? 1
    const learningRate = options.learningRate ?? this.baseLearningRate
    const l2 = options.l2 ?? this.baseL2
    const weightFn = options.exampleWeight ?? (() => 1)

    for (let epoch = 0; epoch < epochs; epoch += 1) {
      for (const example of examples) {
        const features = this.featurize(example.text)
        const probabilities = this.predictProbaVector(features)
        const targetIndex = this.labelToIndex[example.label]
        const sampleWeight = Math.max(0.1, weightFn(example))

        for (let classIndex = 0; classIndex < this.labels.length; classIndex += 1) {
          const target = classIndex === targetIndex ? 1 : 0
          const gradient = (probabilities[classIndex] - target) * sampleWeight
          for (let d = 0; d < this.featureDim; d += 1) {
            const weight = this.weights[classIndex][d]
            this.weights[classIndex][d] -=
              learningRate * (gradient * features[d] + l2 * weight)
          }
          this.bias[classIndex] -= learningRate * gradient
        }
      }
    }
  }

  clone(): OnlineCategoryModel {
    const model = new OnlineCategoryModel(
      this.featureDim,
      [...this.labels],
      this.baseLearningRate,
      this.baseL2,
    )
    model.setState(this.getState())
    return model
  }

  getState(): ModelState {
    return {
      weights: this.weights.map((row) => Array.from(row)),
      bias: Array.from(this.bias),
    }
  }

  setState(state: ModelState): void {
    for (let classIndex = 0; classIndex < this.labels.length; classIndex += 1) {
      for (let d = 0; d < this.featureDim; d += 1) {
        this.weights[classIndex][d] = state.weights[classIndex][d]
      }
      this.bias[classIndex] = state.bias[classIndex]
    }
  }

  private predictProbaVector(features: Float32Array): number[] {
    const scores = new Array<number>(this.labels.length).fill(0)
    for (let classIndex = 0; classIndex < this.labels.length; classIndex += 1) {
      let score = this.bias[classIndex]
      for (let d = 0; d < this.featureDim; d += 1) {
        score += this.weights[classIndex][d] * features[d]
      }
      scores[classIndex] = score
    }
    return softmax(scores)
  }
}
