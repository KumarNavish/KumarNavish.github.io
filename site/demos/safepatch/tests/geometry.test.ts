import { describe, expect, test } from 'vitest'
import { Halfspace, vec } from '../src/geometry'
import { computeProjectedStep } from '../src/qp'

function halfspace(id: string, nx: number, ny: number, bound: number): Halfspace {
  return {
    id,
    label: id,
    normal: vec(nx, ny),
    bound,
    active: true,
  }
}

describe('computeProjectedStep', () => {
  test('returns unconstrained step when already feasible', () => {
    const constraints = [
      halfspace('h1', 1, 0, 1),
      halfspace('h2', -1, 0, 1),
      halfspace('h3', 0, 1, 1),
      halfspace('h4', 0, -1, 1),
    ]

    const result = computeProjectedStep({
      gradient: vec(0.2, 0.1),
      eta: 1,
      halfspaces: constraints,
    })

    expect(result.ship).toBe(true)
    expect(result.projectedStep.x).toBeCloseTo(-0.2, 8)
    expect(result.projectedStep.y).toBeCloseTo(-0.1, 8)
    expect(result.activeSetIds).toHaveLength(0)
    expect(Object.values(result.lambdaById).every((value) => Math.abs(value) < 1e-8)).toBe(true)
  })

  test('projects to a single violated halfspace boundary', () => {
    const constraints = [halfspace('h1', 1, 0, 0.5)]

    const result = computeProjectedStep({
      gradient: vec(-1, 0),
      eta: 1,
      halfspaces: constraints,
    })

    expect(result.ship).toBe(true)
    expect(result.projectedStep.x).toBeCloseTo(0.5, 8)
    expect(result.projectedStep.y).toBeCloseTo(0, 8)
    expect(result.lambdaById.h1).toBeGreaterThan(0)
    expect(result.lambdaById.h1).toBeCloseTo(0.5, 7)
  })

  test('projects onto intersection of two active constraints', () => {
    const constraints = [halfspace('h1', 1, 0, 0.4), halfspace('h2', 0, 1, 0.3)]

    const result = computeProjectedStep({
      gradient: vec(-1, -1),
      eta: 1,
      halfspaces: constraints,
    })

    expect(result.ship).toBe(true)
    expect(result.projectedStep.x).toBeCloseTo(0.4, 8)
    expect(result.projectedStep.y).toBeCloseTo(0.3, 8)
    expect(result.lambdaById.h1).toBeCloseTo(0.6, 7)
    expect(result.lambdaById.h2).toBeCloseTo(0.7, 7)
    expect(result.activeSetIds.sort()).toEqual(['h1', 'h2'])
  })

  test('returns HOLD when guardrail intersection is empty', () => {
    const constraints = [halfspace('h1', 1, 0, -0.2), halfspace('h2', -1, 0, -0.2)]

    const result = computeProjectedStep({
      gradient: vec(-1, 0),
      eta: 0.7,
      halfspaces: constraints,
    })

    expect(result.ship).toBe(false)
    expect(result.reason?.toLowerCase()).toContain('empty')
    expect(result.projectedStep.x).toBeCloseTo(result.step0.x, 8)
    expect(result.projectedStep.y).toBeCloseTo(result.step0.y, 8)
  })
})
