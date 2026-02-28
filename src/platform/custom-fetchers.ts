import * as cheerio from 'cheerio';

import type { RawItem } from '../types.js';
import { parseDate } from '../utils/date.js';
import { fetchJson, fetchText } from '../utils/http.js';
import { firstNonEmpty } from '../utils/text.js';
import { joinUrl, normalizeUrl } from '../utils/url.js';
import type { SourceConfigPayload, SubscriptionSource, ValidationResult } from './types.js';

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value === null || value === undefined ? '' : String(value).trim();
}

function getByPath(input: unknown, path?: string): unknown {
  if (!path || !path.trim()) return input;
  const segments = path.split('.').map((segment) => segment.trim()).filter(Boolean);
  let current: unknown = input;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      current = Number.isInteger(index) ? current[index] : undefined;
      continue;
    }
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function asStringRecord(payload: SourceConfigPayload): Record<string, string> {
  return Object.fromEntries(
    Object.entries(payload || {}).map(([key, value]) => [key, getString(value)])
  );
}

function parsePublishedAt(raw: unknown, now: Date): Date | null {
  if (raw === null || raw === undefined) return null;
  return parseDate(raw, now);
}

export async function fetchGenericJsonItems(
  payload: SourceConfigPayload,
  source: SubscriptionSource | null,
  now: Date,
  templateKey: string,
  templateName: string
): Promise<RawItem[]> {
  const config = asStringRecord(payload);
  const endpoint = config.endpointUrl;
  const listPath = config.listPath;
  const titlePath = config.titlePath;
  const urlPath = config.urlPath;
  const sourcePath = config.sourcePath;
  const publishedAtPath = config.publishedAtPath;
  const itemSourceFallback = config.sourceFallback || source?.name || templateName;
  const baseUrl = config.baseUrl || source?.base_url || endpoint;

  const json = await fetchJson<unknown>(endpoint);
  const list = getByPath(json, listPath);
  if (!Array.isArray(list)) {
    throw new Error('JSON 模板未解析到数组数据，请检查 listPath');
  }

  const items: RawItem[] = [];
  for (const entry of list) {
    const title = getString(getByPath(entry, titlePath));
    const rawUrl = getString(getByPath(entry, urlPath));
    if (!title || !rawUrl) continue;

    items.push({
      siteId: templateKey,
      siteName: templateName,
      source: firstNonEmpty(getByPath(entry, sourcePath), itemSourceFallback),
      title,
      url: normalizeUrl(rawUrl.startsWith('http') ? rawUrl : joinUrl(baseUrl, rawUrl)),
      publishedAt: parsePublishedAt(getByPath(entry, publishedAtPath), now),
      meta: {
        custom_template: templateKey,
        endpoint,
      },
    });
  }

  return items;
}

export async function fetchGenericHtmlItems(
  payload: SourceConfigPayload,
  source: SubscriptionSource | null,
  now: Date,
  templateKey: string,
  templateName: string
): Promise<RawItem[]> {
  const config = asStringRecord(payload);
  const pageUrl = config.pageUrl;
  const itemSelector = config.itemSelector;
  const titleSelector = config.titleSelector;
  const linkSelector = config.linkSelector;
  const timeSelector = config.timeSelector;
  const sourceSelector = config.sourceSelector;
  const baseUrl = config.baseUrl || source?.base_url || pageUrl;
  const sourceFallback = config.sourceFallback || source?.name || templateName;

  const html = await fetchText(pageUrl);
  const $ = cheerio.load(html);
  const items: RawItem[] = [];

  $(itemSelector).each((_, element) => {
    const $item = $(element);
    const title = getString(
      titleSelector ? $item.find(titleSelector).first().text() : $item.text()
    );
    const rawHref = getString(
      linkSelector
        ? $item.find(linkSelector).first().attr('href')
        : $item.attr('href')
    );
    if (!title || !rawHref) return;

    const sourceName = sourceSelector
      ? getString($item.find(sourceSelector).first().text()) || sourceFallback
      : sourceFallback;

    const timeText = timeSelector ? getString($item.find(timeSelector).first().text()) : '';
    items.push({
      siteId: templateKey,
      siteName: templateName,
      source: sourceName,
      title,
      url: normalizeUrl(rawHref.startsWith('http') ? rawHref : joinUrl(baseUrl, rawHref)),
      publishedAt: parsePublishedAt(timeText, now),
      meta: {
        custom_template: templateKey,
        page_url: pageUrl,
      },
    });
  });

  return items;
}

export async function validateGenericJsonSource(
  payload: SourceConfigPayload,
  source: SubscriptionSource | null
): Promise<ValidationResult> {
  const config = asStringRecord(payload);
  if (!config.endpointUrl) {
    return {
      ok: false,
      message: 'JSON 接口地址不能为空',
      normalizedBaseUrl: source?.base_url || '',
      normalizedConfig: payload,
    };
  }
  if (!config.listPath || !config.titlePath || !config.urlPath) {
    return {
      ok: false,
      message: 'JSON 模板至少需要 listPath、titlePath、urlPath',
      normalizedBaseUrl: source?.base_url || config.endpointUrl,
      normalizedConfig: payload,
    };
  }

  try {
    const items = await fetchGenericJsonItems(payload, source, new Date(), 'genericjson', '自定义 JSON 抓取');
    if (items.length === 0) {
      return {
        ok: false,
        message: 'JSON 模板可访问，但未解析到任何条目',
        normalizedBaseUrl: config.baseUrl || config.endpointUrl,
        normalizedConfig: payload,
      };
    }
    return {
      ok: true,
      message: `JSON 模板检测通过，解析到 ${items.length} 条内容`,
      normalizedBaseUrl: config.baseUrl || config.endpointUrl,
      normalizedConfig: payload,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'JSON 模板检测失败',
      normalizedBaseUrl: config.baseUrl || config.endpointUrl,
      normalizedConfig: payload,
    };
  }
}

export async function validateGenericHtmlSource(
  payload: SourceConfigPayload,
  source: SubscriptionSource | null
): Promise<ValidationResult> {
  const config = asStringRecord(payload);
  if (!config.pageUrl) {
    return {
      ok: false,
      message: '页面地址不能为空',
      normalizedBaseUrl: source?.base_url || '',
      normalizedConfig: payload,
    };
  }
  if (!config.itemSelector || !config.titleSelector || !config.linkSelector) {
    return {
      ok: false,
      message: 'HTML 模板至少需要 itemSelector、titleSelector、linkSelector',
      normalizedBaseUrl: config.baseUrl || config.pageUrl,
      normalizedConfig: payload,
    };
  }

  try {
    const items = await fetchGenericHtmlItems(payload, source, new Date(), 'generichtml', '自定义网页抓取');
    if (items.length === 0) {
      return {
        ok: false,
        message: 'HTML 模板可访问，但未解析到任何条目',
        normalizedBaseUrl: config.baseUrl || config.pageUrl,
        normalizedConfig: payload,
      };
    }
    return {
      ok: true,
      message: `HTML 模板检测通过，解析到 ${items.length} 条内容`,
      normalizedBaseUrl: config.baseUrl || config.pageUrl,
      normalizedConfig: payload,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'HTML 模板检测失败',
      normalizedBaseUrl: config.baseUrl || config.pageUrl,
      normalizedConfig: payload,
    };
  }
}
