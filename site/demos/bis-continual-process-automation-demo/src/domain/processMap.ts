import type { ExtractedSignals, IntakeSample, TriageResult } from './types'

/**
 * Build a compact as-is flow in Mermaid syntax.
 */
export function buildAsIsMermaid(
  sample: IntakeSample,
  triageResult: TriageResult,
  extracted: ExtractedSignals,
): string {
  void sample
  void triageResult
  void extracted

  return [
    'flowchart TD',
    '  A["Intake request"] --> B["Manual triage"]',
    '  B --> C["Collect missing data"]',
    '  C --> D["Approval chain"]',
    '  D --> E["Manual status updates"]',
    '  E --> F["Close request"]',
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
  void sample
  void triageResult
  void automationPatterns

  return [
    'flowchart TD',
    '  A["Unified intake form"] --> B["Auto-classify case"]',
    '  B --> C["Policy checks"]',
    '  C --> D["Automated routing"]',
    '  D --> E["SLA monitoring"]',
    '  E --> F["Auto updates and audit log"]',
  ].join('\n')
}
