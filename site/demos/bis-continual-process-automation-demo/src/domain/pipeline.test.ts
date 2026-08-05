import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildAutomationBlueprint } from './blueprint'
import { extractSignals } from './extract'
import { runIntakePipeline } from './pipeline'
import { buildAsIsMermaid, buildToBeMermaid } from './processMap'
import { CategoryCatalogSchema, IntakeSamplesSchema } from './schema'
import { triage } from './triage'

const demoRoot = resolve(process.cwd(), 'demos/bis-continual-process-automation-demo')
const samples = IntakeSamplesSchema.parse(
  JSON.parse(readFileSync(resolve(demoRoot, 'public/data/intake_samples.json'), 'utf-8')),
)
const catalog = CategoryCatalogSchema.parse(
  JSON.parse(readFileSync(resolve(demoRoot, 'public/data/category_catalog.json'), 'utf-8')),
)

const sample = samples[0]

describe('triage', () => {
  it('returns bounded values and deterministic output', () => {
    const extracted = extractSignals(sample.text)
    const first = triage(sample, extracted)
    const second = triage(sample, extracted)

    expect(first).toEqual(second)
    expect(first.automation_score).toBeGreaterThanOrEqual(0)
    expect(first.automation_score).toBeLessThanOrEqual(100)
    expect(first.est_savings_hours_per_month).toBeGreaterThan(0)
    expect(['P1', 'P2', 'P3']).toContain(first.priority)
  })
})

describe('process maps', () => {
  it('returns mermaid-like flowchart strings', () => {
    const extracted = extractSignals(sample.text)
    const triageResult = triage(sample, extracted)
    const category = catalog.categories.find((item) => item.id === triageResult.category)
    const asIs = buildAsIsMermaid(sample, triageResult, extracted)
    const toBe = buildToBeMermaid(
      sample,
      triageResult,
      category?.typical_automation_patterns ?? [],
    )

    expect(asIs.startsWith('flowchart')).toBe(true)
    expect(asIs.includes('-->')).toBe(true)
    expect(toBe.startsWith('flowchart')).toBe(true)
    expect(toBe.includes('-->')).toBe(true)
  })
})

describe('blueprint', () => {
  it('always includes controls and monitoring', () => {
    const extracted = extractSignals(sample.text)
    const triageResult = triage(sample, extracted)
    const category = catalog.categories.find((item) => item.id === triageResult.category)
    const blueprint = buildAutomationBlueprint(sample, triageResult, extracted, category)

    expect(blueprint.controls.length).toBeGreaterThan(0)
    expect(blueprint.monitoring.length).toBeGreaterThan(0)
    expect(blueprint.controls[0]).toHaveProperty('control')
    expect(blueprint.monitoring[0]).toHaveProperty('metric')
  })
})

describe('end-to-end pipeline', () => {
  it('returns triage, charter, maps, blueprint, and export payloads', () => {
    const output = runIntakePipeline(sample, catalog)
    expect(output.triage.automation_score).toBeGreaterThanOrEqual(0)
    expect(output.charter.problem_statement.length).toBeGreaterThan(10)
    expect(output.asIsMermaid.includes('flowchart')).toBe(true)
    expect(output.toBeMermaid.includes('flowchart')).toBe(true)
    expect(output.blueprint.steps.length).toBeGreaterThan(0)
    expect(output.exports).toHaveProperty('jira_issue_create')
    expect(output.exports).toHaveProperty('servicenow_record_create')
    expect(output.exports).toHaveProperty('process_tracker_row')
  })
})
