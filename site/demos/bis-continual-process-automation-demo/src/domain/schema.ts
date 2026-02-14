import { z } from 'zod'

import { intakeCategories, intakeChannels, riskLevels } from './types'

export const IntakeCategorySchema = z.enum(intakeCategories)
export const IntakeChannelSchema = z.enum(intakeChannels)
export const RiskLevelSchema = z.enum(riskLevels)

export const IntakeGroundTruthSchema = z.object({
  category: IntakeCategorySchema,
  risk_level: RiskLevelSchema,
  baseline_cycle_time_days: z.number().nonnegative().nullable(),
  volume_per_month: z.number().nonnegative().nullable(),
  key_systems: z.array(z.string().min(1)).min(1),
  suggested_kpis: z.array(z.string().min(1)).min(1),
})

export const IntakeSampleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  channel: IntakeChannelSchema,
  text: z.string().min(1),
  ground_truth: IntakeGroundTruthSchema,
})

export const IntakeSamplesSchema = z.array(IntakeSampleSchema).min(1)

export const CategoryDefinitionSchema = z.object({
  id: IntakeCategorySchema,
  description: z.string().min(1),
  typical_automation_patterns: z.array(z.string().min(1)).min(1),
})

export const CategoryCatalogSchema = z.object({
  categories: z.array(CategoryDefinitionSchema).min(1),
})
