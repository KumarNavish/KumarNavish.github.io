import type { ExtractedSignals, IntakeCategory, IntakeSample, RiskLevel, TriageResult } from './types'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function inferCategory(sample: IntakeSample, extracted: ExtractedSignals): IntakeCategory {
  const text = sample.text.toLowerCase()
  if (/\bvendor|supplier|kyc|sanctions|onboarding\b/.test(text)) {
    return 'vendor_onboarding_compliance'
  }
  if (/\baccess|provision|iam|role bundle|day-one\b/.test(text)) {
    return 'access_provisioning'
  }
  if (/\breport|kpi|board pack|dashboard|monthly\b/.test(text)) {
    return 'monthly_reporting'
  }
  if (/\bincident|severity|on-call|pager|handoff\b/.test(text)) {
    return 'incident_escalation'
  }
  if (/\btravel|expense|reimbursement|concur\b/.test(text)) {
    return 'travel_expense_approvals'
  }
  if (/\bprocurement|purchase|capex|budget\b/.test(text)) {
    return 'procurement_approvals'
  }

  if (extracted.pain_keywords.includes('escalation')) {
    return 'incident_escalation'
  }

  return sample.ground_truth.category
}

function riskToWeight(risk: RiskLevel): number {
  if (risk === 'high') {
    return 15
  }
  if (risk === 'medium') {
    return 10
  }
  return 5
}

function chooseNextAction(category: IntakeCategory): string {
  const actionMap: Record<IntakeCategory, string> = {
    procurement_approvals:
      'Launch standardized intake form and SLA escalation workflow for approval chain.',
    vendor_onboarding_compliance:
      'Implement stage-gated onboarding packet with auto-validation and risk routing.',
    access_provisioning:
      'Deploy role-based approval automation with IAM-ticket status synchronization.',
    monthly_reporting:
      'Set up scheduled data consolidation with exception checks and publish checklist.',
    incident_escalation:
      'Apply severity-driven escalation playbook with timer-based notifications.',
    travel_expense_approvals:
      'Add policy rule checks at intake and automated missing-receipt nudges.',
  }
  return actionMap[category]
}

/**
 * Deterministic triage for first-pass process optimisation prioritization.
 */
export function triage(sample: IntakeSample, extracted: ExtractedSignals): TriageResult {
  const category = inferCategory(sample, extracted)
  const inferredVolume = extracted.volume_per_month ?? sample.ground_truth.volume_per_month ?? 12
  const inferredCycle = extracted.cycle_time_days ?? sample.ground_truth.baseline_cycle_time_days ?? 4

  const volumeScore = clamp((inferredVolume / 120) * 30, 0, 30)
  const cycleScore = clamp((inferredCycle / 20) * 25, 0, 25)
  const manualScore = clamp(extracted.manual_step_count * 6, 6, 30)
  const automationScore = Math.round(
    clamp(
      volumeScore + cycleScore + manualScore + riskToWeight(sample.ground_truth.risk_level),
      0,
      100,
    ),
  )

  const priority: TriageResult['priority'] =
    automationScore >= 75 ? 'P1' : automationScore >= 45 ? 'P2' : 'P3'

  const savings = Math.round(
    clamp((extracted.manual_step_count * 0.8 + inferredCycle * 0.3) * (inferredVolume / 10), 4, 400),
  )

  return {
    category,
    priority,
    risk_level: sample.ground_truth.risk_level,
    automation_score: automationScore,
    next_action: chooseNextAction(category),
    est_savings_hours_per_month: savings,
  }
}
