import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';
import { startServer } from './server.mjs';
import { resolveFromReportModel } from './resolve.mjs';
import { envUp, envDown, envStatus } from './env.mjs';
import { resolveConfigPath } from './paths.mjs';
import {
  createRunStore,
  resolveAgentConfig,
  taskForFlow,
  buildImplementPrompt,
  startImplementRun,
} from './agent.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const REPORTER_PATH = path.join(HERE, 'reporter.mjs');

const PROTOCOL_VERSION = '2024-11-05';

const SERVER_INFO = { name: 'flowlens', version: '0.0.0' };

const COVERAGE_VALUES = new Set(['covered', 'partial', 'uncovered']);

const NODE_KINDS = new Set(['interaction', 'backend', 'db', 'decision']);

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.angular',
  '.cache',
  '.next',
  'bin',
  'obj',
  'dist',
  'build',
  'coverage',
  'playwright-report',
  'test-results',
  'vendor',
  'out',
  '_reports',
  '_archivo',
]);

const SCAN_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.cs', '.vue']);

const SPEC_SUFFIX = /\.(?:spec|test)\.(?:ts|tsx|js|jsx|mjs|cjs)$/i;

const MAX_SCAN_FILES = 600;

const MAX_LIST = 250;

const activeServers = new Map();

const implementRuns = createRunStore();

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readJsonSafe(file) {
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

function resolveContext(options = {}) {
  const configPath = resolveConfigPath(options);
  const dir = path.dirname(configPath);
  const config = readJson(configPath);
  const suite = path.resolve(dir, config.suite ?? '.');
  const flowsPath = path.resolve(dir, config.flows ?? 'flows.json');
  let project = config.projectName ?? path.basename(suite);
  const flows = readJsonSafe(flowsPath);
  if (flows && flows.project) project = flows.project;
  const outDir = options.outDir
    ? path.resolve(options.outDir)
    : path.join(dir, 'out');
  return {
    configPath,
    dir,
    config,
    suite,
    flowsPath,
    project,
    outDir,
    graphPath: path.join(outDir, 'graph.json'),
  };
}

function graphOrNull(ctx) {
  return readJsonSafe(ctx.graphPath);
}

function graphStats(graph) {
  return graph && graph.stats ? graph.stats : null;
}

function coverageSummary(graph) {
  const flows = (Array.isArray(graph.flows) ? graph.flows : []).map((flow) => ({
    id: flow.id ?? null,
    title: flow.title ?? null,
    coverage: flow.coverage ?? null,
    actors: Array.isArray(flow.actors) ? flow.actors : [],
    tests: (Array.isArray(flow.tests) ? flow.tests : []).map((test) => ({
      spec: test.spec ?? null,
      title: test.title ?? null,
      outcome: test.outcome ?? null,
    })),
  }));
  const ids = (value) => flows.filter((flow) => flow.coverage === value).map((flow) => flow.id);
  return {
    flows,
    covered: ids('covered'),
    partial: ids('partial'),
    uncovered: ids('uncovered'),
    counts: {
      total: flows.length,
      covered: ids('covered').length,
      partial: ids('partial').length,
      uncovered: ids('uncovered').length,
    },
  };
}

function tryReportTests(ctx) {
  try {
    const reportDir = path.join(ctx.suite, 'playwright-report');
    if (!fs.existsSync(path.join(reportDir, 'index.html'))) return null;
    const resolved = resolveFromReportModel(reportDir);
    return Array.isArray(resolved.tests) ? resolved.tests : null;
  } catch {
    return null;
  }
}

function slug(text) {
  return (
    String(text ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'flow'
  );
}

function toolStatus(options) {
  const ctx = resolveContext(options);
  const graph = graphOrNull(ctx);
  return {
    configPath: ctx.configPath,
    project: ctx.project,
    suite: ctx.suite,
    outDir: ctx.outDir,
    graphPath: ctx.graphPath,
    config: ctx.config,
    graph: graph
      ? {
          present: true,
          schemaVersion: graph.schemaVersion ?? null,
          generatedAt: graph.generatedAt ?? null,
          source: graph.source ?? null,
          stats: graphStats(graph),
        }
      : { present: false },
  };
}

function toolBuild(options) {
  const ctx = resolveContext(options);
  const result = build({ configPath: ctx.configPath, outDir: options.outDir });
  return {
    configPath: ctx.configPath,
    project: result.graph.project,
    outDir: result.out,
    graphPath: result.graphPath,
    stats: result.graph.stats,
    warnings: result.warnings,
  };
}

async function toolServe(options) {
  const ctx = resolveContext(options);
  const port = options.port ? Number(options.port) : 8020;
  const key = `${ctx.outDir}\u0000${port}`;
  if (activeServers.has(key)) {
    const active = activeServers.get(key);
    return {
      url: active.url,
      host: active.host,
      port: active.port,
      outDir: ctx.outDir,
      reused: true,
      pid: process.pid,
    };
  }
  const started = await startServer({ outDir: ctx.outDir, port, host: options.host });
  activeServers.set(key, started);
  return {
    url: started.url,
    host: started.host,
    port: started.port,
    outDir: ctx.outDir,
    reused: false,
    pid: process.pid,
  };
}

function parseSpec(rel, content) {
  const describes = [];
  for (const match of content.matchAll(/\btest\.describe\(\s*(['"`])([^'"`]*)\1/g)) {
    describes.push(match[2]);
  }
  for (const match of content.matchAll(/(^|[^.\w])describe\(\s*(['"`])([^'"`]*)\2/g)) {
    describes.push(match[3]);
  }
  const tests = [];
  for (const match of content.matchAll(/\btest\(\s*(['"`])([^'"`]*)\1/g)) {
    tests.push(match[2]);
  }
  const gotoUrls = [];
  for (const match of content.matchAll(/page\.goto\(\s*(['"`])([^'"`]*)\1/g)) {
    gotoUrls.push(match[2]);
  }
  const helpers = [];
  for (const match of content.matchAll(/import\s*\{([^}]*)\}\s*from\s*(['"])([^'"]+)\2/g)) {
    const source = match[3];
    if (!/helper/i.test(source)) continue;
    for (const raw of match[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/)[0].trim();
      if (name) helpers.push(name);
    }
  }
  return {
    path: rel,
    describes: [...new Set(describes)],
    tests: [...new Set(tests)],
    gotoUrls: [...new Set(gotoUrls)],
    helpers: [...new Set(helpers)],
    isPlaywright: /@playwright\/test/.test(content) || /page\.goto\(/.test(content) || /test\.describe\(/.test(content),
  };
}

function parseFrontend(rel, content) {
  const paths = [];
  for (const match of content.matchAll(/path:\s*(['"`])([^'"`]*)\1/g)) paths.push(match[2]);
  for (const match of content.matchAll(/path\s*=\s*(['"])([^'"]*)\1/g)) paths.push(match[2]);
  return {
    path: rel,
    hasRouterModule: /RouterModule\b/.test(content),
    hasRoutes: /\bRoutes\b/.test(content),
    paths: [...new Set(paths)].slice(0, 100),
  };
}

function parseBackend(rel, content) {
  const routes = [];
  for (const match of content.matchAll(
    /\[Http(Get|Post|Put|Delete|Patch|Head)\s*(?:\(\s*(['"])([^'"]*)\2\s*\))?\s*\]/g
  )) {
    routes.push({ method: match[1].toUpperCase(), path: match[3] ?? '', source: 'aspnet-attribute' });
  }
  for (const match of content.matchAll(
    /\b(?:router|app)\.(get|post|put|delete|patch|all|use)\s*\(\s*(['"`])([^'"`]*)\2/g
  )) {
    routes.push({ method: match[1].toUpperCase(), path: match[3], source: 'express' });
  }
  for (const match of content.matchAll(/@(Get|Post|Put|Delete|Patch)\s*\(\s*(['"`])([^'"`]*)\2/g)) {
    routes.push({ method: match[1].toUpperCase(), path: match[3], source: 'decorator' });
  }
  const isController =
    /\[ApiController\]|:\s*ControllerBase\b|\bclass\s+\w*Controller\b/.test(content) ||
    /Controller/.test(path.basename(rel));
  return { path: rel, isController, routes: routes.slice(0, 100) };
}

function scanRepo(repoPath) {
  const root = path.resolve(repoPath);
  if (!fs.existsSync(root)) throw new Error(`repoPath not found: ${root}`);
  const result = {
    repoPath: root,
    scannedFiles: 0,
    truncated: false,
    skippedSpecs: 0,
    playwrightSpecs: [],
    frontendRoutes: [],
    backendRoutes: [],
  };
  const stack = [root];
  while (stack.length) {
    if (result.scannedFiles >= MAX_SCAN_FILES) {
      result.truncated = true;
      break;
    }
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!SCAN_EXTS.has(path.extname(entry.name).toLowerCase())) continue;
      if (result.scannedFiles >= MAX_SCAN_FILES) {
        result.truncated = true;
        break;
      }
      let content;
      try {
        content = fs.readFileSync(full, 'utf8');
      } catch {
        continue;
      }
      result.scannedFiles += 1;
      if (SPEC_SUFFIX.test(rel)) {
        const spec = parseSpec(rel, content);
        if (!spec.isPlaywright) {
          result.skippedSpecs += 1;
          continue;
        }
        if (result.playwrightSpecs.length < MAX_LIST) result.playwrightSpecs.push(spec);
        continue;
      }
      const frontend = parseFrontend(rel, content);
      if ((frontend.hasRouterModule || frontend.hasRoutes || frontend.paths.length) && result.frontendRoutes.length < MAX_LIST) {
        result.frontendRoutes.push(frontend);
      }
      const backend = parseBackend(rel, content);
      if ((backend.isController || backend.routes.length) && result.backendRoutes.length < MAX_LIST) {
        result.backendRoutes.push(backend);
      }
    }
  }
  return result;
}

export function validateFlows(doc) {
  const errors = [];
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    errors.push('flows document must be an object');
    return errors;
  }
  if (doc.schemaVersion !== 1) {
    errors.push(`schemaVersion must be 1 (got ${JSON.stringify(doc.schemaVersion)})`);
  }
  if (typeof doc.project !== 'string' || !doc.project) errors.push('project must be a non-empty string');
  if (!doc.suite || typeof doc.suite !== 'object' || Array.isArray(doc.suite)) {
    errors.push('suite{root,projectName} is required');
  } else {
    if (typeof doc.suite.root !== 'string') errors.push('suite.root must be a string');
    if (typeof doc.suite.projectName !== 'string') errors.push('suite.projectName must be a string');
  }
  if (doc.moduleEdges !== undefined && !Array.isArray(doc.moduleEdges)) {
    errors.push('moduleEdges must be an array');
  }
  if (!Array.isArray(doc.flows)) {
    errors.push('flows must be an array');
    return errors;
  }
  const seen = new Set();
  const globalNodes = new Map();
  doc.flows.forEach((flow, index) => {
    const where = `flows[${index}]`;
    if (!flow || typeof flow !== 'object') {
      errors.push(`${where} must be an object`);
      return;
    }
    if (typeof flow.id !== 'string' || !flow.id) errors.push(`${where}.id must be a non-empty string`);
    else if (seen.has(flow.id)) errors.push(`${where}.id duplicate: ${flow.id}`);
    else seen.add(flow.id);
    if (typeof flow.title !== 'string' || !flow.title) errors.push(`${where}.title must be a non-empty string`);
    if (!COVERAGE_VALUES.has(flow.coverage)) {
      errors.push(`${where}.coverage must be covered|partial|uncovered`);
    }
    if (flow.mermaid !== undefined && typeof flow.mermaid !== 'string') {
      errors.push(`${where}.mermaid must be a string`);
    }
    if (!Array.isArray(flow.nodes)) errors.push(`${where}.nodes must be an array`);
    else {
      const nodeIds = new Set();
      flow.nodes.forEach((node, nodeIndex) => {
        const nodeWhere = `${where}.nodes[${nodeIndex}]`;
        if (!node || typeof node !== 'object') {
          errors.push(`${nodeWhere} must be an object`);
          return;
        }
        if (typeof node.id !== 'string' || !node.id) errors.push(`${nodeWhere}.id must be a non-empty string`);
        else {
          nodeIds.add(node.id);
          const signature = `${node.kind ?? ''}|${node.endpoint ?? ''}`;
          const previous = globalNodes.get(node.id);
          if (previous && previous.signature !== signature) {
            errors.push(
              `${nodeWhere}.id "${node.id}" conflicts with flow ${previous.flow} (kind/endpoint differ)`
            );
          } else if (!previous) {
            globalNodes.set(node.id, { signature, flow: flow.id });
          }
        }
        if (typeof node.label !== 'string' || !node.label) errors.push(`${nodeWhere}.label must be a non-empty string`);
        if (!NODE_KINDS.has(node.kind)) {
          errors.push(`${nodeWhere}.kind must be interaction|backend|db|decision`);
        }
        if (node.endpoint !== undefined && (typeof node.endpoint !== 'string' || !node.endpoint)) {
          errors.push(`${nodeWhere}.endpoint must be a non-empty string`);
        }
        if (node.sharedKey !== undefined && (typeof node.sharedKey !== 'string' || !node.sharedKey)) {
          errors.push(`${nodeWhere}.sharedKey must be a non-empty string`);
        }
        if (node.file !== undefined && (typeof node.file !== 'string' || !node.file)) {
          errors.push(`${nodeWhere}.file must be a non-empty string`);
        }
        if (node.line !== undefined && (!Number.isInteger(node.line) || node.line < 1)) {
          errors.push(`${nodeWhere}.line must be a positive integer`);
        }
        if (node.component !== undefined && (typeof node.component !== 'string' || !node.component)) {
          errors.push(`${nodeWhere}.component must be a non-empty string`);
        }
        if (node.selector !== undefined && (typeof node.selector !== 'string' || !node.selector)) {
          errors.push(`${nodeWhere}.selector must be a non-empty string`);
        }
        if (node.table !== undefined && (typeof node.table !== 'string' || !node.table)) {
          errors.push(`${nodeWhere}.table must be a non-empty string`);
        }
        if (node.dbFields !== undefined) {
          if (!Array.isArray(node.dbFields) || node.dbFields.some((field) => typeof field !== 'string' || !field)) {
            errors.push(`${nodeWhere}.dbFields must be an array of non-empty strings`);
          }
        }
        if (
          node.payloadExample !== undefined &&
          typeof node.payloadExample !== 'string' &&
          (typeof node.payloadExample !== 'object' || node.payloadExample === null)
        ) {
          errors.push(`${nodeWhere}.payloadExample must be a string or an object`);
        }
      });
      if (flow.edges !== undefined) {
        if (!Array.isArray(flow.edges)) errors.push(`${where}.edges must be an array`);
        else {
          flow.edges.forEach((edge, edgeIndex) => {
            const pair = Array.isArray(edge)
              ? edge
              : edge && typeof edge === 'object'
                ? [edge.from ?? edge.source, edge.to ?? edge.target]
                : null;
            if (!pair || pair.length < 2) {
              errors.push(`${where}.edges[${edgeIndex}] must be [from,to] or {from,to}`);
              return;
            }
            for (const endpoint of pair) {
              if (endpoint && !nodeIds.has(endpoint)) {
                errors.push(`${where}.edges[${edgeIndex}] references unknown node: ${endpoint}`);
              }
            }
          });
        }
      }
    }
    if (flow.tests !== undefined) {
      if (!Array.isArray(flow.tests)) errors.push(`${where}.tests must be an array`);
      else {
        flow.tests.forEach((test, testIndex) => {
          if (
            !test ||
            typeof test !== 'object' ||
            typeof test.spec !== 'string' ||
            !test.spec ||
            typeof test.title !== 'string' ||
            !test.title
          ) {
            errors.push(`${where}.tests[${testIndex}] must be {spec,title}`);
          }
        });
      }
    }
  });
  return errors;
}

function toolWriteFlows(options, args) {
  if (!args || typeof args !== 'object') throw new Error('arguments must be an object with { flows }');
  const targetOptions =
    typeof args.configPath === 'string' && args.configPath
      ? { ...options, configPath: args.configPath }
      : options;
  const ctx = resolveContext(targetOptions);
  const doc = args.flows;
  const errors = validateFlows(doc);
  if (errors.length) {
    return { ok: false, path: ctx.flowsPath, errors, warnings: [] };
  }
  const warnings = [];
  const declaredTests = doc.flows.some((flow) => Array.isArray(flow.tests) && flow.tests.length);
  const reportTests = declaredTests ? tryReportTests(ctx) : [];
  if (declaredTests && reportTests === null) {
    warnings.push('report model unavailable: authored tests[] could not be matched against Playwright results');
  } else {
    for (const flow of doc.flows) {
      for (const test of Array.isArray(flow.tests) ? flow.tests : []) {
        const found = (reportTests ?? []).some(
          (candidate) =>
            typeof candidate.file === 'string' &&
            candidate.file.endsWith(test.spec) &&
            candidate.title === test.title
        );
        if (!found) {
          warnings.push(`flow ${flow.id}: test "${test.title}" (${test.spec}) not present in the report model`);
        }
      }
    }
  }
  fs.mkdirSync(path.dirname(ctx.flowsPath), { recursive: true });
  fs.writeFileSync(ctx.flowsPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return { ok: true, path: ctx.flowsPath, errors: [], warnings };
}

function toolCoverage(options) {
  const ctx = resolveContext(options);
  const graph = graphOrNull(ctx);
  if (!graph) {
    return {
      present: false,
      configPath: ctx.configPath,
      project: ctx.project,
      outDir: ctx.outDir,
      graphPath: ctx.graphPath,
      flows: [],
      covered: [],
      partial: [],
      uncovered: [],
      counts: { total: 0, covered: 0, partial: 0, uncovered: 0 },
    };
  }
  return {
    present: true,
    configPath: ctx.configPath,
    project: graph.project ?? ctx.project,
    outDir: ctx.outDir,
    graphPath: ctx.graphPath,
    generatedAt: graph.generatedAt ?? null,
    source: graph.source ?? null,
    ...coverageSummary(graph),
  };
}

function toolUncoveredTasks(options) {
  const ctx = resolveContext(options);
  const graph = graphOrNull(ctx);
  if (!graph) throw new Error(`graph not found at ${ctx.graphPath}; run flowlens_build first`);
  const nodesByFlow = new Map();
  for (const node of Array.isArray(graph.nodes) ? graph.nodes : []) {
    if (!node || !node.flow) continue;
    if (!nodesByFlow.has(node.flow)) nodesByFlow.set(node.flow, []);
    nodesByFlow.get(node.flow).push({ id: node.id, label: node.label, kind: node.kind });
  }
  const runPath = path.join(ctx.outDir, 'run.json');
  const testResultsDir = path.join(ctx.outDir, 'test-results');
  const tasks = (Array.isArray(graph.flows) ? graph.flows : [])
    .filter((flow) => flow.coverage === 'uncovered' || flow.coverage === 'partial')
    .map((flow) => {
      const name = slug(flow.title || flow.id);
      const specRel = path.join('tests', `${name}.spec.ts`);
      return {
        flowId: flow.id,
        title: flow.title,
        coverage: flow.coverage,
        nodes: nodesByFlow.get(flow.id) ?? [],
        actors: Array.isArray(flow.actors) ? flow.actors : [],
        suiteRoot: ctx.suite,
        suggestedSpecFile: specRel,
        specFilePath: path.join(ctx.suite, specRel),
        reporterHint:
          `cd ${ctx.suite} && FLOWLENS_RUN_OUTPUT=${runPath} ` +
          `npx playwright test ${specRel} --reporter=${REPORTER_PATH} --output=${testResultsDir}`,
        outputPath: runPath,
        acceptance: [
          `Playwright spec ${specRel} exists and passes`,
          `flow ${flow.id} coverage becomes "covered" after flowlens_ingest_results`,
          'video/trace evidence attached and visible in the flowlens viewer',
        ],
      };
    });
  return {
    configPath: ctx.configPath,
    project: graph.project ?? ctx.project,
    outDir: ctx.outDir,
    graphPath: ctx.graphPath,
    reporterPath: REPORTER_PATH,
    tasks,
    counts: {
      total: tasks.length,
      uncovered: tasks.filter((task) => task.coverage === 'uncovered').length,
      partial: tasks.filter((task) => task.coverage === 'partial').length,
    },
  };
}

function toolImplementTest(options, args) {
  const input = args && typeof args === 'object' ? args : {};
  const ctx = resolveContext(options);
  const graph = graphOrNull(ctx);
  if (!graph) throw new Error(`graph not found at ${ctx.graphPath}; run flowlens_build first`);
  const flowId = typeof input.flowId === 'string' ? input.flowId : '';
  if (!flowId) throw new Error('arguments.flowId is required');
  const task = taskForFlow(graph, flowId);
  if (!task) throw new Error(`flow not found in graph: ${flowId}`);
  const agent = resolveAgentConfig(ctx.config, ctx.dir);
  if (input.dryRun === true) {
    return {
      dryRun: true,
      flowId,
      project: ctx.project,
      suite: ctx.suite,
      prompt: buildImplementPrompt(task, graph.agent ?? {}),
      agent: { command: agent.command, argsTemplate: agent.argsTemplate, source: agent.source },
      task,
    };
  }
  const run = startImplementRun({
    store: implementRuns,
    project: { suite: ctx.suite, agent, project: ctx.project },
    graph,
    flowId,
    rebuild: (implementedRun) => {
      const runPath =
        implementedRun && implementedRun.task ? implementedRun.task.outputPath : null;
      return build({
        configPath: ctx.configPath,
        outDir: options.outDir,
        ...(runPath && fs.existsSync(runPath) ? { runPath } : {}),
      });
    },
  });
  return {
    id: run.id,
    flowId,
    status: run.status,
    suite: ctx.suite,
    agent: { command: agent.command, argsTemplate: agent.argsTemplate, source: agent.source },
  };
}

function toolIngestResults(options, args) {
  const input = args && typeof args === 'object' ? args : {};
  const targetOptions =
    typeof input.configPath === 'string' && input.configPath
      ? { ...options, configPath: input.configPath }
      : options;
  const ctx = resolveContext(targetOptions);
  const buildOptions = { configPath: ctx.configPath };
  if (typeof input.runPath === 'string' && input.runPath) {
    buildOptions.runPath = input.runPath;
  } else if (typeof input.reportDir === 'string' && input.reportDir) {
    buildOptions.reportDir = input.reportDir;
  } else {
    const defaultRun = path.join(ctx.outDir, 'run.json');
    if (fs.existsSync(defaultRun)) buildOptions.runPath = defaultRun;
  }
  const result = build(buildOptions);
  return {
    configPath: ctx.configPath,
    project: result.graph.project,
    outDir: result.out,
    graphPath: result.graphPath,
    source: result.graph.source ?? null,
    stats: result.graph.stats,
    warnings: result.warnings,
    ...coverageSummary(result.graph),
  };
}

function toolScan(options, args) {
  const input = args && typeof args === 'object' ? args : {};
  if (typeof input.repoPath !== 'string' || !input.repoPath) {
    throw new Error('arguments.repoPath is required');
  }
  return scanRepo(input.repoPath);
}

function scaffoldCoveredFlow(id, spec, describeTitle) {
  const titles = spec.tests.length ? spec.tests : [describeTitle];
  const nodes = titles.map((title, index) => {
    const node = { id: `${id}.step${index + 1}`, label: title, kind: 'interaction' };
    const endpoint = spec.gotoUrls[index] ?? spec.gotoUrls[0] ?? null;
    if (endpoint) node.endpoint = endpoint;
    if (spec.helpers.length) node.helpers = spec.helpers.slice();
    return node;
  });
  const edges = [];
  for (let index = 1; index < nodes.length; index += 1) {
    edges.push([nodes[index - 1].id, nodes[index].id]);
  }
  return {
    id,
    title: describeTitle,
    coverage: 'covered',
    nodes,
    edges,
    tests: spec.tests.map((title) => ({ spec: spec.path, title })),
  };
}

function scaffoldRouteFlow(id, route) {
  const routePaths = route.paths.length ? route.paths : [path.basename(route.path)];
  const nodes = routePaths.map((routePath, index) => ({
    id: `${id}.route${index + 1}`,
    label: routePath === '' ? '/' : routePath,
    kind: 'interaction',
  }));
  const edges = [];
  for (let index = 1; index < nodes.length; index += 1) {
    edges.push([nodes[index - 1].id, nodes[index].id]);
  }
  return {
    id,
    title: path.basename(route.path).replace(/\.[^.]+$/, ''),
    coverage: 'uncovered',
    nodes,
    edges,
    tests: [],
  };
}

function toolScaffoldFlows(options, args) {
  const input = args && typeof args === 'object' ? args : {};
  if (typeof input.repoPath !== 'string' || !input.repoPath) {
    throw new Error('arguments.repoPath is required');
  }
  const scan = scanRepo(input.repoPath);
  const project =
    typeof input.project === 'string' && input.project ? input.project : path.basename(scan.repoPath);
  const suiteRoot =
    typeof input.suite === 'string' && input.suite ? input.suite : scan.repoPath;
  const flows = [];
  let counter = 0;
  const nextId = () => {
    counter += 1;
    return `F${counter}`;
  };
  let covered = 0;
  for (const spec of scan.playwrightSpecs) {
    const describeTitles = spec.describes.length ? spec.describes : [path.basename(spec.path)];
    for (const title of describeTitles) {
      flows.push(scaffoldCoveredFlow(nextId(), spec, title));
      covered += 1;
    }
  }
  for (const route of scan.frontendRoutes) {
    flows.push(scaffoldRouteFlow(nextId(), route));
  }
  const draft = {
    schemaVersion: 1,
    project,
    suite: { root: suiteRoot, projectName: 'chromium' },
    flows,
    moduleEdges: [],
  };
  const errors = validateFlows(draft);
  const nodes = flows.reduce((sum, flow) => sum + flow.nodes.length, 0);
  const edges = flows.reduce((sum, flow) => sum + flow.edges.length, 0);
  const tests = flows.reduce((sum, flow) => sum + flow.tests.length, 0);
  const uncovered = flows.length - covered;
  const notes = [
    'draft only: review titles, nodes and tests, then call flowlens_write_flows',
    `${scan.scannedFiles} file(s) scanned; ${scan.playwrightSpecs.length} playwright spec(s), ${scan.frontendRoutes.length} frontend route file(s), ${scan.backendRoutes.length} backend route file(s)`,
    `${covered} covered flow(s) from describe blocks, ${uncovered} uncovered candidate(s) from routes`,
    errors.length
      ? `schema validation failed: ${errors.join('; ')}`
      : 'draft matches flows schemaVersion 1',
  ];
  if (scan.truncated) {
    notes.push(`scan truncated at ${MAX_SCAN_FILES} files; results may be incomplete`);
  }
  return {
    draft,
    counts: { flows: flows.length, covered, uncovered, nodes, edges, tests },
    notes,
  };
}

const TOOLS = [
  {
    name: 'flowlens_status',
    description:
      'Report the flowlens config path, suite, out dir and graph counts from out/<project>/graph.json.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: (options) => Promise.resolve(toolStatus(options)),
  },
  {
    name: 'flowlens_build',
    description: 'Run the flowlens build and return the graph summary (flows/nodes/links/tests).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: (options) => Promise.resolve(toolBuild(options)),
  },
  {
    name: 'flowlens_serve',
    description: 'Start the flowlens viewer server in-process on a port (default 8020) and return its URL.',
    inputSchema: {
      type: 'object',
      properties: { port: { type: 'number' }, host: { type: 'string' } },
      additionalProperties: false,
    },
    handler: (options, args) => toolServe({ ...options, port: args.port, host: args.host }),
  },
  {
    name: 'flowlens_scan',
    description:
      'READ-ONLY static scan of a repo: playwright specs, frontend route files and backend route/controller files.',
    inputSchema: {
      type: 'object',
      properties: { repoPath: { type: 'string' } },
      required: ['repoPath'],
      additionalProperties: false,
    },
    handler: (options, args) => Promise.resolve(toolScan(options, args)),
  },
  {
    name: 'flowlens_scaffold_flows',
    description:
      'READ-ONLY: scan a repo and return a DRAFT flows.json (one covered flow per Playwright describe plus uncovered route candidates) for review before flowlens_write_flows.',
    inputSchema: {
      type: 'object',
      properties: {
        repoPath: { type: 'string' },
        suite: { type: 'string' },
        project: { type: 'string' },
      },
      required: ['repoPath'],
      additionalProperties: false,
    },
    handler: (options, args) => Promise.resolve(toolScaffoldFlows(options, args)),
  },
  {
    name: 'flowlens_write_flows',
    description: 'Validate a flows.json document against schemaVersion 1 and write it to the configured flows path.',
    inputSchema: {
      type: 'object',
      properties: { flows: { type: 'object' }, configPath: { type: 'string' } },
      required: ['flows'],
      additionalProperties: false,
    },
    handler: (options, args) => Promise.resolve(toolWriteFlows(options, args)),
  },
  {
    name: 'flowlens_coverage',
    description: 'Read out/<project>/graph.json and return per-flow coverage, uncovered/partial ids and test titles.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: (options) => Promise.resolve(toolCoverage(options)),
  },
  {
    name: 'flowlens_uncovered_tasks',
    description:
      'Return implementation tasks for every uncovered/partial flow, with nodes, actors, suggested spec file and reporter hint.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: (options) => Promise.resolve(toolUncoveredTasks(options)),
  },
  {
    name: 'flowlens_implement_test',
    description:
      'Build the Playwright implementation prompt for a flow and (unless dryRun) launch the configured local agent; returns { id } to watch the run.',
    inputSchema: {
      type: 'object',
      properties: { flowId: { type: 'string' }, dryRun: { type: 'boolean' } },
      required: ['flowId'],
      additionalProperties: false,
    },
    handler: (options, args) => Promise.resolve(toolImplementTest(options, args)),
  },
  {
    name: 'flowlens_ingest_results',
    description:
      'Rebuild the graph from a reporter run JSON ({runPath}) or a Playwright report dir ({reportDir}) and return coverage.',
    inputSchema: {
      type: 'object',
      properties: { runPath: { type: 'string' }, reportDir: { type: 'string' }, configPath: { type: 'string' } },
      additionalProperties: false,
    },
    handler: (options, args) => Promise.resolve(toolIngestResults(options, args)),
  },
  {
    name: 'flowlens_env_up',
    description:
      'Bring up the declarative local E2E environment (docker compose + healthchecks + seeds). Use { dryRun: true } to preview commands without executing.',
    inputSchema: {
      type: 'object',
      properties: {
        dryRun: { type: 'boolean' },
        configPath: { type: 'string' },
        envPath: { type: 'string' },
        port: { type: 'number' },
      },
      additionalProperties: false,
    },
    handler: (options, args) => {
      const input = args && typeof args === 'object' ? args : {};
      return envUp({
        configPath: typeof input.configPath === 'string' ? input.configPath : options.configPath,
        envPath: typeof input.envPath === 'string' ? input.envPath : undefined,
        port: typeof input.port === 'number' ? input.port : undefined,
        dryRun: input.dryRun === true,
      });
    },
  },
  {
    name: 'flowlens_env_down',
    description: 'Tear down the declarative local E2E environment (docker compose down) and report container state.',
    inputSchema: {
      type: 'object',
      properties: { configPath: { type: 'string' }, envPath: { type: 'string' } },
      additionalProperties: false,
    },
    handler: (options, args) => {
      const input = args && typeof args === 'object' ? args : {};
      return envDown({
        configPath: typeof input.configPath === 'string' ? input.configPath : options.configPath,
        envPath: typeof input.envPath === 'string' ? input.envPath : undefined,
      });
    },
  },
  {
    name: 'flowlens_env_status',
    description:
      'Report the local E2E environment: container states from docker compose ps plus healthcheck results.',
    inputSchema: {
      type: 'object',
      properties: { configPath: { type: 'string' }, envPath: { type: 'string' } },
      additionalProperties: false,
    },
    handler: (options, args) => {
      const input = args && typeof args === 'object' ? args : {};
      return envStatus({
        configPath: typeof input.configPath === 'string' ? input.configPath : options.configPath,
        envPath: typeof input.envPath === 'string' ? input.envPath : undefined,
      });
    },
  },
];

function writeMessage(stdout, message) {
  stdout.write(`${JSON.stringify(message)}\n`);
}

function respond(stdout, id, result) {
  writeMessage(stdout, { jsonrpc: '2.0', id, result });
}

function respondError(stdout, id, code, message) {
  writeMessage(stdout, { jsonrpc: '2.0', id, error: { code, message } });
}

async function handleMessage(options, message, stdout) {
  if (!message || typeof message !== 'object') return;
  const isNotification = message.id === undefined || message.id === null;
  const { id, method, params } = message;
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') return;
  if (method === 'initialize') {
    if (!isNotification) {
      respond(stdout, id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    }
    return;
  }
  if (method === 'ping') {
    if (!isNotification) respond(stdout, id, {});
    return;
  }
  if (method === 'tools/list') {
    if (!isNotification) {
      respond(stdout, id, {
        tools: TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      });
    }
    return;
  }
  if (method === 'tools/call') {
    if (isNotification) return;
    const name = params && params.name;
    const args = (params && params.arguments) || {};
    const tool = TOOLS.find((candidate) => candidate.name === name);
    if (!tool) {
      respondError(stdout, id, -32602, `unknown tool: ${name}`);
      return;
    }
    try {
      const data = await tool.handler(options, args);
      respond(stdout, id, { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
    } catch (error) {
      const text = error && error.message ? error.message : String(error);
      respond(stdout, id, { content: [{ type: 'text', text: `error: ${text}` }], isError: true });
    }
    return;
  }
  if (!isNotification) respondError(stdout, id, -32601, `method not found: ${method}`);
}

export function startMcp(options = {}) {
  const input = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let queue = Promise.resolve();
  rl.on('line', (line) => {
    const text = line.trim();
    if (!text) return;
    let message;
    try {
      message = JSON.parse(text);
    } catch {
      respondError(stdout, null, -32700, 'parse error');
      return;
    }
    queue = queue
      .then(() => handleMessage(options, message, stdout))
      .catch((error) => {
        process.stderr.write(`[flowlens-mcp] ${error && error.message ? error.message : error}\n`);
      });
  });
  return new Promise((resolve) => {
    rl.on('close', resolve);
  });
}
