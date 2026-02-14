import { describe, expect, it } from 'vitest'

import { parseLatestRunApi, parseProjectsApi } from './api'

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

  it('parses latest run with task logs', () => {
    const parsed = parseLatestRunApi({
      run: {
        status: 'success',
        timestamp: '2026-02-14T00:00:00Z',
        started_at: '2026-02-14T00:00:00Z',
        finished_at: '2026-02-14T00:00:10Z',
        duration_seconds: 10,
        git_sha: 'abc123',
        task_count: 1,
      },
      summary: {
        success: 1,
        failed: 0,
        skipped: 0,
      },
      tasks: [
        {
          name: 'emit_profile_api',
          status: 'success',
          inputs: [],
          outputs: [],
          deps: [],
          started_at: '2026-02-14T00:00:00Z',
          finished_at: '2026-02-14T00:00:01Z',
          duration_seconds: 1,
          logs: [
            {
              level: 'info',
              message: 'ok',
              timestamp: '2026-02-14T00:00:01Z',
            },
          ],
          error: null,
        },
      ],
    })

    expect(parsed.tasks).toHaveLength(1)
    expect(parsed.tasks[0].logs[0].message).toBe('ok')
  })
})

