import type { Fetcher } from '../types.js';
import { AiBaseFetcher } from '../fetchers/aibase.js';
import { AiHotFetcher } from '../fetchers/aihot.js';
import { AiHubTodayFetcher } from '../fetchers/aihubtoday.js';
import { BestBlogsFetcher } from '../fetchers/bestblogs.js';
import { BuzzingFetcher } from '../fetchers/buzzing.js';
import { IrisFetcher } from '../fetchers/iris.js';
import { NewsNowFetcher } from '../fetchers/newsnow.js';
import { TechUrlsFetcher } from '../fetchers/techurls.js';
import { TophubFetcher } from '../fetchers/tophub.js';
import { ZeliFetcher } from '../fetchers/zeli.js';
import type { SourceConfigPayload, SubscriptionSource, ValidationResult } from './types.js';
import { validateRssSource } from './rss-validator.js';
import { runFetcher } from '../fetchers/base.js';
import {
  fetchGenericHtmlItems,
  fetchGenericJsonItems,
  validateGenericHtmlSource,
  validateGenericJsonSource,
} from './custom-fetchers.js';

export interface FetcherTemplateDefinition {
  key: string;
  name: string;
  description: string;
  allowInstanceCreate: boolean;
  singleton: boolean;
  defaultTopicName: string;
  defaultMethodName: string;
  defaultBaseUrl: string;
  configSchema: string;
  validatorKey: string;
  fetcherKey: string;
  createFetcher: (source: SubscriptionSource | null) => Fetcher;
  validate: (payload: SourceConfigPayload, source: SubscriptionSource | null) => Promise<ValidationResult>;
}

const EMPTY_SCHEMA = JSON.stringify({ required: [], properties: {} });

function singletonValidation(
  message: string,
  defaultBaseUrl: string
): (payload: SourceConfigPayload, source: SubscriptionSource | null) => Promise<ValidationResult> {
  return async (_payload, source) => ({
    ok: true,
    message,
    normalizedBaseUrl: source?.base_url || defaultBaseUrl,
    normalizedConfig: {},
  });
}

function createSingletonTemplate(params: {
  key: string;
  name: string;
  description: string;
  defaultBaseUrl: string;
  createFetcher: () => Fetcher;
}): FetcherTemplateDefinition {
  return {
    key: params.key,
    name: params.name,
    description: params.description,
    allowInstanceCreate: true,
    singleton: true,
    defaultTopicName: '内置聚合平台',
    defaultMethodName: params.name,
    defaultBaseUrl: params.defaultBaseUrl,
    configSchema: EMPTY_SCHEMA,
    validatorKey: params.key,
    fetcherKey: params.key,
    createFetcher: () => params.createFetcher(),
    validate: singletonValidation(`${params.name} 模板已就绪，可直接添加`, params.defaultBaseUrl),
  };
}

export const FETCHER_TEMPLATES: FetcherTemplateDefinition[] = [
  {
    key: 'rss',
    name: 'RSS 订阅',
    description: '基于 RSS/Atom Feed 的订阅源',
    allowInstanceCreate: true,
    singleton: false,
    defaultTopicName: '默认主题',
    defaultMethodName: 'RSS 订阅',
    defaultBaseUrl: '',
    configSchema: JSON.stringify({
      required: ['feedUrl'],
      properties: {
        feedUrl: { type: 'string', label: 'RSS 地址' },
        htmlUrl: { type: 'string', label: '站点地址', optional: true },
      },
    }),
    validatorKey: 'rss',
    fetcherKey: 'rss',
    createFetcher: () => {
      throw new Error('RSS 模板通过专用抓取器执行');
    },
    validate: (payload) => validateRssSource(payload),
  },
  {
    key: 'generic_json_feed',
    name: '自定义 JSON 抓取',
    description: '通过 JSON 接口地址和字段路径定义新闻列表抓取',
    allowInstanceCreate: true,
    singleton: false,
    defaultTopicName: '自定义模板',
    defaultMethodName: 'JSON 抓取',
    defaultBaseUrl: '',
    configSchema: JSON.stringify({
      required: ['endpointUrl', 'listPath', 'titlePath', 'urlPath'],
      properties: {
        endpointUrl: { type: 'string', label: 'JSON 接口地址' },
        baseUrl: { type: 'string', label: '链接基地址', optional: true },
        listPath: { type: 'string', label: '数组路径' },
        titlePath: { type: 'string', label: '标题字段路径' },
        urlPath: { type: 'string', label: '链接字段路径' },
        sourcePath: { type: 'string', label: '来源字段路径', optional: true },
        sourceFallback: { type: 'string', label: '默认来源名称', optional: true },
        publishedAtPath: { type: 'string', label: '发布时间字段路径', optional: true },
      },
    }),
    validatorKey: 'generic_json_feed',
    fetcherKey: 'generic_json_feed',
    createFetcher: (source) => ({
      siteId: source?.id || 'generic_json_feed',
      siteName: source?.name || '自定义 JSON 抓取',
      async fetch(now) {
        if (!source) return [];
        return fetchGenericJsonItems(
          JSON.parse(source.config_payload || '{}') as SourceConfigPayload,
          source,
          now,
          source.id,
          source.name
        );
      },
    }),
    validate: (payload, source) => validateGenericJsonSource(payload, source),
  },
  {
    key: 'generic_html_list',
    name: '自定义网页抓取',
    description: '通过页面地址和 CSS 选择器定义列表页抓取',
    allowInstanceCreate: true,
    singleton: false,
    defaultTopicName: '自定义模板',
    defaultMethodName: '网页抓取',
    defaultBaseUrl: '',
    configSchema: JSON.stringify({
      required: ['pageUrl', 'itemSelector', 'titleSelector', 'linkSelector'],
      properties: {
        pageUrl: { type: 'string', label: '列表页地址' },
        baseUrl: { type: 'string', label: '链接基地址', optional: true },
        itemSelector: { type: 'string', label: '条目选择器' },
        titleSelector: { type: 'string', label: '标题选择器' },
        linkSelector: { type: 'string', label: '链接选择器' },
        timeSelector: { type: 'string', label: '时间选择器', optional: true },
        sourceSelector: { type: 'string', label: '来源选择器', optional: true },
        sourceFallback: { type: 'string', label: '默认来源名称', optional: true },
      },
    }),
    validatorKey: 'generic_html_list',
    fetcherKey: 'generic_html_list',
    createFetcher: (source) => ({
      siteId: source?.id || 'generic_html_list',
      siteName: source?.name || '自定义网页抓取',
      async fetch(now) {
        if (!source) return [];
        return fetchGenericHtmlItems(
          JSON.parse(source.config_payload || '{}') as SourceConfigPayload,
          source,
          now,
          source.id,
          source.name
        );
      },
    }),
    validate: (payload, source) => validateGenericHtmlSource(payload, source),
  },
  createSingletonTemplate({
    key: 'techurls',
    name: 'TechURLs',
    description: '技术链接聚合页抓取器',
    defaultBaseUrl: 'https://techurls.com/',
    createFetcher: () => new TechUrlsFetcher(),
  }),
  createSingletonTemplate({
    key: 'buzzing',
    name: 'Buzzing',
    description: 'Buzzing 聚合 JSON 抓取器',
    defaultBaseUrl: 'https://www.buzzing.cc/feed.json',
    createFetcher: () => new BuzzingFetcher(),
  }),
  createSingletonTemplate({
    key: 'iris',
    name: 'Info Flow',
    description: 'Iris 信息流聚合抓取器',
    defaultBaseUrl: 'https://iris.findtruman.io/web/info_flow',
    createFetcher: () => new IrisFetcher(),
  }),
  createSingletonTemplate({
    key: 'bestblogs',
    name: 'BestBlogs',
    description: 'BestBlogs 周刊抓取器',
    defaultBaseUrl: 'https://www.bestblogs.dev/en/newsletter',
    createFetcher: () => new BestBlogsFetcher(),
  }),
  createSingletonTemplate({
    key: 'tophub',
    name: 'TopHub',
    description: 'TopHub 热榜聚合抓取器',
    defaultBaseUrl: 'https://tophub.today/',
    createFetcher: () => new TophubFetcher(),
  }),
  createSingletonTemplate({
    key: 'zeli',
    name: 'Zeli',
    description: 'Zeli Hacker News 热榜抓取器',
    defaultBaseUrl: 'https://zeli.app/api/hacker-news?type=hot24h',
    createFetcher: () => new ZeliFetcher(),
  }),
  createSingletonTemplate({
    key: 'aihubtoday',
    name: 'AI HubToday',
    description: 'AI HubToday 日报抓取器',
    defaultBaseUrl: 'https://ai.hubtoday.app/',
    createFetcher: () => new AiHubTodayFetcher(),
  }),
  createSingletonTemplate({
    key: 'aibase',
    name: 'AIbase',
    description: 'AIbase 新闻列表抓取器',
    defaultBaseUrl: 'https://www.aibase.com/zh/news',
    createFetcher: () => new AiBaseFetcher(),
  }),
  createSingletonTemplate({
    key: 'aihot',
    name: 'AI今日热榜',
    description: 'AI 今日热榜抓取器',
    defaultBaseUrl: 'https://aihot.today/',
    createFetcher: () => new AiHotFetcher(),
  }),
  createSingletonTemplate({
    key: 'newsnow',
    name: 'NewsNow',
    description: 'NewsNow 聚合平台抓取器',
    defaultBaseUrl: 'https://newsnow.busiyi.world/',
    createFetcher: () => new NewsNowFetcher(),
  }),
];

const templateMap = new Map(FETCHER_TEMPLATES.map((template) => [template.key, template]));

export function getTemplateDefinition(key: string): FetcherTemplateDefinition {
  const template = templateMap.get(key);
  if (!template) throw new Error(`未找到模板定义: ${key}`);
  return template;
}

export async function validateTemplateSource(
  templateKey: string,
  payload: SourceConfigPayload,
  source: SubscriptionSource | null = null
): Promise<ValidationResult> {
  const template = getTemplateDefinition(templateKey);
  const validation = await template.validate(payload, source);
  if (template.singleton && template.key !== 'rss' && validation.ok) {
    try {
      const result = await runFetcher(template.createFetcher(source), new Date(), false);
      if (!result.status.ok) {
        return {
          ok: false,
          message: result.status.error || `${template.name} 检测失败`,
          normalizedBaseUrl: source?.base_url || template.defaultBaseUrl,
          normalizedConfig: payload,
        };
      }
      return {
        ok: true,
        message: `${template.name} 检测通过，获取 ${result.items.length} 条内容`,
        normalizedBaseUrl: source?.base_url || template.defaultBaseUrl,
        normalizedConfig: payload,
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : `${template.name} 检测失败`,
        normalizedBaseUrl: source?.base_url || template.defaultBaseUrl,
        normalizedConfig: payload,
      };
    }
  }
  return validation;
}

export function createFetcherFromTemplate(
  templateKey: string,
  source: SubscriptionSource | null = null
): Fetcher | null {
  const template = getTemplateDefinition(templateKey);
  if (template.key === 'rss') return null;
  return template.createFetcher(source);
}
