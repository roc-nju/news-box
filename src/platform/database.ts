import { mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { randomUUID } from 'crypto';
import { DatabaseSync } from 'node:sqlite';

import { CONFIG } from '../config.js';
import { toISOString, utcNow } from '../utils/date.js';
import { FETCHER_TEMPLATES, getTemplateDefinition } from './template-registry.js';
import type {
  FetcherTemplate,
  SourceEditorInput,
  SourceListItem,
  SourceMethodCategory,
  SourceMethodCategoryPayload,
  SourceValidationLog,
  SubscriptionSource,
  TopicCategory,
  TopicCategoryPayload,
  ValidationResult,
} from './types.js';

function boolToInt(value: boolean): number {
  return value ? 1 : 0;
}

function intToBool(value: unknown): boolean {
  return Number(value) === 1;
}

function getNowIso(): string {
  return toISOString(utcNow()) ?? new Date().toISOString();
}

export class PlatformDatabase {
  private readonly db: DatabaseSync;

  constructor(databasePath: string = CONFIG.platform.databasePath) {
    const resolved = resolve(databasePath);
    const parentDir = dirname(resolved);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }
    this.db = new DatabaseSync(resolved);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS topic_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS fetcher_templates (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        allow_instance_create INTEGER NOT NULL DEFAULT 1,
        config_schema TEXT NOT NULL,
        validator_key TEXT NOT NULL,
        fetcher_key TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS source_method_categories (
        id TEXT PRIMARY KEY,
        topic_category_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        template_key TEXT NOT NULL,
        allow_create INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(topic_category_id) REFERENCES topic_categories(id) ON DELETE RESTRICT,
        UNIQUE(topic_category_id, name)
      );

      CREATE TABLE IF NOT EXISTS subscription_sources (
        id TEXT PRIMARY KEY,
        topic_category_id TEXT NOT NULL,
        source_method_category_id TEXT NOT NULL,
        fetcher_template_id TEXT NOT NULL,
        name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        config_payload TEXT NOT NULL,
        status TEXT NOT NULL,
        availability_status TEXT NOT NULL DEFAULT 'pending',
        availability_checked_at TEXT,
        availability_error TEXT,
        last_fetched_at TEXT,
        last_fetch_status TEXT,
        last_fetch_error TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        deleted_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(topic_category_id) REFERENCES topic_categories(id) ON DELETE RESTRICT,
        FOREIGN KEY(source_method_category_id) REFERENCES source_method_categories(id) ON DELETE RESTRICT,
        FOREIGN KEY(fetcher_template_id) REFERENCES fetcher_templates(id) ON DELETE RESTRICT,
        UNIQUE(fetcher_template_id, deleted_at) 
      );

      CREATE TABLE IF NOT EXISTS source_validation_logs (
        id TEXT PRIMARY KEY,
        source_id TEXT,
        result TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        checked_at TEXT NOT NULL,
        FOREIGN KEY(source_id) REFERENCES subscription_sources(id) ON DELETE SET NULL
      );
    `);

    this.seedTemplates();
  }

  private seedTemplates(): void {
    for (const template of FETCHER_TEMPLATES) {
      const existing = this.db
        .prepare('SELECT id FROM fetcher_templates WHERE key = ?')
        .get(template.key) as { id?: string } | undefined;

      if (existing?.id) continue;

      this.db
        .prepare(`
          INSERT INTO fetcher_templates (
            id, key, name, description, allow_instance_create, config_schema, validator_key, fetcher_key, enabled
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          randomUUID(),
          template.key,
          template.name,
          template.description,
          boolToInt(template.allowInstanceCreate),
          template.configSchema,
          template.validatorKey,
          template.fetcherKey,
          1
        );
    }
  }

  listTopicCategories(): TopicCategory[] {
    const rows = this.db
      .prepare('SELECT * FROM topic_categories ORDER BY sort_order ASC, created_at ASC')
      .all() as Record<string, unknown>[];
    return rows.map((row) => this.mapTopicCategory(row));
  }

  createTopicCategory(input: TopicCategoryPayload): TopicCategory {
    const now = getNowIso();
    const row = {
      id: randomUUID(),
      name: input.name.trim(),
      description: input.description?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      enabled: boolToInt(input.enabled ?? true),
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .prepare(`
        INSERT INTO topic_categories (id, name, description, sort_order, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        row.id,
        row.name,
        row.description,
        row.sortOrder,
        row.enabled,
        row.createdAt,
        row.updatedAt
      );

    return this.getTopicCategoryById(row.id);
  }

  updateTopicCategory(id: string, input: TopicCategoryPayload): TopicCategory {
    const existing = this.getTopicCategoryById(id);
    const now = getNowIso();
    this.db
      .prepare(`
        UPDATE topic_categories
        SET name = ?, description = ?, sort_order = ?, enabled = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(
        input.name.trim(),
        input.description?.trim() || null,
        input.sortOrder ?? existing.sort_order,
        boolToInt(input.enabled ?? existing.enabled),
        now,
        id
      );
    return this.getTopicCategoryById(id);
  }

  deleteTopicCategory(id: string): void {
    this.db.prepare('DELETE FROM topic_categories WHERE id = ?').run(id);
  }

  getTopicCategoryById(id: string): TopicCategory {
    const row = this.db.prepare('SELECT * FROM topic_categories WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) throw new Error('业务主题不存在');
    return this.mapTopicCategory(row);
  }

  listSourceMethodCategories(): Array<SourceMethodCategory & { topic_category_name: string }> {
    const rows = this.db
      .prepare(`
        SELECT smc.*, tc.name AS topic_category_name
        FROM source_method_categories smc
        INNER JOIN topic_categories tc ON tc.id = smc.topic_category_id
        ORDER BY tc.sort_order ASC, smc.sort_order ASC, smc.created_at ASC
      `)
      .all() as Record<string, unknown>[];
    return rows.map((row) => ({
      ...this.mapSourceMethodCategory(row),
      topic_category_name: String(row.topic_category_name),
    }));
  }

  createSourceMethodCategory(input: SourceMethodCategoryPayload): SourceMethodCategory {
    const topic = this.getTopicCategoryById(input.topicCategoryId);
    const template = this.getTemplateByKey(input.templateKey ?? 'rss');
    const now = getNowIso();

    this.db
      .prepare(`
        INSERT INTO source_method_categories (
          id, topic_category_id, name, description, template_key, allow_create, sort_order, enabled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        randomUUID(),
        topic.id,
        input.name.trim(),
        input.description?.trim() || null,
        template.key,
        boolToInt(input.allowCreate ?? true),
        input.sortOrder ?? 0,
        boolToInt(input.enabled ?? true),
        now,
        now
      );

    const created = this.db
      .prepare(
        'SELECT * FROM source_method_categories WHERE topic_category_id = ? AND name = ?'
      )
      .get(topic.id, input.name.trim()) as Record<string, unknown>;
    return this.mapSourceMethodCategory(created);
  }

  updateSourceMethodCategory(id: string, input: SourceMethodCategoryPayload): SourceMethodCategory {
    const existing = this.getSourceMethodCategoryById(id);
    const topic = this.getTopicCategoryById(input.topicCategoryId);
    const template = this.getTemplateByKey(input.templateKey ?? existing.template_key);
    const now = getNowIso();

    this.db
      .prepare(`
        UPDATE source_method_categories
        SET topic_category_id = ?, name = ?, description = ?, template_key = ?, allow_create = ?, sort_order = ?, enabled = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(
        topic.id,
        input.name.trim(),
        input.description?.trim() || null,
        template.key,
        boolToInt(input.allowCreate ?? existing.allow_create),
        input.sortOrder ?? existing.sort_order,
        boolToInt(input.enabled ?? existing.enabled),
        now,
        id
      );

    return this.getSourceMethodCategoryById(id);
  }

  deleteSourceMethodCategory(id: string): void {
    this.db.prepare('DELETE FROM source_method_categories WHERE id = ?').run(id);
  }

  getSourceMethodCategoryById(id: string): SourceMethodCategory {
    const row = this.db
      .prepare('SELECT * FROM source_method_categories WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    if (!row) throw new Error('获取方式不存在');
    return this.mapSourceMethodCategory(row);
  }

  listFetcherTemplates(): FetcherTemplate[] {
    const rows = this.db.prepare('SELECT * FROM fetcher_templates ORDER BY key ASC').all() as Record<
      string,
      unknown
    >[];
    return rows.map((row) => this.mapTemplate(row));
  }

  getTemplateByKey(key: string): FetcherTemplate {
    const row = this.db.prepare('SELECT * FROM fetcher_templates WHERE key = ?').get(key) as
      | Record<string, unknown>
      | undefined;
    if (!row) throw new Error(`抓取模板不存在: ${key}`);
    return this.mapTemplate(row);
  }

  listSources(options: { includeDeleted?: boolean } = {}): SourceListItem[] {
    const { includeDeleted = false } = options;
    const rows = this.db
      .prepare(`
        SELECT
          ss.*,
          tc.name AS topic_category_name,
          smc.name AS source_method_category_name,
          ft.key AS template_key
        FROM subscription_sources ss
        INNER JOIN topic_categories tc ON tc.id = ss.topic_category_id
        INNER JOIN source_method_categories smc ON smc.id = ss.source_method_category_id
        INNER JOIN fetcher_templates ft ON ft.id = ss.fetcher_template_id
        WHERE ${includeDeleted ? '1=1' : 'ss.deleted_at IS NULL'}
        ORDER BY tc.sort_order ASC, smc.sort_order ASC, ss.sort_order ASC, ss.created_at ASC
      `)
      .all() as Record<string, unknown>[];

    return rows.map((row) => this.mapSourceListItem(row));
  }

  getSourceById(id: string): SubscriptionSource {
    const row = this.db.prepare('SELECT * FROM subscription_sources WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) throw new Error('订阅源不存在');
    return this.mapSubscriptionSource(row);
  }

  createSource(input: SourceEditorInput, validation: ValidationResult): SubscriptionSource {
    const topic = this.getTopicCategoryById(input.topicCategoryId);
    const method = this.getSourceMethodCategoryById(input.sourceMethodCategoryId);
    const template = this.getTemplateByKey(method.template_key);
    const definition = getTemplateDefinition(template.key);
    const now = getNowIso();
    const id = randomUUID();

    if (definition.singleton) {
      const existing = this.db
        .prepare(
          `
          SELECT id FROM subscription_sources
          WHERE fetcher_template_id = ?
            AND deleted_at IS NULL
        `
        )
        .get(template.id) as { id?: string } | undefined;
      if (existing?.id) {
        throw new Error(`${template.name} 模板仅允许存在一个启用实例`);
      }
    }

    this.db
      .prepare(`
        INSERT INTO subscription_sources (
          id, topic_category_id, source_method_category_id, fetcher_template_id, name, base_url, config_payload,
          status, availability_status, availability_checked_at, availability_error, last_fetched_at, last_fetch_status,
          last_fetch_error, sort_order, notes, deleted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        topic.id,
        method.id,
        template.id,
        input.name.trim(),
        validation.normalizedBaseUrl,
        JSON.stringify(validation.normalizedConfig || {}),
        input.status,
        validation.ok ? 'passed' : 'failed',
        now,
        validation.ok ? null : validation.message,
        null,
        null,
        null,
        0,
        input.notes?.trim() || null,
        null,
        now,
        now
      );

    this.insertValidationLog(id, validation);
    return this.getSourceById(id);
  }

  updateSource(id: string, input: SourceEditorInput, validation: ValidationResult): SubscriptionSource {
    const existing = this.getSourceById(id);
    const topic = this.getTopicCategoryById(input.topicCategoryId);
    const method = this.getSourceMethodCategoryById(input.sourceMethodCategoryId);
    const template = this.getTemplateByKey(method.template_key);
    const now = getNowIso();

    this.db
      .prepare(`
        UPDATE subscription_sources
        SET topic_category_id = ?, source_method_category_id = ?, fetcher_template_id = ?, name = ?, base_url = ?,
            config_payload = ?, status = ?, availability_status = ?, availability_checked_at = ?, availability_error = ?,
            notes = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(
        topic.id,
        method.id,
        template.id,
        input.name.trim(),
        validation.normalizedBaseUrl,
        JSON.stringify(validation.normalizedConfig || {}),
        input.status,
        validation.ok ? 'passed' : 'failed',
        now,
        validation.ok ? null : validation.message,
        input.notes?.trim() || null,
        now,
        id
      );

    this.insertValidationLog(existing.id, validation);
    return this.getSourceById(id);
  }

  softDeleteSource(id: string): void {
    const now = getNowIso();
    this.db
      .prepare('UPDATE subscription_sources SET deleted_at = ?, updated_at = ? WHERE id = ?')
      .run(now, now, id);
  }

  restoreSource(id: string): void {
    const now = getNowIso();
    this.db
      .prepare('UPDATE subscription_sources SET deleted_at = NULL, updated_at = ? WHERE id = ?')
      .run(now, id);
  }

  restoreAllSources(): void {
    const now = getNowIso();
    this.db
      .prepare('UPDATE subscription_sources SET deleted_at = NULL, updated_at = ? WHERE deleted_at IS NOT NULL')
      .run(now);
  }

  setSourceStatus(id: string, status: 'enabled' | 'disabled'): void {
    this.db
      .prepare('UPDATE subscription_sources SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, getNowIso(), id);
  }

  setSourcesStatus(ids: string[], status: 'enabled' | 'disabled'): void {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(', ');
    this.db
      .prepare(
        `UPDATE subscription_sources SET status = ?, updated_at = ? WHERE id IN (${placeholders})`
      )
      .run(status, getNowIso(), ...ids);
  }

  listValidationLogs(limit: number = 50): SourceValidationLog[] {
    const rows = this.db
      .prepare('SELECT * FROM source_validation_logs ORDER BY checked_at DESC LIMIT ?')
      .all(limit) as Record<string, unknown>[];
    return rows.map((row) => this.mapValidationLog(row));
  }

  getActiveRssSources(): Array<SubscriptionSource & { config: { feedUrl: string; htmlUrl?: string } }> {
    const rows = this.db
      .prepare(`
        SELECT ss.*
        FROM subscription_sources ss
        INNER JOIN fetcher_templates ft ON ft.id = ss.fetcher_template_id
        WHERE ss.deleted_at IS NULL
          AND ss.status = 'enabled'
          AND ft.key = 'rss'
        ORDER BY ss.sort_order ASC, ss.created_at ASC
      `)
      .all() as Record<string, unknown>[];

    return rows.map((row) => {
      const source = this.mapSubscriptionSource(row);
      return {
        ...source,
        config: JSON.parse(source.config_payload) as { feedUrl: string; htmlUrl?: string },
      };
    });
  }

  getActiveNonRssSources(): Array<
    SubscriptionSource & {
      template_key: string;
      config: Record<string, unknown>;
    }
  > {
    const rows = this.db
      .prepare(`
        SELECT ss.*, ft.key AS template_key
        FROM subscription_sources ss
        INNER JOIN fetcher_templates ft ON ft.id = ss.fetcher_template_id
        WHERE ss.deleted_at IS NULL
          AND ss.status = 'enabled'
          AND ft.key != 'rss'
        ORDER BY ss.sort_order ASC, ss.created_at ASC
      `)
      .all() as Record<string, unknown>[];

    return rows.map((row) => {
      const source = this.mapSubscriptionSource(row);
      return {
        ...source,
        template_key: String(row.template_key),
        config: JSON.parse(source.config_payload || '{}') as Record<string, unknown>,
      };
    });
  }

  updateSourceFetchStatus(
    sourceId: string,
    payload: { fetchedAt: string; status: 'success' | 'failed'; error?: string | null }
  ): void {
    this.db
      .prepare(`
        UPDATE subscription_sources
        SET last_fetched_at = ?, last_fetch_status = ?, last_fetch_error = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(
        payload.fetchedAt,
        payload.status,
        payload.error ?? null,
        getNowIso(),
        sourceId
      );
  }

  private insertValidationLog(sourceId: string | null, validation: ValidationResult): void {
    this.db
      .prepare(`
        INSERT INTO source_validation_logs (id, source_id, result, message, details, checked_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        randomUUID(),
        sourceId,
        validation.ok ? 'passed' : 'failed',
        validation.message,
        validation.ok ? null : validation.message,
        getNowIso()
      );
  }

  private mapTopicCategory(row: Record<string, unknown>): TopicCategory {
    return {
      id: String(row.id),
      name: String(row.name),
      description: row.description ? String(row.description) : null,
      sort_order: Number(row.sort_order),
      enabled: intToBool(row.enabled),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  private mapSourceMethodCategory(row: Record<string, unknown>): SourceMethodCategory {
    return {
      id: String(row.id),
      topic_category_id: String(row.topic_category_id),
      name: String(row.name),
      description: row.description ? String(row.description) : null,
      template_key: String(row.template_key),
      allow_create: intToBool(row.allow_create),
      sort_order: Number(row.sort_order),
      enabled: intToBool(row.enabled),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  private mapTemplate(row: Record<string, unknown>): FetcherTemplate {
    return {
      id: String(row.id),
      key: String(row.key),
      name: String(row.name),
      description: row.description ? String(row.description) : null,
      allow_instance_create: intToBool(row.allow_instance_create),
      config_schema: String(row.config_schema),
      validator_key: String(row.validator_key),
      fetcher_key: String(row.fetcher_key),
      enabled: intToBool(row.enabled),
    };
  }

  private mapSubscriptionSource(row: Record<string, unknown>): SubscriptionSource {
    return {
      id: String(row.id),
      topic_category_id: String(row.topic_category_id),
      source_method_category_id: String(row.source_method_category_id),
      fetcher_template_id: String(row.fetcher_template_id),
      name: String(row.name),
      base_url: String(row.base_url),
      config_payload: String(row.config_payload),
      status: String(row.status) as SubscriptionSource['status'],
      availability_status: String(row.availability_status) as SubscriptionSource['availability_status'],
      availability_checked_at: row.availability_checked_at ? String(row.availability_checked_at) : null,
      availability_error: row.availability_error ? String(row.availability_error) : null,
      last_fetched_at: row.last_fetched_at ? String(row.last_fetched_at) : null,
      last_fetch_status: row.last_fetch_status ? String(row.last_fetch_status) : null,
      last_fetch_error: row.last_fetch_error ? String(row.last_fetch_error) : null,
      sort_order: Number(row.sort_order),
      notes: row.notes ? String(row.notes) : null,
      deleted_at: row.deleted_at ? String(row.deleted_at) : null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  private mapSourceListItem(row: Record<string, unknown>): SourceListItem {
    return {
      ...this.mapSubscriptionSource(row),
      topic_category_name: String(row.topic_category_name),
      source_method_category_name: String(row.source_method_category_name),
      template_key: String(row.template_key),
    };
  }

  private mapValidationLog(row: Record<string, unknown>): SourceValidationLog {
    return {
      id: String(row.id),
      source_id: row.source_id ? String(row.source_id) : null,
      result: String(row.result) as SourceValidationLog['result'],
      message: String(row.message),
      details: row.details ? String(row.details) : null,
      checked_at: String(row.checked_at),
    };
  }
}
