import { describe, expect, it } from 'vitest'

import {
  createDecisionBlueprint,
  renderDecisionBriefMarkdown,
  type DecisionInput,
} from './decisionEngine'
import type { ProjectItem, PublicationItem } from './api'

function project(overrides: Partial<ProjectItem>): ProjectItem {
  return {
    name: 'Example Project',
    html_url: 'https://example.com/repo',
    description: 'baseline project',
    topics: [],
    tags: [],
    language_breakdown: {},
    stars: 0,
    forks: 0,
    last_push: null,
    homepage: null,
    featured: false,
    pinned: false,
    demo_url: null,
    paper_url: null,
    one_line: null,
    ...overrides,
  }
}

function publication(overrides: Partial<PublicationItem>): PublicationItem {
  return {
    id: 'paper-1',
    title: 'Baseline publication',
    year: 2024,
    venue: 'Venue',
    citation_count: 0,
    authors: [],
    keywords: [],
    url: null,
    pdf_url: null,
    summary: null,
    source: 'overrides',
    ...overrides,
  }
}

describe('decision engine', () => {
  it('produces concrete output sections', () => {
    const input: DecisionInput = {
      challenge: 'continual_reliability',
      goal: 'pilot',
      horizon: '12w',
      risk: 'balanced',
      context: '',
    }

    const blueprint = createDecisionBlueprint(input, {
      projects: [project({ name: 'CL-PLO', tags: ['continual-learning'] })],
      publications: [publication({ title: 'Continual learning paper' })],
    })

    expect(blueprint.executionPlan).toHaveLength(4)
    expect(blueprint.immediateActions).toHaveLength(3)
    expect(blueprint.kpis).toHaveLength(3)
    expect(blueprint.risks.length).toBeGreaterThan(1)
    expect(blueprint.challengeTitle).toBe('Continual learning reliability')
  })

  it('renders a reusable markdown brief', () => {
    const input: DecisionInput = {
      challenge: 'online_safety',
      goal: 'diagnose',
      horizon: '2w',
      risk: 'conservative',
      context: 'high-risk conversation channels',
    }

    const blueprint = createDecisionBlueprint(input, {
      projects: [
        project({ name: 'Generic' }),
        project({ name: 'Twitter-Hate-and-counter-speakers', tags: ['twitter', 'moderation'] }),
      ],
      publications: [
        publication({ title: 'Interaction dynamics between hate and counterspeech accounts' }),
      ],
    })

    const markdown = renderDecisionBriefMarkdown(input, blueprint)

    expect(markdown).toContain('# Decision Brief: Online safety intervention design')
    expect(markdown).toContain('## Next 72 Hours')
    expect(markdown).toContain('Context: high-risk conversation channels')
    expect(markdown).toContain('Implementation Anchor: Twitter-Hate-and-counter-speakers')
  })
})
