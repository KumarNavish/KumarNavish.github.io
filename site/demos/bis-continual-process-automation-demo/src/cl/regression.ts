import { intakeCategories, type IntakeCategory, type IntakeSample } from '../domain/types'
import type { OnlineCategoryModel } from './onlineModel'

export interface CategoryAccuracy {
  correct: number
  total: number
  accuracy: number
}

export interface RegressionMetrics {
  overall_accuracy: number
  per_category: Record<IntakeCategory, CategoryAccuracy>
}

export interface RegressionSnapshot {
  step: string
  metrics: RegressionMetrics
}

export interface RegressionDelta {
  overall_delta: number
  per_category_drop: Record<IntakeCategory, number>
  mean_drop: number
}

function emptyPerCategory(): Record<IntakeCategory, CategoryAccuracy> {
  return Object.fromEntries(
    intakeCategories.map((category) => [category, { correct: 0, total: 0, accuracy: 0 }]),
  ) as Record<IntakeCategory, CategoryAccuracy>
}

export function evaluate(
  samples: Array<{ text: string; label: IntakeCategory }>,
  model: Pick<OnlineCategoryModel, 'predict'>,
): RegressionMetrics {
  const perCategory = emptyPerCategory()
  let total = 0
  let correct = 0

  for (const sample of samples) {
    const predicted = model.predict(sample.text)
    total += 1
    if (predicted === sample.label) {
      correct += 1
      perCategory[sample.label].correct += 1
    }
    perCategory[sample.label].total += 1
  }

  for (const category of intakeCategories) {
    const item = perCategory[category]
    item.accuracy = item.total === 0 ? 0 : item.correct / item.total
  }

  return {
    overall_accuracy: total === 0 ? 0 : correct / total,
    per_category: perCategory,
  }
}

export function evaluateIntakeSamples(
  samples: IntakeSample[],
  model: Pick<OnlineCategoryModel, 'predict'>,
): RegressionMetrics {
  return evaluate(
    samples.map((sample) => ({ text: sample.text, label: sample.ground_truth.category })),
    model,
  )
}

export function regressionDelta(history: RegressionSnapshot[]): RegressionDelta {
  const latest = history[history.length - 1]
  if (!latest) {
    return {
      overall_delta: 0,
      per_category_drop: Object.fromEntries(intakeCategories.map((item) => [item, 0])) as Record<
        IntakeCategory,
        number
      >,
      mean_drop: 0,
    }
  }

  const perCategoryDrop = Object.fromEntries(intakeCategories.map((item) => [item, 0])) as Record<
    IntakeCategory,
    number
  >

  for (const category of intakeCategories) {
    let historicalBest = latest.metrics.per_category[category].accuracy
    for (let i = 0; i < history.length - 1; i += 1) {
      historicalBest = Math.max(historicalBest, history[i].metrics.per_category[category].accuracy)
    }
    perCategoryDrop[category] = Math.max(
      0,
      historicalBest - latest.metrics.per_category[category].accuracy,
    )
  }

  const meanDrop =
    intakeCategories.reduce((acc, category) => acc + perCategoryDrop[category], 0) /
    intakeCategories.length

  return {
    overall_delta: latest.metrics.overall_accuracy - history[0].metrics.overall_accuracy,
    per_category_drop: perCategoryDrop,
    mean_drop: meanDrop,
  }
}
