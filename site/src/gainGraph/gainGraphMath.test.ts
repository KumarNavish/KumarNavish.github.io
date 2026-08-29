import { describe, expect, it } from 'vitest'

import {
  analyzeGainGraph,
  c,
  cAbs,
  diffuse,
  wrapPhase,
  type GainEdge,
  type GainGraph,
} from './gainGraphMath'

const potentials = [0, 0.48, -0.34, 0.93, 0.16, -0.72]
const gaugeShift = [0.36, -0.24, 0.58, -0.39, 0.22, -0.46]
const edgePairs = [
  ['e01', 0, 1],
  ['e12', 1, 2],
  ['e23', 2, 3],
  ['e34', 3, 4],
  ['e45', 4, 5],
  ['e50', 5, 0],
  ['e14', 1, 4],
  ['e25', 2, 5],
] as const

function graph(offset = 0, gauge = false): GainGraph {
  const vertexPhases = potentials.map((value, index) => value + (gauge ? gaugeShift[index] ?? 0 : 0))
  const edges: GainEdge[] = edgePairs.map(([id, source, target]) => ({
    id,
    source,
    target,
    phase: wrapPhase(
      (vertexPhases[source] ?? 0) -
      (vertexPhases[target] ?? 0) +
      (id === 'e23' ? offset : 0),
    ),
  }))
  return { nodeCount: potentials.length, edges }
}

function expectSpectrumClose(left: number[], right: number[]): void {
  expect(left).toHaveLength(right.length)
  left.forEach((value, index) => expect(value).toBeCloseTo(right[index] ?? Number.NaN, 6))
}

describe('complex unit gain graph analysis', () => {
  it('recognizes a gauge-generated balanced graph and its zero mode', () => {
    const result = analyzeGainGraph(graph())
    expect(result.balanced).toBe(true)
    expect(result.frustrationIndex).toBe(0)
    expect(result.cycles.every((cycle) => Math.abs(cycle.phase) < 1e-7)).toBe(true)
    expect(result.combinatorialEigen.values[0]).toBeCloseTo(0, 7)
    expect(result.normalizedEigen.values[0]).toBeCloseTo(0, 7)
    result.normalizedEigen.values.forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(-1e-8)
      expect(value).toBeLessThanOrEqual(2 + 1e-8)
    })
  })

  it('propagates one edge perturbation into cycles and the spectrum', () => {
    const result = analyzeGainGraph(graph(Math.PI * 0.58))
    expect(result.balanced).toBe(false)
    expect(result.frustrationIndex).toBe(1)
    expect(result.cycleDefect).toBeGreaterThan(0)
    expect(result.combinatorialEigen.values[0]).toBeGreaterThan(0)
    expect(result.combinatorialEigen.values[0] ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
      result.frustrationIndex + 1e-7,
    )
    result.normalizedEigen.values.forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(-1e-8)
      expect(value).toBeLessThanOrEqual(2 + 1e-8)
    })
  })

  it('preserves cycle phases and both spectra under a switching transformation', () => {
    const original = analyzeGainGraph(graph(Math.PI * 0.41))
    const switched = analyzeGainGraph(graph(Math.PI * 0.41, true))
    expectSpectrumClose(original.combinatorialEigen.values, switched.combinatorialEigen.values)
    expectSpectrumClose(original.normalizedEigen.values, switched.normalizedEigen.values)
    original.cycles.forEach((cycle, index) => {
      expect(cycle.phase).toBeCloseTo(switched.cycles[index]?.phase ?? Number.NaN, 7)
    })
  })

  it('reconstructs at t=0 and contracts the signal under heat diffusion', () => {
    const result = analyzeGainGraph(graph(Math.PI * 0.33))
    const initial = [c(1, 0), c(0.2, 0.4), c(-0.4, 0.1), c(-0.1, -0.3), c(0.3, -0.2), c(0.5, 0.1)]
    const atZero = diffuse(initial, result.normalizedEigen, 0)
    const later = diffuse(initial, result.normalizedEigen, 1.7)
    initial.forEach((value, index) => {
      expect(atZero[index]?.re).toBeCloseTo(value.re, 5)
      expect(atZero[index]?.im).toBeCloseTo(value.im, 5)
    })
    const initialNorm = Math.sqrt(initial.reduce((sum, value) => sum + cAbs(value) ** 2, 0))
    const laterNorm = Math.sqrt(later.reduce((sum, value) => sum + cAbs(value) ** 2, 0))
    expect(laterNorm).toBeLessThanOrEqual(initialNorm + 1e-7)
  })
})
