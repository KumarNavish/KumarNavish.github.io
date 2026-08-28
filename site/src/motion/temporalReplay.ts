import type {
  ReplayAllocation,
  ReplayAllocationInput,
  TemporalWindow,
} from './mechanisms'

const EPSILON = 1e-9

function softmax(values: number[]): number[] {
  if (values.length === 0) {
    return []
  }
  const maximum = Math.max(...values)
  const exponentials = values.map((value) => Math.exp(value - maximum))
  const total = exponentials.reduce((sum, value) => sum + value, 0)
  return exponentials.map((value) => value / Math.max(total, EPSILON))
}

function baselineMatrix(size: number, currentIndex: number, volatility: number): number[][] {
  return Array.from({ length: size }, (_, checkpoint) =>
    Array.from({ length: size }, (_, evaluation) => {
      const lag = evaluation - checkpoint
      const temporalDistance = Math.abs(lag)
      const currentPenalty = lag === 0 ? 0.28 + 0.12 * volatility : 0
      const backwardPenalty = lag < 0 ? temporalDistance * (0.06 + 0.055 * volatility) : 0
      const forwardPenalty = lag > 0 ? temporalDistance * (0.045 + 0.08 * volatility) : 0
      const checkpointAge = Math.max(0, currentIndex - checkpoint) * 0.012
      return 0.26 + currentPenalty + backwardPenalty + forwardPenalty + checkpointAge
    }),
  )
}

export function allocateTemporalReplayWithFuture(
  windows: TemporalWindow[],
  input: ReplayAllocationInput,
): ReplayAllocation {
  const values = windows.map((window) => {
    const survival = Math.exp((-Math.log(2) * window.age) / Math.max(0.25, input.halfLife))
    const backwardValue = window.backwardBenefit * window.stability * survival
    const currentCost = window.currentCost * (0.7 + input.volatility)
    const forwardCost = window.forwardCost * (0.45 + 1.25 * input.volatility)
    return (
      input.backwardWeight * backwardValue -
      input.currentWeight * currentCost -
      input.forwardWeight * forwardCost
    )
  })

  const conservativeValues = values.map(
    (value, index) => value - input.uncertaintyPenalty * (windows[index]?.uncertainty ?? 0),
  )
  const positive = conservativeValues
    .map((value, index) => ({ value, index }))
    .filter((entry) => entry.value > 0)
  const allocation = windows.map(() => 0)
  if (positive.length > 0 && input.replayBudget > 0) {
    const shares = softmax(positive.map((entry) => entry.value * 5))
    positive.forEach((entry, localIndex) => {
      allocation[entry.index] = input.replayBudget * (shares[localIndex] ?? 0)
    })
  }

  const currentIndex = windows.length
  const size = windows.length + 4
  const regretMatrix = baselineMatrix(size, currentIndex, input.volatility)
  const baselineRow = [...(regretMatrix[currentIndex] ?? [])]
  const backwardGain = allocation.reduce(
    (sum, weight, index) => sum + weight * (windows[index]?.backwardBenefit ?? 0),
    0,
  )
  const currentCost = allocation.reduce(
    (sum, weight, index) => sum + weight * (windows[index]?.currentCost ?? 0),
    0,
  )
  const forwardCost = allocation.reduce(
    (sum, weight, index) => sum + weight * (windows[index]?.forwardCost ?? 0),
    0,
  )

  const updatedRow = baselineRow.map((value, evaluation) => {
    if (evaluation < currentIndex) {
      const ageWeight = 0.65 + 0.35 * (1 - evaluation / Math.max(1, currentIndex))
      return Math.max(0, value - backwardGain * ageWeight)
    }
    if (evaluation === currentIndex) {
      return value + currentCost
    }
    const horizon = evaluation - currentIndex
    return value + forwardCost * (0.72 + 0.18 * horizon)
  })
  regretMatrix[currentIndex] = updatedRow

  return {
    values,
    conservativeValues,
    allocation,
    regretMatrix,
    baselineRow,
    updatedRow,
  }
}
