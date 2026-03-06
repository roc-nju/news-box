import { createServer } from 'http';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { extname, normalize, resolve, sep } from 'path';
import { Readable } from 'stream';

import { CONFIG } from './config.js';
import { PlatformDatabase } from './platform/database.js';
import { PlatformService } from './platform/service.js';
import type { SourceEditorInput, SourceMethodCategoryPayload, TopicCategoryPayload } from './platform/types.js';

type JsonRecord = Record<string, unknown>;

const db = new PlatformDatabase();
const service = new PlatformService(db);
const webDistDir = resolve('web', 'dist');
const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function json(res: import('http').ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function unauthorized(res: import('http').ServerResponse, message: string = 'Unauthorized'): void {
  res.writeHead(401, {
    'Content-Type': 'application/json; charset=utf-8',
    'WWW-Authenticate': 'Basic realm="news-box-admin"',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify({ error: message }));
}

function isAdminAuthorized(req: import('http').IncomingMessage): boolean {
  const expectedUsername = process.env.ADMIN_USERNAME || '';
  const expectedPassword = process.env.ADMIN_PASSWORD || '';

  if (!expectedUsername || !expectedPassword) {
    return false;
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Basic ')) {
    return false;
  }

  try {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) return false;

    const username = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);
    return username === expectedUsername && password === expectedPassword;
  } catch {
    return false;
  }
}

async function readJsonBody(req: import('http').IncomingMessage): Promise<JsonRecord> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  const text = Buffer.concat(chunks).toString('utf-8');
  return JSON.parse(text) as JsonRecord;
}

async function readNewsPayload(range: string): Promise<unknown> {
  const fileName = range === '7d' ? 'latest-7d.json' : 'latest-24h.json';
  try {
    const content = await readFile(resolve('data', fileName), 'utf-8');
    return JSON.parse(content);
  } catch {
    return {
      generated_at: new Date().toISOString(),
      window_hours: range === '7d' ? 168 : 24,
      total_items: 0,
      total_items_ai_raw: 0,
      total_items_raw: 0,
      total_items_all_mode: 0,
      topic_filter: 'ai',
      archive_total: 0,
      site_count: 0,
      source_count: 0,
      site_stats: [],
      items: [],
      items_ai: [],
      items_all_raw: [],
      items_all: [],
    };
  }
}

async function serveStaticAsset(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  pathname: string
): Promise<boolean> {
  if (!existsSync(webDistDir)) return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;

  const rawRelativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const candidatePath = normalize(resolve(webDistDir, rawRelativePath));

  if (!candidatePath.startsWith(`${webDistDir}${sep}`) && candidatePath !== resolve(webDistDir, 'index.html')) {
    json(res, 403, { error: 'Forbidden' });
    return true;
  }

  const filePath = existsSync(candidatePath) ? candidatePath : resolve(webDistDir, 'index.html');

  try {
    const content = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
    });
    res.end(req.method === 'HEAD' ? undefined : content);
    return true;
  } catch {
    return false;
  }
}

function isAllowedMediaUrl(rawUrl: string): boolean {
  try {
    const target = new URL(rawUrl);
    if (!['http:', 'https:'].includes(target.protocol)) return false;
    return ['video.twimg.com', 'pbs.twimg.com'].includes(target.hostname);
  } catch {
    return false;
  }
}

async function proxyMedia(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  rawUrl: string
): Promise<void> {
  if (!isAllowedMediaUrl(rawUrl)) {
    json(res, 400, { error: 'Unsupported media url' });
    return;
  }

  const headers = new Headers({
    'User-Agent': CONFIG.http.userAgent,
  });
  const range = req.headers.range;
  if (typeof range === 'string' && range.trim()) {
    headers.set('Range', range);
  }

  const upstream = await fetch(rawUrl, {
    headers,
    redirect: 'follow',
  });

  if (!upstream.ok && upstream.status !== 206) {
    json(res, upstream.status, { error: `Upstream media request failed: ${upstream.status}` });
    return;
  }

  const responseHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': upstream.headers.get('cache-control') || 'public, max-age=3600',
    'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
    'Accept-Ranges': upstream.headers.get('accept-ranges') || 'bytes',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  };

  const passthroughHeaders = ['content-length', 'content-range', 'etag', 'last-modified'];
  for (const headerName of passthroughHeaders) {
    const value = upstream.headers.get(headerName);
    if (value) {
      responseHeaders[headerName
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('-')] = value;
    }
  }

  res.writeHead(upstream.status, responseHeaders);

  if (!upstream.body) {
    res.end();
    return;
  }

  Readable.fromWeb(upstream.body as globalThis.ReadableStream<Uint8Array>).pipe(res);
}

function toSourceEditorInput(body: JsonRecord): SourceEditorInput {
  const configPayload =
    typeof body.configPayload === 'object' && body.configPayload !== null
      ? { ...(body.configPayload as Record<string, unknown>) }
      : {};
  if (body.feedUrl) configPayload.feedUrl = String(body.feedUrl);
  if (body.htmlUrl) configPayload.htmlUrl = String(body.htmlUrl);

  return {
    name: String(body.name || ''),
    topicCategoryId: String(body.topicCategoryId || ''),
    sourceMethodCategoryId: String(body.sourceMethodCategoryId || ''),
    baseUrl: String(body.baseUrl || ''),
    configPayload,
    status: body.status === 'disabled' ? 'disabled' : 'enabled',
    notes: body.notes ? String(body.notes) : null,
  };
}

async function handleRequest(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse
): Promise<void> {
  if (!req.url || !req.method) {
    json(res, 400, { error: 'Invalid request' });
    return;
  }

  if (req.method === 'OPTIONS') {
    json(res, 200, { ok: true });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  const pathname = url.pathname;
  const segments = pathname.split('/').filter(Boolean);

  try {
    if (pathname.startsWith('/api/admin') && !isAdminAuthorized(req)) {
      unauthorized(res, '后台访问需要认证');
      return;
    }

    if (!pathname.startsWith('/api')) {
      const served = await serveStaticAsset(req, res, pathname);
      if (served) return;

      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Web assets not found. Run `pnpm build` first.');
      return;
    }

    if (req.method === 'GET' && pathname === '/api/health') {
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/news') {
      const range = url.searchParams.get('range') || '24h';
      json(res, 200, await readNewsPayload(range));
      return;
    }

    if (req.method === 'GET' && pathname === '/api/media') {
      const targetUrl = url.searchParams.get('url') || '';
      await proxyMedia(req, res, targetUrl);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/admin/bootstrap') {
      json(res, 200, service.listDashboardData());
      return;
    }

    if (req.method === 'GET' && pathname === '/api/admin/topic-categories') {
      json(res, 200, service.listTopicCategories());
      return;
    }

    if (req.method === 'POST' && pathname === '/api/admin/topic-categories') {
      const body = await readJsonBody(req);
      const payload: TopicCategoryPayload = {
        name: String(body.name || ''),
        description: body.description ? String(body.description) : null,
        enabled: body.enabled === undefined ? true : Boolean(body.enabled),
        sortOrder: body.sortOrder === undefined ? 0 : Number(body.sortOrder),
      };
      json(res, 201, service.createTopicCategory(payload));
      return;
    }

    if (segments[0] === 'api' && segments[1] === 'admin' && segments[2] === 'topic-categories' && segments[3]) {
      const id = segments[3];
      if (req.method === 'PUT') {
        const body = await readJsonBody(req);
        const payload: TopicCategoryPayload = {
          name: String(body.name || ''),
          description: body.description ? String(body.description) : null,
          enabled: body.enabled === undefined ? true : Boolean(body.enabled),
          sortOrder: body.sortOrder === undefined ? 0 : Number(body.sortOrder),
        };
        json(res, 200, service.updateTopicCategory(id, payload));
        return;
      }
      if (req.method === 'DELETE') {
        service.deleteTopicCategory(id);
        json(res, 200, { ok: true });
        return;
      }
    }

    if (req.method === 'GET' && pathname === '/api/admin/source-method-categories') {
      json(res, 200, service.listSourceMethodCategories());
      return;
    }

    if (req.method === 'POST' && pathname === '/api/admin/source-method-categories') {
      const body = await readJsonBody(req);
      const payload: SourceMethodCategoryPayload = {
        topicCategoryId: String(body.topicCategoryId || ''),
        name: String(body.name || ''),
        description: body.description ? String(body.description) : null,
        templateKey: body.templateKey ? String(body.templateKey) : 'rss',
        allowCreate: body.allowCreate === undefined ? true : Boolean(body.allowCreate),
        enabled: body.enabled === undefined ? true : Boolean(body.enabled),
        sortOrder: body.sortOrder === undefined ? 0 : Number(body.sortOrder),
      };
      json(res, 201, service.createSourceMethodCategory(payload));
      return;
    }

    if (
      segments[0] === 'api' &&
      segments[1] === 'admin' &&
      segments[2] === 'source-method-categories' &&
      segments[3]
    ) {
      const id = segments[3];
      if (req.method === 'PUT') {
        const body = await readJsonBody(req);
        const payload: SourceMethodCategoryPayload = {
          topicCategoryId: String(body.topicCategoryId || ''),
          name: String(body.name || ''),
          description: body.description ? String(body.description) : null,
          templateKey: body.templateKey ? String(body.templateKey) : 'rss',
          allowCreate: body.allowCreate === undefined ? true : Boolean(body.allowCreate),
          enabled: body.enabled === undefined ? true : Boolean(body.enabled),
          sortOrder: body.sortOrder === undefined ? 0 : Number(body.sortOrder),
        };
        json(res, 200, service.updateSourceMethodCategory(id, payload));
        return;
      }
      if (req.method === 'DELETE') {
        service.deleteSourceMethodCategory(id);
        json(res, 200, { ok: true });
        return;
      }
    }

    if (req.method === 'GET' && pathname === '/api/admin/sources') {
      json(res, 200, service.listSources(false));
      return;
    }

    if (req.method === 'GET' && pathname === '/api/admin/sources/recycle-bin') {
      json(res, 200, service.listSources(true).filter((source) => source.deleted_at));
      return;
    }

    if (req.method === 'POST' && pathname === '/api/admin/sources/validate') {
      const body = await readJsonBody(req);
      json(res, 200, await service.validateSource(toSourceEditorInput(body)));
      return;
    }

    if (req.method === 'GET' && pathname === '/api/admin/sources/opml-export') {
      res.writeHead(200, {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Disposition': 'attachment; filename="rss-sources.opml"',
      });
      res.end(service.exportRssSourcesAsOpml());
      return;
    }

    if (req.method === 'POST' && pathname === '/api/admin/sources/opml-import') {
      const body = await readJsonBody(req);
      json(res, 200, await service.importRssSourcesFromOpml(String(body.opmlContent || '')));
      return;
    }

    if (req.method === 'POST' && pathname === '/api/admin/sources') {
      const body = await readJsonBody(req);
      json(res, 201, await service.createSource(toSourceEditorInput(body)));
      return;
    }

    if (req.method === 'POST' && pathname === '/api/admin/sources/restore-all') {
      service.restoreAllSources();
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/admin/sources/bulk-status') {
      const body = await readJsonBody(req);
      const ids = Array.isArray(body.ids) ? body.ids.map((id) => String(id)) : [];
      const status = body.status === 'disabled' ? 'disabled' : 'enabled';
      service.setSourcesStatus(ids, status);
      json(res, 200, { ok: true });
      return;
    }

    if (segments[0] === 'api' && segments[1] === 'admin' && segments[2] === 'sources' && segments[3]) {
      const id = segments[3];
      if (req.method === 'PUT') {
        const body = await readJsonBody(req);
        json(res, 200, await service.updateSource(id, toSourceEditorInput(body)));
        return;
      }
      if (req.method === 'POST' && segments[4] === 'enable') {
        service.setSourceStatus(id, 'enabled');
        json(res, 200, { ok: true });
        return;
      }
      if (req.method === 'POST' && segments[4] === 'disable') {
        service.setSourceStatus(id, 'disabled');
        json(res, 200, { ok: true });
        return;
      }
      if (req.method === 'DELETE') {
        service.deleteSource(id);
        json(res, 200, { ok: true });
        return;
      }
      if (req.method === 'POST' && segments[4] === 'restore') {
        service.restoreSource(id);
        json(res, 200, { ok: true });
        return;
      }
    }

    json(res, 404, { error: 'Not found' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    json(res, 400, { error: message });
  }
}

async function start(): Promise<void> {
  await service.bootstrap();
  const server = createServer((req, res) => {
    void handleRequest(req, res);
  });
  server.listen(CONFIG.platform.apiPort, CONFIG.platform.apiHost, () => {
    console.log(`Platform API listening on http://${CONFIG.platform.apiHost}:${CONFIG.platform.apiPort}`);
  });
}

void start();
