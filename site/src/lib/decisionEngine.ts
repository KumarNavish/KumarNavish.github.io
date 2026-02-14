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

export interface KPI {
  metric: string
  target: string
  cadence: string
}

export interface RiskControl {
  risk: string
  trigger: string
  guardrail: string
}

export interface DecisionBlueprint {
  challengeTitle: string
  decisionQuestion: string
  valueStatement: string
  operatingPriority: string
  contextSignals: string[]
  systemDirection: string
  automationLoop: string
  successMetric: string
  immediateActions: string[]
  executionPlan: ExecutionStep[]
  kpis: KPI[]
  risks: RiskControl[]
  handoffChecklist: string[]
  matchedProject: ProjectItem | null
  matchedPublication: PublicationItem | null
}

interface Playbook {
  title: string
  question: string
  value: string
  unit: string
  failureSignal: string
  matchTerms: string[]
  directionByGoal: Record<GoalId, string>
  successByGoal: Record<GoalId, string>
  kpiNames: string[]
  challengeRisks: Array<{ risk: string; trigger: string; guardrail: string }>
}

interface SignalRule {
  id: string
  label: string
  operatingPriority: string
  keywords: string[]
}

export const CHALLENGE_OPTIONS: Array<Option<ChallengeId>> = [
  {
    id: 'continual_reliability',
    label: 'Continual reliability',
    description: 'Keep model updates stable over time.',
  },
  {
    id: 'online_safety',
    label: 'Online safety',
    description: 'Trigger moderation intervention earlier and better.',
  },
  {
    id: 'urban_transition',
    label: 'Urban transition',
    description: 'Sequence operational rollouts by evidence.',
  },
]

export const GOAL_OPTIONS: Array<Option<GoalId>> = [
  {
    id: 'diagnose',
    label: 'Diagnose',
    description: 'Find where the system is failing.',
  },
  {
    id: 'pilot',
    label: 'Pilot',
    description: 'Run controlled practical experiments.',
  },
  {
    id: 'production',
    label: 'Productionize',
    description: 'Scale with guardrails and automation.',
  },
]

export const HORIZON_OPTIONS: Array<Option<HorizonId>> = [
  {
    id: '2w',
    label: '2 weeks',
    description: 'Rapid decision sprint.',
  },
  {
    id: '6w',
    label: '6 weeks',
    description: 'Pilot cycle with measurable outcomes.',
  },
  {
    id: '12w',
    label: '12 weeks',
    description: 'Scale-ready rollout cycle.',
  },
]

export const RISK_OPTIONS: Array<Option<RiskId>> = [
  {
    id: 'conservative',
    label: 'Conservative',
    description: 'Protect quality first.',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Balance speed and reliability.',
  },
  {
    id: 'aggressive',
    label: 'Aggressive',
    description: 'Move fast with explicit containment.',
  },
]

const PLAYBOOKS: Record<ChallengeId, Playbook> = {
  continual_reliability: {
    title: 'Continual learning reliability',
    question: 'How should model updates be sequenced to avoid performance drift?',
    value: 'Turn update risk into a measurable operating process.',
    unit: 'model update cycle',
    failureSignal: 'retained-task regression',
    matchTerms: ['continual', 'optimization', 'policy', 'gradient', 'stability', 'learning'],
    directionByGoal: {
      diagnose:
        'Instrument update behavior first, then isolate where sequential regressions begin.',
      pilot:
        'Run side-by-side update-policy experiments with acceptance and rollback gates.',
      production:
        'Deploy a policy-governed update pipeline with automatic regression checks before release.',
    },
    successByGoal: {
      diagnose: 'Failure modes ranked with explicit threshold bands.',
      pilot: 'One policy demonstrates stable retained performance across sequential tasks.',
      production: 'Update cadence remains stable across consecutive release cycles.',
    },
    kpiNames: [
      'Retained-task performance after update',
      'Regression detection lead time',
      'Rollback-required update rate',
    ],
    challengeRisks: [
      {
        risk: 'Silent regression on prior tasks.',
        trigger: 'Retained-task score drops below guardrail in two consecutive runs.',
        guardrail: 'Block release and run rollback policy branch immediately.',
      },
      {
        risk: 'Overfitting to the latest task slice.',
        trigger: 'Latest-task gain rises while retained-task quality drops.',
        guardrail: 'Require balanced retained/new-task score before promotion.',
      },
    ],
  },
  online_safety: {
    title: 'Online safety intervention design',
    question: 'Which interaction signals should trigger earlier moderation intervention?',
    value: 'Convert moderation from reactive triage to proactive operations.',
    unit: 'moderation decision queue',
    failureSignal: 'escalation before intervention',
    matchTerms: ['hate', 'counter', 'interaction', 'moderation', 'safety', 'twitter'],
    directionByGoal: {
      diagnose:
        'Map escalation signatures first, then locate thresholds where intervention is consistently late.',
      pilot:
        'Test intervention rules against historical interactions and compare false-positive tradeoffs.',
      production:
        'Operationalize intervention triggers with continuous policy feedback and threshold updates.',
    },
    successByGoal: {
      diagnose: 'Escalation signatures are ranked with clear trigger candidates.',
      pilot: 'Trigger policy improves intervention timing without unacceptable false positives.',
      production: 'Escalation risk declines while moderation precision remains within bounds.',
    },
    kpiNames: [
      'Escalation-before-intervention rate',
      'False intervention rate',
      'Median intervention latency',
    ],
    challengeRisks: [
      {
        risk: 'Trigger thresholds generate excessive false positives.',
        trigger: 'False intervention rate exceeds weekly guardrail.',
        guardrail: 'Auto-revert to prior threshold profile and review edge cases.',
      },
      {
        risk: 'High-risk interactions bypass intervention.',
        trigger: 'Escalation events occur without trigger activation.',
        guardrail: 'Expand trigger rule set and raise alert for policy review.',
      },
    ],
  },
  urban_transition: {
    title: 'Urban transition sequencing',
    question: 'Which regions should be prioritized for transition pilots first?',
    value: 'Replace rollout by intuition with rollout by evidence.',
    unit: 'regional rollout unit',
    failureSignal: 'service-quality degradation during transition',
    matchTerms: ['urban', 'logistics', 'micro', 'regions', 'delivery', 'cargo', 'transition'],
    directionByGoal: {
      diagnose:
        'Profile regional constraints and identify where transition readiness is already high.',
      pilot:
        'Launch staged pilots in high-fit regions and compare service stability outcomes.',
      production:
        'Scale sequencing with region-specific playbooks and weekly operating checkpoints.',
    },
    successByGoal: {
      diagnose: 'Regions ranked with transparent readiness criteria.',
      pilot: 'Pilot regions sustain service quality while transition constraints are managed.',
      production: 'Transition rollout scales without sustained service degradation.',
    },
    kpiNames: [
      'On-time service rate in transitioned regions',
      'Transition cost per operational unit',
      'Service exception rate during rollout',
    ],
    challengeRisks: [
      {
        risk: 'Rollout starts in low-readiness regions.',
        trigger: 'Pilot readiness score falls below threshold before launch.',
        guardrail: 'Re-rank candidate regions and delay launch until readiness passes.',
      },
      {
        risk: 'Service instability during transition ramp-up.',
        trigger: 'Service exception rate rises above weekly guardrail.',
        guardrail: 'Pause expansion and resolve root causes before next region.',
      },
    ],
  },
}

const PHASE_LABELS: Record<HorizonId, string[]> = {
  '2w': ['Week 1', 'Week 2'],
  '6w': ['Weeks 1-2', 'Weeks 3-4', 'Weeks 5-6'],
  '12w': ['Weeks 1-3', 'Weeks 4-6', 'Weeks 7-9', 'Weeks 10-12'],
}

const CONTEXT_STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'this',
  'that',
  'into',
  'while',
  'where',
  'when',
  'then',
  'over',
  'under',
  'between',
  'across',
  'should',
  'could',
  'would',
  'have',
  'has',
  'been',
  'are',
  'your',
  'you',
  'our',
  'their',
  'they',
  'them',
  'than',
  'more',
  'less',
  'very',
  'also',
  'about',
  'after',
  'before',
  'during',
  'through',
  'because',
  'using',
  'used',
  'need',
  'needs',
  'must',
  'will',
  'real',
  'time',
])

const SIGNAL_RULES: SignalRule[] = [
  {
    id: 'latency',
    label: 'Latency pressure',
    operatingPriority: 'Shorten decision-to-action latency without dropping quality.',
    keywords: ['latency', 'slow', 'delay', 'timing', 'queue', 'backlog', 'response', 'urgent'],
  },
  {
    id: 'cost',
    label: 'Cost pressure',
    operatingPriority: 'Reduce operating cost while preserving service stability.',
    keywords: ['cost', 'budget', 'spend', 'expense', 'resource', 'efficiency', 'capacity'],
  },
  {
    id: 'reliability',
    label: 'Reliability risk',
    operatingPriority: 'Protect reliability with explicit regression and rollback gates.',
    keywords: ['drift', 'regression', 'failure', 'error', 'reliability', 'quality', 'stability'],
  },
  {
    id: 'compliance',
    label: 'Policy constraints',
    operatingPriority: 'Keep intervention policies auditable and policy-safe.',
    keywords: ['policy', 'compliance', 'legal', 'audit', 'governance', 'regulatory'],
  },
  {
    id: 'adoption',
    label: 'Adoption risk',
    operatingPriority: 'Design for team adoption so the system is actually used.',
    keywords: ['adoption', 'operator', 'workflow', 'handoff', 'stakeholder', 'training'],
  },
]

function cleanContext(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function tokenizeContext(value: string): string[] {
  return (value.toLowerCase().match(/[a-z][a-z-]+/g) ?? []).map((token) => token.trim())
}

function topContextTerms(context: string): string[] {
  const tokens = tokenizeContext(context)
  const counts = new Map<string, number>()
  for (const token of tokens) {
    if (token.length < 4 || CONTEXT_STOPWORDS.has(token)) {
      continue
    }
    counts.set(token, (counts.get(token) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 4)
    .map(([token]) => token)
}

function detectContextSignals(context: string): SignalRule[] {
  const normalized = normalizeText(context)
  return SIGNAL_RULES
    .map((rule) => ({
      rule,
      score: rule.keywords.reduce(
        (count, keyword) => (normalized.includes(keyword) ? count + 1 : count),
        0,
      ),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.rule.label.localeCompare(right.rule.label))
    .slice(0, 2)
    .map((item) => item.rule)
}

function normalizeText(value: string): string {
  return value.toLowerCase()
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

function targetForGoal(goal: GoalId): string {
  if (goal === 'diagnose') {
    return 'Baseline and threshold bands defined.'
  }
  if (goal === 'pilot') {
    return 'Measurable improvement over baseline with reproducible evidence.'
  }
  return 'Stable performance across consecutive operating cycles.'
}

function cadenceForGoal(goal: GoalId): string {
  if (goal === 'diagnose') {
    return 'Daily measurement, weekly review.'
  }
  if (goal === 'pilot') {
    return 'Per experiment run, weekly gate review.'
  }
  return 'Per release cycle, weekly operating review.'
}

function buildKpis(playbook: Playbook, goal: GoalId, signals: SignalRule[]): KPI[] {
  const metricSet = new Set(playbook.kpiNames)
  if (signals.some((signal) => signal.id === 'cost')) {
    metricSet.add('Unit operating cost trend')
  }
  if (signals.some((signal) => signal.id === 'latency')) {
    metricSet.add('Decision-to-action latency')
  }
  if (signals.some((signal) => signal.id === 'compliance')) {
    metricSet.add('Policy exception rate')
  }
  if (signals.some((signal) => signal.id === 'adoption')) {
    metricSet.add('Operator adoption rate')
  }

  return Array.from(metricSet)
    .slice(0, 4)
    .map((metric) => ({
      metric,
      target: targetForGoal(goal),
      cadence: cadenceForGoal(goal),
    }))
}

function buildAutomationLoop(
  playbook: Playbook,
  goal: GoalId,
  risk: RiskId,
  signals: SignalRule[],
): string {
  const baseByGoal: Record<GoalId, string> = {
    diagnose: `Daily sync for ${playbook.unit} signals, then weekly decision checkpoint.`,
    pilot: `Daily sync plus weekly experiment gate for ${playbook.unit}.`,
    production: `Scheduled refresh, release gate checks, and rollback readiness for ${playbook.unit}.`,
  }
  const signalSuffix =
    signals.length > 0 ? ` Each cycle explicitly checks ${signals[0].label.toLowerCase()}.` : ''

  if (risk === 'conservative') {
    return `${baseByGoal[goal]} Run a rollback drill before each major release.${signalSuffix}`
  }

  if (risk === 'aggressive') {
    return `${baseByGoal[goal]} Run parallel experiment lanes with hard stop conditions.${signalSuffix}`
  }

  return `${baseByGoal[goal]}${signalSuffix}`
}

function buildImmediateActions(playbook: Playbook, goal: GoalId, signals: SignalRule[]): string[] {
  const signalAction =
    signals.length > 0
      ? `Within 48 hours: instrument ${signals[0].label.toLowerCase()} on the current ${playbook.unit}.`
      : null
  const actionTwo =
    goal === 'diagnose'
      ? `Within 48 hours: establish baseline for ${playbook.failureSignal} and define alert thresholds.`
      : `Within 48 hours: implement baseline + candidate strategy instrumentation for ${playbook.unit}.`

  const actions = [
    `Within 24 hours: lock scope, owner, and success criteria for this ${playbook.unit}.`,
    signalAction ?? actionTwo,
    `Within 72 hours: run first decision review and approve the next controlled iteration.`,
  ]

  if (signalAction && goal !== 'diagnose') {
    actions.splice(2, 0, actionTwo)
  }

  return actions
}

function buildExecutionPlan(
  goal: GoalId,
  horizon: HorizonId,
  risk: RiskId,
  signals: SignalRule[],
): ExecutionStep[] {
  const templates: Record<GoalId, Array<{ objective: string; deliverable: string }>> = {
    diagnose: [
      {
        objective: 'Map failure surfaces and boundary conditions.',
        deliverable: 'Decision map with ranked failure patterns and confidence notes.',
      },
      {
        objective: 'Define thresholds, alerts, and intervention triggers.',
        deliverable: 'Threshold rulebook with escalation conditions.',
      },
      {
        objective: 'Validate assumptions against observed data.',
        deliverable: 'Shortlist of next actions backed by measured evidence.',
      },
    ],
    pilot: [
      {
        objective: 'Design pilot scope and comparison criteria.',
        deliverable: 'Pilot specification with acceptance and stop rules.',
      },
      {
        objective: 'Run controlled comparisons and capture outcomes.',
        deliverable: 'Pilot report with performance and tradeoff analysis.',
      },
      {
        objective: 'Select the rollout candidate strategy.',
        deliverable: 'Go / no-go recommendation with required prerequisites.',
      },
    ],
    production: [
      {
        objective: 'Harden interfaces, quality gates, and ownership model.',
        deliverable: 'Production contract with validation checklist.',
      },
      {
        objective: 'Automate refresh, monitoring, and intervention flows.',
        deliverable: 'Runbook with escalation and rollback procedures.',
      },
      {
        objective: 'Roll out in staged increments.',
        deliverable: 'Staged rollout plan with monitored checkpoints.',
      },
    ],
  }

  const labels = PHASE_LABELS[horizon]
  const plan: ExecutionStep[] = []
  const targetCount = horizon === '2w' ? 2 : horizon === '6w' ? 3 : 4

  for (let index = 0; index < targetCount; index += 1) {
    const template = templates[goal][Math.min(index, templates[goal].length - 1)]
    const riskSuffix =
      risk === 'conservative'
        ? ' Include explicit rollback criteria.'
        : risk === 'aggressive'
          ? ' Include acceleration and containment criteria.'
          : ''
    const signalSuffix =
      signals.length > 0 && index === 0
        ? ` Prioritize ${signals[0].label.toLowerCase()} in this phase.`
        : ''

    plan.push({
      phase: labels[index] ?? `Phase ${index + 1}`,
      objective: `${template.objective}${riskSuffix}${signalSuffix}`,
      deliverable: template.deliverable,
    })
  }

  return plan
}

function buildRiskControls(
  playbook: Playbook,
  horizon: HorizonId,
  risk: RiskId,
  signals: SignalRule[],
): RiskControl[] {
  const controls = [...playbook.challengeRisks]

  if (risk === 'conservative') {
    controls.push({
      risk: 'Progress stalls due to excessive caution.',
      trigger: 'No material decision after two weekly cycles.',
      guardrail: 'Enforce timeboxed decisions with predefined fallback options.',
    })
  } else if (risk === 'aggressive') {
    controls.push({
      risk: 'Speed compromises quality thresholds.',
      trigger: 'Two consecutive KPI guardrail misses after acceleration.',
      guardrail: 'Freeze expansion and return to previous stable configuration.',
    })
  } else {
    controls.push({
      risk: 'Scope drift reduces delivery clarity.',
      trigger: 'New requirements alter core KPI targets mid-cycle.',
      guardrail: 'Require explicit change approval and updated success criteria.',
    })
  }

  if (horizon === '12w') {
    controls.push({
      risk: 'Long-horizon ownership erosion.',
      trigger: 'Checkpoint responsibilities become unclear across phases.',
      guardrail: 'Attach named owners to each phase gate and review weekly.',
    })
  }

  if (signals.some((signal) => signal.id === 'cost')) {
    controls.push({
      risk: 'Cost reduction undermines service quality.',
      trigger: 'Cost drops while quality KPI misses increase.',
      guardrail: 'Require paired cost and quality checks at every gate.',
    })
  }

  if (signals.some((signal) => signal.id === 'compliance')) {
    controls.push({
      risk: 'Intervention logic violates policy constraints.',
      trigger: 'Policy exceptions rise above accepted threshold.',
      guardrail: 'Run policy audit before each rollout increment.',
    })
  }

  if (signals.some((signal) => signal.id === 'adoption')) {
    controls.push({
      risk: 'Workflow bypass by operational teams.',
      trigger: 'Manual overrides trend upward for two cycles.',
      guardrail: 'Track adoption explicitly and retrain before expanding scope.',
    })
  }

  return controls.slice(0, 4)
}

function buildHandoffChecklist(goal: GoalId, risk: RiskId, signals: SignalRule[]): string[] {
  const items = [
    'Problem statement is constrained to one measurable decision.',
    'Success metric and threshold are explicit before implementation.',
    'Owner and review cadence are assigned and visible.',
  ]

  if (goal !== 'diagnose') {
    items.push('Go / no-go gate is defined before rollout work starts.')
  }

  if (risk === 'conservative') {
    items.push('Rollback procedure has been tested prior to release.')
  } else if (risk === 'aggressive') {
    items.push('Containment conditions are defined for accelerated experiments.')
  } else {
    items.push('Monitoring thresholds are reviewed and adjusted weekly.')
  }

  if (signals.some((signal) => signal.id === 'adoption')) {
    items.push('Adoption owner is assigned with weekly usage checks.')
  }

  if (signals.some((signal) => signal.id === 'compliance')) {
    items.push('Policy review sign-off is captured before launch.')
  }

  return items
}

function optionLabel<T extends string>(
  options: Array<Option<T>>,
  id: T,
): string {
  return options.find((option) => option.id === id)?.label ?? id
}

export function renderDecisionBriefMarkdown(
  input: DecisionInput,
  blueprint: DecisionBlueprint,
): string {
  const lines: string[] = []

  lines.push(`# Decision Brief: ${blueprint.challengeTitle}`)
  lines.push('')
  lines.push(`- Challenge: ${optionLabel(CHALLENGE_OPTIONS, input.challenge)}`)
  lines.push(`- Goal: ${optionLabel(GOAL_OPTIONS, input.goal)}`)
  lines.push(`- Horizon: ${optionLabel(HORIZON_OPTIONS, input.horizon)}`)
  lines.push(`- Risk Mode: ${optionLabel(RISK_OPTIONS, input.risk)}`)
  if (input.context.trim()) {
    lines.push(`- Context: ${input.context.trim()}`)
  }
  lines.push('')

  lines.push('## Decision')
  lines.push(blueprint.decisionQuestion)
  lines.push('')

  lines.push('## System Direction')
  lines.push(blueprint.systemDirection)
  lines.push('')

  lines.push('## Operating Priority')
  lines.push(blueprint.operatingPriority)
  lines.push('')

  if (blueprint.contextSignals.length > 0) {
    lines.push('## Detected Context Signals')
    for (const signal of blueprint.contextSignals) {
      lines.push(`- ${signal}`)
    }
    lines.push('')
  }

  lines.push('## Next 72 Hours')
  for (const action of blueprint.immediateActions) {
    lines.push(`- ${action}`)
  }
  lines.push('')

  lines.push('## Automation Loop')
  lines.push(blueprint.automationLoop)
  lines.push('')

  lines.push('## Execution Plan')
  for (const step of blueprint.executionPlan) {
    lines.push(`- ${step.phase}: ${step.objective} -> ${step.deliverable}`)
  }
  lines.push('')

  lines.push('## KPI Set')
  for (const kpi of blueprint.kpis) {
    lines.push(`- ${kpi.metric} | target: ${kpi.target} | cadence: ${kpi.cadence}`)
  }
  lines.push('')

  lines.push('## Risk Controls')
  for (const risk of blueprint.risks) {
    lines.push(`- Risk: ${risk.risk}`)
    lines.push(`  - Trigger: ${risk.trigger}`)
    lines.push(`  - Guardrail: ${risk.guardrail}`)
  }
  lines.push('')

  lines.push('## Handoff Checklist')
  for (const item of blueprint.handoffChecklist) {
    lines.push(`- ${item}`)
  }
  lines.push('')

  if (blueprint.matchedProject) {
    lines.push(`Implementation Anchor: ${blueprint.matchedProject.name}`)
  }
  if (blueprint.matchedPublication) {
    lines.push(`Evidence Anchor: ${blueprint.matchedPublication.title}`)
  }

  return lines.join('\n')
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
  const contextSuffix = context ? ` Applied context: ${context}.` : ''
  const detectedSignals = detectContextSignals(context)
  const contextTerms = topContextTerms(context)
  const matchTerms = [...playbook.matchTerms, ...contextTerms]
  const contextSignals =
    detectedSignals.length > 0 ? detectedSignals.map((signal) => signal.label) : ['No explicit signal detected']
  const operatingPriority =
    detectedSignals[0]?.operatingPriority ??
    'Define one measurable decision and run a tightly scoped first iteration.'

  return {
    challengeTitle: playbook.title,
    decisionQuestion: playbook.question,
    valueStatement: `${playbook.value}${contextSuffix}`,
    operatingPriority,
    contextSignals,
    systemDirection: playbook.directionByGoal[input.goal],
    automationLoop: buildAutomationLoop(playbook, input.goal, input.risk, detectedSignals),
    successMetric: playbook.successByGoal[input.goal],
    immediateActions: buildImmediateActions(playbook, input.goal, detectedSignals),
    executionPlan: buildExecutionPlan(input.goal, input.horizon, input.risk, detectedSignals),
    kpis: buildKpis(playbook, input.goal, detectedSignals),
    risks: buildRiskControls(playbook, input.horizon, input.risk, detectedSignals),
    handoffChecklist: buildHandoffChecklist(input.goal, input.risk, detectedSignals),
    matchedProject: findBestProject(data.projects, matchTerms),
    matchedPublication: findBestPublication(data.publications, matchTerms),
  }
}
