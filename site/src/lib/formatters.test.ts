import { describe, expect, it } from 'vitest'

import {
  compactList,
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
} from './formatters'

describe('formatters', () => {
  it('formats numbers with compact suffixes', () => {
    expect(formatNumber(138)).toBe('138')
    expect(formatNumber(1380)).toBe('1.4k')
    expect(formatNumber(1380000)).toBe('1.4M')
    expect(formatNumber(null)).toBe('n/a')
  })

  it('formats date strings', () => {
    expect(formatDate('2026-02-14T14:00:00Z')).toContain('2026')
    expect(formatDateTime('2026-02-14T14:00:00Z')).toContain('2026')
    expect(formatDate('not-a-date')).toBe('not-a-date')
  })

  it('formats durations', () => {
    expect(formatDuration(0.12)).toBe('120 ms')
    expect(formatDuration(1.245)).toBe('1.25 s')
  })

  it('compacts long lists', () => {
    expect(compactList(['a', 'b', 'c'], 4)).toBe('a, b, c')
    expect(compactList(['a', 'b', 'c', 'd', 'e'], 3)).toBe('a, b, c +2')
  })
})

