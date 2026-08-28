export interface Vector2 {
  x: number
  y: number
}

export type ReplayMethod = 'greedy' | 'random'

export interface ReplayCandidate extends Vector2 {
  id: string
  label: string
}

export interface ReplaySelection {
  selectedIds: string[]
  mean: Vector2
  residual: number
}

export const REPLAY_TARGET: Vector2 = { x: 0.56, y: -0.26 }

export const REPLAY_CANDIDATES: ReplayCandidate[] = [
  { id: 'c1', label: 'c₁', x: 0.82, y: -0.12 },
  { id: 'c2', label: 'c₂', x: 0.28, y: -0.66 },
  { id: 'c3', label: 'c₃', x: 0.63, y: -0.46 },
  { id: 'c4', label: 'c₄', x: 0.12, y: -0.18 },
  { id: 'c5', label: 'c₅', x: 0.74, y: 0.34 },
  { id: 'c6', label: 'c₆', x: -0.16, y: -0.54 },
  { id: 'c7', label: 'c₇', x: 0.46, y: 0.08 },
  { id: 'c8', label: 'c₈', x: 0.96, y: -0.58 },
]

function distance(left: Vector2, right: Vector2): number {
  return Math.hypot(left.x - right.x, left.y - right.y)
}

function mean(vectors: Vector2[]): Vector2 {
  if (vectors.length === 0) {
    return { x: 0, y: 0 }
  }

  const sum = vectors.reduce(
    (accumulator, vector) => ({
      x: accumulator.x + vector.x,
      y: accumulator.y + vector.y,
    }),
    { x: 0, y: 0 },
  )

  return {
    x: sum.x / vectors.length,
    y: sum.y / vectors.length,
  }
}

function seededOrder<T>(values: T[], seed: number): T[] {
  let state = Math.max(1, Math.floor(seed))
  const scored = values.map((value, index) => {
    state = (state * 48271) % 2147483647
    return { value, score: state / 2147483647 + index * Number.EPSILON }
  })
  return scored.sort((left, right) => left.score - right.score).map(({ value }) => value)
}

function greedySelection(candidateCount: number): ReplayCandidate[] {
  const selected: ReplayCandidate[] = []
  const available = [...REPLAY_CANDIDATES]

  while (selected.length < candidateCount && available.length > 0) {
    let bestIndex = 0
    let bestResidual = Number.POSITIVE_INFINITY

    available.forEach((candidate, index) => {
      const candidateMean = mean([...selected, candidate])
      const candidateResidual = distance(candidateMean, REPLAY_TARGET)
      if (candidateResidual < bestResidual) {
        bestResidual = candidateResidual
        bestIndex = index
      }
    })

    const [next] = available.splice(bestIndex, 1)
    if (next) {
      selected.push(next)
    }
  }

  return selected
}

export function selectReplayCandidates(options: {
  method: ReplayMethod
  candidateCount: number
  seed: number
}): ReplaySelection {
  const candidateCount = Math.min(
    REPLAY_CANDIDATES.length,
    Math.max(1, Math.floor(options.candidateCount)),
  )

  const selected =
    options.method === 'greedy'
      ? greedySelection(candidateCount)
      : seededOrder(REPLAY_CANDIDATES, options.seed).slice(0, candidateCount)

  const selectionMean = mean(selected)
  return {
    selectedIds: selected.map((candidate) => candidate.id),
    mean: selectionMean,
    residual: distance(selectionMean, REPLAY_TARGET),
  }
}
