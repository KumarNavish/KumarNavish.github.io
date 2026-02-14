import { buildAutomationBlueprint } from './blueprint'
import { buildCharter } from './charter'
import { extractSignals } from './extract'
import { buildExportPayloads } from './export'
import { buildAsIsMermaid, buildToBeMermaid } from './processMap'
import { triage } from './triage'
import type { CategoryCatalog, IntakeSample } from './types'

export interface PipelineResult {
  sample: IntakeSample
  extracted: ReturnType<typeof extractSignals>
  triage: ReturnType<typeof triage>
  charter: ReturnType<typeof buildCharter>
  asIsMermaid: string
  toBeMermaid: string
  blueprint: ReturnType<typeof buildAutomationBlueprint>
  exports: ReturnType<typeof buildExportPayloads>
}

/**
 * One-click deterministic pipeline from intake text to actionable artifacts.
 */
export function runIntakePipeline(
  sample: IntakeSample,
  catalog: CategoryCatalog,
): PipelineResult {
  const extracted = extractSignals(sample.text)
  const triageResult = triage(sample, extracted)
  const categoryDefinition = catalog.categories.find((item) => item.id === triageResult.category)
  const charter = buildCharter(sample, triageResult, extracted)
  const asIsMermaid = buildAsIsMermaid(sample, triageResult, extracted)
  const toBeMermaid = buildToBeMermaid(
    sample,
    triageResult,
    categoryDefinition?.typical_automation_patterns ?? [],
  )
  const blueprint = buildAutomationBlueprint(sample, triageResult, extracted, categoryDefinition)
  const exports = buildExportPayloads(sample, triageResult, charter, blueprint)

  return {
    sample,
    extracted,
    triage: triageResult,
    charter,
    asIsMermaid,
    toBeMermaid,
    blueprint,
    exports,
  }
}
