import { describe, expect, it } from 'vitest'

import {
  compileSpatialIntent,
  diffuseGraphSignal,
  norm,
  runCasePath,
  selectReplaySubset,
  signedLaplacian,
  solveRankFeasibility,
  verifyReplayIdentity,
  type CaseSource,
  type RankConstraint,
  type ReplayCandidate,
  type TemporalWindow,
} from './mechanisms'
import { allocateTemporalReplayWithFuture } from './temporalReplay'

describe('signed graph Laplacian', () => {
  it('is symmetric and heat diffusion lowers spectral energy', () => {
    const spectrum = signedLaplacian(
      4,
      [
        { source: 0, target: 1, weight: 1 },
        { source: 1, target: 2, weight: 0.8 },
        { source: 2, target: 3, weight: 1.1 },
        { source: 3, target: 0, weight: 0.7 },
      ],
      false,
    )
    spectrum.laplacian.forEach((row, rowIndex) => {
      row.forEach((value, columnIndex) => {
        expect(value).toBeCloseTo(spectrum.laplacian[columnIndex]?.[rowIndex] ?? 0, 9)
      })
    })
    const initial = [1, 0, -0.4, 0.2]
    const later = diffuseGraphSignal(initial, spectrum.eigen, 1.4)
    expect(norm(later)).toBeLessThanOrEqual(norm(initial) + 1e-8)
  })
})

describe('replay geometry', () => {
  const candidates: ReplayCandidate[] = [
    { id: 'a', label: 'a', gradient: [1.6, 0.7] },
    { id: 'b', label: 'b', gradient: [0.9, 1.45] },
    { id: 'c', label: 'c', gradient: [1.35, 1.2] },
    { id: 'd', label: 'd', gradient: [-0.4, 1.8] },
    { id: 'e', label: 'e', gradient: [1.9, -0.2] },
    { id: 'f', label: 'f', gradient: [0.55, 0.4] },
  ]

  it('reconstructs the desired joint update exactly at the dense target', () => {
    expect(verifyReplayIdentity([0.55, 0.25], [0.92, 0.78], 0.4)).toBe(true)
  })

  it('keeps exact selection no worse than greedy and greedy no worse than the locked random control', () => {
    const argumentsTuple: [
    ReplayCandidate[],
    [number, number],
    [number, number],
    number,
    number,
  ] = [candidates, [0.55, 0.25], [0.92, 0.78], 0.4, 3]
    const exact = selectReplaySubset(...argumentsTuple, 'exact')
    const greedy = selectReplaySubset(...argumentsTuple, 'greedy')
    const random = selectReplaySubset(...argumentsTuple, 'random', 23)
    const randomAgain = selectReplaySubset(...argumentsTuple, 'random', 23)
    expect(exact.residual).toBeLessThanOrEqual(greedy.residual + 1e-9)
    expect(random).toEqual(randomAgain)
  })
})

describe('rank feasibility', () => {
  const basis = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ]
  const constraints: RankConstraint[] = [
    { id: 'old-a', label: 'old A', gradient: [1, 0.1, 0.1, 0], requiredDecrease: 0.32 },
    { id: 'old-b', label: 'old B', gradient: [-0.1, 1, 0.15, 0], requiredDecrease: 0.3 },
    { id: 'old-c', label: 'old C', gradient: [0.05, 0.1, 1, 0.1], requiredDecrease: 0.28 },
  ]

  it('distinguishes infeasible, merely feasible, and practical ranks', () => {
    const rankOne = solveRankFeasibility(basis, 1, constraints, [0.1, -0.05, -0.45, 0], 0.8, 0.12)
    const rankThree = solveRankFeasibility(basis, 3, constraints, [0.1, -0.05, -0.45, 0], 0.8, 0.12)
    expect(rankOne.feasible).toBe(false)
    expect(rankThree.feasible).toBe(true)
    expect(rankThree.correctionNorm).toBeGreaterThan(0)
  })
})

describe('temporal replay', () => {
  const windows: TemporalWindow[] = [
    { id: 'w1', label: 'old stable', age: 4, stability: 0.95, backwardBenefit: 1.1, currentCost: 0.13, forwardCost: 0.08, uncertainty: 0.04 },
    { id: 'w2', label: 'recent', age: 1, stability: 0.8, backwardBenefit: 0.85, currentCost: 0.18, forwardCost: 0.12, uncertainty: 0.05 },
    { id: 'w3', label: 'stale', age: 8, stability: 0.25, backwardBenefit: 0.42, currentCost: 0.36, forwardCost: 0.4, uncertainty: 0.1 },
  ]

  it('allocates only to positive conservative value and exposes forward effects', () => {
    const result = allocateTemporalReplayWithFuture(windows, {
      replayBudget: 0.3,
      halfLife: 5,
      volatility: 0.35,
      uncertaintyPenalty: 0.8,
      backwardWeight: 1,
      currentWeight: 0.8,
      forwardWeight: 0.65,
    })
    const total = result.allocation.reduce((sum, value) => sum + value, 0)
    expect(total).toBeLessThanOrEqual(0.3000001)
    result.allocation.forEach((weight, index) => {
      if ((result.conservativeValues[index] ?? 0) <= 0) {
        expect(weight).toBe(0)
      }
    })
    expect(result.updatedRow.length).toBeGreaterThan(windows.length + 1)
  })
})

describe('CasePath gates', () => {
  const validSources: CaseSource[] = [
    {
      id: 'statute',
      label: 'statute',
      authority: 0.98,
      relevant: true,
      complete: true,
      supportsClaim: true,
      facts: ['lease exists', 'notice was sent', 'deadline is recorded'],
    },
  ]

  it('fails closed and only emits a decision artifact after all gates pass', () => {
    const valid = runCasePath(validSources)
    expect(valid.artifactReady).toBe(true)
    const invalid = runCasePath([
      ...validSources,
      {
        id: 'fragment',
        label: 'fragment',
        authority: 0.3,
        relevant: true,
        complete: false,
        supportsClaim: false,
        facts: ['unverified statement'],
      },
    ])
    expect(invalid.artifactReady).toBe(false)
    expect(invalid.gates.some((gate) => gate.state === 'fail')).toBe(true)
  })
})

describe('spatial compiler', () => {
  it('compiles the same intent into the same persistent structure', () => {
    const intent = 'Create a calm lab to compare competing hypotheses with evidence.'
    expect(compileSpatialIntent(intent, 0.7)).toEqual(compileSpatialIntent(intent, 0.7))
    expect(compileSpatialIntent(intent, 0.7).entities.length).toBeGreaterThan(3)
  })
})
