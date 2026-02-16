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
    label: 'Motivation',
    route: '/',
    readerQuestion: 'Why do I do this?',
    purpose: 'Define the decision pressure before selecting methods.',
    question: 'Which decisions must stay reliable as conditions change?',
    evidence: 'Problem framing and operational constraints.',
    handoff: 'Next: inspect the methods built for this pressure.',
  },
  {
    id: 'skills',
    label: 'Skills',
    route: '/projects',
    readerQuestion: 'What can I do?',
    purpose: 'Show methods that remain stable under drift and stress.',
    question: 'Do the core methods remain stable under drift and stress?',
    evidence: 'Interactive proof and inspectable implementations.',
    handoff: 'Next: verify whether these methods change outcomes.',
  },
  {
    id: 'impact',
    label: 'Impact',
    route: '/work',
    readerQuestion: 'What have I built?',
    purpose: 'Demonstrate systems that change operational decisions.',
    question: 'Do these methods change operational decisions in measurable ways?',
    evidence: 'Case evidence and in-context simulation.',
    handoff: 'Next: connect outcomes to research foundations.',
  },
  {
    id: 'research',
    label: 'Research',
    route: '/publications',
    readerQuestion: 'What have I proven?',
    purpose: 'Anchor implementation choices in published evidence.',
    question: 'How does research justify implementation choices over time?',
    evidence: 'Publication record and citation trajectory.',
    handoff: 'Next: close the loop with execution progression.',
  },
  {
    id: 'experience',
    label: 'Experience',
    route: '/experience',
    readerQuestion: 'Where have I applied it?',
    purpose: 'Show delivery trajectory and execution range.',
    question: 'What sustained trajectory supports delivery at increasing scope?',
    evidence: 'Execution history and delivery artifacts.',
    handoff: 'Then return to Motivation and read the arc as one system.',
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
