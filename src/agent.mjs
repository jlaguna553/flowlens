import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolveConfigPath } from './paths.mjs';

export const DEFAULT_AGENT = {
  command: 'opencode',
  argsTemplate: ['run', '{{prompt}}'],
};

const PROMPT_TOKEN = /\{\{\s*prompt\s*\}\}/g;
const SAFE_SHELL_ARG = /^[A-Za-z0-9_@%+=:,./-]+$/;

function readJsonSafe(file) {
  try {
    if (!file || !fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function slug(text) {
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

export function resolveAgentConfig(config, configDir) {
  let doc = null;
  let source = 'default';
  if (
    config &&
    typeof config === 'object' &&
    config.agent &&
    typeof config.agent === 'object' &&
    !Array.isArray(config.agent)
  ) {
    doc = config.agent;
    source = 'config.agent';
  } else if (configDir) {
    const local = readJsonSafe(path.join(configDir, 'agent.json'));
    if (local && typeof local === 'object' && !Array.isArray(local)) {
      doc = local;
      source = 'agent.json';
    }
  }
  const resolved = doc && typeof doc === 'object' ? doc : {};
  const command =
    typeof resolved.command === 'string' && resolved.command ? resolved.command : DEFAULT_AGENT.command;
  const argsTemplate =
    typeof resolved.argsTemplate === 'string' && resolved.argsTemplate
      ? resolved.argsTemplate
      : Array.isArray(resolved.argsTemplate) && resolved.argsTemplate.length
        ? resolved.argsTemplate.map((entry) => String(entry))
        : DEFAULT_AGENT.argsTemplate.slice();
  const env =
    resolved.env && typeof resolved.env === 'object' && !Array.isArray(resolved.env)
      ? { ...resolved.env }
      : {};
  return { command, argsTemplate, env, source };
}

export function resolveAgentProject(options = {}) {
  const configPath = resolveConfigPath(options);
  const configDir = path.dirname(configPath);
  const config = readJsonSafe(configPath) ?? {};
  const agent = resolveAgentConfig(config, configDir);
  const suite = path.resolve(configDir, config.suite ?? '.');
  let project = config.projectName ?? path.basename(suite);
  const flows = readJsonSafe(path.resolve(configDir, config.flows ?? 'flows.json'));
  if (flows && flows.project) project = flows.project;
  return { configPath, configDir, config, suite, project, agent };
}

export function taskForFlow(graph, flowId) {
  const flows = Array.isArray(graph && graph.flows) ? graph.flows : [];
  const flow = flows.find((entry) => entry && entry.id === flowId);
  if (!flow) return null;
  const agentInfo = graph && graph.agent && typeof graph.agent === 'object' ? graph.agent : {};
  const suiteRoot = agentInfo.suiteRoot ?? '.';
  const outputDir = agentInfo.outputDir ?? '.';
  const testTask = flow.testTask && typeof flow.testTask === 'object' ? flow.testTask : {};
  const specName = testTask.suggestedSpecFile ?? `${slug(flow.title || flow.id)}.spec.ts`;
  const specRel = path.join('tests', path.basename(specName));
  const nodes =
    Array.isArray(testTask.nodes) && testTask.nodes.length
      ? testTask.nodes
      : (Array.isArray(graph.nodes) ? graph.nodes : [])
          .filter((node) => node && node.flow === flowId)
          .map((node) => ({ id: node.id, label: node.label, kind: node.kind }));
  const reporterPath = agentInfo.reporterPath ?? null;
  const runPath = path.join(outputDir, 'run.json');
  const testResults = path.join(outputDir, 'test-results');
  const reporterHint =
    `cd ${suiteRoot} && FLOWLENS_RUN_OUTPUT=${runPath} ` +
    `npx playwright test ${specRel} --reporter=${reporterPath} --output=${testResults}`;
  const acceptance =
    Array.isArray(testTask.acceptance) && testTask.acceptance.length
      ? testTask.acceptance
      : [
          `Playwright spec ${specRel} exists and passes`,
          `flow ${flow.id} coverage becomes "covered" after flowlens_ingest_results`,
          'video/trace evidence attached and visible in the flowlens viewer',
        ];
  return {
    flowId: flow.id,
    title: flow.title ?? null,
    coverage: flow.coverage ?? null,
    nodes,
    actors: Array.isArray(flow.actors) ? flow.actors : [],
    suiteRoot,
    suggestedSpecFile: specRel,
    specFilePath: path.join(suiteRoot, specRel),
    reporterHint,
    outputPath: runPath,
    reporterPath,
    outputDir,
    acceptance,
  };
}

export function buildImplementPrompt(task, agentInfo = {}) {
  const info = task && typeof task === 'object' ? task : {};
  const suiteRoot = info.suiteRoot ?? agentInfo.suiteRoot ?? '.';
  const specRel = info.suggestedSpecFile ?? path.join('tests', 'flow.spec.ts');
  const specPath = info.specFilePath ?? path.join(suiteRoot, specRel);
  const nodes = Array.isArray(info.nodes) ? info.nodes : [];
  const acceptance = Array.isArray(info.acceptance) ? info.acceptance : [];
  const reporterHint = info.reporterHint ?? `cd ${suiteRoot} && npx playwright test ${specRel}`;
  const lines = [];
  lines.push(
    `Implement the Playwright E2E spec for flowlens flow ${info.flowId ?? ''}` +
      `${info.title ? ` ("${info.title}")` : ''}.`
  );
  lines.push('');
  lines.push(`Coverage: ${info.coverage ?? 'uncovered'}`);
  if (Array.isArray(info.actors) && info.actors.length) lines.push(`Actors: ${info.actors.join(', ')}`);
  lines.push('');
  lines.push(`Target spec file: ${specPath}`);
  lines.push(`Suite (run from here): ${suiteRoot}`);
  lines.push('');
  lines.push('Flow nodes to cover:');
  if (nodes.length) {
    for (const node of nodes) {
      lines.push(`- ${node.id ?? '?'} [${node.kind ?? 'interaction'}] ${node.label ?? ''}`.trimEnd());
    }
  } else {
    lines.push('- (no nodes listed; cover the whole flow)');
  }
  lines.push('');
  lines.push('Steps:');
  lines.push(`1. Create or update the spec at ${specPath} (relative ${specRel}).`);
  lines.push('2. Drive the UI/API through every node above and assert the expected outcome.');
  lines.push('3. Run it with the flowlens reporter:');
  lines.push(`   ${reporterHint}`);
  lines.push('4. If it fails, fix the spec and re-run until it passes.');
  lines.push('5. Do not edit unrelated files.');
  lines.push('');
  lines.push('Acceptance criteria:');
  for (const item of acceptance) lines.push(`- ${item}`);
  lines.push('');
  lines.push('Report back with: spec path, exact command run, pass/fail, and a one-line summary.');
  return lines.join('\n');
}

function shellQuote(value) {
  const text = String(value ?? '');
  if (text === '') return "''";
  if (SAFE_SHELL_ARG.test(text)) return text;
  return `'${text.replace(/'/g, "'\\''")}'`;
}

function interpolateToken(entry, prompt) {
  return String(entry).replace(PROMPT_TOKEN, () => prompt);
}

export function buildAgentInvocation(agent = {}, prompt = '') {
  const command =
    typeof agent.command === 'string' && agent.command ? agent.command : DEFAULT_AGENT.command;
  const template = agent.argsTemplate;
  if (typeof template === 'string' && template) {
    const argsPart = template.replace(PROMPT_TOKEN, () => shellQuote(prompt));
    const shellCommand = `${shellQuote(command)} ${argsPart}`;
    return { command: 'sh', args: ['-c', shellCommand], shell: false, shellCommand };
  }
  const list = Array.isArray(template) && template.length ? template : DEFAULT_AGENT.argsTemplate;
  const args = list.map((entry) => interpolateToken(entry, prompt));
  return { command, args, shell: false };
}

function streamLines(stream, emit) {
  if (!stream) return;
  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buffer += chunk;
    let index = buffer.indexOf('\n');
    while (index >= 0) {
      const line = buffer.slice(0, index).replace(/\r$/, '');
      buffer = buffer.slice(index + 1);
      if (line.length) emit(line);
      index = buffer.indexOf('\n');
    }
  });
  stream.on('end', () => {
    const line = buffer.replace(/\r$/, '');
    if (line.length) emit(line);
    buffer = '';
  });
}

export function runAgent(options = {}) {
  const started = Date.now();
  const log = [];
  const emit = (line) => {
    log.push(line);
    if (typeof options.onLog === 'function') {
      try {
        options.onLog(line);
      } catch {
        void 0;
      }
    }
  };
  const invocation = buildAgentInvocation(
    { command: options.command, argsTemplate: options.args },
    options.prompt ?? ''
  );
  const env =
    options.env && typeof options.env === 'object' ? { ...process.env, ...options.env } : process.env;
  return new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    };
    let child;
    try {
      child = spawn(invocation.command, invocation.args, {
        cwd: options.cwd,
        env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      emit(`[flowlens] failed to spawn agent: ${message}`);
      finish({ code: 1, log, durationMs: Date.now() - started, error: message });
      return;
    }
    if (invocation.shellCommand) emit(`[flowlens] agent command: ${invocation.shellCommand}`);
    const timeoutMs = Number(options.timeoutMs);
    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timer = setTimeout(() => {
        emit(`[flowlens] agent timed out after ${timeoutMs}ms; terminating`);
        try {
          child.kill('SIGTERM');
        } catch {
          void 0;
        }
      }, timeoutMs);
    }
    streamLines(child.stdout, emit);
    streamLines(child.stderr, emit);
    child.on('error', (error) => {
      const message = error && error.message ? error.message : String(error);
      emit(`[flowlens] agent error: ${message}`);
      finish({ code: 1, log, durationMs: Date.now() - started, error: message });
    });
    child.on('close', (code) => {
      const exitCode = code === null || code === undefined ? 1 : code;
      emit(`[flowlens] agent exited with code ${exitCode}`);
      finish({ code: exitCode, log, durationMs: Date.now() - started });
    });
  });
}

export function createRunStore() {
  const runs = new Map();
  return {
    create(init = {}) {
      const id = randomUUID();
      const run = {
        id,
        flowId: init.flowId ?? null,
        prompt: init.prompt ?? null,
        task: init.task ?? null,
        status: 'running',
        log: [],
        startedAt: new Date().toISOString(),
        finishedAt: null,
        ok: null,
        exitCode: null,
        rebuilt: false,
        error: null,
        durationMs: null,
      };
      runs.set(id, run);
      return run;
    },
    get(id) {
      return runs.get(id) ?? null;
    },
    list() {
      return [...runs.values()];
    },
  };
}

export function startImplementRun(options = {}) {
  const { store, project, graph, flowId } = options;
  if (!store) throw new Error('startImplementRun requires a run store');
  if (!project || !project.agent) throw new Error('startImplementRun requires a resolved project');
  const task = taskForFlow(graph, flowId);
  if (!task) throw new Error(`flow not found in graph: ${flowId}`);
  const prompt = buildImplementPrompt(task, graph && graph.agent ? graph.agent : {});
  const run = store.create({ flowId, task, prompt });
  const emit = (line) => {
    run.log.push(line);
    if (typeof options.onLine === 'function') {
      try {
        options.onLine(line);
      } catch {
        void 0;
      }
    }
  };
  emit(`[flowlens] implementing flow ${flowId} with ${project.agent.command}`);
  runAgent({
    command: project.agent.command,
    args: project.agent.argsTemplate,
    prompt,
    cwd: project.suite,
    env: project.agent.env,
    timeoutMs: options.timeoutMs,
    onLog: emit,
  }).then((result) => {
    run.exitCode = result.code;
    run.durationMs = result.durationMs;
    run.ok = result.code === 0;
    if (typeof options.rebuild === 'function') {
      try {
        const rebuilt = options.rebuild();
        run.rebuilt = true;
        if (rebuilt && rebuilt.graphPath) run.graphPath = rebuilt.graphPath;
        if (rebuilt && rebuilt.graph && rebuilt.graph.stats) run.stats = rebuilt.graph.stats;
      } catch (error) {
        run.rebuilt = false;
        run.error = error && error.message ? error.message : String(error);
        emit(`[flowlens] rebuild failed: ${run.error}`);
      }
    }
    run.status = 'done';
    run.finishedAt = new Date().toISOString();
  });
  return run;
}
