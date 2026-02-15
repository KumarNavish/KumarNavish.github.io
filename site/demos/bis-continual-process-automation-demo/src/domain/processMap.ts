import type { ExtractedSignals, IntakeSample, TriageResult } from './types'

function toNodeList(roles: string[]): string {
  if (roles.length === 0) {
    return 'Approver'
  }
  return roles.join(' + ')
}

/**
 * Build a compact as-is flow in Mermaid syntax.
 */
export function buildAsIsMermaid(
  sample: IntakeSample,
  triageResult: TriageResult,
  extracted: ExtractedSignals,
): string {
  return [
    'flowchart TD',
    `  A["${sample.channel} intake request"] --> B["Manual triage\\n${triageResult.category}"]`,
    `  B --> C["Data chase\\nemail/spreadsheets\\n${extracted.manual_step_count} touchpoints"]`,
    `  C --> D["Approvals\\n${toNodeList(extracted.approval_roles)}"]`,
    '  D --> E["Manual status updates\\nacross systems"]',
    '  E --> F["Completion\\nlimited audit visibility"]',
  ].join('\n')
}

/**
 * Build a compact to-be flow in Mermaid syntax using recommended automation patterns.
 */
export function buildToBeMermaid(
  sample: IntakeSample,
  triageResult: TriageResult,
  automationPatterns: string[],
): string {
  const patternLine = automationPatterns.slice(0, 2).join(' + ') || 'Automated routing'

  return [
    'flowchart TD',
    `  A["Unified intake\\n${sample.channel}"] --> B["Auto-classify\\n${triageResult.category}"]`,
    `  B --> C["Policy + completeness\\nchecks"]`,
    `  C --> D["${patternLine}"]`,
    '  D --> E["SLA timers\\n+ escalations"]',
    '  E --> F["Closed-loop updates\\n+ audit log"]',
  ].join('\n')
}
