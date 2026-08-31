import { describe, expect, it } from 'vitest'

import {
  EXPERIENCE_STATUSES,
  RELATION_KINDS,
  RESEARCH_STATUSES,
  WORK_BY_ID,
  WORK_BY_ROUTE,
  WORK_PERIODS,
  WORK_REGISTRY,
  WORK_TYPES,
} from './workRegistry'

const REQUIRED_IDS = [
  'counterspeech-dynamics',
  'normalized-gain-laplacians',
  'extremal-gain-laplacian-bounds',
  'urban-microregion-logistics',
  'square-root-natural-gradient',
  'experience-replay-optimization',
  'rank-feasibility',
  'ticlm-replay-value',
  'casepath',
  'spatial-intelligence',
]

const GENERIC_ROUTES = new Set(['/', '/work', '/research', '/systems', '/frontier'])

function isPublicOrInternalUrl(value: string): boolean {
  return value.startsWith('/') || /^https:\/\//.test(value)
}

describe('canonical work registry', () => {
  it('contains the complete first-class body of work exactly once', () => {
    expect(WORK_REGISTRY).toHaveLength(REQUIRED_IDS.length)
    expect(new Set(WORK_REGISTRY.map((work) => work.id)).size).toBe(WORK_REGISTRY.length)
    expect(WORK_REGISTRY.map((work) => work.id).sort()).toEqual([...REQUIRED_IDS].sort())
  })

  it('uses only the canonical status and type taxonomies', () => {
    for (const work of WORK_REGISTRY) {
      expect(RESEARCH_STATUSES).toContain(work.researchStatus)
      expect(EXPERIENCE_STATUSES).toContain(work.experienceStatus)
      expect(WORK_PERIODS).toContain(work.period)
      expect(WORK_TYPES).toContain(work.type)
    }
  })

  it('requires the equal-spotlight fields for every work', () => {
    for (const work of WORK_REGISTRY) {
      expect(work.title.trim().length).toBeGreaterThan(8)
      expect(work.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(work.dateLabel.trim()).not.toBe('')
      expect(work.researchStatusLabel.trim()).not.toBe('')
      expect(work.question.trim().length).toBeGreaterThan(30)
      expect(work.contribution.trim().length).toBeGreaterThan(40)
      expect(work.evidenceAvailableNow.trim().length).toBeGreaterThan(30)
      expect(work.limitation.trim().length).toBeGreaterThan(30)
      expect(work.explanation15.trim().length).toBeGreaterThan(50)
      expect(work.explanation60.length).toBeGreaterThanOrEqual(3)
      expect(work.route).toMatch(/^\/(work|systems|frontier)\/[a-z0-9-]+$/)
      expect(GENERIC_ROUTES.has(work.route)).toBe(false)
      expect(work.metadata.title).toContain('Navish Kumar')
      expect(work.metadata.description.trim().length).toBeGreaterThan(40)
      expect(work.metadata.socialImage).toMatch(/^\/social\/[a-z0-9-]+\.svg$/)
    }
  })

  it('gives every work a unique, restorable route', () => {
    expect(new Set(WORK_REGISTRY.map((work) => work.route)).size).toBe(WORK_REGISTRY.length)
    expect(WORK_BY_ROUTE.size).toBe(WORK_REGISTRY.length)
  })

  it('keeps evidence links public and functional in shape', () => {
    for (const work of WORK_REGISTRY) {
      expect(work.evidence.length).toBeGreaterThan(0)
      for (const evidence of work.evidence) {
        expect(evidence.public).toBe(true)
        expect(isPublicOrInternalUrl(evidence.url)).toBe(true)
        expect(evidence.label.trim()).not.toBe('')
        expect(evidence.note.trim()).not.toBe('')
      }
    }
  })

  it('contains no broken or false relationship targets', () => {
    for (const work of WORK_REGISTRY) {
      for (const relation of work.relations) {
        expect(WORK_BY_ID.has(relation.targetId)).toBe(true)
        expect(relation.targetId).not.toBe(work.id)
        expect(RELATION_KINDS).toContain(relation.kind)
        expect(relation.note.trim().length).toBeGreaterThan(20)
      }
    }
  })

  it('distinguishes foundations, current work, and frontier', () => {
    const periods = new Set(WORK_REGISTRY.map((work) => work.period))
    expect(periods).toEqual(new Set(['foundations', 'current', 'frontier']))
    expect(WORK_REGISTRY.filter((work) => work.period === 'foundations').length).toBeGreaterThanOrEqual(5)
    expect(WORK_REGISTRY.filter((work) => work.period === 'current').length).toBeGreaterThanOrEqual(4)
    expect(WORK_REGISTRY.filter((work) => work.period === 'frontier')).toHaveLength(1)
  })

  it('does not inflate review, prototype, or ongoing work', () => {
    expect(WORK_BY_ID.get('experience-replay-optimization')?.researchStatus).toBe('under-revision')
    expect(WORK_BY_ID.get('rank-feasibility')?.researchStatus).toBe('under-review')
    expect(WORK_BY_ID.get('ticlm-replay-value')?.researchStatus).toBe('ongoing')
    expect(WORK_BY_ID.get('casepath')?.researchStatus).toBe('prototype')
    expect(WORK_BY_ID.get('spatial-intelligence')?.researchStatus).toBe('direction')
  })
})
