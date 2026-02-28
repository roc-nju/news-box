import { useEffect, useMemo, useState } from 'react'
import {
  Database,
  Newspaper,
  Search,
  RefreshCcw,
  RotateCcw,
  Rss,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react'

import { useAdminData } from '../hooks/useAdminData'
import type { FetcherTemplate, SourceListItem, SourceMethodCategory, TopicCategory, ValidationResult } from '../types'

type AdminView = 'categories' | 'sources' | 'recycle'

const navItems: Array<{ key: AdminView; label: string; icon: typeof Newspaper }> = [
  { key: 'categories', label: '分类管理', icon: Database },
  { key: 'sources', label: '订阅源管理', icon: Rss },
  { key: 'recycle', label: '回收站', icon: Trash2 },
]

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

function availabilityLabel(status: SourceListItem['availability_status']) {
  if (status === 'passed') return '可用'
  if (status === 'failed') return '不可用'
  return '待检测'
}

function availabilityClass(status: SourceListItem['availability_status']) {
  if (status === 'passed') return 'bg-emerald-100 text-emerald-700'
  if (status === 'failed') return 'bg-rose-100 text-rose-700'
  return 'bg-amber-100 text-amber-700'
}

function SourceStatusBadge({ source }: { source: SourceListItem }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className={cn('badge', availabilityClass(source.availability_status))}>
        {availabilityLabel(source.availability_status)}
      </span>
      <span className={cn('badge', source.status === 'enabled' ? 'bg-sky-100 text-sky-700' : 'bg-slate-200 text-slate-600')}>
        {source.status === 'enabled' ? '启用中' : '已停用'}
      </span>
    </div>
  )
}

export function AdminDashboard() {
  const {
    data,
    loading,
    saving,
    error,
    refresh,
    createTopic,
    updateTopic,
    deleteTopic,
    createMethod,
    updateMethod,
    deleteMethod,
    validate,
    createSource,
    updateSource,
    deleteSource,
    setSourceStatus,
    setSourcesStatus,
    restoreSource,
    restoreAllSources,
  } = useAdminData()
  const [view, setView] = useState<AdminView>('categories')
  const [editingTopic, setEditingTopic] = useState<TopicCategory | null>(null)
  const [editingMethod, setEditingMethod] = useState<SourceMethodCategory | null>(null)
  const [editingSource, setEditingSource] = useState<SourceListItem | null>(null)
  const [topicForm, setTopicForm] = useState({ name: '', description: '', enabled: true })
  const [methodForm, setMethodForm] = useState({
    topicCategoryId: '',
    name: '',
    description: '',
    allowCreate: true,
    enabled: true,
  })
  const [sourceForm, setSourceForm] = useState({
    name: '',
    topicCategoryId: '',
    sourceMethodCategoryId: '',
    status: 'enabled' as 'enabled' | 'disabled',
    notes: '',
  })
  const [sourceConfig, setSourceConfig] = useState<Record<string, string>>({})
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [validatedSnapshot, setValidatedSnapshot] = useState('')
  const [sourceError, setSourceError] = useState<string | null>(null)
  const [sourceSearch, setSourceSearch] = useState('')
  const [sourceTopicFilter, setSourceTopicFilter] = useState('all')
  const [sourceMethodFilter, setSourceMethodFilter] = useState('all')
  const [sourceStatusFilter, setSourceStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [sourceAvailabilityFilter, setSourceAvailabilityFilter] = useState<'all' | 'passed' | 'failed' | 'pending'>('all')
  const [sourceTemplateFilter, setSourceTemplateFilter] = useState('all')
  const [rssOnly, setRssOnly] = useState(false)
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([])

  const topics = data?.topicCategories || []
  const methods = data?.sourceMethodCategories || []
  const sources = data?.sources || []
  const recycleBin = data?.recycleBin || []
  const fetcherTemplates = data?.fetcherTemplates || []

  const filteredMethods = useMemo(
    () => methods.filter((method) => method.topic_category_id === sourceForm.topicCategoryId),
    [methods, sourceForm.topicCategoryId]
  )
  const selectedMethod = useMemo(
    () => methods.find((method) => method.id === sourceForm.sourceMethodCategoryId) || null,
    [methods, sourceForm.sourceMethodCategoryId]
  )
  const selectedTemplate = useMemo<FetcherTemplate | null>(
    () => fetcherTemplates.find((template) => template.key === selectedMethod?.template_key) || null,
    [fetcherTemplates, selectedMethod?.template_key]
  )
  const isRssMethod = selectedMethod?.template_key === 'rss'
  const templateSchema = useMemo(() => {
    if (!selectedTemplate?.config_schema) return null
    try {
      return JSON.parse(selectedTemplate.config_schema) as {
        required?: string[]
        properties?: Record<string, { label?: string; optional?: boolean }>
      }
    } catch {
      return null
    }
  }, [selectedTemplate])
  const schemaEntries = useMemo(
    () => Object.entries(templateSchema?.properties || {}).filter(([key]) => key !== 'feedUrl' && key !== 'htmlUrl'),
    [templateSchema]
  )
  const visibleSources = useMemo(() => {
    const query = sourceSearch.trim().toLowerCase()
    return sources.filter((source) => {
      if (rssOnly && source.template_key !== 'rss') return false
      if (sourceTopicFilter !== 'all' && source.topic_category_id !== sourceTopicFilter) return false
      if (sourceMethodFilter !== 'all' && source.source_method_category_id !== sourceMethodFilter) return false
      if (sourceStatusFilter !== 'all' && source.status !== sourceStatusFilter) return false
      if (sourceAvailabilityFilter !== 'all' && source.availability_status !== sourceAvailabilityFilter) return false
      if (sourceTemplateFilter !== 'all' && source.template_key !== sourceTemplateFilter) return false
      if (!query) return true
      return [
        source.name,
        source.base_url,
        source.topic_category_name,
        source.source_method_category_name,
        source.template_key,
        source.notes || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [
    rssOnly,
    sourceAvailabilityFilter,
    sourceMethodFilter,
    sourceSearch,
    sourceStatusFilter,
    sourceTemplateFilter,
    sourceTopicFilter,
    sources,
  ])
  const selectedSourceSet = useMemo(() => new Set(selectedSourceIds), [selectedSourceIds])
  const allVisibleSelected = visibleSources.length > 0 && visibleSources.every((source) => selectedSourceSet.has(source.id))

  const buildSourceSnapshot = () =>
    JSON.stringify({
      ...sourceForm,
      config: sourceConfig,
      notes: sourceForm.notes.trim(),
    })

  useEffect(() => {
    if (!editingTopic) {
      setTopicForm({ name: '', description: '', enabled: true })
      return
    }
    setTopicForm({
      name: editingTopic.name,
      description: editingTopic.description || '',
      enabled: editingTopic.enabled,
    })
  }, [editingTopic])

  useEffect(() => {
    if (!editingMethod) {
      setMethodForm({
        topicCategoryId: topics[0]?.id || '',
        name: '',
        description: '',
        allowCreate: true,
        enabled: true,
      })
      return
    }
    setMethodForm({
      topicCategoryId: editingMethod.topic_category_id,
      name: editingMethod.name,
      description: editingMethod.description || '',
      allowCreate: editingMethod.allow_create,
      enabled: editingMethod.enabled,
    })
  }, [editingMethod, topics])

  useEffect(() => {
    if (!editingSource) {
      setSourceForm({
        name: '',
        topicCategoryId: topics[0]?.id || '',
        sourceMethodCategoryId: '',
        status: 'enabled',
        notes: '',
      })
      setSourceConfig({})
      setValidation(null)
      setValidatedSnapshot('')
      return
    }
    const config = (() => {
      try {
        return JSON.parse((editingSource as SourceListItem & { config_payload: string }).config_payload || '{}')
      } catch {
        return {}
      }
    })() as Record<string, string>
    setSourceForm({
      name: editingSource.name,
      topicCategoryId: editingSource.topic_category_id,
      sourceMethodCategoryId: editingSource.source_method_category_id,
      status: editingSource.status,
      notes: editingSource.notes || '',
    })
    setSourceConfig(
      Object.fromEntries(
        Object.entries(config || {}).map(([key, value]) => [key, typeof value === 'string' ? value : String(value ?? '')])
      )
    )
    setValidation(null)
    setValidatedSnapshot('')
  }, [editingSource, topics])

  useEffect(() => {
    setValidation(null)
    setValidatedSnapshot('')
  }, [
    sourceForm.name,
    sourceForm.topicCategoryId,
    sourceForm.sourceMethodCategoryId,
    sourceForm.status,
    sourceForm.notes,
    sourceConfig,
  ])

  useEffect(() => {
    if (editingSource) return
    if (isRssMethod) {
      setSourceConfig((current) => ({
        feedUrl: current.feedUrl || '',
        htmlUrl: current.htmlUrl || '',
      }))
      return
    }
    setSourceConfig({})
  }, [editingSource, isRssMethod, selectedMethod?.template_key])

  useEffect(() => {
    setSelectedSourceIds((current) => current.filter((id) => visibleSources.some((source) => source.id === id)))
  }, [visibleSources])

  async function handleValidate() {
    setSourceError(null)
    try {
      const result = await validate({
        ...sourceForm,
        baseUrl: sourceConfig.baseUrl,
        feedUrl: sourceConfig.feedUrl,
        htmlUrl: sourceConfig.htmlUrl,
        configPayload: sourceConfig,
      })
      setValidation(result)
      setValidatedSnapshot(buildSourceSnapshot())
    } catch (err) {
      setValidation(null)
      setSourceError(err instanceof Error ? err.message : '检测失败')
    }
  }

  async function handleSaveSource() {
    setSourceError(null)
    try {
      if (!validation?.ok || validatedSnapshot !== buildSourceSnapshot()) {
        throw new Error('请先对当前表单执行可用性检测')
      }
      const payload = {
        ...sourceForm,
        baseUrl: sourceConfig.baseUrl,
        feedUrl: sourceConfig.feedUrl,
        htmlUrl: sourceConfig.htmlUrl,
        configPayload: sourceConfig,
      }
      if (editingSource) {
        await updateSource(editingSource.id, payload)
      } else {
        await createSource(payload)
      }
      setEditingSource(null)
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : '保存失败')
    }
  }

  async function handleDeleteSource(id: string, name: string) {
    if (!window.confirm(`确认删除订阅源“${name}”吗？删除后会进入回收站。`)) return
    await deleteSource(id)
    if (editingSource?.id === id) setEditingSource(null)
  }

  async function handleBulkStatus(status: 'enabled' | 'disabled') {
    if (selectedSourceIds.length === 0) return
    await setSourcesStatus(selectedSourceIds, status)
    setSelectedSourceIds([])
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Admin Console</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">订阅源管理中心</h1>
            <p className="mt-2 text-sm text-slate-500">
              第一阶段开放 RSS/OPML 模板配置，后台展示订阅源可用状态与回收站恢复。
            </p>
          </div>
          <button className="btn btn-ghost inline-flex items-center gap-2 self-start" onClick={() => void refresh()}>
            <RefreshCcw size={16} />
            刷新数据
          </button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[220px,1fr]">
        <aside className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <nav className="space-y-2">
            {navItems.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition',
                  view === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
                onClick={() => setView(key)}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="space-y-6">
          {error ? <div className="card p-4 text-sm text-rose-600">{error}</div> : null}
          {loading ? <div className="card p-6 text-sm text-slate-500">正在加载管理数据...</div> : null}

          {!loading && view === 'categories' ? (
            <>
              <div className="grid gap-6 xl:grid-cols-2">
                <div className="card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">业务主题</h2>
                    {editingTopic ? (
                      <button className="btn btn-ghost" onClick={() => setEditingTopic(null)}>
                        新建
                      </button>
                    ) : null}
                  </div>
                  <div className="space-y-3">
                    <input
                      className="input"
                      placeholder="业务主题名称"
                      value={topicForm.name}
                      onChange={(event) => setTopicForm((current) => ({ ...current, name: event.target.value }))}
                    />
                    <textarea
                      className="input min-h-[112px]"
                      placeholder="业务主题说明"
                      value={topicForm.description}
                      onChange={(event) =>
                        setTopicForm((current) => ({ ...current, description: event.target.value }))
                      }
                    />
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={topicForm.enabled}
                        onChange={(event) =>
                          setTopicForm((current) => ({ ...current, enabled: event.target.checked }))
                        }
                      />
                      启用该业务主题
                    </label>
                    <button
                      className="btn btn-primary inline-flex items-center gap-2"
                      disabled={saving}
                      onClick={async () => {
                        if (editingTopic) {
                          await updateTopic(editingTopic.id, topicForm)
                        } else {
                          await createTopic(topicForm)
                        }
                        setEditingTopic(null)
                      }}
                    >
                      <Save size={16} />
                      保存业务主题
                    </button>
                  </div>
                </div>

                <div className="card p-5">
                  <h2 className="text-lg font-semibold text-slate-900">现有业务主题</h2>
                  <div className="mt-4 space-y-3">
                    {topics.map((topic) => (
                      <div key={topic.id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-slate-900">{topic.name}</p>
                            <p className="mt-1 text-sm text-slate-500">{topic.description || '暂无说明'}</p>
                          </div>
                          <div className="flex gap-2">
                            <button className="btn btn-ghost" onClick={() => setEditingTopic(topic)}>
                              编辑
                            </button>
                            <button
                              className="btn btn-ghost text-rose-600"
                              onClick={async () => {
                                if (!window.confirm(`确认删除业务主题“${topic.name}”吗？`)) return
                                await deleteTopic(topic.id)
                                if (editingTopic?.id === topic.id) setEditingTopic(null)
                              }}
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <div className="card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">获取方式</h2>
                    {editingMethod ? (
                      <button className="btn btn-ghost" onClick={() => setEditingMethod(null)}>
                        新建
                      </button>
                    ) : null}
                  </div>
                  <select
                    className="input"
                    value={methodForm.topicCategoryId}
                    onChange={(event) =>
                      setMethodForm((current) => ({ ...current, topicCategoryId: event.target.value }))
                    }
                  >
                    <option value="">选择业务主题</option>
                    {topics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    placeholder="获取方式名称"
                    value={methodForm.name}
                    onChange={(event) => setMethodForm((current) => ({ ...current, name: event.target.value }))}
                  />
                  <textarea
                    className="input min-h-[112px]"
                    placeholder="抓取方式说明"
                    value={methodForm.description}
                    onChange={(event) =>
                      setMethodForm((current) => ({ ...current, description: event.target.value }))
                    }
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={methodForm.allowCreate}
                        onChange={(event) =>
                          setMethodForm((current) => ({ ...current, allowCreate: event.target.checked }))
                        }
                      />
                      允许新增实例
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={methodForm.enabled}
                        onChange={(event) =>
                          setMethodForm((current) => ({ ...current, enabled: event.target.checked }))
                        }
                      />
                      启用该获取方式
                    </label>
                  </div>
                  <button
                    className="btn btn-primary inline-flex items-center gap-2"
                    disabled={saving}
                    onClick={async () => {
                      if (editingMethod) {
                        await updateMethod(editingMethod.id, methodForm)
                      } else {
                        await createMethod(methodForm)
                      }
                      setEditingMethod(null)
                    }}
                  >
                    <Save size={16} />
                    保存获取方式
                  </button>
                </div>

                <div className="card p-5">
                  <h2 className="text-lg font-semibold text-slate-900">现有获取方式</h2>
                  <div className="mt-4 space-y-3">
                    {methods.map((method) => (
                      <div key={method.id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-slate-900">
                              {method.name}
                              <span className="ml-2 text-sm text-slate-400">/ {method.topic_category_name}</span>
                            </p>
                            <p className="mt-1 text-sm text-slate-500">{method.description || '暂无说明'}</p>
                            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                              模板 {method.template_key}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button className="btn btn-ghost" onClick={() => setEditingMethod(method)}>
                              编辑
                            </button>
                            <button
                              className="btn btn-ghost text-rose-600"
                              onClick={async () => {
                                if (!window.confirm(`确认删除获取方式“${method.name}”吗？`)) return
                                await deleteMethod(method.id)
                                if (editingMethod?.id === method.id) setEditingMethod(null)
                              }}
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {!loading && view === 'sources' ? (
            <div className="grid gap-6 xl:grid-cols-[360px,1fr]">
              <div className="card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">RSS 订阅源</h2>
                  {editingSource ? (
                    <button className="btn btn-ghost" onClick={() => setEditingSource(null)}>
                      新建
                    </button>
                  ) : null}
                </div>
                <input
                  className="input"
                  placeholder="订阅源名称"
                  value={sourceForm.name}
                  onChange={(event) => setSourceForm((current) => ({ ...current, name: event.target.value }))}
                />
                <select
                  className="input"
                  value={sourceForm.topicCategoryId}
                  onChange={(event) =>
                    setSourceForm((current) => ({
                      ...current,
                      topicCategoryId: event.target.value,
                      sourceMethodCategoryId: '',
                    }))
                  }
                >
                  <option value="">选择业务主题</option>
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
                <select
                  className="input"
                  value={sourceForm.sourceMethodCategoryId}
                  onChange={(event) =>
                    setSourceForm((current) => ({ ...current, sourceMethodCategoryId: event.target.value }))
                  }
                >
                  <option value="">选择获取方式</option>
                  {filteredMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name} / {method.template_key}
                    </option>
                  ))}
                </select>
                {selectedMethod ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    当前模板：<span className="font-medium text-slate-700">{selectedMethod.template_key}</span>
                    <div className="mt-1">{selectedMethod.description || '暂无模板说明'}</div>
                  </div>
                ) : null}
                {isRssMethod ? (
                  <>
                    <input
                      className="input"
                      placeholder="RSS 地址"
                      value={sourceConfig.feedUrl || ''}
                      onChange={(event) => setSourceConfig((current) => ({ ...current, feedUrl: event.target.value }))}
                    />
                    <input
                      className="input"
                      placeholder="站点地址（可选）"
                      value={sourceConfig.htmlUrl || ''}
                      onChange={(event) => setSourceConfig((current) => ({ ...current, htmlUrl: event.target.value }))}
                    />
                  </>
                ) : selectedMethod?.template_key?.startsWith('generic_') ? (
                  schemaEntries.map(([key, meta]) => (
                    <input
                      key={key}
                      className="input"
                      placeholder={meta.label || key}
                      value={sourceConfig[key] || ''}
                      onChange={(event) => setSourceConfig((current) => ({ ...current, [key]: event.target.value }))}
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
                    该模板属于内置抓取器类型，不需要额外填写源地址。保存前仍需先执行可用性检测。
                  </div>
                )}
                <select
                  className="input"
                  value={sourceForm.status}
                  onChange={(event) =>
                    setSourceForm((current) => ({
                      ...current,
                      status: event.target.value === 'disabled' ? 'disabled' : 'enabled',
                    }))
                  }
                >
                  <option value="enabled">启用</option>
                  <option value="disabled">停用</option>
                </select>
                <textarea
                  className="input min-h-[100px]"
                  placeholder="备注"
                  value={sourceForm.notes}
                  onChange={(event) => setSourceForm((current) => ({ ...current, notes: event.target.value }))}
                />
                <div className="flex flex-wrap gap-3">
                  <button className="btn btn-ghost inline-flex items-center gap-2" onClick={() => void handleValidate()}>
                    <ShieldCheck size={16} />
                    检测可用性
                  </button>
                  <button
                    className="btn btn-primary inline-flex items-center gap-2"
                    disabled={saving}
                    onClick={() => void handleSaveSource()}
                  >
                    <Save size={16} />
                    保存订阅源
                  </button>
                </div>
                {validation ? (
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-3 text-sm',
                      validation.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    )}
                  >
                    {validation.message}
                  </div>
                ) : null}
                {sourceError ? <div className="text-sm text-rose-600">{sourceError}</div> : null}
              </div>

              <div className="card p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">现有订阅源</h2>
                    <p className="mt-1 text-sm text-slate-500">列表中直接展示启用状态、可用状态和最近抓取结果。</p>
                  </div>
                  <span className="badge bg-slate-100 text-slate-600">{sources.length} 个订阅源</span>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <div className="mb-4 grid gap-3 lg:grid-cols-[1.4fr,repeat(5,minmax(0,1fr))]">
                    <label className="relative block">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        className="input pl-10"
                        placeholder="搜索名称、URL、分类、模板"
                        value={sourceSearch}
                        onChange={(event) => setSourceSearch(event.target.value)}
                      />
                    </label>
                    <select className="input" value={sourceTopicFilter} onChange={(event) => setSourceTopicFilter(event.target.value)}>
                      <option value="all">全部业务主题</option>
                      {topics.map((topic) => (
                        <option key={topic.id} value={topic.id}>
                          {topic.name}
                        </option>
                      ))}
                    </select>
                    <select className="input" value={sourceMethodFilter} onChange={(event) => setSourceMethodFilter(event.target.value)}>
                      <option value="all">全部获取方式</option>
                      {methods.map((method) => (
                        <option key={method.id} value={method.id}>
                          {method.name}
                        </option>
                      ))}
                    </select>
                    <select className="input" value={sourceTemplateFilter} onChange={(event) => setSourceTemplateFilter(event.target.value)}>
                      <option value="all">全部模板</option>
                      {fetcherTemplates.map((template) => (
                        <option key={template.id} value={template.key}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input"
                      value={sourceStatusFilter}
                      onChange={(event) => setSourceStatusFilter(event.target.value as 'all' | 'enabled' | 'disabled')}
                    >
                      <option value="all">全部启停状态</option>
                      <option value="enabled">启用中</option>
                      <option value="disabled">已停用</option>
                    </select>
                    <select
                      className="input"
                      value={sourceAvailabilityFilter}
                      onChange={(event) =>
                        setSourceAvailabilityFilter(event.target.value as 'all' | 'passed' | 'failed' | 'pending')
                      }
                    >
                      <option value="all">全部可用状态</option>
                      <option value="passed">可用</option>
                      <option value="failed">不可用</option>
                      <option value="pending">待检测</option>
                    </select>
                  </div>
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" checked={rssOnly} onChange={(event) => setRssOnly(event.target.checked)} />
                      只看 RSS 实例
                    </label>
                    <span className="text-sm text-slate-500">当前列表 {visibleSources.length} 条</span>
                    <button
                      className="btn btn-ghost"
                      disabled={selectedSourceIds.length === 0}
                      onClick={() => void handleBulkStatus('enabled')}
                    >
                      批量启用
                    </button>
                    <button
                      className="btn btn-ghost"
                      disabled={selectedSourceIds.length === 0}
                      onClick={() => void handleBulkStatus('disabled')}
                    >
                      批量停用
                    </button>
                  </div>
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="py-3 pr-3">
                          <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={(event) =>
                              setSelectedSourceIds(
                                event.target.checked ? visibleSources.map((source) => source.id) : []
                              )
                            }
                          />
                        </th>
                        <th className="py-3">订阅源</th>
                        <th className="py-3">分类</th>
                        <th className="py-3">状态</th>
                        <th className="py-3">最近检测</th>
                        <th className="py-3">最近抓取</th>
                        <th className="py-3">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleSources.map((source) => (
                        <tr key={source.id} className="border-t border-slate-100 align-top">
                          <td className="py-4 pr-3">
                            <input
                              type="checkbox"
                              checked={selectedSourceSet.has(source.id)}
                              onChange={(event) =>
                                setSelectedSourceIds((current) =>
                                  event.target.checked
                                    ? [...new Set([...current, source.id])]
                                    : current.filter((id) => id !== source.id)
                                )
                              }
                            />
                          </td>
                          <td className="py-4 pr-4">
                            <p className="font-medium text-slate-900">{source.name}</p>
                            <a className="mt-1 block text-xs text-slate-500" href={source.base_url} target="_blank" rel="noreferrer">
                              {source.base_url}
                            </a>
                          </td>
                          <td className="py-4 pr-4 text-slate-600">
                            <p>{source.topic_category_name}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              {source.source_method_category_name} / {source.template_key}
                            </p>
                          </td>
                          <td className="py-4 pr-4">
                            <SourceStatusBadge source={source} />
                            {source.availability_error ? (
                              <p className="mt-2 max-w-xs text-xs text-rose-600">{source.availability_error}</p>
                            ) : null}
                          </td>
                          <td className="py-4 pr-4 text-slate-600">
                            {source.availability_checked_at || '尚未检测'}
                          </td>
                          <td className="py-4 pr-4 text-slate-600">
                            <p>{source.last_fetch_status || '暂无'}</p>
                            <p className="mt-1 text-xs text-slate-400">{source.last_fetched_at || '未抓取'}</p>
                          </td>
                          <td className="py-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                className="btn btn-ghost"
                                onClick={() => void setSourceStatus(source.id, source.status === 'enabled' ? 'disabled' : 'enabled')}
                              >
                                {source.status === 'enabled' ? '停用' : '启用'}
                              </button>
                              <button className="btn btn-ghost" onClick={() => setEditingSource(source)}>
                                编辑
                              </button>
                              <button className="btn btn-ghost text-rose-600" onClick={() => void handleDeleteSource(source.id, source.name)}>
                                删除
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {!loading && view === 'recycle' ? (
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">回收站</h2>
                  <p className="mt-1 text-sm text-slate-500">软删除的订阅源会保留原状态，可单条恢复或一键恢复。</p>
                </div>
                <button className="btn btn-ghost inline-flex items-center gap-2" onClick={() => void restoreAllSources()}>
                  <RotateCcw size={16} />
                  一键恢复
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {recycleBin.length === 0 ? <div className="text-sm text-slate-500">回收站为空。</div> : null}
                {recycleBin.map((source) => (
                  <div key={source.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{source.name}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {source.topic_category_name} / {source.source_method_category_name}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">删除时间：{source.deleted_at}</p>
                      </div>
                      <button
                        className="btn btn-primary inline-flex items-center gap-2 self-start"
                        onClick={() => void restoreSource(source.id)}
                      >
                        <RotateCcw size={16} />
                        恢复
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
