import Parser from 'rss-parser';

import { CONFIG } from '../config.js';
import type { SourceConfigPayload, ValidationResult } from './types.js';

function normalizeUrl(url: string): string {
  return url.trim();
}

export async function validateRssSource(config: SourceConfigPayload): Promise<ValidationResult> {
  const feedUrl = normalizeUrl(String(config.feedUrl || ''));
  const htmlUrl = config.htmlUrl ? normalizeUrl(String(config.htmlUrl)) : undefined;

  if (!feedUrl) {
    return {
      ok: false,
      message: 'RSS 地址不能为空',
      normalizedBaseUrl: htmlUrl || '',
      normalizedConfig: { feedUrl, htmlUrl },
    };
  }

  try {
    new URL(feedUrl);
  } catch {
    return {
      ok: false,
      message: 'RSS 地址格式不合法',
      normalizedBaseUrl: htmlUrl || feedUrl,
      normalizedConfig: { feedUrl, htmlUrl },
    };
  }

  try {
    const parser = new Parser({
      timeout: CONFIG.rss.feedTimeout,
      headers: {
        'User-Agent': CONFIG.http.userAgent,
        Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
      },
    });
    const feed = await parser.parseURL(feedUrl);
    const hasItems = Array.isArray(feed.items) && feed.items.some((item) => item.title && item.link);

    if (!hasItems) {
      return {
        ok: false,
        message: '订阅源可访问，但未解析到有效条目',
        normalizedBaseUrl: htmlUrl || feed.link || feedUrl,
        normalizedConfig: {
          feedUrl,
          htmlUrl: htmlUrl || feed.link || undefined,
        },
      };
    }

    return {
      ok: true,
      message: `检测通过，共发现 ${feed.items?.length ?? 0} 条条目`,
      normalizedBaseUrl: htmlUrl || feed.link || feedUrl,
      normalizedConfig: {
        feedUrl,
        htmlUrl: htmlUrl || feed.link || undefined,
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'RSS 检测失败',
      normalizedBaseUrl: htmlUrl || feedUrl,
      normalizedConfig: { feedUrl, htmlUrl },
    };
  }
}
