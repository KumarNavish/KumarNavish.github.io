import { describe, expect, it } from 'vitest'

import { parseLatestRunApi, parseProjectsApi, parseSearchIndexApi } from './api'

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

  it('parses search index payload shape', () => {
    const parsed = parseSearchIndexApi({
      generated_at: '2026-02-14T00:00:00Z',
      schema: 'v1',
      document_count: 1,
      term_count: 2,
      source_provenance: { projects: 'github_api' },
      documents: [
        {
          doc_id: 0,
          id: 'project:CL-PLO',
          type: 'project',
          title: 'CL-PLO',
          subtitle: 'sandbox',
          route: '/projects',
          url: 'https://github.com/KumarNavish/CL-PLO',
        },
      ],
      postings: {
        continual: [0],
      },
    })

    expect(parsed.document_count).toBe(1)
    expect(parsed.documents[0].type).toBe('project')
    expect(parsed.postings.continual).toEqual([0])
  })

  it('parses latest run payload with task logs', () => {
    const parsed = parseLatestRunApi({
      run: {
        status: 'success',
        timestamp: '2026-02-14T00:00:00Z',
        started_at: '2026-02-14T00:00:00Z',
        finished_at: '2026-02-14T00:00:01Z',
        duration_seconds: 1,
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
          inputs: ['api/v1/projects.json'],
          outputs: ['api/v1/profile.json'],
          deps: ['emit_projects_api'],
          started_at: '2026-02-14T00:00:00Z',
          finished_at: '2026-02-14T00:00:01Z',
          duration_seconds: 1,
          logs: [
            {
              level: 'warning',
              message: 'sample warning',
              timestamp: '2026-02-14T00:00:00Z',
            },
          ],
          error: null,
        },
      ],
    })

    expect(parsed.summary.success).toBe(1)
    expect(parsed.tasks[0].logs[0].level).toBe('warning')
    expect(parsed.tasks[0].name).toBe('emit_profile_api')
  })
})
