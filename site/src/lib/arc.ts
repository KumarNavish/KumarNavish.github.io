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
  readerQuestion: string
  purpose: string
  question: string
  evidence: string
  handoff: string
}

export const ARC_STEPS: ArcStep[] = [
  {
    id: 'motivation',
    label: 'Overview',
    route: '/',
    readerQuestion: 'What is this site for?',
    purpose: 'Define the practical problem and where to start.',
    question: 'What should be tested first?',
    evidence: 'Problem framing and quick entry points.',
    handoff: 'Next, test method behavior.',
  },
  {
    id: 'skills',
    label: 'Methods',
    route: '/projects',
    readerQuestion: 'How does the method behave?',
    purpose: 'Show performance under drift and stress.',
    question: 'Does the strategy remain stable as conditions change?',
    evidence: 'Interactive proof and implementation links.',
    handoff: 'Next, review case outcomes.',
  },
  {
    id: 'impact',
    label: 'Case Studies',
    route: '/work',
    readerQuestion: 'What changed in practice?',
    purpose: 'Demonstrate measurable operational changes.',
    question: 'Which decisions improved in real scenarios?',
    evidence: 'Case evidence and in-context simulation.',
    handoff: 'Next, inspect formal evidence.',
  },
  {
    id: 'research',
    label: 'Evidence',
    route: '/publications',
    readerQuestion: 'What backs the decisions?',
    purpose: 'Anchor implementation choices in published work.',
    question: 'Is there sustained research support?',
    evidence: 'Publication record and citation trajectory.',
    handoff: 'Next, review delivery trajectory.',
  },
  {
    id: 'experience',
    label: 'Delivery',
    route: '/experience',
    readerQuestion: 'Can this be delivered consistently?',
    purpose: 'Show execution continuity and artifacts.',
    question: 'What delivery record supports credibility?',
    evidence: 'Execution history and production artifacts.',
    handoff: 'Return to Overview when needed.',
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
