export const intakeCategories = [
  'procurement_approvals',
  'vendor_onboarding_compliance',
  'access_provisioning',
  'monthly_reporting',
  'incident_escalation',
  'travel_expense_approvals',
] as const

export type IntakeCategory = (typeof intakeCategories)[number]

export const intakeChannels = ['ticket', 'email', 'workshop_note'] as const
export type IntakeChannel = (typeof intakeChannels)[number]

export const riskLevels = ['low', 'medium', 'high'] as const
export type RiskLevel = (typeof riskLevels)[number]

export interface IntakeGroundTruth {
  category: IntakeCategory
  risk_level: RiskLevel
  baseline_cycle_time_days: number | null
  volume_per_month: number | null
  key_systems: string[]
  suggested_kpis: string[]
}

export interface IntakeSample {
  id: string
  title: string
  channel: IntakeChannel
  text: string
  ground_truth: IntakeGroundTruth
}

export interface CategoryDefinition {
  id: IntakeCategory
  description: string
  typical_automation_patterns: string[]
}

export interface CategoryCatalog {
  categories: CategoryDefinition[]
}

export interface ExtractedSignals {
  cycle_time_days: number | null
  volume_per_month: number | null
  key_systems: string[]
  approval_roles: string[]
  pain_keywords: string[]
  manual_step_count: number
  mentions_sla: boolean
  controls_keywords: string[]
}

export type PriorityBand = 'P1' | 'P2' | 'P3'

export interface TriageResult {
  category: IntakeCategory
  priority: PriorityBand
  risk_level: RiskLevel
  automation_score: number
  next_action: string
  est_savings_hours_per_month: number
}

export interface Charter {
  problem_statement: string
  scope_in: string[]
  scope_out: string[]
  stakeholders: string[]
  baseline_metrics: Record<string, number | string | null>
  target_metrics: Record<string, number | string | null>
  constraints_controls: string[]
  dmaic_next_steps: Array<{
    phase: 'Define' | 'Measure' | 'Analyze' | 'Improve' | 'Control'
    action: string
  }>
}

export interface BlueprintStep {
  id: string
  name: string
  type: 'validation' | 'approval' | 'routing' | 'notification' | 'update'
  description: string
}

export interface AutomationBlueprint {
  process_category: IntakeCategory
  objective: string
  triggers: Array<{ type: string; description: string }>
  connectors: Array<{ system: string; purpose: string }>
  steps: BlueprintStep[]
  controls: Array<{ control: string; description: string }>
  monitoring: Array<{ metric: string; target: string; alert_condition: string }>
}

export interface ExportPayloads {
  jira_issue_create: Record<string, unknown>
  servicenow_record_create: Record<string, unknown>
  process_tracker_row: Record<string, unknown>
}
