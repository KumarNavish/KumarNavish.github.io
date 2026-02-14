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
