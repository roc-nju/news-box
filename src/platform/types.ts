export type SourceStatus = 'enabled' | 'disabled';

export type AvailabilityStatus = 'pending' | 'passed' | 'failed';

export interface TopicCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SourceMethodCategory {
  id: string;
  topic_category_id: string;
  name: string;
  description: string | null;
  template_key: string;
  allow_create: boolean;
  sort_order: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface FetcherTemplate {
  id: string;
  key: string;
  name: string;
  description: string | null;
  allow_instance_create: boolean;
  config_schema: string;
  validator_key: string;
  fetcher_key: string;
  enabled: boolean;
}

export type SourceConfigPayload = Record<string, unknown>;

export interface SubscriptionSource {
  id: string;
  topic_category_id: string;
  source_method_category_id: string;
  fetcher_template_id: string;
  name: string;
  base_url: string;
  config_payload: string;
  status: SourceStatus;
  availability_status: AvailabilityStatus;
  availability_checked_at: string | null;
  availability_error: string | null;
  last_fetched_at: string | null;
  last_fetch_status: string | null;
  last_fetch_error: string | null;
  sort_order: number;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourceValidationLog {
  id: string;
  source_id: string | null;
  result: 'passed' | 'failed';
  message: string;
  details: string | null;
  checked_at: string;
}

export interface SourceListItem {
  id: string;
  name: string;
  base_url: string;
  config_payload: string;
  status: SourceStatus;
  availability_status: AvailabilityStatus;
  availability_checked_at: string | null;
  availability_error: string | null;
  last_fetched_at: string | null;
  last_fetch_status: string | null;
  last_fetch_error: string | null;
  sort_order: number;
  notes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  topic_category_id: string;
  topic_category_name: string;
  source_method_category_id: string;
  source_method_category_name: string;
  template_key: string;
}

export interface SourceEditorInput {
  name: string;
  topicCategoryId: string;
  sourceMethodCategoryId: string;
  baseUrl: string;
  configPayload: SourceConfigPayload;
  status: SourceStatus;
  notes?: string | null;
}

export interface ValidationResult {
  ok: boolean;
  message: string;
  normalizedBaseUrl: string;
  normalizedConfig: SourceConfigPayload;
}

export interface TopicCategoryPayload {
  name: string;
  description?: string | null;
  enabled?: boolean;
  sortOrder?: number;
}

export interface SourceMethodCategoryPayload {
  topicCategoryId: string;
  name: string;
  description?: string | null;
  templateKey?: string;
  allowCreate?: boolean;
  enabled?: boolean;
  sortOrder?: number;
}
