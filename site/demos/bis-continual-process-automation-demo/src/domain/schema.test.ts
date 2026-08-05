import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { CategoryCatalogSchema, IntakeSamplesSchema } from './schema'
import { intakeCategories } from './types'

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

describe('BIS intake dataset validation', () => {
  const demoRoot = resolve(process.cwd(), 'demos/bis-continual-process-automation-demo')
  const intakePath = resolve(demoRoot, 'public/data/intake_samples.json')
  const catalogPath = resolve(demoRoot, 'public/data/category_catalog.json')

  it('parses intake samples with strict schema', () => {
    const parsed = IntakeSamplesSchema.parse(readJson(intakePath))
    expect(parsed.length).toBeGreaterThanOrEqual(10)
    expect(parsed.length).toBeLessThanOrEqual(12)
  })

  it('keeps category enum and sample categories consistent', () => {
    const samples = IntakeSamplesSchema.parse(readJson(intakePath))
    const catalog = CategoryCatalogSchema.parse(readJson(catalogPath))
    const expected = new Set(intakeCategories)

    expect(catalog.categories).toHaveLength(intakeCategories.length)
    for (const category of catalog.categories) {
      expect(expected.has(category.id)).toBe(true)
    }

    for (const sample of samples) {
      expect(expected.has(sample.ground_truth.category)).toBe(true)
    }
  })
})
