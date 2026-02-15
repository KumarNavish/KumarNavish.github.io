import { describe, expect, it } from 'vitest'

import { runClPloProof } from './clploProof'

describe('runClPloProof', () => {
  it('is deterministic for the same config', () => {
    const config = {
      steps: 64,
      stress_probability: 0.33,
      anchor_weight: 0.4,
      projection_limit: 0.62,
      seed: 17,
    }

    const first = runClPloProof(config)
    const second = runClPloProof(config)

    expect(first.winner.id).toBe(second.winner.id)
    expect(first.strategies.map((strategy) => strategy.metrics.total_return)).toEqual(
      second.strategies.map((strategy) => strategy.metrics.total_return),
    )
    expect(first.strategies.map((strategy) => strategy.metrics.max_drawdown)).toEqual(
      second.strategies.map((strategy) => strategy.metrics.max_drawdown),
    )
  })

  it('keeps hybrid drawdown lower than naive in stress-heavy mode', () => {
    const result = runClPloProof({
      steps: 80,
      stress_probability: 0.58,
      anchor_weight: 0.48,
      projection_limit: 0.56,
      seed: 29,
    })

    const naive = result.strategies.find((strategy) => strategy.id === 'naive')
    const hybrid = result.strategies.find((strategy) => strategy.id === 'hybrid')

    expect(naive).toBeDefined()
    expect(hybrid).toBeDefined()

    if (!naive || !hybrid) {
      return
    }

    expect(hybrid.metrics.max_drawdown).toBeLessThan(naive.metrics.max_drawdown)
  })
})
