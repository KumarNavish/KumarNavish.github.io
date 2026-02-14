import type { ExtractedSignals } from './types'

const SYSTEM_ALIASES: Array<{ pattern: RegExp; normalized: string }> = [
  { pattern: /\bjira service management\b/i, normalized: 'Jira Service Management' },
  { pattern: /\bjira\b/i, normalized: 'Jira' },
  { pattern: /\bservicenow\b/i, normalized: 'ServiceNow' },
  { pattern: /\bsap\b/i, normalized: 'SAP' },
  { pattern: /\boutlook\b/i, normalized: 'Outlook' },
  { pattern: /\bteams\b/i, normalized: 'Teams' },
  { pattern: /\bokta\b/i, normalized: 'Okta' },
  { pattern: /\bworkday\b/i, normalized: 'Workday' },
  { pattern: /\bazure ad\b/i, normalized: 'Azure AD' },
  { pattern: /\bsalesforce\b/i, normalized: 'Salesforce' },
  { pattern: /\bconcur\b/i, normalized: 'Concur' },
  { pattern: /\bpower bi\b/i, normalized: 'Power BI' },
  { pattern: /\bsharepoint\b/i, normalized: 'SharePoint' },
  { pattern: /\bpagerduty\b/i, normalized: 'PagerDuty' },
  { pattern: /\bopsgenie\b/i, normalized: 'Opsgenie' },
  { pattern: /\bexcel\b/i, normalized: 'Excel' },
  { pattern: /\bcoupa\b/i, normalized: 'Coupa' },
  { pattern: /\bariba\b/i, normalized: 'Ariba' },
  { pattern: /\bdocusign\b/i, normalized: 'DocuSign' },
  { pattern: /\bpower automate\b/i, normalized: 'Power Automate' },
]

const APPROVAL_ROLE_PATTERNS: Array<{ pattern: RegExp; role: string }> = [
  { pattern: /\bmanager\b/i, role: 'Manager' },
  { pattern: /\bfinance\b/i, role: 'Finance' },
  { pattern: /\bcompliance\b/i, role: 'Compliance' },
  { pattern: /\blegal\b/i, role: 'Legal' },
  { pattern: /\brisk\b/i, role: 'Risk Team' },
  { pattern: /\bsecurity\b/i, role: 'Security' },
  { pattern: /\biam\b/i, role: 'IAM' },
  { pattern: /\bapp owner\b/i, role: 'Application Owner' },
]

const PAIN_PATTERNS: Array<{ pattern: RegExp; keyword: string }> = [
  { pattern: /\bstall|stalling|delayed|delay\b/i, keyword: 'delay' },
  { pattern: /\bback[- ]and[- ]forth\b/i, keyword: 'back_and_forth' },
  { pattern: /\bmanual|manually\b/i, keyword: 'manual_work' },
  { pattern: /\bcopy|paste|spreadsheet\b/i, keyword: 'rekeying' },
  { pattern: /\bmissing|incomplete\b/i, keyword: 'missing_fields' },
  { pattern: /\bescalat/i, keyword: 'escalation' },
  { pattern: /\bconfus/i, keyword: 'ownership_confusion' },
]

const CONTROL_PATTERNS: Array<{ pattern: RegExp; keyword: string }> = [
  { pattern: /\baudit\b/i, keyword: 'audit' },
  { pattern: /\bpolicy\b/i, keyword: 'policy' },
  { pattern: /\bcompliance\b/i, keyword: 'compliance' },
  { pattern: /\bapproval\b/i, keyword: 'approval_control' },
  { pattern: /\bsegregation\b|\bsod\b/i, keyword: 'segregation_of_duties' },
]

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))
}

function inferCycleTimeDays(text: string): number | null {
  const rangeMatch = text.match(/(\d+)\s*(?:to|-)\s*(\d+)\s*days?/i)
  if (rangeMatch) {
    const low = Number(rangeMatch[1])
    const high = Number(rangeMatch[2])
    if (!Number.isNaN(low) && !Number.isNaN(high)) {
      return Math.round((low + high) / 2)
    }
  }

  const singularMatch = text.match(/(\d+)\s*days?/i)
  if (singularMatch) {
    const value = Number(singularMatch[1])
    return Number.isNaN(value) ? null : value
  }

  return null
}

function inferVolumePerMonth(text: string): number | null {
  const monthlyMatch = text.match(/(\d+)\s*(?:per|\/)\s*month/i)
  if (monthlyMatch) {
    const value = Number(monthlyMatch[1])
    return Number.isNaN(value) ? null : value
  }

  const batchMatch = text.match(/(\d+)\s*requests?\s*(?:a|per)\s*month/i)
  if (batchMatch) {
    const value = Number(batchMatch[1])
    return Number.isNaN(value) ? null : value
  }

  return null
}

/**
 * Deterministic extraction from free-text intake notes.
 */
export function extractSignals(requestText: string): ExtractedSignals {
  const text = requestText.toLowerCase()

  const keySystems = SYSTEM_ALIASES.flatMap((item) =>
    item.pattern.test(requestText) ? [item.normalized] : [],
  )

  const approvalRoles = APPROVAL_ROLE_PATTERNS.flatMap((item) =>
    item.pattern.test(requestText) ? [item.role] : [],
  )

  const painKeywords = PAIN_PATTERNS.flatMap((item) =>
    item.pattern.test(requestText) ? [item.keyword] : [],
  )

  const controls = CONTROL_PATTERNS.flatMap((item) =>
    item.pattern.test(requestText) ? [item.keyword] : [],
  )

  const manualPatternHits =
    (text.match(/manual|manually|copy|paste|spreadsheet|email|chase|re-enter/g) ?? [])
      .length
  const manualStepCount = Math.max(1, manualPatternHits)

  return {
    cycle_time_days: inferCycleTimeDays(requestText),
    volume_per_month: inferVolumePerMonth(requestText),
    key_systems: uniqueSorted(keySystems),
    approval_roles: uniqueSorted(approvalRoles),
    pain_keywords: uniqueSorted(painKeywords),
    manual_step_count: manualStepCount,
    mentions_sla:
      /\bsla\b|deadline|turnaround|on-time|late\b|day-one\b/i.test(requestText),
    controls_keywords: uniqueSorted(controls),
  }
}
