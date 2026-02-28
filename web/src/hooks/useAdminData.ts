import { useCallback, useEffect, useState } from 'react'

import type {
  AdminBootstrapData,
  SourceListItem,
  SourceMethodCategory,
  TopicCategory,
  ValidationResult,
} from '../types'
import {
  createSource,
  createSourceMethodCategory,
  createTopicCategory,
  deleteSource,
  deleteSourceMethodCategory,
  deleteTopicCategory,
  fetchAdminBootstrap,
  restoreAllSources,
  restoreSource,
  setSourceStatus,
  setSourcesStatus,
  updateSource,
  updateSourceMethodCategory,
  updateTopicCategory,
  validateSource,
} from '../utils/api'

interface SourcePayload {
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

export function useAdminData() {
  const [data, setData] = useState<AdminBootstrapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const bootstrap = await fetchAdminBootstrap()
      setData(bootstrap)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const wrapMutation = useCallback(
    async <T,>(task: () => Promise<T>) => {
      setSaving(true)
      try {
        setError(null)
        const result = await task()
        await refresh()
        return result
      } catch (err) {
        setError(err instanceof Error ? err.message : '操作失败')
        throw err
      } finally {
        setSaving(false)
      }
    },
    [refresh]
  )

  return {
    data,
    loading,
    saving,
    error,
    refresh,
    createTopic: (payload: { name: string; description?: string | null; enabled?: boolean }) =>
      wrapMutation(() => createTopicCategory(payload)),
    updateTopic: (id: string, payload: { name: string; description?: string | null; enabled?: boolean }) =>
      wrapMutation(() => updateTopicCategory(id, payload)),
    deleteTopic: (id: string) => wrapMutation(() => deleteTopicCategory(id)),
    createMethod: (payload: {
      topicCategoryId: string
      name: string
      description?: string | null
      allowCreate?: boolean
      enabled?: boolean
    }) => wrapMutation(() => createSourceMethodCategory(payload)),
    updateMethod: (
      id: string,
      payload: {
        topicCategoryId: string
        name: string
        description?: string | null
        allowCreate?: boolean
        enabled?: boolean
      }
    ) => wrapMutation(() => updateSourceMethodCategory(id, payload)),
    deleteMethod: (id: string) => wrapMutation(() => deleteSourceMethodCategory(id)),
    validate: (payload: SourcePayload) => validateSource(payload),
    createSource: (payload: SourcePayload) => wrapMutation(() => createSource(payload)),
    updateSource: (id: string, payload: SourcePayload) => wrapMutation(() => updateSource(id, payload)),
    deleteSource: (id: string) => wrapMutation(() => deleteSource(id)),
    setSourceStatus: (id: string, status: 'enabled' | 'disabled') =>
      wrapMutation(() => setSourceStatus(id, status)),
    setSourcesStatus: (ids: string[], status: 'enabled' | 'disabled') =>
      wrapMutation(() => setSourcesStatus(ids, status)),
    restoreSource: (id: string) => wrapMutation(() => restoreSource(id)),
    restoreAllSources: () => wrapMutation(() => restoreAllSources()),
  }
}

export type UseAdminDataReturn = ReturnType<typeof useAdminData>
export type AdminData = AdminBootstrapData
export type AdminTopic = TopicCategory
export type AdminMethod = SourceMethodCategory
export type AdminSource = SourceListItem
export type SourceValidation = ValidationResult
