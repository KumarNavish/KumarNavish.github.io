import type {
  AutomationBlueprint,
  CategoryDefinition,
  ExtractedSignals,
  IntakeSample,
  TriageResult,
} from './types'

function connectorsFromSignals(sample: IntakeSample, extracted: ExtractedSignals) {
  const systems = new Set<string>(sample.ground_truth.key_systems)
  for (const system of extracted.key_systems) {
    systems.add(system)
  }

  return Array.from(systems).map((system) => ({
    system,
    purpose: 'Read/write workflow status and approval context.',
  }))
}

/**
 * Build an automation blueprint shaped for internal implementation planning.
 */
export function buildAutomationBlueprint(
  sample: IntakeSample,
  triageResult: TriageResult,
  extracted: ExtractedSignals,
  categoryDefinition: CategoryDefinition | undefined,
): AutomationBlueprint {
  const patterns = categoryDefinition?.typical_automation_patterns ?? []

  return {
    process_category: triageResult.category,
    objective: `Reduce delay and rework for "${sample.title}" while preserving audit and approval controls.`,
    triggers: [
      { type: 'intake_submitted', description: `${sample.channel} request captured in intake queue.` },
      { type: 'sla_threshold', description: 'Escalate when stage timer breaches SLA target.' },
    ],
    connectors: connectorsFromSignals(sample, extracted),
    steps: [
      {
        id: 'S1',
        name: 'Normalize request',
        type: 'validation',
        description: 'Extract mandatory fields and check completeness.',
      },
      {
        id: 'S2',
        name: 'Route approvals',
        type: 'approval',
        description: `Apply category-aware approval flow for ${triageResult.category}.`,
      },
      {
        id: 'S3',
        name: 'Apply automation pattern',
        type: 'routing',
        description: patterns[0] ?? 'Rule-based routing and task assignment.',
      },
      {
        id: 'S4',
        name: 'Notify stakeholders',
        type: 'notification',
        description: 'Send status updates and next-action prompts.',
      },
      {
        id: 'S5',
        name: 'Sync record status',
        type: 'update',
        description: 'Write final state to tracker and close related work items.',
      },
    ],
    controls: [
      { control: 'Audit log', description: 'Log all transitions with actor and timestamp.' },
      {
        control: 'Segregation of duties',
        description: 'Prevent the same user from requesting and approving.',
      },
      { control: 'Retry and exception handling', description: 'Retry transient failures and open fallback task.' },
    ],
    monitoring: [
      {
        metric: 'approval_cycle_time_days',
        target: '40% reduction from baseline',
        alert_condition: 'Any request exceeds SLA threshold.',
      },
      {
        metric: 'first_pass_complete_rate',
        target: '>= 85%',
        alert_condition: 'Drops below 75% for two consecutive weeks.',
      },
      {
        metric: 'automation_coverage_rate',
        target: '>= 70%',
        alert_condition: 'Below target for current month.',
      },
    ],
  }
}
