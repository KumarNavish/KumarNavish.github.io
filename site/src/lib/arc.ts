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
    question: 'Which decisions must remain reliable when conditions change?',
    evidence: 'Problem framing, decision intent, and operating constraints.',
    handoff: 'Move to Skills to validate the methods used to uphold reliability.',
  },
  {
    id: 'skills',
    label: 'Skills',
    route: '/projects',
    question: 'Can the core methods stay stable under drift and stress?',
    evidence: 'Interactive optimization proofs and inspectable implementation surfaces.',
    handoff: 'Move to Impact to see how these methods change practical outcomes.',
  },
  {
    id: 'impact',
    label: 'Impact',
    route: '/work',
    question: 'Do these methods alter real operational decisions in measurable ways?',
    evidence: 'Case evidence maps and in-context simulation tied to explicit signals.',
    handoff: 'Move to Research to ground impact in broader evidence and inquiry.',
  },
  {
    id: 'research',
    label: 'Research',
    route: '/publications',
    question: 'How is the implementation justified by durable research evidence?',
    evidence: 'Publication record, citation patterns, and topic trajectory.',
    handoff: 'Move to Experience to close the loop with execution trajectory.',
  },
  {
    id: 'experience',
    label: 'Experience',
    route: '/experience',
    question: 'What sustained trajectory supports delivery at increasing scope?',
    evidence: 'Execution history, artifacts, and production-oriented system practice.',
    handoff: 'Return to Motivation to review the full arc as one system.',
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
