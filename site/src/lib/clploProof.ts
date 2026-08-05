export type ProofStrategyId = 'naive' | 'replay' | 'hybrid'
export type Regime = 'calm' | 'stress'

export interface ClPloProofConfig {
  steps: number
  stress_probability: number
  anchor_weight: number
  projection_limit: number
  seed: number
}

export interface StrategyMetrics {
  total_return: number
  max_drawdown: number
  turnover: number
  stress_sharpe: number
  score: number
}

export interface StrategySeries {
  id: ProofStrategyId
  label: string
  values: number[]
  risky_weights: number[]
  metrics: StrategyMetrics
}

export interface ClPloProofResult {
  config: ClPloProofConfig
  regimes: Regime[]
  strategies: StrategySeries[]
  winner: StrategySeries
  decision_note: string
}

interface RunAccumulator {
  values: number[]
  riskyWeights: number[]
  turnoverSum: number
  maxDrawdown: number
  stressReturns: number[]
  finalValue: number
}

const STRATEGY_LABELS: Record<ProofStrategyId, string> = {
  naive: 'Naive',
  replay: 'Replay',
  hybrid: 'Hybrid',
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) {
    return 0
  }
  const avg = mean(values)
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function createRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function normalSample(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-7)
  const u2 = Math.max(rng(), 1e-7)
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

function scoreMetrics(metrics: Omit<StrategyMetrics, 'score'>): number {
  return (
    metrics.total_return * 1.25 -
    metrics.max_drawdown * 1.45 -
    metrics.turnover * 0.35 +
    metrics.stress_sharpe * 0.08
  )
}

function simulateStrategy(
  strategyId: ProofStrategyId,
  config: ClPloProofConfig,
  regimes: Regime[],
  marketReturns: number[],
  updateNoise: number[],
): StrategySeries {
  const initialValue = 100
  const learningRate = 0.19
  const projectionStep = 0.056
  const replayPenalty = config.anchor_weight * 0.16

  let value = initialValue
  let peak = initialValue
  let riskyWeight = strategyId === 'hybrid' ? 0.44 : 0.5

  const run: RunAccumulator = {
    values: [initialValue],
    riskyWeights: [riskyWeight],
    turnoverSum: 0,
    maxDrawdown: 0,
    stressReturns: [],
    finalValue: initialValue,
  }

  for (let step = 0; step < config.steps; step += 1) {
    const regime = regimes[step]
    const regimeSignal = regime === 'stress' ? -0.43 : 0.24
    const noise = updateNoise[step]

    const rawDelta = learningRate * (regimeSignal + noise)
    let nextWeight: number

    if (strategyId === 'naive') {
      nextWeight = clamp(riskyWeight + rawDelta, 0.03, 0.95)
    } else if (strategyId === 'replay') {
      nextWeight = clamp(riskyWeight + rawDelta - replayPenalty, 0.03, 0.9)
    } else {
      const proposed = riskyWeight + rawDelta - replayPenalty
      const boundedStep = riskyWeight + clamp(proposed - riskyWeight, -projectionStep, projectionStep)
      nextWeight = clamp(boundedStep, 0.08, config.projection_limit)
    }

    const turnover = Math.abs(nextWeight - riskyWeight)
    const tradePenalty = turnover * 0.0028
    const portfolioReturn = nextWeight * marketReturns[step] + (1 - nextWeight) * 0.0012 - tradePenalty

    value *= Math.max(0.2, 1 + portfolioReturn)
    peak = Math.max(peak, value)
    const drawdown = peak > 0 ? (peak - value) / peak : 0

    run.turnoverSum += turnover
    run.maxDrawdown = Math.max(run.maxDrawdown, drawdown)
    if (regime === 'stress') {
      run.stressReturns.push(portfolioReturn)
    }

    run.values.push(value)
    run.riskyWeights.push(nextWeight)

    riskyWeight = nextWeight
  }

  run.finalValue = value

  const stressStd = standardDeviation(run.stressReturns)
  const stressSharpe =
    stressStd > 1e-8 ? (mean(run.stressReturns) / stressStd) * Math.sqrt(12) : 0

  const metricsWithoutScore = {
    total_return: run.finalValue / initialValue - 1,
    max_drawdown: run.maxDrawdown,
    turnover: run.turnoverSum / Math.max(1, config.steps),
    stress_sharpe: stressSharpe,
  }

  const metrics: StrategyMetrics = {
    ...metricsWithoutScore,
    score: scoreMetrics(metricsWithoutScore),
  }

  return {
    id: strategyId,
    label: STRATEGY_LABELS[strategyId],
    values: run.values,
    risky_weights: run.riskyWeights,
    metrics,
  }
}

function validateConfig(config: ClPloProofConfig): ClPloProofConfig {
  return {
    steps: clamp(Math.round(config.steps), 20, 120),
    stress_probability: clamp(config.stress_probability, 0.05, 0.75),
    anchor_weight: clamp(config.anchor_weight, 0.1, 0.7),
    projection_limit: clamp(config.projection_limit, 0.3, 0.85),
    seed: Math.round(config.seed),
  }
}

export function runClPloProof(rawConfig: ClPloProofConfig): ClPloProofResult {
  const config = validateConfig(rawConfig)
  const rng = createRng(config.seed)

  const regimes: Regime[] = Array.from({ length: config.steps }, () =>
    rng() < config.stress_probability ? 'stress' : 'calm',
  )

  const marketReturns = regimes.map((regime) => {
    const shock = normalSample(rng)
    if (regime === 'stress') {
      return -0.078 + shock * 0.018
    }
    return 0.019 + shock * 0.011
  })

  const naiveNoise = Array.from({ length: config.steps }, () => normalSample(rng) * 0.24)
  const replayNoise = Array.from({ length: config.steps }, () => normalSample(rng) * 0.22)
  const hybridNoise = Array.from({ length: config.steps }, () => normalSample(rng) * 0.2)

  const strategies = [
    simulateStrategy('naive', config, regimes, marketReturns, naiveNoise),
    simulateStrategy('replay', config, regimes, marketReturns, replayNoise),
    simulateStrategy('hybrid', config, regimes, marketReturns, hybridNoise),
  ]

  const winner = [...strategies].sort(
    (left, right) => right.metrics.score - left.metrics.score,
  )[0]

  const decisionNote =
    winner.id === 'hybrid'
      ? 'Hybrid preserves stress behavior while keeping allocation moves inside the risk budget.'
      : winner.id === 'replay'
        ? 'Replay improves memory retention, but still needs tighter risk bounds for production.'
        : 'Naive adapts quickly on this path, but stress robustness should be checked before deployment.'

  return {
    config,
    regimes,
    strategies,
    winner,
    decision_note: decisionNote,
  }
}
