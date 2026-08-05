export interface LastMileInput {
  demand_volatility: number
  bike_lane_coverage: number
  service_level_target: number
}

export interface LastMileRegionPlan {
  name: string
  readiness_score: number
  transition_risk: number
}

export interface LastMilePlanResult {
  bike_share: number
  van_share: number
  expected_reliability: number
  cost_delta_vs_van_baseline: number
  emissions_reduction: number
  first_wave: string[]
  ranked_regions: LastMileRegionPlan[]
  rationale: string
}

interface RegionProfile {
  name: string
  street_fit: number
  distance_pressure: number
  volatility_sensitivity: number
  service_sensitivity: number
}

const REGION_PROFILES: RegionProfile[] = [
  {
    name: 'Basel Core',
    street_fit: 0.86,
    distance_pressure: 0.34,
    volatility_sensitivity: 0.28,
    service_sensitivity: 0.22,
  },
  {
    name: 'Rhine North',
    street_fit: 0.73,
    distance_pressure: 0.38,
    volatility_sensitivity: 0.32,
    service_sensitivity: 0.28,
  },
  {
    name: 'University Ring',
    street_fit: 0.81,
    distance_pressure: 0.41,
    volatility_sensitivity: 0.3,
    service_sensitivity: 0.27,
  },
  {
    name: 'Industrial East',
    street_fit: 0.57,
    distance_pressure: 0.62,
    volatility_sensitivity: 0.49,
    service_sensitivity: 0.44,
  },
  {
    name: 'Airport Belt',
    street_fit: 0.46,
    distance_pressure: 0.71,
    volatility_sensitivity: 0.52,
    service_sensitivity: 0.47,
  },
  {
    name: 'Suburban South',
    street_fit: 0.63,
    distance_pressure: 0.55,
    volatility_sensitivity: 0.39,
    service_sensitivity: 0.34,
  },
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function simulateLastMilePlan(rawInput: LastMileInput): LastMilePlanResult {
  const demandVolatility = clamp(rawInput.demand_volatility, 0, 1)
  const bikeLaneCoverage = clamp(rawInput.bike_lane_coverage, 0, 1)
  const serviceLevelTarget = clamp(rawInput.service_level_target, 0.9, 0.99)

  const targetPressure = clamp((serviceLevelTarget - 0.9) / 0.09, 0, 1)

  const rankedRegions = REGION_PROFILES.map((region) => {
    const bikePotential =
      0.62 * bikeLaneCoverage + 0.22 * region.street_fit + 0.16 * (1 - region.distance_pressure)
    const volatilityPenalty = demandVolatility * region.volatility_sensitivity
    const serviceBuffer = clamp(1 - targetPressure * region.service_sensitivity, 0, 1)

    const readinessScore =
      0.44 * bikePotential + 0.34 * serviceBuffer + 0.22 * (1 - volatilityPenalty)
    const transitionRisk = clamp(0.55 * volatilityPenalty + 0.45 * (1 - bikePotential), 0, 1)

    return {
      name: region.name,
      readiness_score: readinessScore,
      transition_risk: transitionRisk,
      bikePotential,
      serviceBuffer,
    }
  }).sort(
    (left, right) =>
      right.readiness_score - left.readiness_score || left.name.localeCompare(right.name),
  )

  const firstWave = rankedRegions.slice(0, 3)
  const avgBikePotential =
    firstWave.reduce((sum, region) => sum + region.bikePotential, 0) / Math.max(firstWave.length, 1)
  const avgServiceBuffer =
    firstWave.reduce((sum, region) => sum + region.serviceBuffer, 0) / Math.max(firstWave.length, 1)
  const avgReadiness =
    firstWave.reduce((sum, region) => sum + region.readiness_score, 0) / Math.max(firstWave.length, 1)

  const bikeShare = clamp(
    0.28 + 0.52 * bikeLaneCoverage + 0.2 * avgBikePotential - 0.22 * demandVolatility - 0.18 * targetPressure,
    0.15,
    0.82,
  )
  const vanShare = 1 - bikeShare

  const expectedReliability = clamp(
    0.9 + 0.06 * avgServiceBuffer + 0.03 * (1 - demandVolatility) - 0.03 * (1 - avgReadiness),
    0.86,
    0.99,
  )

  const costDelta = clamp(
    -0.12 * bikeShare + 0.09 * demandVolatility + 0.05 * targetPressure,
    -0.15,
    0.14,
  )

  const emissionsReduction = clamp(
    0.18 + 0.58 * bikeShare + 0.12 * bikeLaneCoverage - 0.08 * demandVolatility,
    0.08,
    0.72,
  )

  const rationale =
    demandVolatility > 0.62
      ? 'High volatility shifts first-wave priority toward regions with stronger service buffers.'
      : bikeLaneCoverage > 0.65
        ? 'High lane coverage supports a bike-heavy first wave with lower transition risk.'
        : 'Balanced conditions favor phased rollout through mixed-readiness regions first.'

  return {
    bike_share: bikeShare,
    van_share: vanShare,
    expected_reliability: expectedReliability,
    cost_delta_vs_van_baseline: costDelta,
    emissions_reduction: emissionsReduction,
    first_wave: firstWave.map((region) => region.name),
    ranked_regions: rankedRegions.map((region) => ({
      name: region.name,
      readiness_score: region.readiness_score,
      transition_risk: region.transition_risk,
    })),
    rationale,
  }
}
