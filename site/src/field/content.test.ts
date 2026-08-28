import { describe, expect, it } from 'vitest'

import { EVIDENCE_CLAIMS, EVIDENCE_SOURCES, FIELD_ENTITIES } from './content'

describe('FIELD content graph', () => {
  it('binds every evidence claim to an existing source', () => {
    const sourceIds = new Set(EVIDENCE_SOURCES.map((source) => source.id))

    for (const claim of EVIDENCE_CLAIMS) {
      expect(claim.sourceIds.length).toBeGreaterThan(0)
      for (const sourceId of claim.sourceIds) {
        expect(sourceIds.has(sourceId)).toBe(true)
      }
    }
  })

  it('binds every entity source to an existing source', () => {
    const sourceIds = new Set(EVIDENCE_SOURCES.map((source) => source.id))

    for (const entity of FIELD_ENTITIES) {
      for (const sourceId of entity.sourceIds) {
        expect(sourceIds.has(sourceId)).toBe(true)
      }
    }
  })

  it('keeps ongoing private work explicit instead of fabricating public artifacts', () => {
    const ongoing = FIELD_ENTITIES.filter((entity) => entity.status === 'ongoing')

    expect(ongoing.length).toBeGreaterThan(0)
    for (const entity of ongoing) {
      expect(entity.statusLabel.toLowerCase()).toMatch(/ongoing|direction/)
      if (!entity.public) {
        expect(entity.sourceIds).toHaveLength(0)
      }
    }
  })
})
