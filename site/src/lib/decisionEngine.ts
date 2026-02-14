import type { ProjectItem, PublicationItem } from './api'

export type ChallengeId = 'continual_reliability' | 'online_safety' | 'urban_transition'
export type GoalId = 'diagnose' | 'pilot' | 'production'
export type HorizonId = '2w' | '6w' | '12w'
export type RiskId = 'conservative' | 'balanced' | 'aggressive'

export interface Option<T extends string> {
  id: T
  label: string
  description: string
}

export interface DecisionInput {
  challenge: ChallengeId
  goal: GoalId
  horizon: HorizonId
  risk: RiskId
  context: string
}

export interface ExecutionStep {
  phase: string
  objective: string
  deliverable: string
}

export interface DecisionBlueprint {
  challengeTitle: string
  decisionQuestion: string
  valueStatement: string
  systemDirection: string
  automationLoop: string
  successMetric: string
  executionPlan: ExecutionStep[]
  handoffChecklist: string[]
  matchedProject: ProjectItem | null
  matchedPublication: PublicationItem | null
}

interface Playbook {
  title: string
  question: string
  value: string
  matchTerms: string[]
  directionByGoal: Record<GoalId, string>
  successByGoal: Record<GoalId, string>
}

const PLAYBOOKS: Record<ChallengeId, Playbook> = {
  continual_reliability: {
    title: 'Continual learning reliability',
    question: 'How should model updates be sequenced to avoid performance drift?',
    value: 'Turn model update risk into a measurable and controlled process.',
    matchTerms: ['continual', 'optimization', 'policy', 'gradient', 'stability', 'learning'],
    directionByGoal: {
      diagnose:
        'Instrument update behavior first, then isolate where sequential learning regressions begin.',
      pilot:
        'Run side-by-side update-policy experiments with explicit rollback criteria and acceptance gates.',
      production:
        'Deploy a policy-governed update pipeline with automated regression checks before release.',
    },
    successByGoal: {
      diagnose: 'Failure modes ranked with clear trigger thresholds for intervention.',
      pilot: 'Update policies compared with evidence on stability, recovery speed, and retained quality.',
      production: 'Update cadence sustained without unacceptable quality regression across sequential tasks.',
    },
  },
  online_safety: {
    title: 'Online safety intervention design',
    question: 'Which interaction signals should trigger earlier moderation intervention?',
    value: 'Convert moderation from reactive action to proactive system design.',
    matchTerms: ['hate', 'counter', 'interaction', 'moderation', 'safety', 'twitter'],
    directionByGoal: {
      diagnose:
        'Map harmful interaction signatures and identify thresholds where escalation risk increases.',
      pilot:
        'Test intervention policies against historical patterns and compare false positive tradeoffs.',
      production:
        'Operationalize intervention triggers with continuous monitoring and policy feedback loops.',
    },
    successByGoal: {
      diagnose: 'High-risk interaction signatures identified with decision-ready thresholds.',
      pilot: 'Intervention policy calibrated with transparent precision and recall tradeoffs.',
      production: 'Escalation risk reduced while preserving acceptable moderation precision.',
    },
  },
  urban_transition: {
    title: 'Urban logistics transition planning',
    question: 'Which regions should be prioritized for transition pilots first?',
    value: 'Sequence rollout decisions using evidence instead of broad assumptions.',
    matchTerms: ['urban', 'logistics', 'micro', 'regions', 'delivery', 'cargo', 'transition'],
    directionByGoal: {
      diagnose:
        'Profile regional constraints and identify where transition feasibility is immediately highest.',
      pilot:
        'Launch staged pilots in high-fit regions while measuring operational and service stability.',
      production:
        'Scale transition sequencing with region-specific operating playbooks and monitoring.',
    },
    successByGoal: {
      diagnose: 'Regions prioritized with transparent fit criteria and expected constraints.',
      pilot: 'Pilot regions validated with measurable service quality and operational viability.',
      production: 'Transition rollout scaled with predictable service and cost performance.',
    },
  },
}

export const CHALLENGE_OPTIONS: Array<Option<ChallengeId>> = [
  {
    id: 'continual_reliability',
    label: 'Continual reliability',
    description: 'Long-lived model update quality.',
  },
  {
    id: 'online_safety',
    label: 'Online safety',
    description: 'Early intervention policy design.',
  },
  {
    id: 'urban_transition',
    label: 'Urban transition',
    description: 'Region-level rollout sequencing.',
  },
]

export const GOAL_OPTIONS: Array<Option<GoalId>> = [
  {
    id: 'diagnose',
    label: 'Diagnose',
    description: 'Understand failure patterns quickly.',
  },
  {
    id: 'pilot',
    label: 'Pilot',
    description: 'Run controlled practical experiments.',
  },
  {
    id: 'production',
    label: 'Productionize',
    description: 'Harden and scale with guardrails.',
  },
]

export const HORIZON_OPTIONS: Array<Option<HorizonId>> = [
  {
    id: '2w',
    label: '2 weeks',
    description: 'Rapid clarity sprint.',
  },
  {
    id: '6w',
    label: '6 weeks',
    description: 'Practical pilot cycle.',
  },
  {
    id: '12w',
    label: '12 weeks',
    description: 'Scale-ready rollout arc.',
  },
]

export const RISK_OPTIONS: Array<Option<RiskId>> = [
  {
    id: 'conservative',
    label: 'Conservative',
    description: 'Prioritize safety and rollback readiness.',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Balance speed and reliability.',
  },
  {
    id: 'aggressive',
    label: 'Aggressive',
    description: 'Favor learning speed with explicit controls.',
  },
]

const PHASE_LABELS: Record<HorizonId, string[]> = {
  '2w': ['Week 1', 'Week 2'],
  '6w': ['Weeks 1-2', 'Weeks 3-4', 'Weeks 5-6'],
  '12w': ['Weeks 1-3', 'Weeks 4-6', 'Weeks 7-9', 'Weeks 10-12'],
}

function normalizeText(value: string): string {
  return value.toLowerCase()
}

function cleanContext(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function scoreByTerms(text: string, terms: string[]): number {
  const normalized = normalizeText(text)
  let score = 0
  for (const term of terms) {
    if (normalized.includes(term)) {
      score += 1
    }
  }
  return score
}

function projectText(project: ProjectItem): string {
  return [
    project.name,
    project.description,
    project.one_line ?? '',
    project.tags.join(' '),
    project.topics.join(' '),
  ].join(' ')
}

function publicationText(publication: PublicationItem): string {
  return [
    publication.title,
    publication.summary ?? '',
    publication.venue ?? '',
    publication.keywords.join(' '),
  ].join(' ')
}

function findBestProject(projects: ProjectItem[], terms: string[]): ProjectItem | null {
  let best: { item: ProjectItem; score: number } | null = null
  for (const project of projects) {
    const relevance = scoreByTerms(projectText(project), terms)
    const featuredBoost = project.featured || project.pinned ? 2 : 0
    const activityBoost = project.last_push ? 1 : 0
    const score = relevance * 3 + featuredBoost + activityBoost
    if (!best || score > best.score) {
      best = { item: project, score }
    }
  }

  if (!best || best.score <= 0) {
    return projects.find((project) => project.featured || project.pinned) ?? projects[0] ?? null
  }

  return best.item
}

function findBestPublication(publications: PublicationItem[], terms: string[]): PublicationItem | null {
  let best: { item: PublicationItem; score: number } | null = null
  for (const publication of publications) {
    const relevance = scoreByTerms(publicationText(publication), terms)
    const citationBoost = Math.min(3, Math.floor(Math.log10((publication.citation_count ?? 0) + 1)))
    const score = relevance * 3 + citationBoost
    if (!best || score > best.score) {
      best = { item: publication, score }
    }
  }

  if (!best || best.score <= 0) {
    return publications[0] ?? null
  }

  return best.item
}

function buildAutomationLoop(goal: GoalId, risk: RiskId): string {
  const goalLoop: Record<GoalId, string> = {
    diagnose: 'Daily data sync, daily anomaly scan, and a weekly decision checkpoint.',
    pilot: 'Daily updates, weekly experiment comparisons, and weekly decision gates.',
    production:
      'Scheduled refresh cycles, automatic quality gates, and release approvals with rollback paths.',
  }

  if (risk === 'conservative') {
    return `${goalLoop[goal]} Add explicit rollback rehearsal before each major release.`
  }

  if (risk === 'aggressive') {
    return `${goalLoop[goal]} Add parallel experiment tracks with strict exit criteria.`
  }

  return goalLoop[goal]
}

function buildExecutionPlan(goal: GoalId, horizon: HorizonId, risk: RiskId): ExecutionStep[] {
  const baseByGoal: Record<GoalId, Array<{ objective: string; deliverable: string }>> = {
    diagnose: [
      {
        objective: 'Establish baseline behavior and map failure surfaces.',
        deliverable: 'Decision map with ranked failure patterns.',
      },
      {
        objective: 'Define trigger thresholds and intervention points.',
        deliverable: 'Decision memo with threshold rules and confidence notes.',
      },
      {
        objective: 'Validate assumptions with fast backtests.',
        deliverable: 'Evidence-backed shortlist of next implementation moves.',
      },
    ],
    pilot: [
      {
        objective: 'Design pilot scope and comparison criteria.',
        deliverable: 'Pilot spec with acceptance and stop conditions.',
      },
      {
        objective: 'Implement and run controlled comparisons.',
        deliverable: 'Pilot report with performance and tradeoff analysis.',
      },
      {
        objective: 'Select rollout-ready strategy.',
        deliverable: 'Go / no-go recommendation with rollout prerequisites.',
      },
    ],
    production: [
      {
        objective: 'Harden architecture, interfaces, and quality gates.',
        deliverable: 'Production-ready system contract and validation suite.',
      },
      {
        objective: 'Automate refresh, evaluation, and rollback flows.',
        deliverable: 'Operational runbook with automation ownership map.',
      },
      {
        objective: 'Roll out in staged increments.',
        deliverable: 'Progressive rollout plan with monitored release checkpoints.',
      },
    ],
  }

  const labels = PHASE_LABELS[horizon]
  const templates = baseByGoal[goal]

  const steps: ExecutionStep[] = []
  const targetCount = horizon === '2w' ? 2 : horizon === '6w' ? 3 : 4

  for (let index = 0; index < targetCount; index += 1) {
    const template = templates[Math.min(index, templates.length - 1)]
    const riskSuffix =
      risk === 'conservative'
        ? ' Include fallback criteria.'
        : risk === 'aggressive'
          ? ' Include acceleration criteria.'
          : ''

    steps.push({
      phase: labels[index] ?? `Phase ${index + 1}`,
      objective: `${template.objective}${riskSuffix}`,
      deliverable: template.deliverable,
    })
  }

  return steps
}

function buildHandoffChecklist(goal: GoalId, risk: RiskId): string[] {
  const base = [
    'Decision objective agreed with measurable success criteria.',
    'Data assumptions documented with known failure boundaries.',
    'Owner assigned for implementation and review cadence.',
  ]

  if (goal !== 'diagnose') {
    base.push('Experiment or rollout gate defined before implementation starts.')
  }

  if (risk === 'conservative') {
    base.push('Rollback and recovery procedure verified before release.')
  } else if (risk === 'aggressive') {
    base.push('Parallel experiment branches tracked with explicit stop conditions.')
  } else {
    base.push('Monitoring thresholds reviewed weekly and adjusted by evidence.')
  }

  return base
}

export function createDecisionBlueprint(
  input: DecisionInput,
  data: {
    projects: ProjectItem[]
    publications: PublicationItem[]
  },
): DecisionBlueprint {
  const playbook = PLAYBOOKS[input.challenge]
  const context = cleanContext(input.context)
  const systemDirection = playbook.directionByGoal[input.goal]
  const contextSuffix = context ? ` Applied context: ${context}.` : ''

  return {
    challengeTitle: playbook.title,
    decisionQuestion: playbook.question,
    valueStatement: `${playbook.value}${contextSuffix}`,
    systemDirection,
    automationLoop: buildAutomationLoop(input.goal, input.risk),
    successMetric: playbook.successByGoal[input.goal],
    executionPlan: buildExecutionPlan(input.goal, input.horizon, input.risk),
    handoffChecklist: buildHandoffChecklist(input.goal, input.risk),
    matchedProject: findBestProject(data.projects, playbook.matchTerms),
    matchedPublication: findBestPublication(data.publications, playbook.matchTerms),
  }
}
