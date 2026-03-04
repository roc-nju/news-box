export interface MediaItem {
  type: 'image' | 'video'
  url: string
  posterUrl?: string | null
}

export interface NewsItem {
  id: string
  site_id: string
  site_name: string
  source: string
  title: string
  url: string
  published_at: string | null
  first_seen_at: string
  last_seen_at: string
  content_text?: string | null
  media_items?: MediaItem[]
  title_original: string
  title_en: string | null
  title_zh: string | null
  title_bilingual: string
}

export interface SiteStat {
  site_id: string
  site_name: string
  count: number
  raw_count: number
}

export interface NewsData {
  generated_at: string
  window_hours: number
  total_items: number
  total_items_ai_raw: number
  total_items_raw: number
  total_items_all_mode: number
  topic_filter: string
  archive_total: number
  site_count: number
  source_count: number
  site_stats: SiteStat[]
  items: NewsItem[]
}

export interface SourceStatus {
  generated_at: string
  sites: SiteStatus[]
  successful_sites: number
  failed_sites: string[]
  zero_item_sites: string[]
  fetched_raw_items: number
  items_before_topic_filter: number
  items_in_24h: number
}

export interface SiteStatus {
  site_id: string
  site_name: string
  ok: boolean
  item_count: number
  duration_ms: number
  error: string | null
}

export interface TopicCategory {
  id: string
  name: string
  description: string | null
  sort_order: number
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface SourceMethodCategory {
  id: string
  topic_category_id: string
  topic_category_name?: string
  name: string
  description: string | null
  template_key: string
  allow_create: boolean
  sort_order: number
  enabled: boolean
  created_at: string
  updated_at: string
}

export type SourceStatusType = 'enabled' | 'disabled'
export type AvailabilityStatus = 'pending' | 'passed' | 'failed'

export interface SourceListItem {
  id: string
  name: string
  base_url: string
  config_payload: string
  status: SourceStatusType
  availability_status: AvailabilityStatus
  availability_checked_at: string | null
  availability_error: string | null
  last_fetched_at: string | null
  last_fetch_status: string | null
  last_fetch_error: string | null
  sort_order: number
  notes: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  topic_category_id: string
  topic_category_name: string
  source_method_category_id: string
  source_method_category_name: string
  template_key: string
}

export interface ValidationResult {
  ok: boolean
  message: string
  normalizedBaseUrl: string
  normalizedConfig: Record<string, unknown>
}

export interface FetcherTemplate {
  id: string
  key: string
  name: string
  description: string | null
  allow_instance_create: boolean
  config_schema: string
  validator_key: string
  fetcher_key: string
  enabled: boolean
}

export interface AdminBootstrapData {
  topicCategories: TopicCategory[]
  sourceMethodCategories: SourceMethodCategory[]
  fetcherTemplates: FetcherTemplate[]
  sources: SourceListItem[]
  recycleBin: SourceListItem[]
  validationLogs: Array<{
    id: string
    source_id: string | null
    result: 'passed' | 'failed'
    message: string
    details: string | null
    checked_at: string
  }>
}
