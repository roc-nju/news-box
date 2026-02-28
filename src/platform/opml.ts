import type { SourceListItem } from './types.js';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildOpmlFromSources(sources: SourceListItem[]): string {
  const groups = new Map<string, SourceListItem[]>();
  for (const source of sources.filter((item) => item.template_key === 'rss' && !item.deleted_at)) {
    const key = source.topic_category_name || '默认分组';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(source);
  }

  const outlines = Array.from(groups.entries())
    .map(([groupName, groupSources]) => {
      const sourceLines = groupSources
        .map((source) => {
          const config = JSON.parse(source.config_payload || '{}') as { feedUrl?: string; htmlUrl?: string };
          return `      <outline text="${escapeXml(source.name)}" title="${escapeXml(source.name)}" type="rss" xmlUrl="${escapeXml(config.feedUrl || source.base_url)}" htmlUrl="${escapeXml(config.htmlUrl || source.base_url)}" />`;
        })
        .join('\n');
      return `    <outline text="${escapeXml(groupName)}">\n${sourceLines}\n    </outline>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head>\n    <title>AI Signal Board RSS Export</title>\n  </head>\n  <body>\n${outlines}\n  </body>\n</opml>\n`;
}
