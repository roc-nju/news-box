import { existsSync } from 'fs';
import { readFile } from 'fs/promises';

import { CONFIG } from '../config.js';
import { parseOpmlSubscriptions } from '../fetchers/opml-rss.js';
import type { OpmlFeed } from '../types.js';
import { PlatformDatabase } from './database.js';
import { FETCHER_TEMPLATES } from './template-registry.js';
import type { SourceEditorInput, ValidationResult } from './types.js';

interface OpmlGroup {
  name: string;
  feeds: OpmlFeed[];
}

function buildValidation(feed: OpmlFeed): ValidationResult {
  return {
    ok: true,
    message: '从 OPML 导入',
    normalizedBaseUrl: feed.htmlUrl || feed.xmlUrl,
    normalizedConfig: {
      feedUrl: feed.xmlUrl,
      htmlUrl: feed.htmlUrl || undefined,
    },
  };
}

function parseOpmlGroups(content: string): OpmlGroup[] {
  const feeds = parseOpmlSubscriptions(content);
  if (feeds.length === 0) return [];

  const groups = new Map<string, OpmlFeed[]>();
  const bodyRegex = /<outline[^>]+text="([^"]+)"[^>]*>([\s\S]*?)<\/outline>/g;

  let match: RegExpExecArray | null = bodyRegex.exec(content);
  while (match) {
    const groupName = match[1]?.trim() || '默认分组';
    const groupFeeds = parseOpmlSubscriptions(`<opml><body>${match[0]}</body></opml>`);
    if (groupFeeds.length > 0) {
      groups.set(groupName, groupFeeds);
    }
    match = bodyRegex.exec(content);
  }

  if (groups.size === 0) {
    groups.set('默认分组', feeds);
  }

  return Array.from(groups.entries()).map(([name, groupFeeds]) => ({ name, feeds: groupFeeds }));
}

export async function bootstrapPlatformDatabase(
  db: PlatformDatabase,
  opmlPath: string = CONFIG.rss.defaultOpmlPath
): Promise<void> {
  const existingTopics = db.listTopicCategories();

  let rssTopic = existingTopics.find((topic) => topic.name === '默认主题');
  if (!rssTopic) {
    rssTopic = db.createTopicCategory({
      name: '默认主题',
      description: '手动维护的个人资讯主题',
      sortOrder: existingTopics.length,
      enabled: true,
    });
  }

  const existingMethods = db.listSourceMethodCategories();
  const rssMethod =
    existingMethods.find(
    (method) => method.topic_category_id === rssTopic.id && method.template_key === 'rss'
  ) ||
    db.createSourceMethodCategory({
      topicCategoryId: rssTopic.id,
      name: 'RSS 订阅',
      description: '基于 RSS/Atom 的订阅获取方式',
      templateKey: 'rss',
      allowCreate: true,
      enabled: true,
      sortOrder: 0,
    });

  if (existsSync(opmlPath)) {
    const content = await readFile(opmlPath, 'utf-8');
    const groups = parseOpmlGroups(content);

    for (const [groupIndex, group] of groups.entries()) {
      const topic =
        db.listTopicCategories().find((item) => item.name === group.name) ||
        db.createTopicCategory({
          name: group.name,
          description: `${group.name} 业务主题`,
          sortOrder: groupIndex,
          enabled: true,
        });

      const method =
        db.listSourceMethodCategories().find(
          (item) => item.topic_category_id === topic.id && item.template_key === 'rss'
        ) ||
        db.createSourceMethodCategory({
          topicCategoryId: topic.id,
          name: 'RSS 订阅',
          description: '基于 RSS/Atom 的订阅获取方式',
          templateKey: 'rss',
          allowCreate: true,
          enabled: true,
          sortOrder: 0,
        });

      const existingSources = db.listSources({ includeDeleted: true });
      for (const feed of group.feeds) {
        if (
          existingSources.some(
            (source) =>
              source.topic_category_id === topic.id &&
              source.source_method_category_id === method.id &&
              source.name === feed.title
          )
        ) {
          continue;
        }
        const sourceInput: SourceEditorInput = {
          name: feed.title,
          topicCategoryId: topic.id,
          sourceMethodCategoryId: method.id,
          baseUrl: feed.htmlUrl || feed.xmlUrl,
          configPayload: {
            feedUrl: feed.xmlUrl,
            htmlUrl: feed.htmlUrl || undefined,
          },
          status: 'enabled',
          notes: '来自 OPML 自动迁移',
        };
        db.createSource(sourceInput, buildValidation(feed));
      }
    }
  }

  const allMethods = db.listSourceMethodCategories();
  const allSources = db.listSources({ includeDeleted: true });
  for (const [index, template] of FETCHER_TEMPLATES.entries()) {
    if (template.key === 'rss') continue;

    const topicName = template.defaultTopicName || '内置聚合平台';
    const topicDescription =
      topicName === '内置聚合平台' ? '源代码中的内置抓取器模板和系统源' : `${topicName} 的可配置抓取模板`;
    const topic =
      db.listTopicCategories().find((item) => item.name === topicName) ||
      db.createTopicCategory({
        name: topicName,
        description: topicDescription,
        sortOrder: topicName === '内置聚合平台' ? 999 : 500,
        enabled: true,
      });

    const method =
      allMethods.find(
        (item) => item.topic_category_id === topic.id && item.template_key === template.key
      ) ||
      db.createSourceMethodCategory({
        topicCategoryId: topic.id,
        name: template.defaultMethodName,
        description: template.description,
        templateKey: template.key,
        allowCreate: template.allowInstanceCreate,
        enabled: true,
        sortOrder: index,
      });

    if (
      template.singleton &&
      !allSources.some(
        (source) =>
          source.source_method_category_id === method.id &&
          source.template_key === template.key &&
          !source.deleted_at
      )
    ) {
      db.createSource(
        {
          name: template.name,
          topicCategoryId: topic.id,
          sourceMethodCategoryId: method.id,
          baseUrl: template.defaultBaseUrl,
          configPayload: {},
          status: 'enabled',
          notes: '系统内置抓取器',
        },
        {
          ok: true,
          message: '系统模板已初始化',
          normalizedBaseUrl: template.defaultBaseUrl,
          normalizedConfig: {},
        }
      );
    }
  }
}
