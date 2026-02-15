import { describe, expect, it } from 'vitest'

import { simulateLastMilePlan } from './lastMileSimulator'

describe('simulateLastMilePlan', () => {
  it('is deterministic for a fixed input', () => {
    const input = {
      demand_volatility: 0.4,
      bike_lane_coverage: 0.58,
      service_level_target: 0.95,
    }

    const first = simulateLastMilePlan(input)
    const second = simulateLastMilePlan(input)

    expect(first).toEqual(second)
  })

  it('increases bike share and emissions reduction when lane coverage improves', () => {
    const lowCoverage = simulateLastMilePlan({
      demand_volatility: 0.35,
      bike_lane_coverage: 0.35,
      service_level_target: 0.95,
    })
    const highCoverage = simulateLastMilePlan({
      demand_volatility: 0.35,
      bike_lane_coverage: 0.82,
      service_level_target: 0.95,
    })

    expect(highCoverage.bike_share).toBeGreaterThan(lowCoverage.bike_share)
    expect(highCoverage.emissions_reduction).toBeGreaterThan(lowCoverage.emissions_reduction)
  })

  it('reduces reliability when demand volatility is higher', () => {
    const stable = simulateLastMilePlan({
      demand_volatility: 0.2,
      bike_lane_coverage: 0.6,
      service_level_target: 0.95,
    })
    const volatile = simulateLastMilePlan({
      demand_volatility: 0.75,
      bike_lane_coverage: 0.6,
      service_level_target: 0.95,
    })

    expect(volatile.expected_reliability).toBeLessThan(stable.expected_reliability)
  })
})
