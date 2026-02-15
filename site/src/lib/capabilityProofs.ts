interface SafetyItem {
  harmful: boolean
  score: number
}

export interface SafetyProofInput {
  threshold: number
  intervention_budget: number
}

export interface SafetyProofResult {
  precision: number
  recall: number
  intervention_rate: number
  prevented_harmful: number
  false_alarms: number
  recommendation: string
}

export interface RolloutProofInput {
  readiness_weight: number
  cost_weight: number
  risk_weight: number
}

export interface RolloutRegionResult {
  name: string
  score: number
  readiness: number
  cost_pressure: number
  transition_risk: number
}

export interface RolloutProofResult {
  ranked_regions: RolloutRegionResult[]
  top_sequence: string[]
  stability_score: number
  expected_cost_pressure: number
}

interface RolloutRegion {
  name: string
  readiness: number
  cost_pressure: number
  transition_risk: number
}

const SAFETY_DATASET: SafetyItem[] = buildSafetyDataset(240, 19)

const ROLLOUT_REGIONS: RolloutRegion[] = [
  { name: 'Basel Core', readiness: 0.82, cost_pressure: 0.58, transition_risk: 0.34 },
  { name: 'Rhine North', readiness: 0.71, cost_pressure: 0.42, transition_risk: 0.29 },
  { name: 'Industrial East', readiness: 0.61, cost_pressure: 0.36, transition_risk: 0.52 },
  { name: 'University Ring', readiness: 0.77, cost_pressure: 0.55, transition_risk: 0.31 },
  { name: 'Airport Belt', readiness: 0.56, cost_pressure: 0.44, transition_risk: 0.58 },
  { name: 'Suburban South', readiness: 0.68, cost_pressure: 0.47, transition_risk: 0.37 },
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function createRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function buildSafetyDataset(size: number, seed: number): SafetyItem[] {
  const rng = createRng(seed)
  const rows: SafetyItem[] = []

  for (let index = 0; index < size; index += 1) {
    const harmful = rng() < 0.33
    const baseScore = harmful ? 0.48 + rng() * 0.5 : 0.05 + rng() * 0.65
    const hardCasePenalty = harmful && rng() < 0.26 ? 0.22 : 0
    const score = clamp(baseScore - hardCasePenalty, 0.01, 0.99)

    rows.push({
      harmful,
      score,
    })
  }

  return rows
}

function safeDivide(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0
  }
  return numerator / denominator
}

export function runSafetyProof(rawInput: SafetyProofInput): SafetyProofResult {
  const threshold = clamp(rawInput.threshold, 0.35, 0.88)
  const budget = clamp(rawInput.intervention_budget, 0.08, 0.5)

  const budgetCount = Math.max(1, Math.floor(SAFETY_DATASET.length * budget))
  const ranked = [...SAFETY_DATASET].sort((left, right) => right.score - left.score)
  const selected = new Set(ranked.slice(0, budgetCount))

  let truePositive = 0
  let falsePositive = 0
  let harmfulTotal = 0

  for (const item of SAFETY_DATASET) {
    const thresholdFlag = item.score >= threshold
    const budgetFlag = selected.has(item)
    const predictedIntervention = thresholdFlag && budgetFlag

    if (item.harmful) {
      harmfulTotal += 1
      if (predictedIntervention) {
        truePositive += 1
      }
    } else if (predictedIntervention) {
      falsePositive += 1
    }
  }

  const precision = safeDivide(truePositive, truePositive + falsePositive)
  const recall = safeDivide(truePositive, harmfulTotal)
  const interventionRate = safeDivide(truePositive + falsePositive, SAFETY_DATASET.length)

  const recommendation =
    recall >= 0.62 && precision >= 0.67
      ? 'Deploy this threshold profile for pilot monitoring.'
      : recall < 0.62
        ? 'Increase intervention coverage to catch more harmful escalation early.'
        : 'Tighten threshold to reduce false positives before rollout.'

  return {
    precision,
    recall,
    intervention_rate: interventionRate,
    prevented_harmful: truePositive,
    false_alarms: falsePositive,
    recommendation,
  }
}

function normalizeWeights(input: RolloutProofInput): RolloutProofInput {
  const r = Math.max(input.readiness_weight, 0)
  const c = Math.max(input.cost_weight, 0)
  const k = Math.max(input.risk_weight, 0)
  const sum = r + c + k

  if (sum <= 1e-8) {
    return {
      readiness_weight: 1 / 3,
      cost_weight: 1 / 3,
      risk_weight: 1 / 3,
    }
  }

  return {
    readiness_weight: r / sum,
    cost_weight: c / sum,
    risk_weight: k / sum,
  }
}

export function runRolloutProof(input: RolloutProofInput): RolloutProofResult {
  const normalized = normalizeWeights(input)

  const ranked = ROLLOUT_REGIONS.map((region) => {
    const score =
      normalized.readiness_weight * region.readiness +
      normalized.cost_weight * (1 - region.cost_pressure) +
      normalized.risk_weight * (1 - region.transition_risk)

    return {
      name: region.name,
      score,
      readiness: region.readiness,
      cost_pressure: region.cost_pressure,
      transition_risk: region.transition_risk,
    }
  }).sort((left, right) => right.score - left.score)

  const top = ranked.slice(0, 3)
  const stability = top.reduce((sum, region) => sum + (region.readiness - region.transition_risk), 0) /
    Math.max(1, top.length)
  const expectedCostPressure = top.reduce((sum, region) => sum + region.cost_pressure, 0) /
    Math.max(1, top.length)

  return {
    ranked_regions: ranked,
    top_sequence: top.map((region) => region.name),
    stability_score: stability,
    expected_cost_pressure: expectedCostPressure,
  }
}
