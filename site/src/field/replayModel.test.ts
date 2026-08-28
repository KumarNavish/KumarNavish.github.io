import { describe, expect, it } from 'vitest'

import { REPLAY_CANDIDATES, selectReplayCandidates } from './replayModel'

describe('replay mechanism model', () => {
  it('returns the requested number of unique candidates', () => {
    const result = selectReplayCandidates({ method: 'greedy', candidateCount: 4, seed: 11 })

    expect(result.selectedIds).toHaveLength(4)
    expect(new Set(result.selectedIds).size).toBe(4)
  })

  it('is deterministic for the same random seed', () => {
    const first = selectReplayCandidates({ method: 'random', candidateCount: 3, seed: 29 })
    const second = selectReplayCandidates({ method: 'random', candidateCount: 3, seed: 29 })

    expect(second).toEqual(first)
  })

  it('keeps candidate counts inside the available range', () => {
    const result = selectReplayCandidates({ method: 'greedy', candidateCount: 999, seed: 5 })

    expect(result.selectedIds).toHaveLength(REPLAY_CANDIDATES.length)
    expect(Number.isFinite(result.residual)).toBe(true)
  })

  it('greedy matching is no worse than the deterministic random control in the default view', () => {
    const greedy = selectReplayCandidates({ method: 'greedy', candidateCount: 3, seed: 23 })
    const random = selectReplayCandidates({ method: 'random', candidateCount: 3, seed: 23 })

    expect(greedy.residual).toBeLessThanOrEqual(random.residual)
  })
})
