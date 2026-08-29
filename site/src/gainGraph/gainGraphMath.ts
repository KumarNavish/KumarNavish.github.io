export interface Complex { re: number; im: number }
export interface GainEdge { id: string; source: number; target: number; phase: number }
export interface GainGraph { nodeCount: number; edges: GainEdge[] }
export interface EigenSystem { values: number[]; vectors: Complex[][] }
export interface GainAnalysis {
  adjacency: Complex[][]
  combinatorial: Complex[][]
  normalized: Complex[][]
  degrees: number[]
  combinatorialEigen: EigenSystem
  normalizedEigen: EigenSystem
  cycles: Array<{ id: string; phase: number }>
  balanced: boolean
  frustrationIndex: number
  cycleDefect: number
}

const EPS = 1e-9
const TAU = Math.PI * 2
const CYCLES = [
  { id: 'outer', nodes: [0, 1, 2, 3, 4, 5, 0] },
  { id: 'upper', nodes: [1, 2, 3, 4, 1] },
  { id: 'lower', nodes: [2, 3, 4, 5, 2] },
] as const

export const c = (re = 0, im = 0): Complex => ({ re, im })
export const cAdd = (a: Complex, b: Complex): Complex => c(a.re + b.re, a.im + b.im)
export const cMul = (a: Complex, b: Complex): Complex => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re)
export const cScale = (a: Complex, k: number): Complex => c(a.re * k, a.im * k)
export const cConj = (a: Complex): Complex => c(a.re, -a.im)
export const cAbs = (a: Complex): number => Math.hypot(a.re, a.im)
export const cArg = (a: Complex): number => Math.atan2(a.im, a.re)
export const cUnit = (angle: number): Complex => c(Math.cos(angle), Math.sin(angle))

export function wrapPhase(angle: number): number {
  let value = angle % TAU
  if (value > Math.PI) value -= TAU
  if (value <= -Math.PI) value += TAU
  return value
}

function realIdentity(n: number): number[][] {
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, q) => r === q ? 1 : 0))
}

function jacobi(input: number[][]): { values: number[]; vectors: number[][] } {
  const n = input.length
  const a = input.map((row) => [...row])
  const v = realIdentity(n)
  for (let iteration = 0; iteration < 2400; iteration += 1) {
    let p = 0
    let q = 1
    let largest = 0
    for (let r = 0; r < n; r += 1) {
      for (let s = r + 1; s < n; s += 1) {
        const value = Math.abs(a[r]?.[s] ?? 0)
        if (value > largest) { largest = value; p = r; q = s }
      }
    }
    if (largest < 1e-11) break
    const app = a[p]?.[p] ?? 0
    const aqq = a[q]?.[q] ?? 0
    const apq = a[p]?.[q] ?? 0
    const angle = 0.5 * Math.atan2(2 * apq, aqq - app)
    const co = Math.cos(angle)
    const si = Math.sin(angle)
    for (let r = 0; r < n; r += 1) {
      if (r === p || r === q) continue
      const arp = a[r]?.[p] ?? 0
      const arq = a[r]?.[q] ?? 0
      const nextP = co * arp - si * arq
      const nextQ = si * arp + co * arq
      a[r]![p] = nextP; a[p]![r] = nextP
      a[r]![q] = nextQ; a[q]![r] = nextQ
    }
    a[p]![p] = co * co * app - 2 * si * co * apq + si * si * aqq
    a[q]![q] = si * si * app + 2 * si * co * apq + co * co * aqq
    a[p]![q] = 0; a[q]![p] = 0
    for (let r = 0; r < n; r += 1) {
      const vrp = v[r]?.[p] ?? 0
      const vrq = v[r]?.[q] ?? 0
      v[r]![p] = co * vrp - si * vrq
      v[r]![q] = si * vrp + co * vrq
    }
  }
  const pairs = Array.from({ length: n }, (_, index) => ({
    value: a[index]?.[index] ?? 0,
    vector: v.map((row) => row[index] ?? 0),
  })).sort((left, right) => left.value - right.value)
  return { values: pairs.map((item) => item.value), vectors: pairs.map((item) => item.vector) }
}

function hermitianEigen(matrix: Complex[][]): EigenSystem {
  const n = matrix.length
  const block = Array.from({ length: n * 2 }, (_, row) =>
    Array.from({ length: n * 2 }, (_, column) => {
      const rowImaginary = row >= n
      const columnImaginary = column >= n
      const value = matrix[rowImaginary ? row - n : row]?.[columnImaginary ? column - n : column] ?? c()
      if (!rowImaginary && !columnImaginary) return value.re
      if (!rowImaginary && columnImaginary) return -value.im
      if (rowImaginary && !columnImaginary) return value.im
      return value.re
    }),
  )
  const real = jacobi(block)
  const values: number[] = []
  const vectors: Complex[][] = []
  const used = new Set<number>()
  for (let index = 0; index < real.values.length && values.length < n; index += 1) {
    if (used.has(index)) continue
    const value = real.values[index] ?? 0
    let mate = -1
    for (let candidate = index + 1; candidate < real.values.length; candidate += 1) {
      if (!used.has(candidate) && Math.abs((real.values[candidate] ?? 0) - value) < 1e-7) { mate = candidate; break }
    }
    used.add(index); if (mate >= 0) used.add(mate)
    const column = real.vectors[index] ?? []
    const vector = Array.from({ length: n }, (_, node) => c(column[node] ?? 0, column[node + n] ?? 0))
    const norm = Math.sqrt(vector.reduce((sum, item) => sum + item.re * item.re + item.im * item.im, 0)) || 1
    values.push(Math.abs(value) < 1e-10 ? 0 : value)
    vectors.push(vector.map((item) => cScale(item, 1 / norm)))
  }
  return { values, vectors }
}

function matrices(graph: GainGraph) {
  const n = graph.nodeCount
  const adjacency = Array.from({ length: n }, () => Array.from({ length: n }, () => c()))
  const degrees = Array.from({ length: n }, () => 0)
  for (const edge of graph.edges) {
    const gain = cUnit(edge.phase)
    adjacency[edge.source]![edge.target] = gain
    adjacency[edge.target]![edge.source] = cConj(gain)
    degrees[edge.source] = (degrees[edge.source] ?? 0) + 1
    degrees[edge.target] = (degrees[edge.target] ?? 0) + 1
  }
  const combinatorial = Array.from({ length: n }, (_, row) =>
    Array.from({ length: n }, (_, column) => row === column ? c(degrees[row] ?? 0) : cScale(adjacency[row]?.[column] ?? c(), -1)),
  )
  const normalized = Array.from({ length: n }, (_, row) =>
    Array.from({ length: n }, (_, column) => {
      if (row === column) return c((degrees[row] ?? 0) > 0 ? 1 : 0)
      const denominator = Math.sqrt((degrees[row] ?? 0) * (degrees[column] ?? 0))
      return denominator > EPS ? cScale(adjacency[row]?.[column] ?? c(), -1 / denominator) : c()
    }),
  )
  return { adjacency, combinatorial, normalized, degrees }
}

function directedGain(graph: GainGraph, source: number, target: number): Complex {
  const forward = graph.edges.find((edge) => edge.source === source && edge.target === target)
  if (forward) return cUnit(forward.phase)
  const reverse = graph.edges.find((edge) => edge.source === target && edge.target === source)
  if (reverse) return cConj(cUnit(reverse.phase))
  throw new Error(`Missing edge ${source}-${target}`)
}

function cyclePhase(graph: GainGraph, nodes: readonly number[]): number {
  let product = c(1)
  for (let index = 0; index < nodes.length - 1; index += 1) {
    product = cMul(product, directedGain(graph, nodes[index] ?? 0, nodes[index + 1] ?? 0))
  }
  return wrapPhase(cArg(product))
}

function balancedWithEdges(nodeCount: number, edges: GainEdge[]): boolean {
  const relations = Array.from({ length: nodeCount }, () => [] as Array<{ target: number; phase: number }>)
  for (const edge of edges) {
    relations[edge.source]?.push({ target: edge.target, phase: edge.phase })
    relations[edge.target]?.push({ target: edge.source, phase: -edge.phase })
  }
  const potentials = Array.from({ length: nodeCount }, () => Number.NaN)
  for (let root = 0; root < nodeCount; root += 1) {
    if (Number.isFinite(potentials[root])) continue
    potentials[root] = 0
    const queue = [root]
    while (queue.length > 0) {
      const source = queue.shift()
      if (source === undefined) continue
      for (const relation of relations[source] ?? []) {
        const expected = wrapPhase((potentials[source] ?? 0) - relation.phase)
        if (!Number.isFinite(potentials[relation.target])) { potentials[relation.target] = expected; queue.push(relation.target) }
        else if (Math.abs(wrapPhase((potentials[relation.target] ?? 0) - expected)) > 1e-6) return false
      }
    }
  }
  return true
}

export function frustrationIndex(graph: GainGraph): number {
  if (balancedWithEdges(graph.nodeCount, graph.edges)) return 0
  const total = graph.edges.length
  for (let count = 1; count <= total; count += 1) {
    const visit = (start: number, removed: number[]): boolean => {
      if (removed.length === count) {
        const set = new Set(removed)
        return balancedWithEdges(graph.nodeCount, graph.edges.filter((_, index) => !set.has(index)))
      }
      for (let index = start; index < total; index += 1) {
        removed.push(index)
        if (visit(index + 1, removed)) return true
        removed.pop()
      }
      return false
    }
    if (visit(0, [])) return count
  }
  return total
}

export function analyzeGainGraph(graph: GainGraph): GainAnalysis {
  const built = matrices(graph)
  const cycles = CYCLES.map((cycle) => ({ id: cycle.id, phase: cyclePhase(graph, cycle.nodes) }))
  return {
    ...built,
    combinatorialEigen: hermitianEigen(built.combinatorial),
    normalizedEigen: hermitianEigen(built.normalized),
    cycles,
    balanced: cycles.every((cycle) => Math.abs(cycle.phase) < 1e-6),
    frustrationIndex: frustrationIndex(graph),
    cycleDefect: cycles.reduce((sum, cycle) => sum + 1 - Math.cos(cycle.phase), 0) / cycles.length,
  }
}

function inner(left: Complex[], right: Complex[]): Complex {
  return left.reduce((sum, value, index) => cAdd(sum, cMul(cConj(value), right[index] ?? c())), c())
}

export function diffuse(initial: Complex[], eigen: EigenSystem, time: number): Complex[] {
  const output = initial.map(() => c())
  eigen.vectors.forEach((vector, modeIndex) => {
    const coefficient = inner(vector, initial)
    const decay = Math.exp(-Math.max(0, time) * Math.max(0, eigen.values[modeIndex] ?? 0))
    vector.forEach((basis, node) => { output[node] = cAdd(output[node] ?? c(), cScale(cMul(basis, coefficient), decay)) })
  })
  return output
}

export function phaseLabel(angle: number): string {
  const value = wrapPhase(angle)
  if (Math.abs(value) < 0.005) return '0'
  return `${value >= 0 ? '+' : '−'}${Math.abs(value / Math.PI).toFixed(2)}π`
}

export function complexLabel(value: Complex): string {
  const re = Math.abs(value.re) < 0.005 ? 0 : value.re
  const im = Math.abs(value.im) < 0.005 ? 0 : value.im
  if (im === 0) return re.toFixed(2)
  if (re === 0) return `${im < 0 ? '−' : ''}${Math.abs(im).toFixed(2)}i`
  return `${re.toFixed(2)} ${im < 0 ? '−' : '+'} ${Math.abs(im).toFixed(2)}i`
}
