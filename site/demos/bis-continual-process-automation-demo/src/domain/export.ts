import type {
  AutomationBlueprint,
  Charter,
  ExportPayloads,
  IntakeSample,
  TriageResult,
} from './types'

/**
 * Build copyable payloads compatible with internal ticketing/tracking integrations.
 */
export function buildExportPayloads(
  sample: IntakeSample,
  triageResult: TriageResult,
  charter: Charter,
  blueprint: AutomationBlueprint,
): ExportPayloads {
  return {
    jira_issue_create: {
      fields: {
        project: { key: 'BIS' },
        issuetype: { name: 'Task' },
        summary: `[Process Optimisation] ${sample.title}`,
        description: `Priority ${triageResult.priority}; automation score ${triageResult.automation_score}. Next action: ${triageResult.next_action}`,
        labels: ['process-optimisation', triageResult.category, triageResult.risk_level],
        customfield_risk_level: triageResult.risk_level,
      },
    },
    servicenow_record_create: {
      table: 'u_process_optimisation_intake',
      payload: {
        short_description: sample.title,
        category: triageResult.category,
        priority: triageResult.priority,
        risk_level: triageResult.risk_level,
        baseline_cycle_time_days: charter.baseline_metrics.cycle_time_days,
        proposed_blueprint_steps: blueprint.steps.length,
      },
    },
    process_tracker_row: {
      intake_id: sample.id,
      title: sample.title,
      category: triageResult.category,
      priority: triageResult.priority,
      risk_level: triageResult.risk_level,
      automation_score: triageResult.automation_score,
      est_savings_hours_per_month: triageResult.est_savings_hours_per_month,
      owner: 'BIS Process Optimisation CoE',
      status: 'Proposed',
    },
  }
}
