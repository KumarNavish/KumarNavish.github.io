import type { CategoryCatalog, IntakeSample } from './types'
import { CategoryCatalogSchema, IntakeSamplesSchema } from './schema'

type FetchLike = typeof fetch

async function fetchJson<T>(
  path: string,
  parser: (value: unknown) => T,
  fetchImpl: FetchLike = fetch,
): Promise<T> {
  const base = import.meta.env.BASE_URL ?? '/'
  const response = await fetchImpl(`${base}${path}`)

  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`)
  }

  return parser(await response.json())
}

export async function loadIntakeSamples(fetchImpl?: FetchLike): Promise<IntakeSample[]> {
  return fetchJson(
    'data/intake_samples.json',
    (payload) => IntakeSamplesSchema.parse(payload),
    fetchImpl,
  )
}

export async function loadCategoryCatalog(fetchImpl?: FetchLike): Promise<CategoryCatalog> {
  return fetchJson(
    'data/category_catalog.json',
    (payload) => CategoryCatalogSchema.parse(payload),
    fetchImpl,
  )
}
