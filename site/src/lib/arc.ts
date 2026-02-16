export type ArcStepId =
  | 'motivation'
  | 'skills'
  | 'impact'
  | 'research'
  | 'experience'

export interface ArcStep {
  id: ArcStepId
  label: string
  route: string
  question: string
  evidence: string
  handoff: string
}

export const ARC_STEPS: ArcStep[] = [
  {
    id: 'motivation',
    label: 'Motivation',
    route: '/',
    question: 'Which decisions must stay reliable as conditions change?',
    evidence: 'Problem framing, operating constraints, and decision intent.',
    handoff: 'Next, test the methods under controlled stress.',
  },
  {
    id: 'skills',
    label: 'Skills',
    route: '/projects',
    question: 'Do the core methods remain stable under drift and stress?',
    evidence: 'Interactive optimization proofs and inspectable implementation.',
    handoff: 'Next, see whether these methods shift operational outcomes.',
  },
  {
    id: 'impact',
    label: 'Impact',
    route: '/work',
    question: 'Do these methods change operational decisions in measurable ways?',
    evidence: 'Case evidence maps and in-context simulation tied to explicit signals.',
    handoff: 'Next, trace these outcomes to durable research evidence.',
  },
  {
    id: 'research',
    label: 'Research',
    route: '/publications',
    question: 'How does research justify implementation choices over time?',
    evidence: 'Publication record, citation patterns, and topic trajectory.',
    handoff: 'Next, close the loop with execution history.',
  },
  {
    id: 'experience',
    label: 'Experience',
    route: '/experience',
    question: 'What sustained trajectory supports delivery at increasing scope?',
    evidence: 'Execution history, artifacts, and production system practice.',
    handoff: 'Then return to Motivation and read the full arc as one system.',
  },
]

export function getArcStep(id: ArcStepId): ArcStep {
  return ARC_STEPS.find((step) => step.id === id) ?? ARC_STEPS[0]
}

export function getArcNeighbors(id: ArcStepId): {
  previous: ArcStep | null
  current: ArcStep
  next: ArcStep | null
} {
  const index = ARC_STEPS.findIndex((step) => step.id === id)
  const safeIndex = index >= 0 ? index : 0
  const current = ARC_STEPS[safeIndex]
  const previous = safeIndex > 0 ? ARC_STEPS[safeIndex - 1] : null
  const next = safeIndex < ARC_STEPS.length - 1 ? ARC_STEPS[safeIndex + 1] : null
  return { previous, current, next }
}
