import { describe, expect, it } from 'vitest'

import { parseProjectsApi } from './api'

describe('api parsers', () => {
  it('parses projects payload shape', () => {
    const parsed = parseProjectsApi({
      generated_at: '2026-02-14T00:00:00Z',
      source: 'github_api',
      warning: null,
      count: 1,
      items: [
        {
          name: 'CL-PLO',
          html_url: 'https://github.com/KumarNavish/CL-PLO',
          description: 'desc',
          topics: ['continual-learning'],
          tags: ['continual-learning', 'optimization'],
          language_breakdown: { Python: 100 },
          stars: 10,
          forks: 2,
          last_push: '2026-02-14T00:00:00Z',
          homepage: null,
          featured: true,
          pinned: true,
          demo_url: 'https://kumarnavish.github.io/CL-PLO/',
          paper_url: null,
          one_line: 'sandbox',
        },
      ],
    })

    expect(parsed.count).toBe(1)
    expect(parsed.items[0].name).toBe('CL-PLO')
    expect(parsed.items[0].language_breakdown.Python).toBe(100)
  })

  it('throws on invalid projects payload', () => {
    expect(() =>
      parseProjectsApi({
        generated_at: '2026-02-14T00:00:00Z',
        source: 'github_api',
        warning: null,
        count: 1,
        items: [{ html_url: 'https://example.com' }],
      }),
    ).toThrow()
  })
})
