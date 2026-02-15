import { describe, expect, it } from 'vitest'

import { runRolloutProof, runSafetyProof } from './capabilityProofs'

describe('runSafetyProof', () => {
  it('is deterministic for identical inputs', () => {
    const first = runSafetyProof({ threshold: 0.62, intervention_budget: 0.24 })
    const second = runSafetyProof({ threshold: 0.62, intervention_budget: 0.24 })

    expect(first).toEqual(second)
  })

  it('trades precision and recall as threshold tightens', () => {
    const lower = runSafetyProof({ threshold: 0.56, intervention_budget: 0.28 })
    const higher = runSafetyProof({ threshold: 0.76, intervention_budget: 0.28 })

    expect(lower.recall).toBeGreaterThanOrEqual(higher.recall)
  })
})

describe('runRolloutProof', () => {
  it('returns deterministic ranking for fixed weights', () => {
    const first = runRolloutProof({
      readiness_weight: 0.52,
      cost_weight: 0.24,
      risk_weight: 0.24,
    })
    const second = runRolloutProof({
      readiness_weight: 0.52,
      cost_weight: 0.24,
      risk_weight: 0.24,
    })

    expect(first.top_sequence).toEqual(second.top_sequence)
    expect(first.stability_score).toBeCloseTo(second.stability_score)
  })
})
