import {
  Halfspace,
  Vec2,
  dot,
  intersectHalfspaces,
  isStepFeasible,
  scale,
  squaredNorm,
  worldBoundsFromHalfspaces,
} from './geometry'

export interface ProjectionInput {
  gradient: Vec2
  eta: number
  halfspaces: Halfspace[]
  tolerance?: number
}

export interface ProjectionResult {
  step0: Vec2
  projectedStep: Vec2
  lambdaById: Record<string, number>
  activeSetIds: string[]
  objective0: number
  objectiveProjected: number
  ship: boolean
  reason: string | null
}

interface Candidate {
  step: Vec2
  lambdas: number[]
  objective: number
  activeSet: number[]
}

function objective(gradient: Vec2, eta: number, step: Vec2): number {
  return dot(gradient, step) + squaredNorm(step) / (2 * eta)
}

function solveLinearSystem(matrix: number[][], rhs: number[], tolerance = 1e-10): number[] | null {
  const n = rhs.length
  const a = matrix.map((row) => [...row])
  const b = [...rhs]

  for (let col = 0; col < n; col += 1) {
    let pivotRow = col
    let pivotValue = Math.abs(a[col][col])

    for (let row = col + 1; row < n; row += 1) {
      const candidate = Math.abs(a[row][col])
      if (candidate > pivotValue) {
        pivotValue = candidate
        pivotRow = row
      }
    }

    if (pivotValue < tolerance) {
      return null
    }

    if (pivotRow !== col) {
      ;[a[col], a[pivotRow]] = [a[pivotRow], a[col]]
      ;[b[col], b[pivotRow]] = [b[pivotRow], b[col]]
    }

    const pivot = a[col][col]
    for (let row = col + 1; row < n; row += 1) {
      const factor = a[row][col] / pivot
      if (Math.abs(factor) < tolerance) {
        continue
      }

      for (let k = col; k < n; k += 1) {
        a[row][k] -= factor * a[col][k]
      }
      b[row] -= factor * b[col]
    }
  }

  const x = new Array<number>(n).fill(0)
  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = b[row]
    for (let k = row + 1; k < n; k += 1) {
      sum -= a[row][k] * x[k]
    }

    const diagonal = a[row][row]
    if (Math.abs(diagonal) < tolerance) {
      return null
    }
    x[row] = sum / diagonal
  }

  return x
}

function enumerateSubsets(n: number): number[][] {
  const subsets: number[][] = [[]]

  for (let mask = 1; mask < 1 << n; mask += 1) {
    const subset: number[] = []
    for (let bit = 0; bit < n; bit += 1) {
      if ((mask & (1 << bit)) !== 0) {
        subset.push(bit)
      }
    }
    subsets.push(subset)
  }

  return subsets
}

export function computeProjectedStep(input: ProjectionInput): ProjectionResult {
  const { gradient, halfspaces } = input
  const eta = input.eta
  const tolerance = input.tolerance ?? 1e-7
  const step0 = scale(gradient, -eta)

  const lambdaById: Record<string, number> = {}
  for (const halfspace of halfspaces) {
    lambdaById[halfspace.id] = 0
  }

  const objective0 = objective(gradient, eta, step0)

  if (!Number.isFinite(eta) || eta <= tolerance) {
    return {
      step0,
      projectedStep: step0,
      lambdaById,
      activeSetIds: [],
      objective0,
      objectiveProjected: objective0,
      ship: false,
      reason: 'Step size eta must be positive.',
    }
  }

  const activeHalfspaces = halfspaces.filter((halfspace) => halfspace.active)
  if (activeHalfspaces.length === 0) {
    return {
      step0,
      projectedStep: step0,
      lambdaById,
      activeSetIds: [],
      objective0,
      objectiveProjected: objective0,
      ship: true,
      reason: null,
    }
  }

  const worldRadius = worldBoundsFromHalfspaces(activeHalfspaces)
  const zone = intersectHalfspaces(activeHalfspaces, worldRadius)
  if (zone.isEmpty) {
    return {
      step0,
      projectedStep: step0,
      lambdaById,
      activeSetIds: [],
      objective0,
      objectiveProjected: objective0,
      ship: false,
      reason: 'Guardrail set is infeasible: the ship zone is empty.',
    }
  }

  const candidates: Candidate[] = []
  let linearSolveFailures = 0

  for (const subset of enumerateSubsets(activeHalfspaces.length)) {
    if (subset.length === 0) {
      if (!isStepFeasible(step0, activeHalfspaces, tolerance)) {
        continue
      }

      candidates.push({
        step: step0,
        lambdas: new Array<number>(activeHalfspaces.length).fill(0),
        objective: objective0,
        activeSet: [],
      })
      continue
    }

    const m = subset.length
    const dim = 2 + m

    const matrix: number[][] = Array.from({ length: dim }, () => new Array<number>(dim).fill(0))
    const rhs = new Array<number>(dim).fill(0)

    matrix[0][0] = 1 / eta
    matrix[1][1] = 1 / eta
    rhs[0] = -gradient.x
    rhs[1] = -gradient.y

    for (let row = 0; row < m; row += 1) {
      const constraint = activeHalfspaces[subset[row]]
      const constraintIndex = 2 + row

      matrix[0][constraintIndex] = constraint.normal.x
      matrix[1][constraintIndex] = constraint.normal.y
      matrix[constraintIndex][0] = constraint.normal.x
      matrix[constraintIndex][1] = constraint.normal.y
      rhs[constraintIndex] = constraint.bound
    }

    const solution = solveLinearSystem(matrix, rhs)
    if (!solution) {
      linearSolveFailures += 1
      continue
    }

    const step = { x: solution[0], y: solution[1] }

    const multipliers = new Array<number>(activeHalfspaces.length).fill(0)
    let multipliersValid = true

    for (let row = 0; row < m; row += 1) {
      const lambda = solution[2 + row]
      if (lambda < -tolerance) {
        multipliersValid = false
        break
      }
      multipliers[subset[row]] = Math.max(0, lambda)
    }

    if (!multipliersValid) {
      continue
    }

    if (!isStepFeasible(step, activeHalfspaces, tolerance)) {
      continue
    }

    candidates.push({
      step,
      lambdas: multipliers,
      objective: objective(gradient, eta, step),
      activeSet: subset,
    })
  }

  if (candidates.length === 0) {
    const reason =
      linearSolveFailures > 0
        ? 'Numerical instability in QP solve. Try smaller eta or looser budgets.'
        : 'No feasible projected step for current guardrails and budgets.'

    return {
      step0,
      projectedStep: step0,
      lambdaById,
      activeSetIds: [],
      objective0,
      objectiveProjected: objective0,
      ship: false,
      reason,
    }
  }

  candidates.sort((a, b) => a.objective - b.objective)
  const best = candidates[0]

  const activeSetIds: string[] = []
  for (let i = 0; i < activeHalfspaces.length; i += 1) {
    const value = best.lambdas[i]
    lambdaById[activeHalfspaces[i].id] = value
    if (value > tolerance) {
      activeSetIds.push(activeHalfspaces[i].id)
    }
  }

  return {
    step0,
    projectedStep: best.step,
    lambdaById,
    activeSetIds,
    objective0,
    objectiveProjected: best.objective,
    ship: true,
    reason: null,
  }
}
