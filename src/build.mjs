import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveFromReportModel, resolveFromReporterJson } from './resolve.mjs';
import { extractRequests } from './network.mjs';
import { renderHtml } from './viewer/render.mjs';
import { resolveConfigPath } from './paths.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const FLOWLENS_ROOT = path.resolve(HERE, '..');

const VENDOR_DIR = path.join(HERE, 'viewer', 'vendor');

const TRACE_VIEWER_SEGMENTS = [
  'node_modules',
  'playwright-core',
  'lib',
  'vite',
  'traceViewer',
];

const ACCENT_MARKS = /[\u0300-\u036f]/g;

const TOKEN_SPLIT = /[^a-z0-9]+/;

const STOP_WORDS = new Set([
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'un',
  'una',
  'unos',
  'unas',
  'y',
  'o',
  'en',
  'con',
  'por',
  'para',
  'sin',
  'su',
  'sus',
  'al',
  'se',
  'lo',
  'que',
  'the',
  'and',
]);

function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(ACCENT_MARKS, '')
    .toLowerCase();
}

function slug(text) {
  return (
    String(text ?? '')
      .normalize('NFD')
      .replace(ACCENT_MARKS, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'flow'
  );
}

function labelTokens(label) {
  return normalize(label)
    .split(TOKEN_SPLIT)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function collectSteps(steps, predicate, out) {
  for (const step of Array.isArray(steps) ? steps : []) {
    if (!step || typeof step !== 'object') continue;
    if (!predicate(step)) continue;
    out.push(step);
    collectSteps(step.children, predicate, out);
  }
  return out;
}

function allSteps(steps) {
  return collectSteps(steps, () => true, []);
}

function bodySteps(steps) {
  return collectSteps(
    steps,
    (step) => !(typeof step.title === 'string' && step.title.toLowerCase().includes('hooks')),
    []
  );
}

function findCreateContextMs(steps) {
  const all = allSteps(steps);
  const create = all.find(
    (step) => typeof step.title === 'string' && step.title.includes('Create context')
  );
  const chosen = create ?? all[0] ?? null;
  return chosen && typeof chosen.startMs === 'number' ? chosen.startMs : null;
}

function attachmentId(attachment) {
  return attachment && attachment.absPath ? path.basename(attachment.absPath) : null;
}

function findVideoAttachment(test) {
  const results = Array.isArray(test.results) ? test.results : [];
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const found = (results[index].attachments ?? []).find(
      (attachment) => attachment.name === 'video' && attachment.exists
    );
    if (found) return found;
  }
  return null;
}

function matchBySubstring(steps, text, occurrence) {
  const target = normalize(text);
  if (!target) return null;
  let seen = 0;
  for (const step of steps) {
    if (typeof step.title !== 'string') continue;
    if (normalize(step.title).includes(target)) {
      seen += 1;
      if (seen === occurrence) return step;
    }
  }
  return null;
}

function makeEntry(nodeId, step, baseMs, approx) {
  const start = step.startMs - baseMs;
  const duration = typeof step.durationMs === 'number' ? step.durationMs : 0;
  return {
    node: nodeId,
    startMs: start,
    endMs: start + duration,
    stepTitle: typeof step.title === 'string' ? step.title : null,
    approx,
  };
}

function autoMatch(node, body, baseMs) {
  const tokens = labelTokens(node.label ?? '');
  if (!tokens.length) return null;
  let best = null;
  let bestScore = 0;
  for (const step of body) {
    if (typeof step.title !== 'string' || typeof step.startMs !== 'number') continue;
    const haystack = normalize(step.title);
    let score = 0;
    for (const token of tokens) {
      if (haystack.includes(token)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = step;
    }
  }
  return best ? makeEntry(node.id, best, baseMs, true) : null;
}

function mapNode(node, all, body, baseMs) {
  if (typeof baseMs !== 'number') return [];
  const out = [];
  if (Array.isArray(node.steps) && node.steps.length) {
    for (const spec of node.steps) {
      let title = null;
      let occurrence = 1;
      if (typeof spec === 'string') {
        title = spec;
      } else if (spec && typeof spec === 'object') {
        title = typeof spec.title === 'string' ? spec.title : null;
        occurrence = typeof spec.occurrence === 'number' && spec.occurrence > 0 ? spec.occurrence : 1;
      }
      if (!title) continue;
      const step = matchBySubstring(all, title, occurrence);
      if (step && typeof step.startMs === 'number') out.push(makeEntry(node.id, step, baseMs, false));
    }
    if (out.length) return out;
    return [];
  }
  const auto = autoMatch(node, body, baseMs);
  return auto ? [auto] : [];
}

function ordinalEntry(node, index, nodeCount, body, baseMs) {
  const total = body.length;
  if (!total || nodeCount < 1) return null;
  const lo = Math.floor((index * total) / nodeCount);
  const hi = Math.floor(((index + 1) * total) / nodeCount);
  if (hi <= lo) return null;
  const first = body[lo];
  const last = body[hi - 1];
  if (typeof first.startMs !== 'number') return null;
  const start = first.startMs - baseMs;
  const endStart = typeof last.startMs === 'number' ? last.startMs : first.startMs;
  const end = endStart + (typeof last.durationMs === 'number' ? last.durationMs : 0) - baseMs;
  return {
    node: node.id,
    startMs: start,
    endMs: end,
    stepTitle: typeof first.title === 'string' ? first.title : null,
    approx: true,
  };
}

const METHOD_PATH = /^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(\S+)/i;

const TRACE_NODE_ID = /\.trace\.\d+$/;

function isTraceNodeId(id) {
  return typeof id === 'string' && TRACE_NODE_ID.test(id);
}

function routeOf(label) {
  const match = METHOD_PATH.exec(String(label ?? '').trim());
  if (!match) return null;
  return { method: match[1].toUpperCase(), path: match[2] };
}

function pathSegments(value) {
  return String(value ?? '')
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.toLowerCase());
}

function segmentMatches(nodeSegment, requestSegment) {
  if (nodeSegment === '*') return true;
  if (/^\{[^}]+\}$/.test(nodeSegment)) return true;
  return nodeSegment === requestSegment;
}

function routeMatches(nodeSegments, requestSegments, nodeIndex, requestIndex) {
  let i = nodeIndex;
  let j = requestIndex;
  while (i < nodeSegments.length) {
    const nodeSegment = nodeSegments[i];
    if (nodeSegment === '*') {
      if (i === nodeSegments.length - 1) return requestSegments.length - j >= 1;
      for (let k = j + 1; k <= requestSegments.length; k += 1) {
        if (routeMatches(nodeSegments, requestSegments, i + 1, k)) return true;
      }
      return false;
    }
    if (j >= requestSegments.length) return false;
    if (!segmentMatches(nodeSegment, requestSegments[j])) return false;
    i += 1;
    j += 1;
  }
  return j === requestSegments.length;
}

function matchRequest(backends, request) {
  const requestSegments = pathSegments(request.path);
  const method = String(request.method ?? '').toUpperCase();
  for (const backend of backends) {
    const route = routeOf(backend.endpoint ?? backend.label);
    if (!route || route.method !== method) continue;
    if (routeMatches(pathSegments(route.path), requestSegments, 0, 0)) return backend;
  }
  return null;
}

const METHOD_VERB = {
  GET: 'Consultar',
  HEAD: 'Consultar',
  OPTIONS: 'Consultar',
  POST: 'Crear',
  PUT: 'Actualizar',
  PATCH: 'Actualizar',
  DELETE: 'Eliminar',
};

const CAMEL_BOUNDARY = /([a-z0-9])([A-Z])/g;

const ROUTE_NOISE = new Set(['api', 'download']);

function resourceWord(pathValue) {
  const segments = String(pathValue ?? '')
    .split('/')
    .filter((segment) => segment.length > 0)
    .filter((segment) => !/^\{[^}]+\}$/.test(segment))
    .filter((segment) => !/^v\d+$/i.test(segment))
    .filter((segment) => !ROUTE_NOISE.has(segment.toLowerCase()));
  const last = segments[segments.length - 1];
  if (!last) return null;
  return last
    .replace(CAMEL_BOUNDARY, '$1 $2')
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function prettifyTechnical(technical) {
  const route = routeOf(technical);
  if (route) {
    const verb = METHOD_VERB[route.method] ?? 'Llamar';
    const word = resourceWord(route.path);
    return word ? `${verb} ${word}` : `${verb} recurso`;
  }
  const first = String(technical ?? '').split(/[+(]/)[0].trim();
  const cleaned = first.replace(/^(Opr|Ctl|sp_)/i, '');
  const words = cleaned
    .replace(CAMEL_BOUNDARY, '$1 $2')
    .replace(/[_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return words || String(technical ?? '').trim();
}

function patternMatches(matchText, technical) {
  const match = String(matchText ?? '').trim();
  const technicalText = String(technical ?? '');
  if (!match || !technicalText) return false;
  const matchRoute = routeOf(match);
  if (matchRoute) {
    const technicalRoute = routeOf(technicalText);
    if (!technicalRoute || technicalRoute.method !== matchRoute.method) return false;
    return routeMatches(pathSegments(matchRoute.path), pathSegments(technicalRoute.path), 0, 0);
  }
  return normalize(technicalText).includes(normalize(match));
}

function resolveLabel(labels, technical) {
  const list = labels && Array.isArray(labels.patterns) ? labels.patterns : [];
  const target = String(technical ?? '');
  const normalized = normalize(target);
  for (const pattern of list) {
    if (!pattern || typeof pattern.label !== 'string') continue;
    if (normalize(pattern.match) === normalized) return { label: pattern.label, matched: true };
  }
  for (const pattern of list) {
    if (!pattern || typeof pattern.label !== 'string') continue;
    if (patternMatches(pattern.match, target)) return { label: pattern.label, matched: true };
  }
  return { label: prettifyTechnical(target), matched: false };
}

function tracePayload(postData) {
  if (typeof postData !== 'string') return null;
  const value = postData.trim();
  if (!value) return null;
  return value.slice(0, 160);
}

function authoredBackends(flow) {
  return (Array.isArray(flow.nodes) ? flow.nodes : []).filter(
    (node) => node && node.kind === 'backend' && !isTraceNodeId(node.id)
  );
}

function findLoginNodeId(flow) {
  const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];
  for (const node of nodes) {
    if (node && typeof node.id === 'string' && /\.login$/i.test(node.id)) return node.id;
  }
  for (const node of nodes) {
    if (node && typeof node.label === 'string' && /login/i.test(node.label)) return node.id;
  }
  return null;
}

function activeSourceNode(activity, relMs, loginId) {
  let active = null;
  let lastStarted = null;
  for (const entry of activity) {
    if (entry.startMs <= relMs) {
      lastStarted = entry;
      if (relMs < entry.endMs) active = entry;
    }
  }
  if (active) return active.node;
  if (lastStarted) return lastStarted.node;
  return loginId;
}

function nextSourceNode(activity, endMs) {
  for (const entry of activity) {
    if (entry.startMs >= endMs) return entry.node;
  }
  return null;
}

function applyTraceRequests(flow, trace, entries, baseMs, links, labels) {
  const requests = Array.isArray(trace.requests) ? trace.requests.slice() : [];
  if (!requests.length || typeof baseMs !== 'number') return;
  requests.sort((left, right) => left.startWallMs - right.startWallMs);
  const backends = authoredBackends(flow);
  const state = trace.state;
  if (!Array.isArray(flow.nodes)) flow.nodes = [];
  const flowNodes = flow.nodes;
  const kindById = new Map(flowNodes.map((node) => [node.id, node.kind]));
  const activity = entries
    .filter((entry) => {
      const kind = kindById.get(entry.node);
      return kind === 'interaction' || kind === 'decision';
    })
    .slice()
    .sort((left, right) => left.startMs - right.startMs);
  const loginId = findLoginNodeId(flow);
  const nodeById = (id) => flowNodes.find((node) => node.id === id) ?? null;

  for (const request of requests) {
    const relMs = request.startWallMs - baseMs;
    if (!(relMs >= -2000 && relMs <= 600000)) continue;
    const duration = typeof request.durationMs === 'number' ? request.durationMs : 0;
    const stepTitle = `${request.method} ${request.path}`;
    const matched = matchRequest(backends, request);
    let nodeId = null;
    if (matched) {
      nodeId = matched.id;
      entries.push({ node: matched.id, startMs: relMs, endMs: relMs + duration, stepTitle, approx: false });
      const payload = tracePayload(request.postData);
      if (payload) matched.payload = payload;
      if (request.response) matched.response = request.response;
    } else if (state) {
      const key = `${request.method} ${request.path}`.toLowerCase();
      const existing = state.byKey.get(key);
      if (existing) {
        nodeId = existing;
        entries.push({ node: existing, startMs: relMs, endMs: relMs + duration, stepTitle, approx: false });
        const node = nodeById(existing);
        if (node && request.response) node.response = request.response;
      } else if (state.count < 6) {
        if (!Array.isArray(flow.nodes)) flow.nodes = [];
        state.count += 1;
        const id = `${flow.id ?? 'flow'}.trace.${state.count}`;
        const friendly = resolveLabel(labels, stepTitle).label;
        const created = {
          id,
          label: friendly,
          endpoint: stepTitle,
          kind: 'backend',
          flow: flow.id ?? null,
          module: 'trace',
          payload: tracePayload(request.postData),
          response: request.response ?? null,
        };
        flow.nodes.push(created);
        kindById.set(id, 'backend');
        state.byKey.set(key, id);
        nodeId = id;
        entries.push({ node: id, startMs: relMs, endMs: relMs + duration, stepTitle, approx: false });
      }
    }
    if (!nodeId || !links) continue;
    const source = activeSourceNode(activity, relMs, loginId);
    if (source) links.add(source, nodeId);
    const next = nextSourceNode(activity, relMs + duration);
    if (next) links.add(nodeId, next);
  }
}

function dbBackendPairs(flow) {
  const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];
  const kindById = new Map(nodes.map((node) => [node.id, node.kind]));
  const pairs = new Map();
  for (const edge of Array.isArray(flow.edges) ? flow.edges : []) {
    let from = null;
    let to = null;
    if (Array.isArray(edge) && edge.length >= 2) {
      from = edge[0];
      to = edge[1];
    } else if (edge && typeof edge === 'object') {
      from = edge.from ?? edge.source ?? null;
      to = edge.to ?? edge.target ?? null;
    }
    if (kindById.get(from) === 'backend' && kindById.get(to) === 'db' && !pairs.has(to)) {
      pairs.set(to, from);
    }
  }
  const dbPrefix = `${flow.id ?? ''}.db.`;
  const backendPrefix = `${flow.id ?? ''}.backend.`;
  for (const node of nodes) {
    if (node.kind !== 'db' || pairs.has(node.id) || typeof node.id !== 'string') continue;
    if (!node.id.startsWith(dbPrefix)) continue;
    const candidate = `${backendPrefix}${node.id.slice(dbPrefix.length)}`;
    if (kindById.get(candidate) === 'backend') pairs.set(node.id, candidate);
  }
  return pairs;
}

function applyDbEntries(flow, entries) {
  const pairs = dbBackendPairs(flow);
  if (!pairs.size) return;
  const labelById = new Map((Array.isArray(flow.nodes) ? flow.nodes : []).map((node) => [node.id, node]));
  const byNode = new Map();
  for (const entry of entries) {
    const list = byNode.get(entry.node);
    if (list) list.push(entry);
    else byNode.set(entry.node, [entry]);
  }
  for (const [dbId, backendId] of pairs) {
    const source = byNode.get(backendId);
    if (!source || !source.length) continue;
    const node = labelById.get(dbId);
    const technical =
      node && typeof node.endpoint === 'string' && node.endpoint
        ? node.endpoint
        : node && typeof node.label === 'string' && node.label
          ? node.label
          : null;
    for (const entry of source) {
      entries.push({
        node: dbId,
        startMs: entry.startMs,
        endMs: entry.endMs,
        stepTitle: technical ?? (typeof entry.stepTitle === 'string' ? entry.stepTitle : null),
        approx: false,
      });
    }
  }
}

function findTraceAttachment(test) {
  const results = Array.isArray(test.results) ? test.results : [];
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const found = (results[index].attachments ?? []).find(
      (attachment) => attachment && attachment.name === 'trace' && attachment.exists === true && attachment.absPath
    );
    if (found) return found;
  }
  return null;
}

function loadTrace(flow, test, artifacts, traceState) {
  const attachment = findTraceAttachment(test);
  if (!attachment) return null;
  const artifactId = path.basename(attachment.absPath);
  const artifact = artifacts[artifactId];
  const absPath = artifact && artifact.absPath ? artifact.absPath : attachment.absPath;
  if (!absPath || !fs.existsSync(absPath)) return null;
  let requests;
  try {
    requests = extractRequests(fs.readFileSync(absPath));
  } catch (error) {
    return null;
  }
  const flowId = flow.id ?? '';
  let state = traceState.get(flowId);
  if (!state) {
    state = { count: 0, byKey: new Map() };
    traceState.set(flowId, state);
  }
  return { requests, state };
}

function buildTimeline(flow, test, mappedNodes, trace, links, labels) {
  const results = Array.isArray(test.results) ? test.results : [];
  const result = results[results.length - 1] ?? null;
  const rawSteps = result && Array.isArray(result.steps) ? result.steps : [];
  const all = allSteps(rawSteps);
  const body = bodySteps(rawSteps);
  const base = findCreateContextMs(rawSteps);
  const baseMs =
    typeof base === 'number'
      ? base
      : all[0] && typeof all[0].startMs === 'number'
        ? all[0].startMs
        : null;
  const videoAttachment = findVideoAttachment(test);
  const nodeList = (Array.isArray(flow.nodes) ? flow.nodes : []).filter(
    (node) => !node || (node.kind !== 'backend' && node.kind !== 'db')
  );
  const entries = [];
  const mapped = new Set();

  for (const node of nodeList) {
    const nodeEntries = mapNode(node, all, body, baseMs);
    for (const entry of nodeEntries) {
      entries.push(entry);
      mapped.add(node.id);
      mappedNodes.add(node.id);
    }
  }

  if (typeof baseMs === 'number' && body.length) {
    nodeList.forEach((node, index) => {
      if (mapped.has(node.id)) return;
      if (Array.isArray(node.steps) && node.steps.length) return;
      const entry = ordinalEntry(node, index, nodeList.length, body, baseMs);
      if (entry) {
        entries.push(entry);
        mapped.add(node.id);
        mappedNodes.add(node.id);
      }
    });
  }

  if (trace) applyTraceRequests(flow, trace, entries, baseMs, links, labels);
  applyDbEntries(flow, entries);

  entries.sort((left, right) => left.startMs - right.startMs);

  return {
    videoArtifact: videoAttachment ? attachmentId(videoAttachment) : null,
    videoBaseMs: baseMs,
    entries,
  };
}

function registerArtifacts(artifacts, test) {
  for (const result of test.results ?? []) {
    for (const attachment of result.attachments ?? []) {
      if (!attachment || attachment.exists !== true || !attachment.absPath) continue;
      const id = path.basename(attachment.absPath);
      artifacts[id] = {
        absPath: attachment.absPath,
        contentType: attachment.contentType ?? 'application/octet-stream',
        name: attachment.name ?? null,
      };
    }
  }
}

function loadLabels(labelsPath) {
  if (!labelsPath || !fs.existsSync(labelsPath)) return { patterns: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(labelsPath, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : { patterns: [] };
  } catch {
    return { patterns: [] };
  }
}

function resolvedResults(test, artifacts) {
  return (test.results ?? []).map((result) => ({
    retry: typeof result.retry === 'number' ? result.retry : 0,
    startMs: typeof result.startMs === 'number' ? result.startMs : null,
    durationMs: typeof result.durationMs === 'number' ? result.durationMs : 0,
    attachments: (result.attachments ?? [])
      .filter((attachment) => attachment && attachment.exists === true && attachment.absPath)
      .map((attachment) => ({
        name: attachment.name ?? null,
        contentType: attachment.contentType ?? 'application/octet-stream',
        artifact: path.basename(attachment.absPath),
        exists: true,
      })),
  }));
}

function resolveFlowTest(flow, spec, index, artifacts, mappedNodes, traceState, links, labels) {
  const resolved = index.get(`${spec.spec}\u0000${spec.title}`) ?? null;
  if (!resolved) {
    return {
      spec: spec.spec,
      title: spec.title,
      outcome: null,
      results: [],
      timeline: { videoArtifact: null, videoBaseMs: null, entries: [] },
    };
  }
  registerArtifacts(artifacts, resolved);
  return {
    spec: spec.spec,
    title: spec.title,
    outcome: resolved.outcome ?? null,
    results: resolvedResults(resolved, artifacts),
    timeline: buildTimeline(flow, resolved, mappedNodes, loadTrace(flow, resolved, artifacts, traceState), links, labels),
  };
}

function resolveConfig(configPath) {
  const abs = path.resolve(configPath);
  const dir = path.dirname(abs);
  const config = JSON.parse(fs.readFileSync(abs, 'utf8'));
  return {
    abs,
    dir,
    config,
    suite: path.resolve(dir, config.suite ?? '.'),
    flowsPath: path.resolve(dir, config.flows ?? 'flows.json'),
    labelsPath: path.resolve(dir, config.labels ?? 'labels.json'),
  };
}

function writeAssets(suite, out, warn) {
  const traceSource = path.join(suite, ...TRACE_VIEWER_SEGMENTS);
  const traceDest = path.join(out, '_pw', 'trace');
  if (fs.existsSync(traceSource)) {
    fs.mkdirSync(path.dirname(traceDest), { recursive: true });
    fs.cpSync(traceSource, traceDest, { recursive: true });
  } else {
    warn(`trace viewer assets not found at ${traceSource}`);
  }

  const vendorDest = path.join(out, 'vendor');
  fs.mkdirSync(vendorDest, { recursive: true });
  for (const file of ['vis-network.min.js', 'mermaid.min.js', '3d-force-graph.min.js']) {
    const source = path.join(VENDOR_DIR, file);
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(vendorDest, file));
  }
}

function testTaskFor(flow, nodes, directory) {
  if (!flow || (flow.coverage !== 'partial' && flow.coverage !== 'uncovered')) return null;
  const name = slug(flow.title || flow.id);
  const specFilePath = path.join(directory, `${name}.spec.ts`);
  return {
    suggestedSpecFile: specFilePath,
    acceptance: [
      `Playwright spec ${specFilePath} exists and passes`,
      `flow ${flow.id} coverage becomes "covered" after flowlens_ingest_results`,
      'video/trace evidence attached and visible in the flowlens viewer',
    ],
    nodes,
  };
}

function writeIsolatedPlaywrightConfig(suite, specDir, configDir) {
  fs.mkdirSync(specDir, { recursive: true });
  const candidates = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs', 'playwright.config.cjs'];
  const baseConfig = candidates.map((name) => path.join(suite, name)).find((file) => fs.existsSync(file)) || null;
  const target = path.join(configDir, 'playwright.isolated.config.ts');
  const webServer = baseConfig
    ? `base.webServer\n    ? (Array.isArray(base.webServer)\n        ? base.webServer.map((server) => ({ ...server, cwd: ${JSON.stringify(suite)} }))\n        : { ...base.webServer, cwd: ${JSON.stringify(suite)} })\n    : undefined`
    : 'undefined';
  const content = baseConfig
    ? `import base from ${JSON.stringify(baseConfig)};\n\nexport default {\n  ...base,\n  testDir: ${JSON.stringify(specDir)},\n  webServer: ${webServer},\n};\n`
    : `import { defineConfig, devices } from '@playwright/test';\n\nexport default defineConfig({\n  testDir: ${JSON.stringify(specDir)},\n  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],\n});\n`;
  fs.writeFileSync(target, content, 'utf8');
  return target;
}

export function build(options = {}) {
  const config = resolveConfig(resolveConfigPath(options));
  const flows = JSON.parse(fs.readFileSync(config.flowsPath, 'utf8'));
  const testsConfig = config.config && config.config.tests && typeof config.config.tests === 'object'
    ? config.config.tests
    : {};
  const testsMode = testsConfig.mode === 'isolated' ? 'isolated' : 'project';
  const testsDirName = typeof testsConfig.dir === 'string' && testsConfig.dir ? testsConfig.dir : 'tests';
  const specDir = testsMode === 'isolated'
    ? path.resolve(config.dir, testsDirName)
    : path.resolve(config.suite, testsDirName);
  const isolatedConfigPath = testsMode === 'isolated'
    ? writeIsolatedPlaywrightConfig(config.suite, specDir, config.dir)
    : null;
  const labels = loadLabels(
    options.labelsPath ? path.resolve(options.labelsPath) : config.labelsPath
  );
  const project = flows.project ?? config.config.projectName ?? path.basename(config.suite);
  const reportDir = options.reportDir
    ? path.resolve(options.reportDir)
    : path.join(config.suite, 'playwright-report');
  const hasReport = fs.existsSync(path.join(reportDir, 'index.html'));
  const resolved = options.runPath
    ? resolveFromReporterJson(path.resolve(options.runPath))
    : hasReport
      ? resolveFromReportModel(reportDir)
      : { source: 'none', tests: [] };
  const out = options.outDir
    ? path.resolve(options.outDir)
    : path.join(config.dir, 'out');

  const warnings = [];
  const warn = (message) => warnings.push(message);
  if (!options.runPath && !hasReport) {
    warn(`no Playwright report at ${reportDir}; building flow graph without test results`);
  }

  const artifacts = {};
  const mappedNodes = new Set();
  const traceState = new Map();
  const traceLinkLog = [];
  const traceLinkKeys = new Set();
  const traceLinks = {
    add(from, to) {
      if (!from || !to) return;
      const key = `${from}->${to}`;
      if (traceLinkKeys.has(key)) return;
      traceLinkKeys.add(key);
      traceLinkLog.push({ from, to });
    },
  };

  const index = new Map();
  for (const test of resolved.tests ?? []) {
    index.set(`${test.file}\u0000${test.title}`, test);
  }

  const flowList = Array.isArray(flows.flows) ? flows.flows : [];
  const nodes = [];
  const links = [];
  const nodeByKey = new Map();
  const nodeById = new Map();
  const linkByKey = new Map();
  const flowIdMaps = new Map();

  const coverageRank = (value) => (value === 'uncovered' ? 2 : value === 'partial' ? 1 : 0);
  const mergeCoverage = (left, right) => {
    if (!left) return right ?? null;
    if (!right) return left;
    return coverageRank(right) > coverageRank(left) ? right : left;
  };
  const nodeKey = (node) => {
    if (typeof node.sharedKey === 'string' && node.sharedKey) return `key:${node.sharedKey}`;
    if (
      (node.kind === 'backend' || node.kind === 'db') &&
      typeof node.endpoint === 'string' &&
      node.endpoint
    ) {
      return `endpoint:${node.kind}:${node.endpoint}`;
    }
    return `id:${node.id}`;
  };
  const canonicalNode = (node) => {
    const kind = node.kind ?? null;
    let label = node.label ?? node.id ?? null;
    let endpoint = node.endpoint ?? null;
    if (kind === 'backend' || kind === 'db') {
      const technical = endpoint ?? (typeof node.label === 'string' ? node.label : null);
      if (technical) {
        endpoint = technical;
        const resolved = resolveLabel(labels, technical);
        if (resolved.matched || !node.label || node.label === technical) label = resolved.label;
      }
    }
    return {
      kind,
      label,
      endpoint,
      file: node.file ?? null,
      line: Number.isInteger(node.line) ? node.line : null,
      component: node.component ?? null,
      selector: node.selector ?? null,
      payloadExample: node.payloadExample ?? null,
      table: node.table ?? null,
      dbFields: Array.isArray(node.dbFields) ? node.dbFields.slice() : null,
    };
  };

  for (const flow of flowList) {
    const flowId = flow.id ?? null;
    const flowTitle = flow.title ?? flowId;
    const idMap = new Map();
    const flowNodes = Array.isArray(flow.nodes) ? flow.nodes : [];
    for (const node of flowNodes) {
      const key = nodeKey(node);
      const canonical = canonicalNode(node);
      let target = node.id !== undefined && node.id !== null ? nodeById.get(node.id) : undefined;
      if (!target) target = nodeByKey.get(key);
      if (!target) {
        target = {
          id: node.id ?? null,
          label: canonical.label,
          endpoint: canonical.endpoint,
          kind: canonical.kind,
          shared: false,
          payload: node.payload ?? null,
          flow: flowId,
          flowName: flowTitle,
          flows: flowId ? [flowId] : [],
          flowNames: flowId ? [flowTitle] : [],
          module: node.module ?? null,
          coverage: flow.coverage ?? null,
          response: node.response ?? null,
          file: canonical.file,
          line: canonical.line,
          component: canonical.component,
          selector: canonical.selector,
          payloadExample: canonical.payloadExample,
          table: canonical.table,
          dbFields: canonical.dbFields,
        };
        nodes.push(target);
        nodeByKey.set(key, target);
      } else {
        target.shared = true;
        if (flowId && !target.flows.includes(flowId)) {
          target.flows.push(flowId);
          target.flowNames.push(flowTitle);
        }
        target.coverage = mergeCoverage(target.coverage, flow.coverage);
        if (!target.payload && node.payload) target.payload = node.payload;
        if (!target.response && node.response) target.response = node.response;
        if (!target.label && canonical.label) target.label = canonical.label;
        if (!target.endpoint && canonical.endpoint) target.endpoint = canonical.endpoint;
        if (!target.file && canonical.file) target.file = canonical.file;
        if (!target.line && canonical.line) target.line = canonical.line;
        if (!target.component && canonical.component) target.component = canonical.component;
        if (!target.selector && canonical.selector) target.selector = canonical.selector;
        if (target.payloadExample === null || target.payloadExample === undefined) {
          if (canonical.payloadExample !== null && canonical.payloadExample !== undefined) {
            target.payloadExample = canonical.payloadExample;
          }
        }
        if (!target.table && canonical.table) target.table = canonical.table;
        if (!target.dbFields && canonical.dbFields) target.dbFields = canonical.dbFields;
      }
      if (node.id !== undefined && node.id !== null) nodeById.set(node.id, target);
      nodeByKey.set(key, target);
      if (node.id !== undefined && node.id !== null) idMap.set(node.id, target.id);
    }
    flowIdMaps.set(flowId, idMap);

    for (const edge of Array.isArray(flow.edges) ? flow.edges : []) {
      let from = null;
      let to = null;
      if (Array.isArray(edge) && edge.length >= 2) {
        from = edge[0];
        to = edge[1];
      } else if (edge && typeof edge === 'object') {
        from = edge.from ?? edge.source ?? null;
        to = edge.to ?? edge.target ?? null;
      } else {
        continue;
      }
      from = idMap.get(from) ?? from;
      to = idMap.get(to) ?? to;
      const key = `${from}->${to}`;
      const existing = linkByKey.get(key);
      if (existing) {
        if (flowId && !existing.flows.includes(flowId)) existing.flows.push(flowId);
      } else {
        const link = { from, to, flows: flowId ? [flowId] : [] };
        links.push(link);
        linkByKey.set(key, link);
      }
    }
  }

  const flowsOut = flowList.map((flow) => {
    const idMap = flowIdMaps.get(flow.id) ?? new Map();
    const testFlow = {
      ...flow,
      nodes: (Array.isArray(flow.nodes) ? flow.nodes : []).map((node) => ({
        ...node,
        id: idMap.get(node.id) ?? node.id,
      })),
      edges: (Array.isArray(flow.edges) ? flow.edges : []).map((edge) => {
        if (Array.isArray(edge)) {
          return [idMap.get(edge[0]) ?? edge[0], idMap.get(edge[1]) ?? edge[1]];
        }
        if (edge && typeof edge === 'object') {
          const from = edge.from ?? edge.source ?? null;
          const to = edge.to ?? edge.target ?? null;
          return {
            ...edge,
            from: idMap.get(from) ?? from,
            to: idMap.get(to) ?? to,
          };
        }
        return edge;
      }),
    };
    return {
      id: flow.id ?? null,
      title: flow.title ?? null,
      coverage: flow.coverage ?? null,
      actors: Array.isArray(flow.actors) ? flow.actors.slice() : [],
      notes: flow.notes ?? null,
      start: flow.start ?? null,
      mermaid: typeof flow.mermaid === 'string' ? flow.mermaid : null,
      tests: (Array.isArray(flow.tests) ? flow.tests : []).map((spec) =>
        resolveFlowTest(testFlow, spec, index, artifacts, mappedNodes, traceState, traceLinks, labels)
      ),
    };
  });

  for (const link of traceLinkLog) {
    const key = `${link.from}->${link.to}`;
    if (linkByKey.has(key)) continue;
    const added = { from: link.from, to: link.to, flows: [] };
    links.push(added);
    linkByKey.set(key, added);
  }

  const testsTotal = flowsOut.reduce((sum, flow) => sum + flow.tests.length, 0);

  const nodesByFlow = new Map();
  for (const node of nodes) {
    const nodeFlows = Array.isArray(node.flows) && node.flows.length ? node.flows : node.flow ? [node.flow] : [];
    for (const flowId of nodeFlows) {
      if (!nodesByFlow.has(flowId)) nodesByFlow.set(flowId, []);
      nodesByFlow.get(flowId).push({
        id: node.id,
        label: node.label,
        kind: node.kind,
        file: node.file,
        line: node.line,
        component: node.component,
        selector: node.selector,
        table: node.table,
        dbFields: node.dbFields,
      });
    }
  }
  flowsOut.forEach((flow) => {
    flow.testTask = testTaskFor(flow, nodesByFlow.get(flow.id) ?? [], specDir);
  });

  const graph = {
    schemaVersion: 1,
    project,
    generatedAt: new Date().toISOString(),
    source: resolved.source ?? null,
    agent: {
      reporterPath: path.join(HERE, 'reporter.mjs'),
      suiteRoot: config.suite,
      outputDir: out,
      specDir,
      specMode: testsMode,
      playwrightConfig: isolatedConfigPath,
      nodePath: testsMode === 'isolated' ? path.join(config.suite, 'node_modules') : null,
      platform: process.platform,
    },
    flows: flowsOut,
    nodes,
    links,
    moduleEdges: Array.isArray(flows.moduleEdges) ? flows.moduleEdges : [],
    artifacts,
    stats: {
      flows: flowsOut.length,
      nodes: nodes.length,
      links: links.length,
      tests: testsTotal,
      artifacts: Object.keys(artifacts).length,
      mappedNodes: mappedNodes.size,
      sharedNodes: nodes.filter((node) => node.shared === true).length,
      sharedLinks: links.filter((link) => Array.isArray(link.flows) && link.flows.length > 1).length,
      kinds: nodes.reduce((counts, node) => {
        const key = node.kind ?? 'unknown';
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      }, {}),
    },
  };

  fs.mkdirSync(out, { recursive: true });
  writeAssets(config.suite, out, warn);
  const graphPath = path.join(out, 'graph.json');
  fs.writeFileSync(graphPath, `${JSON.stringify(graph, null, 2)}\n`, 'utf8');
  const html = renderHtml(graph, { vendorHref: './vendor/vis-network.min.js' });
  fs.writeFileSync(path.join(out, 'index.html'), html, 'utf8');

  return { out, graphPath, graph, warnings };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const argv = process.argv.slice(2);
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--config') options.configPath = argv[index + 1];
    else if (arg === '--run') options.runPath = argv[index + 1];
    else if (arg === '--report') options.reportDir = argv[index + 1];
    else if (arg === '--labels') options.labelsPath = argv[index + 1];
    else if (arg === '--out') options.outDir = argv[index + 1];
  }
  const result = build(options);
  for (const warning of result.warnings) process.stderr.write(`[flowlens] WARNING: ${warning}\n`);
  process.stdout.write(`[flowlens] build -> ${result.graphPath}\n`);
}
