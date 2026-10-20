import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';
import {
  createRunStore,
  resolveAgentProject,
  startImplementRun,
  taskForFlow,
  buildImplementPrompt,
} from './agent.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.zip': 'application/zip',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

const DEFAULT_TYPE = 'application/octet-stream';

const ARTIFACT_PREFIX = '/api/artifact/';

const GRAPH_ROUTE = '/api/graph.json';

const IMPLEMENT_ROUTE = '/api/implement-test';

const MAX_BODY_BYTES = 100000;

const IMPLEMENT_KEYS = [
  'id',
  'flowId',
  'status',
  'log',
  'ok',
  'exitCode',
  'rebuilt',
  'startedAt',
  'finishedAt',
  'durationMs',
  'error',
];

function publicRun(run) {
  const out = {};
  for (const key of IMPLEMENT_KEYS) out[key] = run[key] ?? null;
  if (Array.isArray(out.log)) out.log = out.log.join('\n');
  if (!run.error) delete out.error;
  return out;
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJsonBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      data += chunk.toString('utf8');
    });
    req.on('end', () => {
      if (!data.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function contentTypeFor(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] ?? DEFAULT_TYPE;
}

function isInside(base, target) {
  const relative = path.relative(base, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!match) return { invalid: true };
  let start;
  let end;
  if (match[1] === '') {
    if (match[2] === '') return { invalid: true };
    const suffix = Number(match[2]);
    if (!Number.isFinite(suffix) || suffix <= 0) return { invalid: true };
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Number(match[2]);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return { invalid: true };
  if (start > end || start >= size) return { invalid: true };
  if (end >= size) end = size - 1;
  return { start, end };
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function streamFile(req, res, filePath, type, allowRanges) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    sendText(res, 404, 'not found');
    return;
  }
  if (!stat.isFile()) {
    sendText(res, 404, 'not found');
    return;
  }

  const size = stat.size;
  const headers = { 'Content-Type': type };
  if (allowRanges) headers['Accept-Ranges'] = 'bytes';

  const range = allowRanges ? parseRange(req.headers.range, size) : null;

  if (range && range.invalid) {
    res.writeHead(416, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Range': `bytes *` + `/${size}`,
    });
    res.end();
    return;
  }

  if (range) {
    headers['Content-Length'] = range.end - range.start + 1;
    headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`;
    res.writeHead(206, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath, { start: range.start, end: range.end }).pipe(res);
    return;
  }

  headers['Content-Length'] = size;
  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
}

function readGraph(graphPath) {
  try {
    return JSON.parse(fs.readFileSync(graphPath, 'utf8'));
  } catch {
    return null;
  }
}

export function createServer(options = {}) {
  const outDir = path.resolve(options.outDir ?? '.');
  const graphPath = options.graphPath ? path.resolve(options.graphPath) : path.join(outDir, 'graph.json');
  const configPath = options.configPath
    ? path.resolve(options.configPath)
    : path.join(path.dirname(outDir), 'flowlens.config.json');
  const runs = createRunStore();

  function handleImplement(req, res) {
    let parsed;
    try {
      parsed = new URL(req.url, 'http://localhost');
    } catch {
      sendJson(res, 400, { error: 'bad request' });
      return;
    }
    if (req.method === 'GET') {
      const id = parsed.searchParams.get('id');
      if (id) {
        const run = runs.get(id);
        if (!run) {
          sendJson(res, 404, { error: 'run not found', id });
          return;
        }
        sendJson(res, 200, publicRun(run));
        return;
      }
      sendJson(res, 200, { runs: runs.list().map(publicRun) });
      return;
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { Allow: 'GET, POST', 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('method not allowed');
      return;
    }
    readJsonBody(req)
      .then((body) => {
        const flowId = body && body.flowId;
        if (typeof flowId !== 'string' || !flowId) {
          sendJson(res, 400, { error: 'flowId is required' });
          return;
        }
        const graph = readGraph(graphPath);
        if (!graph) {
          sendJson(res, 409, { error: 'graph not built', graphPath });
          return;
        }
        const task = taskForFlow(graph, flowId);
        if (!task) {
          sendJson(res, 404, { error: `flow not found in graph: ${flowId}` });
          return;
        }
        if (body.dryRun === true) {
          const project = resolveAgentProject({ configPath });
          sendJson(res, 200, {
            dryRun: true,
            flowId,
            prompt: buildImplementPrompt(task, graph.agent ?? {}),
            agent: {
              command: project.agent.command,
              argsTemplate: project.agent.argsTemplate,
              source: project.agent.source,
            },
            task,
          });
          return;
        }
        let run;
        try {
          const project = resolveAgentProject({ configPath });
          run = startImplementRun({
            store: runs,
            project,
            graph,
            flowId,
            timeoutMs: options.agentTimeoutMs,
            rebuild: () => build({ configPath }),
          });
        } catch (error) {
          sendJson(res, 500, { error: error && error.message ? error.message : String(error) });
          return;
        }
        sendJson(res, 202, { id: run.id, flowId, status: run.status });
      })
      .catch((error) => {
        sendJson(res, 400, { error: error && error.message ? error.message : 'invalid request' });
      });
  }

  return http.createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      sendText(res, 400, 'bad request');
      return;
    }

    if (pathname === IMPLEMENT_ROUTE) {
      handleImplement(req, res);
      return;
    }

    if (pathname === GRAPH_ROUTE) {
      streamFile(req, res, graphPath, 'application/json; charset=utf-8', false);
      return;
    }

    if (pathname.startsWith(ARTIFACT_PREFIX)) {
      const id = pathname.slice(ARTIFACT_PREFIX.length);
      const graph = readGraph(graphPath);
      const entry = graph && graph.artifacts ? graph.artifacts[id] : null;
      if (!entry || !entry.absPath) {
        sendText(res, 404, 'artifact not found');
        return;
      }
      streamFile(
        req,
        res,
        path.resolve(entry.absPath),
        entry.contentType ?? DEFAULT_TYPE,
        true
      );
      return;
    }

    const relativePath = pathname === '/' ? '/index.html' : pathname;
    const target = path.resolve(outDir, `.${relativePath}`);
    if (!isInside(outDir, target)) {
      sendText(res, 403, 'forbidden');
      return;
    }
    streamFile(req, res, target, contentTypeFor(target), true);
  });
}

export function startServer(options = {}) {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 8017;
  const server = createServer(options);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      const boundPort = address && typeof address === 'object' ? address.port : port;
      resolve({ server, host, port: boundPort, url: `http://${host}:${boundPort}` });
    });
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const argv = process.argv.slice(2);
  let outDir = null;
  let port = 8017;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--out') outDir = argv[index + 1];
    else if (argv[index] === '--port') port = Number(argv[index + 1]);
  }
  if (!outDir) {
    process.stderr.write('usage: node src/server.mjs --out <dir> [--port <n>]\n');
    process.exitCode = 1;
  } else {
    startServer({ outDir, port }).then(({ url }) => {
      process.stdout.write(`flowlens serve -> ${url} (out=${path.resolve(outDir)})\n`);
    });
  }
}
