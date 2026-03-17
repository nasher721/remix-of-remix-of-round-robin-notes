const HINDSIGHT_BASE_URL = import.meta.env.VITE_HINDSIGHT_BASE_URL as string | undefined
const HINDSIGHT_API_KEY = import.meta.env.VITE_HINDSIGHT_API_KEY as string | undefined

const isConfigured = Boolean(HINDSIGHT_BASE_URL && HINDSIGHT_API_KEY)

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export interface HindsightMetadata extends Record<string, JsonValue> {}

export interface HindsightFilters extends Record<string, JsonValue> {}

export interface RetainMemoryParams {
  bankId: string
  content: string
  metadata?: HindsightMetadata
}

export interface HindsightMemory {
  id: string
  bankId: string
  content: string
  metadata?: HindsightMetadata
  createdAt?: string
  updatedAt?: string
}

export interface RecallMemoriesParams {
  bankId: string
  query: string
  filters?: HindsightFilters
  limit?: number
}

export interface RecallMemoriesResult {
  memories: HindsightMemory[]
}

export interface ReflectOnMemoriesParams {
  bankId: string
  query: string
  filters?: HindsightFilters
  maxTokens?: number
}

export interface HindsightReflection {
  summary: string
  insights?: string[]
  relatedMemories?: HindsightMemory[]
}

export interface ReflectOnMemoriesResult {
  reflection: HindsightReflection
}

async function hindsightFetch<TResponse>(
  path: string,
  options: RequestInit & { signal?: AbortSignal } = {}
): Promise<TResponse | null> {
  if (!isConfigured) {
    return null
  }

  const base = HINDSIGHT_BASE_URL!.replace(/\/+$/, '')
  const url = `${base}/${path.replace(/^\/+/, '')}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${HINDSIGHT_API_KEY}`,
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    console.error('Hindsight API error', {
      url,
      status: response.status,
      statusText: response.statusText,
    })
    return null
  }

  if (response.status === 204) {
    return null
  }

  try {
    const data = (await response.json()) as TResponse
    return data
  } catch (err) {
    console.error('Failed to parse Hindsight response JSON', { url, err })
    return null
  }
}

export const retainMemory = async (
  params: RetainMemoryParams,
  options?: { signal?: AbortSignal }
): Promise<void> => {
  if (!isConfigured) {
    return
  }

  await hindsightFetch<unknown>('/memories/retain', {
    body: JSON.stringify({
      bankId: params.bankId,
      content: params.content,
      metadata: params.metadata ?? {},
    }),
    signal: options?.signal,
  })
}

export const recallMemories = async (
  params: RecallMemoriesParams,
  options?: { signal?: AbortSignal }
): Promise<RecallMemoriesResult | null> => {
  const result = await hindsightFetch<RecallMemoriesResult>('/memories/recall', {
    body: JSON.stringify({
      bankId: params.bankId,
      query: params.query,
      filters: params.filters ?? {},
      limit: params.limit,
    }),
    signal: options?.signal,
  })
  return result
}

export const reflectOnMemories = async (
  params: ReflectOnMemoriesParams,
  options?: { signal?: AbortSignal }
): Promise<ReflectOnMemoriesResult | null> => {
  const result = await hindsightFetch<ReflectOnMemoriesResult>('/memories/reflect', {
    body: JSON.stringify({
      bankId: params.bankId,
      query: params.query,
      filters: params.filters ?? {},
      maxTokens: params.maxTokens,
    }),
    signal: options?.signal,
  })
  return result
}

