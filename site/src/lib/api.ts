export type TaskStatus = 'success' | 'failed' | 'skipped'

export interface ProjectItem {
  name: string
  html_url: string
  description: string
  topics: string[]
  tags: string[]
  language_breakdown: Record<string, number>
  stars: number
  forks: number
  last_push: string | null
  homepage: string | null
  featured: boolean
  pinned: boolean
  demo_url: string | null
  paper_url: string | null
  one_line: string | null
}

export interface ProjectsApi {
  generated_at: string
  source: string
  warning: string | null
  count: number
  items: ProjectItem[]
}

export interface PublicationItem {
  id: string
  title: string
  year: number | null
  venue: string | null
  citation_count: number | null
  authors: string[]
  keywords: string[]
  url: string | null
  pdf_url: string | null
  summary: string | null
  source: string
}

export interface PublicationsApi {
  generated_at: string
  source: string
  warning: string | null
  count: number
  items: PublicationItem[]
}

export interface MetricsPoint {
  year: number
  citations: number
}

export interface MetricsApi {
  generated_at: string
  source: string
  works_count: number
  citations_total: number | null
  citations_by_year: MetricsPoint[]
  top_venues: { venue: string; works: number }[]
  topics: { topic: string; count: number }[]
}

export interface SearchDocument {
  doc_id: number
  id: string
  type: 'project' | 'publication'
  title: string
  subtitle: string
  route: string
  url: string | null
}

export interface SearchIndexApi {
  generated_at: string
  schema: string
  document_count: number
  term_count: number
  source_provenance: Record<string, string | null>
  documents: SearchDocument[]
  postings: Record<string, number[]>
}

export interface ProfileApi {
  generated_at: string
  site_title: string | null
  identity: {
    github_username: string
    semantic_scholar_author_id: string | null
    timezone: string | null
    refresh_policy: string | null
  }
  links: Record<string, string>
  counts: {
    projects: number
    featured_projects: number
    publications: number
    works_count: number | null
    citations_total: number | null
  }
  featured: {
    projects: {
      name: string
      one_line: string | null
      html_url: string | null
      demo_url: string | null
      stars: number
    }[]
    publications: {
      id: string | null
      title: string
      year: number | null
      venue: string | null
      citation_count: number | null
      url: string | null
    }[]
  }
  last_sync: {
    last_run_timestamp: string
    generated_at: string
  }
  source_provenance: Record<string, string | null>
}

export interface StatusApi {
  status: string
  generated_at: string
  message: string
}

export interface LatestRunTaskLog {
  level: 'info' | 'warning' | 'error'
  message: string
  timestamp: string
}

export interface LatestRunTask {
  name: string
  status: TaskStatus
  inputs: string[]
  outputs: string[]
  deps: string[]
  started_at: string
  finished_at: string
  duration_seconds: number
  logs: LatestRunTaskLog[]
  error: string | null
}

export interface LatestRunApi {
  run: {
    status: string
    timestamp: string
    started_at: string
    finished_at: string
    duration_seconds: number
    git_sha: string
    task_count: number
    action_run_url?: string
  }
  summary: {
    success: number
    failed: number
    skipped: number
  }
  tasks: LatestRunTask[]
}

export interface DagApi {
  generated_at: string
  tasks: {
    name: string
    inputs: string[]
    outputs: string[]
    deps: string[]
  }[]
  edges: {
    from: string
    to: string
  }[]
}

export interface ProvenanceApi {
  generated_at: string
  git_sha: string
  pipeline: {
    python_version: string
    platform: string
  }
  environment: Record<string, string | null>
  artifacts: Record<string, string>
  action_run_url?: string
}

type JsonObject = Record<string, unknown>

function asObject(value: unknown, context: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`invalid ${context}: expected object`)
  }
  return value as JsonObject
}

function asString(value: unknown, context: string): string {
  if (typeof value !== 'string') {
    throw new Error(`invalid ${context}: expected string`)
  }
  return value
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`invalid ${context}: expected number`)
  }
  return value
}

function asBoolean(value: unknown, context: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`invalid ${context}: expected boolean`)
  }
  return value
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string')
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is number => typeof item === 'number')
}

function asRecordNumber(value: unknown): Record<string, number> {
  const object = asObject(value, 'record<number>')
  const result: Record<string, number> = {}
  for (const [key, rawValue] of Object.entries(object)) {
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      result[key] = rawValue
    }
  }
  return result
}

function asRecordNullableString(value: unknown): Record<string, string | null> {
  const object = asObject(value, 'record<string|null>')
  const result: Record<string, string | null> = {}
  for (const [key, rawValue] of Object.entries(object)) {
    result[key] = typeof rawValue === 'string' ? rawValue : null
  }
  return result
}

export function parseProjectsApi(payload: unknown): ProjectsApi {
  const root = asObject(payload, 'projects payload')
  const itemsRaw = root.items
  if (!Array.isArray(itemsRaw)) {
    throw new Error('invalid projects payload: items must be array')
  }

  const items = itemsRaw.map((itemRaw, index): ProjectItem => {
    const item = asObject(itemRaw, `project item ${index}`)
    return {
      name: asString(item.name, `project item ${index}.name`),
      html_url: asString(item.html_url, `project item ${index}.html_url`),
      description: typeof item.description === 'string' ? item.description : '',
      topics: asStringArray(item.topics),
      tags: asStringArray(item.tags),
      language_breakdown: asRecordNumber(item.language_breakdown ?? {}),
      stars: asNumber(item.stars, `project item ${index}.stars`),
      forks: asNumber(item.forks, `project item ${index}.forks`),
      last_push: asNullableString(item.last_push),
      homepage: asNullableString(item.homepage),
      featured: asBoolean(item.featured, `project item ${index}.featured`),
      pinned: asBoolean(item.pinned, `project item ${index}.pinned`),
      demo_url: asNullableString(item.demo_url),
      paper_url: asNullableString(item.paper_url),
      one_line: asNullableString(item.one_line),
    }
  })

  return {
    generated_at: asString(root.generated_at, 'projects.generated_at'),
    source: asString(root.source, 'projects.source'),
    warning: asNullableString(root.warning),
    count: asNumber(root.count, 'projects.count'),
    items,
  }
}

export function parsePublicationsApi(payload: unknown): PublicationsApi {
  const root = asObject(payload, 'publications payload')
  const itemsRaw = root.items
  if (!Array.isArray(itemsRaw)) {
    throw new Error('invalid publications payload: items must be array')
  }

  const items = itemsRaw.map((itemRaw, index): PublicationItem => {
    const item = asObject(itemRaw, `publication item ${index}`)
    return {
      id: asString(item.id, `publication item ${index}.id`),
      title: asString(item.title, `publication item ${index}.title`),
      year: typeof item.year === 'number' ? item.year : null,
      venue: asNullableString(item.venue),
      citation_count: typeof item.citation_count === 'number' ? item.citation_count : null,
      authors: asStringArray(item.authors),
      keywords: asStringArray(item.keywords),
      url: asNullableString(item.url),
      pdf_url: asNullableString(item.pdf_url),
      summary: asNullableString(item.summary),
      source: asString(item.source, `publication item ${index}.source`),
    }
  })

  return {
    generated_at: asString(root.generated_at, 'publications.generated_at'),
    source: asString(root.source, 'publications.source'),
    warning: asNullableString(root.warning),
    count: asNumber(root.count, 'publications.count'),
    items,
  }
}

export function parseMetricsApi(payload: unknown): MetricsApi {
  const root = asObject(payload, 'metrics payload')
  const pointsRaw = root.citations_by_year
  const venuesRaw = root.top_venues
  const topicsRaw = root.topics

  if (!Array.isArray(pointsRaw) || !Array.isArray(venuesRaw) || !Array.isArray(topicsRaw)) {
    throw new Error('invalid metrics payload: array fields missing')
  }

  return {
    generated_at: asString(root.generated_at, 'metrics.generated_at'),
    source: asString(root.source, 'metrics.source'),
    works_count: asNumber(root.works_count, 'metrics.works_count'),
    citations_total: typeof root.citations_total === 'number' ? root.citations_total : null,
    citations_by_year: pointsRaw.map((pointRaw, index) => {
      const point = asObject(pointRaw, `metrics.citations_by_year[${index}]`)
      return {
        year: asNumber(point.year, `metrics.citations_by_year[${index}].year`),
        citations: asNumber(point.citations, `metrics.citations_by_year[${index}].citations`),
      }
    }),
    top_venues: venuesRaw.map((venueRaw, index) => {
      const venue = asObject(venueRaw, `metrics.top_venues[${index}]`)
      return {
        venue: asString(venue.venue, `metrics.top_venues[${index}].venue`),
        works: asNumber(venue.works, `metrics.top_venues[${index}].works`),
      }
    }),
    topics: topicsRaw.map((topicRaw, index) => {
      const topic = asObject(topicRaw, `metrics.topics[${index}]`)
      return {
        topic: asString(topic.topic, `metrics.topics[${index}].topic`),
        count: asNumber(topic.count, `metrics.topics[${index}].count`),
      }
    }),
  }
}

export function parseSearchIndexApi(payload: unknown): SearchIndexApi {
  const root = asObject(payload, 'search index payload')
  const documentsRaw = root.documents
  const postingsRaw = root.postings
  if (!Array.isArray(documentsRaw)) {
    throw new Error('invalid search index payload: documents must be array')
  }

  return {
    generated_at: asString(root.generated_at, 'search.generated_at'),
    schema: asString(root.schema, 'search.schema'),
    document_count: asNumber(root.document_count, 'search.document_count'),
    term_count: asNumber(root.term_count, 'search.term_count'),
    source_provenance: asRecordNullableString(root.source_provenance ?? {}),
    documents: documentsRaw.map((documentRaw, index) => {
      const document = asObject(documentRaw, `search.documents[${index}]`)
      const type = asString(document.type, `search.documents[${index}].type`)
      if (type !== 'project' && type !== 'publication') {
        throw new Error(`invalid search document type at index ${index}`)
      }
      return {
        doc_id: asNumber(document.doc_id, `search.documents[${index}].doc_id`),
        id: asString(document.id, `search.documents[${index}].id`),
        type,
        title: asString(document.title, `search.documents[${index}].title`),
        subtitle: typeof document.subtitle === 'string' ? document.subtitle : '',
        route: asString(document.route, `search.documents[${index}].route`),
        url: asNullableString(document.url),
      }
    }),
    postings: Object.fromEntries(
      Object.entries(asObject(postingsRaw ?? {}, 'search.postings')).map(([term, docIds]) => [
        term,
        asNumberArray(docIds),
      ]),
    ),
  }
}

export function parseProfileApi(payload: unknown): ProfileApi {
  const root = asObject(payload, 'profile payload')
  const identity = asObject(root.identity, 'profile.identity')
  const counts = asObject(root.counts, 'profile.counts')
  const featured = asObject(root.featured, 'profile.featured')
  const lastSync = asObject(root.last_sync, 'profile.last_sync')
  const featuredProjectsRaw = featured.projects
  const featuredPublicationsRaw = featured.publications

  if (!Array.isArray(featuredProjectsRaw) || !Array.isArray(featuredPublicationsRaw)) {
    throw new Error('invalid profile payload: featured arrays missing')
  }

  return {
    generated_at: asString(root.generated_at, 'profile.generated_at'),
    site_title: asNullableString(root.site_title),
    identity: {
      github_username: asString(identity.github_username, 'profile.identity.github_username'),
      semantic_scholar_author_id: asNullableString(identity.semantic_scholar_author_id),
      timezone: asNullableString(identity.timezone),
      refresh_policy: asNullableString(identity.refresh_policy),
    },
    links: Object.fromEntries(
      Object.entries(asObject(root.links ?? {}, 'profile.links')).map(([key, value]) => [
        key,
        typeof value === 'string' ? value : '',
      ]),
    ),
    counts: {
      projects: asNumber(counts.projects, 'profile.counts.projects'),
      featured_projects: asNumber(counts.featured_projects, 'profile.counts.featured_projects'),
      publications: asNumber(counts.publications, 'profile.counts.publications'),
      works_count: typeof counts.works_count === 'number' ? counts.works_count : null,
      citations_total: typeof counts.citations_total === 'number' ? counts.citations_total : null,
    },
    featured: {
      projects: featuredProjectsRaw.map((projectRaw, index) => {
        const project = asObject(projectRaw, `profile.featured.projects[${index}]`)
        return {
          name: asString(project.name, `profile.featured.projects[${index}].name`),
          one_line: asNullableString(project.one_line),
          html_url: asNullableString(project.html_url),
          demo_url: asNullableString(project.demo_url),
          stars: typeof project.stars === 'number' ? project.stars : 0,
        }
      }),
      publications: featuredPublicationsRaw.map((publicationRaw, index) => {
        const publication = asObject(publicationRaw, `profile.featured.publications[${index}]`)
        return {
          id: asNullableString(publication.id),
          title: asString(publication.title, `profile.featured.publications[${index}].title`),
          year: typeof publication.year === 'number' ? publication.year : null,
          venue: asNullableString(publication.venue),
          citation_count: typeof publication.citation_count === 'number' ? publication.citation_count : null,
          url: asNullableString(publication.url),
        }
      }),
    },
    last_sync: {
      last_run_timestamp: asString(lastSync.last_run_timestamp, 'profile.last_sync.last_run_timestamp'),
      generated_at: asString(lastSync.generated_at, 'profile.last_sync.generated_at'),
    },
    source_provenance: asRecordNullableString(root.source_provenance ?? {}),
  }
}

export function parseStatusApi(payload: unknown): StatusApi {
  const root = asObject(payload, 'status payload')
  return {
    status: asString(root.status, 'status.status'),
    generated_at: asString(root.generated_at, 'status.generated_at'),
    message: asString(root.message, 'status.message'),
  }
}

export function parseLatestRunApi(payload: unknown): LatestRunApi {
  const root = asObject(payload, 'latest run payload')
  const run = asObject(root.run, 'latest run.run')
  const summary = asObject(root.summary, 'latest run.summary')
  const tasksRaw = root.tasks
  if (!Array.isArray(tasksRaw)) {
    throw new Error('invalid latest run payload: tasks must be array')
  }

  return {
    run: {
      status: asString(run.status, 'latest run.run.status'),
      timestamp: asString(run.timestamp, 'latest run.run.timestamp'),
      started_at: asString(run.started_at, 'latest run.run.started_at'),
      finished_at: asString(run.finished_at, 'latest run.run.finished_at'),
      duration_seconds: asNumber(run.duration_seconds, 'latest run.run.duration_seconds'),
      git_sha: asString(run.git_sha, 'latest run.run.git_sha'),
      task_count: asNumber(run.task_count, 'latest run.run.task_count'),
      action_run_url: typeof run.action_run_url === 'string' ? run.action_run_url : undefined,
    },
    summary: {
      success: asNumber(summary.success, 'latest run.summary.success'),
      failed: asNumber(summary.failed, 'latest run.summary.failed'),
      skipped: asNumber(summary.skipped, 'latest run.summary.skipped'),
    },
    tasks: tasksRaw.map((taskRaw, index) => {
      const task = asObject(taskRaw, `latest run.tasks[${index}]`)
      const status = asString(task.status, `latest run.tasks[${index}].status`)
      if (status !== 'success' && status !== 'failed' && status !== 'skipped') {
        throw new Error(`invalid task status at index ${index}`)
      }
      const logsRaw = Array.isArray(task.logs) ? task.logs : []
      return {
        name: asString(task.name, `latest run.tasks[${index}].name`),
        status,
        inputs: asStringArray(task.inputs),
        outputs: asStringArray(task.outputs),
        deps: asStringArray(task.deps),
        started_at: asString(task.started_at, `latest run.tasks[${index}].started_at`),
        finished_at: asString(task.finished_at, `latest run.tasks[${index}].finished_at`),
        duration_seconds: asNumber(task.duration_seconds, `latest run.tasks[${index}].duration_seconds`),
        logs: logsRaw
          .map((logRaw): LatestRunTaskLog | null => {
            if (!logRaw || typeof logRaw !== 'object' || Array.isArray(logRaw)) {
              return null
            }
            const log = logRaw as JsonObject
            const level = typeof log.level === 'string' ? log.level : ''
            if (level !== 'info' && level !== 'warning' && level !== 'error') {
              return null
            }
            if (typeof log.message !== 'string' || typeof log.timestamp !== 'string') {
              return null
            }
            return { level, message: log.message, timestamp: log.timestamp }
          })
          .filter((log): log is LatestRunTaskLog => log !== null),
        error: asNullableString(task.error),
      }
    }),
  }
}

export function parseDagApi(payload: unknown): DagApi {
  const root = asObject(payload, 'dag payload')
  const tasksRaw = root.tasks
  const edgesRaw = root.edges
  if (!Array.isArray(tasksRaw) || !Array.isArray(edgesRaw)) {
    throw new Error('invalid dag payload: arrays missing')
  }

  return {
    generated_at: asString(root.generated_at, 'dag.generated_at'),
    tasks: tasksRaw.map((taskRaw, index) => {
      const task = asObject(taskRaw, `dag.tasks[${index}]`)
      return {
        name: asString(task.name, `dag.tasks[${index}].name`),
        inputs: asStringArray(task.inputs),
        outputs: asStringArray(task.outputs),
        deps: asStringArray(task.deps),
      }
    }),
    edges: edgesRaw.map((edgeRaw, index) => {
      const edge = asObject(edgeRaw, `dag.edges[${index}]`)
      return {
        from: asString(edge.from, `dag.edges[${index}].from`),
        to: asString(edge.to, `dag.edges[${index}].to`),
      }
    }),
  }
}

export function parseProvenanceApi(payload: unknown): ProvenanceApi {
  const root = asObject(payload, 'provenance payload')
  const pipeline = asObject(root.pipeline, 'provenance.pipeline')
  return {
    generated_at: asString(root.generated_at, 'provenance.generated_at'),
    git_sha: asString(root.git_sha, 'provenance.git_sha'),
    pipeline: {
      python_version: asString(pipeline.python_version, 'provenance.pipeline.python_version'),
      platform: asString(pipeline.platform, 'provenance.pipeline.platform'),
    },
    environment: asRecordNullableString(root.environment ?? {}),
    artifacts: Object.fromEntries(
      Object.entries(asObject(root.artifacts ?? {}, 'provenance.artifacts')).map(([key, value]) => [
        key,
        typeof value === 'string' ? value : '',
      ]),
    ),
    action_run_url: typeof root.action_run_url === 'string' ? root.action_run_url : undefined,
  }
}

async function fetchJson<T>(url: string, parser: (payload: unknown) => T): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`request failed: ${url} (${response.status})`)
  }
  const payload = (await response.json()) as unknown
  return parser(payload)
}

export function fetchProjectsApi(): Promise<ProjectsApi> {
  return fetchJson('/api/v1/projects.json', parseProjectsApi)
}

export function fetchPublicationsApi(): Promise<PublicationsApi> {
  return fetchJson('/api/v1/publications.json', parsePublicationsApi)
}

export function fetchMetricsApi(): Promise<MetricsApi> {
  return fetchJson('/api/v1/metrics.json', parseMetricsApi)
}

export function fetchSearchIndexApi(): Promise<SearchIndexApi> {
  return fetchJson('/api/v1/search-index.json', parseSearchIndexApi)
}

export function fetchProfileApi(): Promise<ProfileApi> {
  return fetchJson('/api/v1/profile.json', parseProfileApi)
}

export function fetchStatusApi(): Promise<StatusApi> {
  return fetchJson('/api/v1/status.json', parseStatusApi)
}

export function fetchLatestRunApi(): Promise<LatestRunApi> {
  return fetchJson('/ops/latest-run.json', parseLatestRunApi)
}

export function fetchDagApi(): Promise<DagApi> {
  return fetchJson('/ops/dag.json', parseDagApi)
}

export function fetchProvenanceApi(): Promise<ProvenanceApi> {
  return fetchJson('/ops/provenance.json', parseProvenanceApi)
}

