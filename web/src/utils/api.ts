import type {
  AdminBootstrapData,
  SourceListItem,
  SourceMethodCategory,
  TopicCategory,
  ValidationResult,
} from '../types'
import { buildAdminAuthHeader, clearAdminCredentials, getAdminCredentials } from './adminAuth'
import { runtimeConfig } from './runtime'

const API_BASE = runtimeConfig.apiBase

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isAdminRequest = path.startsWith('/api/admin')
  const adminCredentials = isAdminRequest ? getAdminCredentials() : null
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(adminCredentials ? { Authorization: buildAdminAuthHeader(adminCredentials) } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  })

  if (!response.ok) {
    if (response.status === 401 && isAdminRequest) {
      clearAdminCredentials()
    }
    const errorPayload = await response.json().catch(() => ({}))
    throw new Error(errorPayload.error || '请求失败')
  }

  return response.json() as Promise<T>
}

export async function fetchNews(range: '24h' | '7d') {
  if (runtimeConfig.isStaticDeploy) {
    const fileName = range === '7d' ? 'latest-7d.json' : 'latest-24h.json'
    const response = await fetch(runtimeConfig.staticDataUrl(fileName))
    if (!response.ok) {
      throw new Error('静态新闻数据加载失败')
    }
    return response.json()
  }

  return request(`/api/news?range=${range}`)
}

export function fetchAdminBootstrap() {
  return request<AdminBootstrapData>('/api/admin/bootstrap')
}

export function createTopicCategory(payload: {
  name: string
  description?: string | null
  enabled?: boolean
  sortOrder?: number
}) {
  return request<TopicCategory>('/api/admin/topic-categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateTopicCategory(
  id: string,
  payload: {
    name: string
    description?: string | null
    enabled?: boolean
    sortOrder?: number
  }
) {
  return request<TopicCategory>(`/api/admin/topic-categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteTopicCategory(id: string) {
  return request<{ ok: boolean }>(`/api/admin/topic-categories/${id}`, { method: 'DELETE' })
}

export function createSourceMethodCategory(payload: {
  topicCategoryId: string
  name: string
  description?: string | null
  templateKey?: string
  allowCreate?: boolean
  enabled?: boolean
  sortOrder?: number
}) {
  return request<SourceMethodCategory>('/api/admin/source-method-categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateSourceMethodCategory(
  id: string,
  payload: {
    topicCategoryId: string
    name: string
    description?: string | null
    templateKey?: string
    allowCreate?: boolean
    enabled?: boolean
    sortOrder?: number
  }
) {
  return request<SourceMethodCategory>(`/api/admin/source-method-categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteSourceMethodCategory(id: string) {
  return request<{ ok: boolean }>(`/api/admin/source-method-categories/${id}`, { method: 'DELETE' })
}

export function validateSource(payload: {
  name: string
  topicCategoryId: string
  sourceMethodCategoryId: string
  baseUrl?: string
  feedUrl?: string
  htmlUrl?: string
  configPayload?: Record<string, unknown>
  status: 'enabled' | 'disabled'
  notes?: string | null
}) {
  return request<ValidationResult>('/api/admin/sources/validate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function createSource(payload: {
  name: string
  topicCategoryId: string
  sourceMethodCategoryId: string
  baseUrl?: string
  feedUrl?: string
  htmlUrl?: string
  configPayload?: Record<string, unknown>
  status: 'enabled' | 'disabled'
  notes?: string | null
}) {
  return request<SourceListItem>('/api/admin/sources', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateSource(
  id: string,
  payload: {
    name: string
    topicCategoryId: string
    sourceMethodCategoryId: string
    baseUrl?: string
    feedUrl?: string
    htmlUrl?: string
    configPayload?: Record<string, unknown>
    status: 'enabled' | 'disabled'
    notes?: string | null
  }
) {
  return request<SourceListItem>(`/api/admin/sources/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteSource(id: string) {
  return request<{ ok: boolean }>(`/api/admin/sources/${id}`, { method: 'DELETE' })
}

export function setSourceStatus(id: string, status: 'enabled' | 'disabled') {
  return request<{ ok: boolean }>(`/api/admin/sources/${id}/${status === 'enabled' ? 'enable' : 'disable'}`, {
    method: 'POST',
  })
}

export function setSourcesStatus(ids: string[], status: 'enabled' | 'disabled') {
  return request<{ ok: boolean }>('/api/admin/sources/bulk-status', {
    method: 'POST',
    body: JSON.stringify({ ids, status }),
  })
}

export function restoreSource(id: string) {
  return request<{ ok: boolean }>(`/api/admin/sources/${id}/restore`, { method: 'POST' })
}

export function restoreAllSources() {
  return request<{ ok: boolean }>('/api/admin/sources/restore-all', { method: 'POST' })
}

export function importOpmlSources(opmlContent: string) {
  return request<{ created: number; skipped: number }>('/api/admin/sources/opml-import', {
    method: 'POST',
    body: JSON.stringify({ opmlContent }),
  })
}

export async function exportOpmlSources() {
  const adminCredentials = getAdminCredentials()
  const response = await fetch(`${API_BASE}/api/admin/sources/opml-export`, {
    headers: adminCredentials ? { Authorization: buildAdminAuthHeader(adminCredentials) } : {},
  })
  if (!response.ok) {
    if (response.status === 401) {
      clearAdminCredentials()
    }
    throw new Error('导出 OPML 失败')
  }
  return response.text()
}
