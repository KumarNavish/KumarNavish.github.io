import type { Charter, ExtractedSignals, IntakeSample, TriageResult } from './types'

function buildStakeholders(sample: IntakeSample, extracted: ExtractedSignals): string[] {
  const stakeholders = new Set<string>([
    'Process Optimisation Lead',
    'Business Process Owner',
    'Operations Manager',
  ])

  for (const role of extracted.approval_roles) {
    stakeholders.add(role)
  }
  for (const system of extracted.key_systems) {
    stakeholders.add(`${system} System Owner`)
  }

  return Array.from(stakeholders)
}

/**
 * Build a compact DMAIC-style charter from intake plus triage.
 */
export function buildCharter(
  sample: IntakeSample,
  triageResult: TriageResult,
  extracted: ExtractedSignals,
): Charter {
  const baselineCycle =
    extracted.cycle_time_days ?? sample.ground_truth.baseline_cycle_time_days ?? null
  const baselineVolume =
    extracted.volume_per_month ?? sample.ground_truth.volume_per_month ?? null
  const targetCycle =
    baselineCycle === null ? null : Math.max(1, Math.round(baselineCycle * 0.6))
  const targetManualTouches = Math.max(1, extracted.manual_step_count - 2)

  return {
    problem_statement: `${sample.title}: manual handoffs and incomplete intake data increase lead time and rework.`,
    scope_in: [
      'Intake capture and normalization',
      'Approval and routing orchestration',
      'Status notifications and SLA follow-up',
    ],
    scope_out: [
      'Core ERP re-platforming',
      'Policy redesign outside intake workflow',
      'Downstream vendor or HR master-data model changes',
    ],
    stakeholders: buildStakeholders(sample, extracted),
    baseline_metrics: {
      cycle_time_days: baselineCycle,
      volume_per_month: baselineVolume,
      manual_handoffs_estimate: extracted.manual_step_count,
      risk_level: triageResult.risk_level,
    },
    target_metrics: {
      cycle_time_days_target: targetCycle,
      manual_handoffs_target: targetManualTouches,
      automation_score_target: Math.min(100, triageResult.automation_score + 8),
      expected_savings_hours_per_month: triageResult.est_savings_hours_per_month,
    },
    constraints_controls: [
      'Audit trail required for every approval transition',
      'Role-based access and segregation-of-duties checks',
      'Policy and compliance validation before final closure',
    ],
    dmaic_next_steps: [
      { phase: 'Define', action: 'Confirm process owner, objective, and SIPOC boundaries.' },
      { phase: 'Measure', action: 'Baseline lead-time and handoff defects over last 8 weeks.' },
      { phase: 'Analyze', action: 'Identify top delay causes by queue stage and approver role.' },
      { phase: 'Improve', action: triageResult.next_action },
      { phase: 'Control', action: 'Publish SLA dashboard with weekly exception review cadence.' },
    ],
  }
}
