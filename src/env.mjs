import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { resolveConfigPath } from './paths.mjs';

const DEFAULT_HEALTHCHECK_TIMEOUT_MS = 30000;
const DEFAULT_HEALTHCHECK_INTERVAL_MS = 1000;
const STATUS_HEALTHCHECK_TIMEOUT_MS = 3000;
const MAX_CAPTURE = 4000;

function readJsonFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readJsonSafe(file) {
  try {
    return readJsonFile(file);
  } catch {
    return null;
  }
}

function resolveProject(config, configDir, envDoc) {
  if (typeof envDoc.project === 'string' && envDoc.project) return envDoc.project;
  const suite = path.resolve(configDir, config.suite ?? '.');
  let project = config.projectName ?? path.basename(suite);
  const flows = readJsonSafe(path.resolve(configDir, config.flows ?? 'flows.json'));
  if (flows && flows.project) project = flows.project;
  return project;
}

function sanitizeName(value) {
  return (
    String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'flowlens-env'
  );
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePorts(value) {
  const out = {};
  for (const [key, raw] of Object.entries(asObject(value))) {
    const num = Number(raw);
    if (Number.isFinite(num) && num > 0) out[key] = num;
  }
  return out;
}

function applyPortOverride(ports, port, notes) {
  if (port === undefined || port === null || !Number.isFinite(Number(port))) return ports;
  const num = Number(port);
  if (Object.prototype.hasOwnProperty.call(ports, 'main')) ports.main = num;
  else {
    const first = Object.keys(ports)[0];
    if (first) ports[first] = num;
    else ports.main = num;
  }
  notes.push(`port override: ${num} applied to ${Object.prototype.hasOwnProperty.call(ports, 'main') ? 'ports.main' : Object.keys(ports)[0]}`);
  return ports;
}

function interpolate(text, vars) {
  if (typeof text !== 'string') return text;
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
    const value = key
      .split('.')
      .reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), vars);
    return value === undefined || value === null ? match : String(value);
  });
}

function renderArg(arg) {
  const value = String(arg);
  if (value === '') return "''";
  if (/^[A-Za-z0-9_./:=@,+-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function renderCmd(command) {
  return [command.cmd, ...command.args].map(renderArg).join(' ');
}

function composeBase(composeFiles) {
  const args = ['compose'];
  for (const file of composeFiles) args.push('-f', file);
  return args;
}

function buildComposeCommand(composeFiles, rest) {
  return { cmd: 'docker', args: [...composeBase(composeFiles), ...rest] };
}

function runProcess(cmd, args, options = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { cwd: options.cwd, env: options.env, shell: false });
    } catch (error) {
      resolve({ code: 1, stdout: '', stderr: String(error && error.message ? error.message : error), error });
      return;
    }
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      finish({ code: 1, stdout, stderr: stderr || String(error && error.message ? error.message : error), error });
    });
    child.on('close', (code) => {
      finish({ code: code === null || code === undefined ? 1 : code, stdout, stderr });
    });
  });
}

function runShell(command, options = {}) {
  return runProcess('sh', ['-c', command], options);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureEnvDir(envDir) {
  fs.mkdirSync(envDir, { recursive: true });
  fs.mkdirSync(path.join(envDir, 'logs'), { recursive: true });
}

function writeLog(envDir, action, lines) {
  ensureEnvDir(envDir);
  const file = path.join(envDir, 'logs', `${action}.log`);
  const stamp = new Date().toISOString();
  fs.writeFileSync(file, [`[flowlens env ${action}] ${stamp}`, ...lines.filter(Boolean), ''].join('\n'), 'utf8');
  return file;
}

function writeState(envDir, state) {
  ensureEnvDir(envDir);
  fs.writeFileSync(path.join(envDir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function writeNotes(envDir, notes) {
  ensureEnvDir(envDir);
  fs.writeFileSync(path.join(envDir, 'notes.json'), `${JSON.stringify(notes, null, 2)}\n`, 'utf8');
}

function appendGitExclude(repoDir, patterns, notes) {
  const gitDir = path.join(repoDir, '.git');
  if (!fs.existsSync(gitDir)) {
    notes.push(`gitExclude: ${repoDir} is not a git repo, skipped`);
    return;
  }
  const infoDir = path.join(gitDir, 'info');
  fs.mkdirSync(infoDir, { recursive: true });
  const excludePath = path.join(infoDir, 'exclude');
  const existing = fs.existsSync(excludePath) ? fs.readFileSync(excludePath, 'utf8') : '';
  const lines = new Set(existing.split('\n'));
  const added = [];
  for (const pattern of patterns) {
    if (typeof pattern === 'string' && pattern && !lines.has(pattern)) {
      lines.add(pattern);
      added.push(pattern);
    }
  }
  if (added.length) fs.writeFileSync(excludePath, `${[...lines].join('\n')}\n`, 'utf8');
  notes.push(`gitExclude: added ${added.length} pattern(s) to ${excludePath}`);
}

function resolveEnvContext(options = {}) {
  const configPath = resolveConfigPath(options);
  const configDir = path.dirname(configPath);
  const config = readJsonFile(configPath);
  let envPath = null;
  let envDoc = null;
  if (typeof options.envPath === 'string' && options.envPath) {
    envPath = path.resolve(options.envPath);
    envDoc = readJsonFile(envPath);
  } else {
    const localEnvPath = path.join(configDir, 'env.json');
    if (fs.existsSync(localEnvPath)) {
      envPath = localEnvPath;
      envDoc = readJsonFile(localEnvPath);
    } else if (config.env && typeof config.env === 'object' && !Array.isArray(config.env)) {
      envDoc = config.env;
    }
  }
  if (!envDoc || typeof envDoc !== 'object' || Array.isArray(envDoc)) {
    throw new Error(
      `no env configuration found (looked for ${path.join(configDir, 'env.json')}, config.env and --env)`
    );
  }
  const project =
    typeof options.project === 'string' && options.project
      ? options.project
      : resolveProject(config, configDir, envDoc);
  const baseDir = envPath ? path.dirname(envPath) : configDir;
  const compose = asArray(envDoc.compose).map((entry) => path.resolve(baseDir, entry));
  const workdir = envDoc.workdir
    ? path.resolve(baseDir, envDoc.workdir)
    : compose[0]
      ? path.dirname(compose[0])
      : baseDir;
  const envDir = path.join(configDir, 'env');
  const notes = [];
  const ports = normalizePorts(envDoc.ports);
  applyPortOverride(ports, options.port, notes);
  const envVars = {};
  for (const [key, value] of Object.entries(asObject(envDoc.env))) {
    envVars[key] = interpolate(value, { port: ports });
  }
  for (const [key, value] of Object.entries(ports)) {
    envVars[`FLOWLENS_PORT_${key.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`] = String(value);
  }
  const composeProject =
    typeof envDoc.composeProject === 'string' && envDoc.composeProject
      ? sanitizeName(envDoc.composeProject)
      : typeof options.composeProject === 'string' && options.composeProject
        ? sanitizeName(options.composeProject)
        : null;
  return {
    configPath,
    configDir,
    config,
    envPath,
    envDoc,
    project,
    envDir,
    workdir,
    compose,
    ports,
    envVars,
    composeProject,
    notes,
  };
}

function buildComposeFiles(ctx) {
  const composeFiles = [...ctx.compose];
  const notes = [];
  const hasOverride = typeof ctx.envDoc.override === 'string' && ctx.envDoc.override.trim();
  const overridePath = path.join(ctx.envDir, 'compose.override.yml');
  if (hasOverride) {
    composeFiles.push(overridePath);
    notes.push(`compose override is generated at ${overridePath}`);
  }
  return { composeFiles, overridePath, hasOverride, notes };
}

function healthTimeout(entry, maxTimeoutMs) {
  const configured = Number(entry.timeoutMs);
  const value = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_HEALTHCHECK_TIMEOUT_MS;
  return maxTimeoutMs ? Math.min(value, maxTimeoutMs) : value;
}

function healthInterval(entry) {
  const configured = Number(entry.intervalMs);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_HEALTHCHECK_INTERVAL_MS;
}

function normalizeHealthcheck(entry) {
  if (typeof entry === 'string') return { url: entry };
  return asObject(entry);
}

function normalizeSeed(step) {
  if (typeof step === 'string') return { command: step };
  return asObject(step);
}

function describeHealthPlan(entry, vars) {
  const health = normalizeHealthcheck(entry);
  if (health.url) {
    return { kind: 'url', target: interpolate(health.url, vars), timeoutMs: healthTimeout(health) };
  }
  if (health.command) {
    return { kind: 'command', target: interpolate(health.command, vars), timeoutMs: healthTimeout(health) };
  }
  return { kind: 'invalid', target: null, timeoutMs: null };
}

function describeSeedPlan(step, vars) {
  const seed = normalizeSeed(step);
  if (seed.command) return { kind: 'command', target: interpolate(seed.command, vars) };
  if (seed.request) {
    const request = asObject(seed.request);
    return { kind: 'request', target: `${request.method ?? 'GET'} ${interpolate(request.url, vars)}` };
  }
  return { kind: 'invalid', target: null };
}

async function runHealthcheck(entry, vars, ctx, maxTimeoutMs) {
  const health = normalizeHealthcheck(entry);
  const timeoutMs = healthTimeout(health, maxTimeoutMs);
  const intervalMs = healthInterval(health);
  const started = Date.now();
  const result = {
    kind: null,
    target: null,
    ok: false,
    attempts: 0,
    timeoutMs,
    elapsedMs: 0,
    statusCode: null,
    error: null,
  };
  if (health.url) {
    const url = interpolate(health.url, vars);
    result.kind = 'url';
    result.target = url;
    while (Date.now() - started < timeoutMs) {
      result.attempts += 1;
      try {
        const response = await fetch(url, {
          method: health.method ?? 'GET',
          signal: AbortSignal.timeout(Math.min(Math.max(intervalMs * 2, 1000), 10000)),
        });
        result.statusCode = response.status;
        if (response.ok) {
          result.ok = true;
          result.error = null;
          break;
        }
        result.error = `HTTP ${response.status}`;
      } catch (error) {
        result.error = String(error && error.message ? error.message : error).slice(0, 400);
      }
      if (Date.now() - started >= timeoutMs) break;
      await sleep(intervalMs);
    }
  } else if (health.command) {
    const command = interpolate(health.command, vars);
    result.kind = 'command';
    result.target = command;
    while (Date.now() - started < timeoutMs) {
      result.attempts += 1;
      const proc = await runShell(command, { cwd: ctx.workdir, env: ctx.spawnEnv });
      if (proc.code === 0) {
        result.ok = true;
        result.error = null;
        break;
      }
      result.error = String(proc.stderr || proc.stdout || `exit ${proc.code}`).trim().slice(0, 400);
      if (Date.now() - started >= timeoutMs) break;
      await sleep(intervalMs);
    }
  } else {
    result.error = 'healthcheck requires url or command';
  }
  result.elapsedMs = Date.now() - started;
  return result;
}

async function runSeedStep(step, vars, ctx) {
  const seed = normalizeSeed(step);
  const out = {
    kind: null,
    target: null,
    ok: false,
    exitCode: null,
    statusCode: null,
    stdout: '',
    stderr: '',
    error: null,
  };
  if (seed.command) {
    const command = interpolate(seed.command, vars);
    out.kind = 'command';
    out.target = command;
    const proc = await runShell(command, { cwd: ctx.workdir, env: ctx.spawnEnv });
    out.exitCode = proc.code;
    out.stdout = proc.stdout.slice(-MAX_CAPTURE);
    out.stderr = proc.stderr.slice(-MAX_CAPTURE);
    out.ok = proc.code === 0;
    if (!out.ok) out.error = String(proc.stderr || `exit ${proc.code}`).trim().slice(0, 400);
  } else if (seed.request) {
    const request = asObject(seed.request);
    const url = interpolate(request.url, vars);
    out.kind = 'request';
    out.target = `${request.method ?? 'GET'} ${url}`;
    const headers = { ...asObject(request.headers) };
    let body;
    if (request.body !== undefined) {
      if (typeof request.body === 'string') body = request.body;
      else {
        body = JSON.stringify(request.body);
        if (!Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
          headers['content-type'] = 'application/json';
        }
      }
    }
    try {
      const response = await fetch(url, { method: request.method ?? 'GET', headers, body });
      out.statusCode = response.status;
      out.ok = response.ok;
      if (!out.ok) out.error = `HTTP ${response.status}`;
    } catch (error) {
      out.error = String(error && error.message ? error.message : error).slice(0, 400);
    }
  } else {
    out.error = 'seed requires command or request';
  }
  return out;
}

function parseComposePs(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    const ignored = null;
  }
  const rows = [];
  for (const line of trimmed.split('\n')) {
    const value = line.trim();
    if (!value) continue;
    try {
      rows.push(JSON.parse(value));
    } catch {
      const ignored = null;
    }
  }
  return rows;
}

function describeServices(configured, rows) {
  const byService = new Map();
  for (const row of rows) {
    const name = row.Service ?? row.Name;
    if (name && !byService.has(name)) byService.set(name, row);
  }
  const names = configured.length ? configured : [...byService.keys()];
  return names.map((name) => {
    const row = byService.get(name);
    if (!row) {
      return { name, state: 'missing', health: 'missing', status: null, ports: null, configured: configured.includes(name) };
    }
    return {
      name,
      state: row.State ?? null,
      health: row.Health ?? (row.State === 'running' ? 'running' : row.State ?? null),
      status: row.Status ?? null,
      ports: row.Publishers ?? row.Ports ?? null,
      configured: configured.includes(name),
    };
  });
}

function readPsCommand(composeFiles) {
  return buildComposeCommand(composeFiles, ['ps', '-a', '--format', 'json']);
}

function baseContext(options) {
  const ctx = resolveEnvContext(options);
  const notes = [...ctx.notes, ...asArray(ctx.envDoc.notes).map((entry) => String(entry))];
  ctx.spawnEnv = {
    ...process.env,
    ...(ctx.composeProject ? { COMPOSE_PROJECT_NAME: ctx.composeProject } : {}),
    ...ctx.envVars,
  };
  if (!ctx.composeProject) {
    notes.push('COMPOSE_PROJECT_NAME not set: using the compose file default project name');
  }
  ctx.notes = notes;
  ctx.vars = { port: ctx.ports, env: ctx.envVars };
  ctx.dryRun = options.dryRun === true;
  ctx.services = asArray(ctx.envDoc.services).map((entry) => String(entry));
  ctx.healthchecks = asArray(ctx.envDoc.healthcheck);
  ctx.seeds = asArray(ctx.envDoc.seed);
  return ctx;
}

export async function envUp(options = {}) {
  const ctx = baseContext(options);
  const notes = ctx.notes;
  const { composeFiles, overridePath, hasOverride, notes: overrideNotes } = buildComposeFiles(ctx);
  notes.push(...overrideNotes);
  const up = buildComposeCommand(composeFiles, ['up', '-d', ...ctx.services]);
  const ps = readPsCommand(composeFiles);
  const planned = {
    envDir: ctx.envDir,
    project: ctx.project,
    workdir: ctx.workdir,
    composeFiles,
    overridePath: hasOverride ? overridePath : null,
    up: renderCmd(up),
    ps: renderCmd(ps),
    healthcheck: ctx.healthchecks.map((entry) => describeHealthPlan(entry, ctx.vars)),
    seed: ctx.seeds.map((step) => describeSeedPlan(step, ctx.vars)),
  };
  if (ctx.dryRun) {
    return {
      ok: true,
      action: 'up',
      dryRun: true,
      project: ctx.project,
      configPath: ctx.configPath,
      envPath: ctx.envPath,
      envDir: ctx.envDir,
      composeProject: ctx.composeProject,
      planned,
      notes,
    };
  }
  ensureEnvDir(ctx.envDir);
  if (hasOverride) fs.writeFileSync(overridePath, ctx.envDoc.override, 'utf8');
  const log = [];
  const upProc = await runProcess(up.cmd, up.args, { cwd: ctx.workdir, env: ctx.spawnEnv });
  log.push(`$ ${renderCmd(up)}`, `exit=${upProc.code}`, upProc.stdout.trim(), upProc.stderr.trim());
  const psProc = await runProcess(ps.cmd, ps.args, { cwd: ctx.workdir, env: ctx.spawnEnv });
  log.push(`$ ${renderCmd(ps)}`, psProc.stdout.trim());
  const services = describeServices(ctx.services, parseComposePs(psProc.stdout));
  const healthchecks = [];
  for (const entry of ctx.healthchecks) {
    const result = await runHealthcheck(entry, ctx.vars, ctx);
    healthchecks.push(result);
    log.push(`healthcheck ${result.kind} ${result.target} ok=${result.ok} attempts=${result.attempts} ms=${result.elapsedMs}`);
  }
  const seeds = [];
  for (const step of ctx.seeds) {
    const result = await runSeedStep(step, ctx.vars, ctx);
    seeds.push(result);
    log.push(`seed ${result.kind} ${result.target} ok=${result.ok}`);
  }
  if (asArray(ctx.envDoc.gitExclude).length) {
    appendGitExclude(ctx.workdir, asArray(ctx.envDoc.gitExclude), notes);
  }
  const ok =
    upProc.code === 0 &&
    services.every((service) => service.state === 'running' || !service.configured) &&
    healthchecks.every((check) => check.ok) &&
    seeds.every((seed) => seed.ok);
  if (upProc.code !== 0) notes.push(`docker compose up exited ${upProc.code}`);
  const logPath = writeLog(ctx.envDir, 'up', log);
  const result = {
    ok,
    action: 'up',
    dryRun: false,
    project: ctx.project,
    configPath: ctx.configPath,
    envPath: ctx.envPath,
    envDir: ctx.envDir,
    workdir: ctx.workdir,
    composeProject: ctx.composeProject,
    composeFiles,
    services,
    healthchecks,
    seeds,
    logPath,
    notes,
  };
  writeState(ctx.envDir, result);
  writeNotes(ctx.envDir, notes);
  return result;
}

export async function envDown(options = {}) {
  const ctx = baseContext(options);
  const notes = ctx.notes;
  const { composeFiles, overridePath, hasOverride, notes: overrideNotes } = buildComposeFiles(ctx);
  notes.push(...overrideNotes);
  const down = buildComposeCommand(composeFiles, ['down']);
  const ps = readPsCommand(composeFiles);
  const planned = {
    envDir: ctx.envDir,
    project: ctx.project,
    workdir: ctx.workdir,
    composeFiles,
    overridePath: hasOverride ? overridePath : null,
    down: renderCmd(down),
    ps: renderCmd(ps),
  };
  if (ctx.dryRun) {
    return {
      ok: true,
      action: 'down',
      dryRun: true,
      project: ctx.project,
      configPath: ctx.configPath,
      envPath: ctx.envPath,
      envDir: ctx.envDir,
      composeProject: ctx.composeProject,
      planned,
      notes,
    };
  }
  ensureEnvDir(ctx.envDir);
  const log = [];
  const downProc = await runProcess(down.cmd, down.args, { cwd: ctx.workdir, env: ctx.spawnEnv });
  log.push(`$ ${renderCmd(down)}`, `exit=${downProc.code}`, downProc.stdout.trim(), downProc.stderr.trim());
  const psProc = await runProcess(ps.cmd, ps.args, { cwd: ctx.workdir, env: ctx.spawnEnv });
  log.push(`$ ${renderCmd(ps)}`, psProc.stdout.trim());
  const services = describeServices(ctx.services, parseComposePs(psProc.stdout));
  if (downProc.code !== 0) notes.push(`docker compose down exited ${downProc.code}`);
  const logPath = writeLog(ctx.envDir, 'down', log);
  const result = {
    ok: downProc.code === 0,
    action: 'down',
    dryRun: false,
    project: ctx.project,
    configPath: ctx.configPath,
    envPath: ctx.envPath,
    envDir: ctx.envDir,
    workdir: ctx.workdir,
    composeProject: ctx.composeProject,
    composeFiles,
    services,
    logPath,
    notes,
  };
  writeState(ctx.envDir, result);
  writeNotes(ctx.envDir, notes);
  return result;
}

export async function envStatus(options = {}) {
  const ctx = baseContext(options);
  const notes = ctx.notes;
  const { composeFiles, overridePath, hasOverride, notes: overrideNotes } = buildComposeFiles(ctx);
  notes.push(...overrideNotes);
  const ps = readPsCommand(composeFiles);
  const planned = {
    envDir: ctx.envDir,
    project: ctx.project,
    workdir: ctx.workdir,
    composeFiles,
    overridePath: hasOverride ? overridePath : null,
    ps: renderCmd(ps),
    healthcheck: ctx.healthchecks.map((entry) => describeHealthPlan(entry, ctx.vars)),
  };
  if (ctx.dryRun) {
    return {
      ok: true,
      action: 'status',
      dryRun: true,
      project: ctx.project,
      configPath: ctx.configPath,
      envPath: ctx.envPath,
      envDir: ctx.envDir,
      composeProject: ctx.composeProject,
      planned,
      notes,
    };
  }
  ensureEnvDir(ctx.envDir);
  const log = [];
  const psProc = await runProcess(ps.cmd, ps.args, { cwd: ctx.workdir, env: ctx.spawnEnv });
  log.push(`$ ${renderCmd(ps)}`, `exit=${psProc.code}`, psProc.stdout.trim(), psProc.stderr.trim());
  if (psProc.code !== 0) notes.push(`docker compose ps exited ${psProc.code}`);
  const services = describeServices(ctx.services, parseComposePs(psProc.stdout));
  const healthchecks = [];
  for (const entry of ctx.healthchecks) {
    const result = await runHealthcheck(entry, ctx.vars, ctx, STATUS_HEALTHCHECK_TIMEOUT_MS);
    healthchecks.push(result);
    log.push(`healthcheck ${result.kind} ${result.target} ok=${result.ok} attempts=${result.attempts} ms=${result.elapsedMs}`);
  }
  notes.push(`status healthchecks capped at ${STATUS_HEALTHCHECK_TIMEOUT_MS}ms; see logs for full up-time checks`);
  const running = services.filter((service) => service.configured);
  const ok = psProc.code === 0 && running.length > 0 && running.every((service) => service.state === 'running');
  const logPath = writeLog(ctx.envDir, 'status', log);
  const result = {
    ok,
    action: 'status',
    dryRun: false,
    project: ctx.project,
    configPath: ctx.configPath,
    envPath: ctx.envPath,
    envDir: ctx.envDir,
    workdir: ctx.workdir,
    composeProject: ctx.composeProject,
    composeFiles,
    services,
    healthchecks,
    logPath,
    notes,
  };
  writeState(ctx.envDir, result);
  writeNotes(ctx.envDir, notes);
  return result;
}
