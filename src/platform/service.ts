import { PlatformDatabase } from './database.js';
import { bootstrapPlatformDatabase } from './opml-import.js';
import { parseOpmlSubscriptions } from '../fetchers/opml-rss.js';
import { buildOpmlFromSources } from './opml.js';
import { validateTemplateSource } from './template-registry.js';
import type {
  SourceEditorInput,
  SourceMethodCategoryPayload,
  TopicCategoryPayload,
  ValidationResult,
} from './types.js';

export class PlatformService {
  constructor(private readonly db: PlatformDatabase) {}

  async bootstrap(): Promise<void> {
    await bootstrapPlatformDatabase(this.db);
  }

  listDashboardData(): Record<string, unknown> {
    return {
      topicCategories: this.db.listTopicCategories(),
      sourceMethodCategories: this.db.listSourceMethodCategories(),
      fetcherTemplates: this.db.listFetcherTemplates(),
      sources: this.db.listSources(),
      recycleBin: this.db.listSources({ includeDeleted: true }).filter((source) => source.deleted_at),
      validationLogs: this.db.listValidationLogs(20),
    };
  }

  listTopicCategories() {
    return this.db.listTopicCategories();
  }

  createTopicCategory(input: TopicCategoryPayload) {
    if (!input.name?.trim()) throw new Error('业务主题名称不能为空');
    return this.db.createTopicCategory(input);
  }

  updateTopicCategory(id: string, input: TopicCategoryPayload) {
    if (!input.name?.trim()) throw new Error('业务主题名称不能为空');
    return this.db.updateTopicCategory(id, input);
  }

  deleteTopicCategory(id: string) {
    return this.db.deleteTopicCategory(id);
  }

  listSourceMethodCategories() {
    return this.db.listSourceMethodCategories();
  }

  createSourceMethodCategory(input: SourceMethodCategoryPayload) {
    if (!input.name?.trim()) throw new Error('获取方式名称不能为空');
    return this.db.createSourceMethodCategory(input);
  }

  updateSourceMethodCategory(id: string, input: SourceMethodCategoryPayload) {
    if (!input.name?.trim()) throw new Error('获取方式名称不能为空');
    return this.db.updateSourceMethodCategory(id, input);
  }

  deleteSourceMethodCategory(id: string) {
    return this.db.deleteSourceMethodCategory(id);
  }

  listSources(includeDeleted: boolean = false) {
    return this.db.listSources({ includeDeleted });
  }

  async validateSource(input: SourceEditorInput): Promise<ValidationResult> {
    const method = this.db.getSourceMethodCategoryById(input.sourceMethodCategoryId);
    return validateTemplateSource(method.template_key, input.configPayload, null);
  }

  async createSource(input: SourceEditorInput) {
    this.assertSourceInput(input);
    const validation = await this.validateSource(input);
    if (!validation.ok) {
      throw new Error(validation.message);
    }
    return this.db.createSource(input, validation);
  }

  async updateSource(id: string, input: SourceEditorInput) {
    this.assertSourceInput(input);
    const validation = await this.validateSource(input);
    if (!validation.ok) {
      throw new Error(validation.message);
    }
    return this.db.updateSource(id, input, validation);
  }

  deleteSource(id: string) {
    this.db.softDeleteSource(id);
  }

  restoreSource(id: string) {
    this.db.restoreSource(id);
  }

  restoreAllSources() {
    this.db.restoreAllSources();
  }

  setSourceStatus(id: string, status: 'enabled' | 'disabled') {
    this.db.setSourceStatus(id, status);
  }

  setSourcesStatus(ids: string[], status: 'enabled' | 'disabled') {
    this.db.setSourcesStatus(ids, status);
  }

  getDatabase() {
    return this.db;
  }

  exportRssSourcesAsOpml(): string {
    return buildOpmlFromSources(this.db.listSources());
  }

  async importRssSourcesFromOpml(opmlContent: string): Promise<{ created: number; skipped: number }> {
    const feeds = parseOpmlSubscriptions(opmlContent);
    if (feeds.length === 0) {
      throw new Error('OPML 中未解析到任何 RSS 订阅源');
    }

    const topics = this.db.listTopicCategories();
    const methods = this.db.listSourceMethodCategories();
    const defaultTopic =
      topics.find((topic) => topic.name === '默认主题') ||
      this.db.createTopicCategory({ name: '默认主题', description: '手动维护的个人资讯主题', enabled: true });
    const defaultMethod =
      methods.find((method) => method.topic_category_id === defaultTopic.id && method.template_key === 'rss') ||
      this.db.createSourceMethodCategory({
        topicCategoryId: defaultTopic.id,
        name: 'RSS 订阅',
        description: '基于 RSS/Atom 的订阅获取方式',
        templateKey: 'rss',
        allowCreate: true,
        enabled: true,
      });

    const existingSources = this.db.listSources({ includeDeleted: true });
    let created = 0;
    let skipped = 0;

    for (const feed of feeds) {
      const duplicate = existingSources.find((source) => {
        if (source.template_key !== 'rss') return false;
        const config = JSON.parse(source.config_payload || '{}') as { feedUrl?: string };
        return config.feedUrl === feed.xmlUrl || source.name === feed.title;
      });
      if (duplicate) {
        skipped += 1;
        continue;
      }

      const input: SourceEditorInput = {
        name: feed.title,
        topicCategoryId: defaultTopic.id,
        sourceMethodCategoryId: defaultMethod.id,
        baseUrl: feed.htmlUrl || feed.xmlUrl,
        configPayload: {
          feedUrl: feed.xmlUrl,
          htmlUrl: feed.htmlUrl || undefined,
        },
        status: 'enabled',
        notes: '来自 OPML 导入',
      };

      const validation = await this.validateSource(input);
      if (!validation.ok) {
        skipped += 1;
        continue;
      }
      this.db.createSource(input, validation);
      created += 1;
    }

    return { created, skipped };
  }

  private assertSourceInput(input: SourceEditorInput): void {
    if (!input.name?.trim()) throw new Error('订阅源名称不能为空');
    if (!input.topicCategoryId) throw new Error('请选择业务主题');
    if (!input.sourceMethodCategoryId) throw new Error('请选择获取方式');
    const method = this.db.getSourceMethodCategoryById(input.sourceMethodCategoryId);
    if (method.template_key === 'rss' && !String(input.configPayload?.feedUrl || '').trim()) {
      throw new Error('RSS 地址不能为空');
    }
  }
}
