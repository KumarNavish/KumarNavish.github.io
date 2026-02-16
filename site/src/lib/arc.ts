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
    evidence: 'Problem framing, operational constraints, and decision intent.',
    handoff: 'Next, inspect the methods built to handle this pressure.',
  },
  {
    id: 'skills',
    label: 'Skills',
    route: '/projects',
    readerQuestion: 'What can I do?',
    purpose: 'Show methods that remain stable under drift and stress.',
    question: 'Do the core methods remain stable under drift and stress?',
    evidence: 'Interactive optimization proof and inspectable implementations.',
    handoff: 'Next, verify whether these methods change operational outcomes.',
  },
  {
    id: 'impact',
    label: 'Impact',
    route: '/work',
    readerQuestion: 'What have I built?',
    purpose: 'Demonstrate systems that change operational decisions.',
    question: 'Do these methods change operational decisions in measurable ways?',
    evidence: 'Case evidence and in-context simulation tied to measurable signals.',
    handoff: 'Next, connect these outcomes to durable research foundations.',
  },
  {
    id: 'research',
    label: 'Research',
    route: '/publications',
    readerQuestion: 'What have I proven?',
    purpose: 'Anchor implementation choices in published evidence.',
    question: 'How does research justify implementation choices over time?',
    evidence: 'Publication record, citation trajectory, and topic continuity.',
    handoff: 'Next, close the loop with execution progression.',
  },
  {
    id: 'experience',
    label: 'Experience',
    route: '/experience',
    readerQuestion: 'Where have I applied it?',
    purpose: 'Show delivery trajectory, artifacts, and execution range.',
    question: 'What sustained trajectory supports delivery at increasing scope?',
    evidence: 'Execution history, artifacts, and production practice.',
    handoff: 'Then return to Motivation and read the full arc as one coherent system.',
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
