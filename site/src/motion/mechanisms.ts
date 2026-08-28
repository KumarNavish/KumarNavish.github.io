export type Vector = number[]

export interface GraphEdge {
  source: number
  target: number
  weight: number
}

export interface EigenSystem {
  values: number[]
  vectors: number[][]
}

export interface GraphSpectrum {
  laplacian: number[][]
  degrees: number[]
  eigen: EigenSystem
}

export interface ReplayCandidate {
  id: string
  gradient: [number, number]
  label: string
}

export type ReplayMethod = 'greedy' | 'random' | 'exact'

export interface ReplaySelection {
  method: ReplayMethod
  selected: ReplayCandidate[]
  targetReplayGradient: [number, number]
  selectedMean: [number, number]
  correctedGradient: [number, number]
  desiredGradient: [number, number]
  residual: number
  residualPath: number[]
}

export interface RankConstraint {
  id: string
  label: string
  gradient: Vector
  requiredDecrease: number
}

export interface RankSolution {
  rank: number
  feasible: boolean
  practicallyUsable: boolean
  coefficients: Vector
  correction: Vector
  correctionNorm: number
  currentDamage: number
  slacks: number[]
  activeConstraints: number[]
  reason: string
}

export interface TemporalWindow {
  id: string
  label: string
  age: number
  stability: number
  backwardBenefit: number
  currentCost: number
  forwardCost: number
  uncertainty: number
}

export interface ReplayAllocationInput {
  replayBudget: number
  halfLife: number
  volatility: number
  uncertaintyPenalty: number
  backwardWeight: number
  currentWeight: number
  forwardWeight: number
}

export interface ReplayAllocation {
  values: number[]
  conservativeValues: number[]
  allocation: number[]
  regretMatrix: number[][]
  baselineRow: number[]
  updatedRow: number[]
}

export type GateState = 'pass' | 'fail' | 'blocked'

export interface CaseSource {
  id: string
  label: string
  authority: number
  relevant: boolean
  complete: boolean
  supportsClaim: boolean
  facts: string[]
}

export interface CasePathGate {
  id: string
  label: string
  state: GateState
  explanation: string
}

export interface CasePathRun {
  facts: string[]
  gates: CasePathGate[]
  process: string[]
  artifactReady: boolean
  decision: string
}

export interface SpatialEntity {
  id: string
  label: string
  kind: 'question' | 'evidence' | 'tool' | 'agent' | 'environment' | 'action'
  x: number
  y: number
  z: number
}

export interface SpatialRelation {
  source: string
  target: string
  label: string
}

export interface SpatialPlan {
  intent: string
  objective: string
  environment: string
  entities: SpatialEntity[]
  relations: SpatialRelation[]
  affordances: string[]
}

const EPSILON = 1e-9

export function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function dot(left: Vector, right: Vector): number {
  if (left.length !== right.length) {
    throw new Error('dot product requires vectors of equal length')
  }
  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0)
}

export function norm(vector: Vector): number {
  return Math.sqrt(dot(vector, vector))
}

export function add(left: Vector, right: Vector): Vector {
  if (left.length !== right.length) {
    throw new Error('vector addition requires equal length')
  }
  return left.map((value, index) => value + (right[index] ?? 0))
}

export function subtract(left: Vector, right: Vector): Vector {
  if (left.length !== right.length) {
    throw new Error('vector subtraction requires equal length')
  }
  return left.map((value, index) => value - (right[index] ?? 0))
}

export function scale(vector: Vector, factor: number): Vector {
  return vector.map((value) => value * factor)
}

export function mean(vectors: Vector[]): Vector {
  if (vectors.length === 0) {
    return []
  }
  const width = vectors[0]?.length ?? 0
  const total = Array.from({ length: width }, () => 0)
  for (const vector of vectors) {
    if (vector.length !== width) {
      throw new Error('mean requires vectors of equal length')
    }
    vector.forEach((value, index) => {
      total[index] = (total[index] ?? 0) + value
    })
  }
  return total.map((value) => value / vectors.length)
}

function identity(size: number): number[][] {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => (row === column ? 1 : 0)),
  )
}

function transpose(matrix: number[][]): number[][] {
  if (matrix.length === 0) {
    return []
  }
  return Array.from({ length: matrix[0]?.length ?? 0 }, (_, column) =>
    matrix.map((row) => row[column] ?? 0),
  )
}

function multiplyMatrixVector(matrix: number[][], vector: Vector): Vector {
  return matrix.map((row) => dot(row, vector))
}

function multiplyMatrices(left: number[][], right: number[][]): number[][] {
  const rightTranspose = transpose(right)
  return left.map((row) => rightTranspose.map((column) => dot(row, column)))
}

function solveLinearSystem(matrix: number[][], values: Vector): Vector | null {
  const size = matrix.length
  if (size === 0 || values.length !== size || matrix.some((row) => row.length !== size)) {
    return null
  }
  const augmented = matrix.map((row, index) => [...row, values[index] ?? 0])

  for (let pivot = 0; pivot < size; pivot += 1) {
    let best = pivot
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(augmented[row]?.[pivot] ?? 0) > Math.abs(augmented[best]?.[pivot] ?? 0)) {
        best = row
      }
    }
    if (Math.abs(augmented[best]?.[pivot] ?? 0) < EPSILON) {
      return null
    }
    if (best !== pivot) {
      const temporary = augmented[pivot]
      augmented[pivot] = augmented[best] ?? []
      augmented[best] = temporary ?? []
    }

    const pivotValue = augmented[pivot]?.[pivot] ?? 1
    for (let column = pivot; column <= size; column += 1) {
      if (augmented[pivot]) {
        augmented[pivot]![column] = (augmented[pivot]?.[column] ?? 0) / pivotValue
      }
    }

    for (let row = 0; row < size; row += 1) {
      if (row === pivot) {
        continue
      }
      const factor = augmented[row]?.[pivot] ?? 0
      for (let column = pivot; column <= size; column += 1) {
        if (augmented[row]) {
          augmented[row]![column] =
            (augmented[row]?.[column] ?? 0) - factor * (augmented[pivot]?.[column] ?? 0)
        }
      }
    }
  }

  return augmented.map((row) => row[size] ?? 0)
}

export function signedLaplacian(
  nodeCount: number,
  edges: GraphEdge[],
  normalized: boolean,
): GraphSpectrum {
  const adjacency = Array.from({ length: nodeCount }, () =>
    Array.from({ length: nodeCount }, () => 0),
  )
  const degrees = Array.from({ length: nodeCount }, () => 0)

  for (const edge of edges) {
    if (
      edge.source < 0 ||
      edge.target < 0 ||
      edge.source >= nodeCount ||
      edge.target >= nodeCount ||
      edge.source === edge.target
    ) {
      throw new Error('invalid graph edge')
    }
    adjacency[edge.source]![edge.target] =
      (adjacency[edge.source]?.[edge.target] ?? 0) + edge.weight
    adjacency[edge.target]![edge.source] =
      (adjacency[edge.target]?.[edge.source] ?? 0) + edge.weight
    degrees[edge.source] = (degrees[edge.source] ?? 0) + Math.abs(edge.weight)
    degrees[edge.target] = (degrees[edge.target] ?? 0) + Math.abs(edge.weight)
  }

  const laplacian = Array.from({ length: nodeCount }, (_, row) =>
    Array.from({ length: nodeCount }, (_, column) => {
      if (!normalized) {
        return row === column
          ? degrees[row] ?? 0
          : -(adjacency[row]?.[column] ?? 0)
      }
      if (row === column) {
        return (degrees[row] ?? 0) > EPSILON ? 1 : 0
      }
      const denominator = Math.sqrt((degrees[row] ?? 0) * (degrees[column] ?? 0))
      return denominator > EPSILON ? -(adjacency[row]?.[column] ?? 0) / denominator : 0
    }),
  )

  return {
    laplacian,
    degrees,
    eigen: jacobiEigenDecomposition(laplacian),
  }
}

export function jacobiEigenDecomposition(
  matrix: number[][],
  tolerance = 1e-11,
  maxIterations = 400,
): EigenSystem {
  const size = matrix.length
  if (matrix.some((row) => row.length !== size)) {
    throw new Error('Jacobi decomposition requires a square matrix')
  }
  const valuesMatrix = matrix.map((row) => [...row])
  const vectors = identity(size)

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let pivotRow = 0
    let pivotColumn = 0
    let largest = 0
    for (let row = 0; row < size; row += 1) {
      for (let column = row + 1; column < size; column += 1) {
        const magnitude = Math.abs(valuesMatrix[row]?.[column] ?? 0)
        if (magnitude > largest) {
          largest = magnitude
          pivotRow = row
          pivotColumn = column
        }
      }
    }
    if (largest < tolerance) {
      break
    }

    const app = valuesMatrix[pivotRow]?.[pivotRow] ?? 0
    const aqq = valuesMatrix[pivotColumn]?.[pivotColumn] ?? 0
    const apq = valuesMatrix[pivotRow]?.[pivotColumn] ?? 0
    const angle = 0.5 * Math.atan2(2 * apq, aqq - app)
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)

    for (let index = 0; index < size; index += 1) {
      if (index !== pivotRow && index !== pivotColumn) {
        const aip = valuesMatrix[index]?.[pivotRow] ?? 0
        const aiq = valuesMatrix[index]?.[pivotColumn] ?? 0
        const rotatedP = cosine * aip - sine * aiq
        const rotatedQ = sine * aip + cosine * aiq
        valuesMatrix[index]![pivotRow] = rotatedP
        valuesMatrix[pivotRow]![index] = rotatedP
        valuesMatrix[index]![pivotColumn] = rotatedQ
        valuesMatrix[pivotColumn]![index] = rotatedQ
      }
    }

    valuesMatrix[pivotRow]![pivotRow] =
      cosine * cosine * app - 2 * sine * cosine * apq + sine * sine * aqq
    valuesMatrix[pivotColumn]![pivotColumn] =
      sine * sine * app + 2 * sine * cosine * apq + cosine * cosine * aqq
    valuesMatrix[pivotRow]![pivotColumn] = 0
    valuesMatrix[pivotColumn]![pivotRow] = 0

    for (let row = 0; row < size; row += 1) {
      const vip = vectors[row]?.[pivotRow] ?? 0
      const viq = vectors[row]?.[pivotColumn] ?? 0
      vectors[row]![pivotRow] = cosine * vip - sine * viq
      vectors[row]![pivotColumn] = sine * vip + cosine * viq
    }
  }

  const pairs = Array.from({ length: size }, (_, index) => ({
    value: valuesMatrix[index]?.[index] ?? 0,
    vector: vectors.map((row) => row[index] ?? 0),
  })).sort((left, right) => left.value - right.value)

  return {
    values: pairs.map((pair) => pair.value),
    vectors: transpose(pairs.map((pair) => pair.vector)),
  }
}

export function diffuseGraphSignal(
  signal: Vector,
  eigen: EigenSystem,
  time: number,
): Vector {
  const basis = eigen.vectors
  const coefficients = multiplyMatrixVector(transpose(basis), signal)
  const decayed = coefficients.map(
    (value, index) => value * Math.exp(-Math.max(0, time) * (eigen.values[index] ?? 0)),
  )
  return multiplyMatrixVector(basis, decayed)
}

export function rayleighQuotient(vector: Vector, matrix: number[][]): number {
  const denominator = dot(vector, vector)
  if (denominator < EPSILON) {
    return 0
  }
  return dot(vector, multiplyMatrixVector(matrix, vector)) / denominator
}

function combinationIndices(total: number, count: number): number[][] {
  const result: number[][] = []
  const visit = (start: number, current: number[]) => {
    if (current.length === count) {
      result.push([...current])
      return
    }
    for (let index = start; index < total; index += 1) {
      current.push(index)
      visit(index + 1, current)
      current.pop()
    }
  }
  visit(0, [])
  return result
}

function seededOrder(length: number, seed: number): number[] {
  let state = seed >>> 0
  const random = () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 4294967296
  }
  return Array.from({ length }, (_, index) => ({ index, value: random() }))
    .sort((left, right) => left.value - right.value)
    .map((entry) => entry.index)
}

function asTuple(vector: Vector): [number, number] {
  return [vector[0] ?? 0, vector[1] ?? 0]
}

function replayResidual(
  selected: ReplayCandidate[],
  current: [number, number],
  desired: [number, number],
  alpha: number,
): number {
  if (selected.length === 0) {
    return norm(subtract(current, desired))
  }
  const selectedMean = mean(selected.map((candidate) => candidate.gradient))
  const corrected = add(scale(current, 1 - alpha), scale(selectedMean, alpha))
  return norm(subtract(corrected, desired))
}

export function targetReplayGradient(
  current: [number, number],
  desired: [number, number],
  alpha: number,
): [number, number] {
  if (alpha <= 0 || alpha > 1) {
    throw new Error('alpha must lie in (0, 1]')
  }
  return asTuple(add(current, scale(subtract(desired, current), 1 / alpha)))
}

export function verifyReplayIdentity(
  current: [number, number],
  desired: [number, number],
  alpha: number,
): boolean {
  const target = targetReplayGradient(current, desired, alpha)
  const reconstructed = add(scale(current, 1 - alpha), scale(target, alpha))
  return norm(subtract(reconstructed, desired)) < 1e-8
}

export function selectReplaySubset(
  candidates: ReplayCandidate[],
  current: [number, number],
  desired: [number, number],
  alpha: number,
  count: number,
  method: ReplayMethod,
  seed = 23,
): ReplaySelection {
  if (count < 1 || count > candidates.length) {
    throw new Error('replay count must be within the candidate pool')
  }
  if (!verifyReplayIdentity(current, desired, alpha)) {
    throw new Error('replay target identity failed')
  }

  let selected: ReplayCandidate[] = []
  const residualPath: number[] = []

  if (method === 'random') {
    selected = seededOrder(candidates.length, seed)
      .slice(0, count)
      .map((index) => candidates[index])
      .filter((candidate): candidate is ReplayCandidate => candidate !== undefined)
    selected.forEach((_, index) => {
      residualPath.push(replayResidual(selected.slice(0, index + 1), current, desired, alpha))
    })
  } else if (method === 'exact') {
    const combinations = combinationIndices(candidates.length, count)
    let bestResidual = Number.POSITIVE_INFINITY
    let best: ReplayCandidate[] = []
    for (const indices of combinations) {
      const subset = indices
        .map((index) => candidates[index])
        .filter((candidate): candidate is ReplayCandidate => candidate !== undefined)
      const residual = replayResidual(subset, current, desired, alpha)
      if (residual < bestResidual - EPSILON) {
        bestResidual = residual
        best = subset
      }
    }
    selected = best
    selected.forEach((_, index) => {
      residualPath.push(replayResidual(selected.slice(0, index + 1), current, desired, alpha))
    })
  } else {
    const remaining = [...candidates]
    for (let step = 0; step < count; step += 1) {
      let bestIndex = 0
      let bestResidual = Number.POSITIVE_INFINITY
      for (let index = 0; index < remaining.length; index += 1) {
        const candidate = remaining[index]
        if (!candidate) {
          continue
        }
        const trial = [...selected, candidate]
        const residual = replayResidual(trial, current, desired, alpha)
        if (residual < bestResidual - EPSILON) {
          bestResidual = residual
          bestIndex = index
        }
      }
      const [chosen] = remaining.splice(bestIndex, 1)
      if (chosen) {
        selected.push(chosen)
        residualPath.push(bestResidual)
      }
    }
  }

  const selectedMean = asTuple(mean(selected.map((candidate) => candidate.gradient)))
  const correctedGradient = asTuple(add(scale(current, 1 - alpha), scale(selectedMean, alpha)))
  return {
    method,
    selected,
    targetReplayGradient: targetReplayGradient(current, desired, alpha),
    selectedMean,
    correctedGradient,
    desiredGradient: desired,
    residual: norm(subtract(correctedGradient, desired)),
    residualPath,
  }
}

function orthonormalColumns(basis: number[][], rank: number): number[][] {
  return basis.map((row) => row.slice(0, rank))
}

function projectCoefficientsToCorrection(basis: number[][], coefficients: Vector): Vector {
  return multiplyMatrixVector(basis, coefficients)
}

function minimumNormEqualitySolution(matrix: number[][], values: Vector): Vector | null {
  if (matrix.length === 0) {
    return []
  }
  const gram = multiplyMatrices(matrix, transpose(matrix))
  const dual = solveLinearSystem(gram, values)
  if (!dual) {
    return null
  }
  return multiplyMatrixVector(transpose(matrix), dual)
}

export function solveRankFeasibility(
  ambientBasis: number[][],
  rank: number,
  constraints: RankConstraint[],
  currentGradient: Vector,
  maxCorrectionNorm: number,
  maxCurrentDamage: number,
): RankSolution {
  const ambientDimension = ambientBasis.length
  if (rank < 1 || ambientDimension === 0 || rank > (ambientBasis[0]?.length ?? 0)) {
    throw new Error('rank must select at least one available basis direction')
  }
  if (currentGradient.length !== ambientDimension) {
    throw new Error('current gradient dimension mismatch')
  }

  const basis = orthonormalColumns(ambientBasis, rank)
  const projectedConstraints = constraints.map((constraint) => ({
    row: multiplyMatrixVector(transpose(basis), constraint.gradient),
    bound: -constraint.requiredDecrease,
  }))

  const candidates: Array<{ coefficients: Vector; active: number[] }> = []
  const zero = Array.from({ length: rank }, () => 0)
  if (
    projectedConstraints.every(
      (constraint) => dot(constraint.row, zero) <= constraint.bound + 1e-8,
    )
  ) {
    candidates.push({ coefficients: zero, active: [] })
  }

  const maximumActive = Math.min(rank, constraints.length)
  for (let activeCount = 1; activeCount <= maximumActive; activeCount += 1) {
    for (const indices of combinationIndices(constraints.length, activeCount)) {
      const matrix = indices.map((index) => projectedConstraints[index]?.row ?? [])
      const values = indices.map((index) => projectedConstraints[index]?.bound ?? 0)
      const coefficients = minimumNormEqualitySolution(matrix, values)
      if (!coefficients || coefficients.some((value) => !Number.isFinite(value))) {
        continue
      }
      const satisfies = projectedConstraints.every(
        (constraint) => dot(constraint.row, coefficients) <= constraint.bound + 1e-7,
      )
      if (satisfies) {
        candidates.push({ coefficients, active: indices })
      }
    }
  }

  if (candidates.length === 0) {
    return {
      rank,
      feasible: false,
      practicallyUsable: false,
      coefficients: zero,
      correction: Array.from({ length: ambientDimension }, () => 0),
      correctionNorm: Number.POSITIVE_INFINITY,
      currentDamage: Number.POSITIVE_INFINITY,
      slacks: constraints.map(() => Number.NEGATIVE_INFINITY),
      activeConstraints: [],
      reason: 'No correction in this rank-restricted space satisfies every old-task constraint.',
    }
  }

  const best = candidates.sort(
    (left, right) => norm(left.coefficients) - norm(right.coefficients),
  )[0]
  const coefficients = best?.coefficients ?? zero
  const correction = projectCoefficientsToCorrection(basis, coefficients)
  const correctionNorm = norm(correction)
  const currentDamage = dot(currentGradient, correction)
  const slacks = constraints.map(
    (constraint) => -constraint.requiredDecrease - dot(constraint.gradient, correction),
  )
  const practicallyUsable =
    correctionNorm <= maxCorrectionNorm + 1e-8 && currentDamage <= maxCurrentDamage + 1e-8

  return {
    rank,
    feasible: true,
    practicallyUsable,
    coefficients,
    correction,
    correctionNorm,
    currentDamage,
    slacks,
    activeConstraints: best?.active ?? [],
    reason: practicallyUsable
      ? 'A minimum-norm correction exists and remains inside the practical norm and current-task limits.'
      : correctionNorm > maxCorrectionNorm
        ? 'A correction exists, but the required norm exceeds the practical limit.'
        : 'A correction exists, but it sacrifices too much current-task progress.',
  }
}

function stableSoftmax(values: number[]): number[] {
  if (values.length === 0) {
    return []
  }
  const maximum = Math.max(...values)
  const exponentials = values.map((value) => Math.exp(value - maximum))
  const total = exponentials.reduce((sum, value) => sum + value, 0)
  return exponentials.map((value) => value / Math.max(total, EPSILON))
}

function createBaselineRegretMatrix(size: number, volatility: number): number[][] {
  return Array.from({ length: size }, (_, checkpoint) =>
    Array.from({ length: size }, (_, evaluation) => {
      const lag = evaluation - checkpoint
      if (lag === 0) {
        return 0.34 + 0.12 * volatility
      }
      if (lag < 0) {
        return 0.32 + Math.abs(lag) * (0.07 + 0.05 * volatility)
      }
      return 0.38 + lag * (0.055 + 0.08 * volatility)
    }),
  )
}

export function allocateTemporalReplay(
  windows: TemporalWindow[],
  input: ReplayAllocationInput,
): ReplayAllocation {
  const values = windows.map((window) => {
    const survival = Math.exp((-Math.log(2) * window.age) / Math.max(0.25, input.halfLife))
    const retainedBenefit = window.backwardBenefit * window.stability * survival
    const adaptationCost = window.currentCost * (0.65 + input.volatility)
    const futureCost = window.forwardCost * (0.45 + 1.2 * input.volatility)
    return (
      input.backwardWeight * retainedBenefit -
      input.currentWeight * adaptationCost -
      input.forwardWeight * futureCost
    )
  })
  const conservativeValues = values.map(
    (value, index) => value - input.uncertaintyPenalty * (windows[index]?.uncertainty ?? 0),
  )
  const positiveIndices = conservativeValues
    .map((value, index) => ({ value, index }))
    .filter((entry) => entry.value > 0)

  const allocation = windows.map(() => 0)
  if (positiveIndices.length > 0 && input.replayBudget > 0) {
    const shares = stableSoftmax(positiveIndices.map((entry) => entry.value * 5))
    positiveIndices.forEach((entry, localIndex) => {
      allocation[entry.index] = input.replayBudget * (shares[localIndex] ?? 0)
    })
  }

  const size = Math.max(6, windows.length + 1)
  const regretMatrix = createBaselineRegretMatrix(size, input.volatility)
  const baselineRow = [...(regretMatrix[size - 1] ?? [])]
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
  const updatedRow = baselineRow.map((value, index) => {
    if (index < size - 1) {
      const recency = 1 - index / Math.max(1, size - 1)
      return Math.max(0, value - backwardGain * (0.65 + 0.35 * recency))
    }
    if (index === size - 1) {
      return value + currentCost
    }
    return value + forwardCost
  })
  regretMatrix[size - 1] = updatedRow

  return {
    values,
    conservativeValues,
    allocation,
    regretMatrix,
    baselineRow,
    updatedRow,
  }
}

export function runCasePath(sources: CaseSource[]): CasePathRun {
  const relevant = sources.filter((source) => source.relevant)
  const facts = Array.from(new Set(relevant.flatMap((source) => source.facts)))
  const authorityPass = relevant.length > 0 && relevant.every((source) => source.authority >= 0.72)
  const integrityPass = relevant.length > 0 && relevant.every((source) => source.complete)
  const evidencePass = relevant.some((source) => source.supportsClaim)

  const authorityGate: CasePathGate = {
    id: 'authority',
    label: 'Source authority',
    state: authorityPass ? 'pass' : 'fail',
    explanation: authorityPass
      ? 'Every relevant source clears the deterministic authority threshold.'
      : 'At least one relevant source is below the authority threshold.',
  }
  const integrityGate: CasePathGate = {
    id: 'integrity',
    label: 'Document integrity',
    state: authorityPass ? (integrityPass ? 'pass' : 'fail') : 'blocked',
    explanation: !authorityPass
      ? 'Blocked until source authority passes.'
      : integrityPass
        ? 'Every relevant source is complete enough for bounded extraction.'
        : 'A relevant source is incomplete; extraction cannot be treated as whole-document evidence.',
  }
  const evidenceGate: CasePathGate = {
    id: 'evidence',
    label: 'Claim evidence',
    state:
      authorityPass && integrityPass ? (evidencePass ? 'pass' : 'fail') : 'blocked',
    explanation:
      authorityPass && integrityPass
        ? evidencePass
          ? 'At least one authoritative source directly supports the claim.'
          : 'No authoritative source directly supports the claim.'
        : 'Blocked until upstream gates pass.',
  }
  const wholePlaybookPass = authorityPass && integrityPass && evidencePass && facts.length >= 3
  const playbookGate: CasePathGate = {
    id: 'playbook',
    label: 'Whole-playbook consistency',
    state:
      authorityPass && integrityPass && evidencePass
        ? wholePlaybookPass
          ? 'pass'
          : 'fail'
        : 'blocked',
    explanation:
      authorityPass && integrityPass && evidencePass
        ? wholePlaybookPass
          ? 'The extracted facts support a complete, reviewable process chain.'
          : 'The evidence is valid but insufficient to construct the complete process.'
        : 'Blocked until evidence is valid.',
  }

  const artifactReady = wholePlaybookPass
  return {
    facts,
    gates: [authorityGate, integrityGate, evidenceGate, playbookGate],
    process: artifactReady
      ? [
          'Canonical facts',
          'Process decision map',
          'Evidence checklist',
          'Reviewable claim brief',
        ]
      : ['Canonical facts', 'Fail-closed review queue'],
    artifactReady,
    decision: artifactReady
      ? 'Construct the reviewable decision artifact with source-bound claims.'
      : 'Stop. Preserve the evidence state and expose the failed gate for review.',
  }
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function containsAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term))
}

export function compileSpatialIntent(intent: string, density = 0.65): SpatialPlan {
  const normalized = intent.trim().toLowerCase()
  const objective = containsAny(normalized, ['compare', 'competing', 'versus', 'hypotheses'])
    ? 'Compare alternatives through situated evidence.'
    : containsAny(normalized, ['process', 'workflow', 'sequence'])
      ? 'Inspect a process as a persistent spatial sequence.'
      : containsAny(normalized, ['learn', 'teach', 'classroom'])
        ? 'Create an environment for active learning and explanation.'
        : 'Explore a structured field of questions, evidence, and actions.'
  const environment = containsAny(normalized, ['calm', 'quiet', 'focus'])
    ? 'calm studio'
    : containsAny(normalized, ['outdoor', 'mountain', 'nature'])
      ? 'open landscape'
      : containsAny(normalized, ['lab', 'laboratory', 'experiment'])
        ? 'instrumented laboratory'
        : 'spatial research field'

  const concepts = [
    ...(containsAny(normalized, ['hypothesis', 'compare', 'competing'])
      ? ['Hypothesis A', 'Hypothesis B']
      : ['Central question']),
    'Evidence surface',
    ...(density > 0.45 ? ['Method console', 'Limitation boundary'] : []),
    ...(density > 0.72 ? ['Counterexample', 'Next experiment'] : []),
  ]
  const radius = 1.3 + density * 1.2
  const entities: SpatialEntity[] = concepts.map((label, index) => {
    const angle = (-Math.PI / 2) + (index * 2 * Math.PI) / Math.max(1, concepts.length)
    const kind: SpatialEntity['kind'] = label.includes('Evidence')
      ? 'evidence'
      : label.includes('console')
        ? 'tool'
        : label.includes('experiment')
          ? 'action'
          : label.includes('boundary')
            ? 'environment'
            : 'question'
    return {
      id: slug(label),
      label,
      kind,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * 0.68,
      z: index % 2 === 0 ? 0.28 : -0.18,
    }
  })

  const evidenceId = entities.find((entity) => entity.kind === 'evidence')?.id
  const relations: SpatialRelation[] = []
  if (evidenceId) {
    for (const entity of entities) {
      if (entity.id !== evidenceId) {
        relations.push({
          source: evidenceId,
          target: entity.id,
          label: entity.kind === 'question' ? 'tests' : 'informs',
        })
      }
    }
  }
  if (entities.length > 1) {
    relations.push({
      source: entities[0]?.id ?? '',
      target: entities[1]?.id ?? '',
      label: 'contrasts',
    })
  }

  return {
    intent,
    objective,
    environment,
    entities,
    relations,
    affordances: [
      'Focus an entity to reveal its evidence.',
      'Reposition a question without losing its relations.',
      'Change information density while preserving the world state.',
    ],
  }
}
