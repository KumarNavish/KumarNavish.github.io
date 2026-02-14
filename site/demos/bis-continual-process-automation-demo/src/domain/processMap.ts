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
    'flowchart LR',
    `  A["${sample.channel} intake request"] --> B["Manual triage (${triageResult.category})"]`,
    `  B --> C["Data chase in email/spreadsheets (${extracted.manual_step_count} touchpoints)"]`,
    `  C --> D["Approvals (${toNodeList(extracted.approval_roles)})"]`,
    '  D --> E["Manual status updates across systems"]',
    '  E --> F["Completion with limited audit visibility"]',
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
    'flowchart LR',
    `  A["Unified intake (${sample.channel})"] --> B["Auto-classify: ${triageResult.category}"]`,
    `  B --> C["Policy and completeness checks"]`,
    `  C --> D["${patternLine}"]`,
    '  D --> E["SLA timers + escalations"]',
    '  E --> F["Closed-loop updates + audit log"]',
  ].join('\n')
}
