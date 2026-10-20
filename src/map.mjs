import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from './build.mjs';
import { validateFlows } from './mcp.mjs';
import {
  DEFAULT_AGENT,
  resolveAgentProject,
  runAgent,
  shellQuote,
  slug,
} from './agent.mjs';

export const CLAUDE_AGENT = {
  command: 'claude',
  argsTemplate: ['-p', '{{prompt}}'],
};

const AGENT_ALIASES = {
  opencode: DEFAULT_AGENT,
  claude: CLAUDE_AGENT,
};

export function agentForAlias(name) {
  if (typeof name !== 'string' || !name) return null;
  const entry = AGENT_ALIASES[name];
  if (!entry) return null;
  return { command: entry.command, argsTemplate: entry.argsTemplate.slice() };
}

// The agent that installed/launched flowlens exports a marker in its environment.
// Detecting it lets init map flows with the same agent instead of guessing.
export function detectInstallerAgent(env = process.env) {
  // Prefer opencode: an opencode session can inherit Claude markers from the host
  // (e.g. CLAUDE_CODE_SSE_PORT), and the inner session is the one running flowlens.
  if (env.OPENCODE || env.OPENCODE_BIN || env.OPENCODE_RUN) return 'opencode';
  if (env.CLAUDECODE || env.CLAUDE_CODE_ENTRYPOINT || env.CLAUDE_CODE_SSE_PORT) return 'claude';
  return null;
}

export function commandExists(name) {
  if (typeof name !== 'string' || !name) return false;
  const result =
    process.platform === 'win32'
      ? spawnSync('where', [name], { stdio: 'ignore' })
      : spawnSync('sh', ['-c', `command -v ${shellQuote(name)}`], { stdio: 'ignore' });
  return result.status === 0;
}

export function resolveAgentForEnvironment(env = process.env) {
  const installer = detectInstallerAgent(env);
  if (installer) {
    const agent = agentForAlias(installer);
    if (agent) return { ...agent, source: `${installer}-session` };
  }
  if (commandExists(DEFAULT_AGENT.command)) {
    return { ...DEFAULT_AGENT, argsTemplate: DEFAULT_AGENT.argsTemplate.slice(), source: 'detected' };
  }
  if (commandExists(CLAUDE_AGENT.command)) {
    return { ...CLAUDE_AGENT, argsTemplate: CLAUDE_AGENT.argsTemplate.slice(), source: 'detected' };
  }
  return { ...DEFAULT_AGENT, argsTemplate: DEFAULT_AGENT.argsTemplate.slice(), source: 'default' };
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function currentCli() {
  return {
    node: process.execPath,
    cliPath: process.argv[1] ? path.resolve(process.argv[1]) : null,
  };
}

export function buildMapPrompt(info = {}) {
  const suite = info.suite ?? '.';
  const configPath = info.configPath ?? '';
  const flowsPath = info.flowsPath ?? '';
  const draftPath = info.draftPath ?? '';
  const node = info.node ?? 'node';
  const cliPath = info.cliPath ?? 'flowlens';
  const project = info.project ?? 'this project';
  const relativeRoot = info.relativeRoot ?? '.';
  const current = info.currentFlows;
  const existing = Array.isArray(current && current.flows) ? current.flows : [];
  const lines = [];
  lines.push(`Map the user flows of ${project} for flowlens.`);
  lines.push('');
  lines.push(`Repository (read-only, do not modify): ${suite}`);
  lines.push(`flowlens config: ${configPath}`);
  lines.push(`flows file: ${flowsPath}`);
  lines.push(`Write the reviewed document to: ${draftPath}`);
  lines.push('');
  lines.push('Steps:');
  lines.push('1. Inspect the repository: Playwright specs, frontend routes, backend routes/controllers.');
  lines.push('2. Build a complete flows.json document (schemaVersion 1):');
  lines.push('   - one flow per user journey; derive "covered" flows from existing Playwright describe blocks');
  lines.push('   - tests[] entries are join keys {spec,title} that must match the Playwright report');
  lines.push('   - add routes/controllers without E2E coverage as "uncovered" or "partial" flows');
  lines.push('   - nodes are {id,label,kind}, kind is interaction|backend|db|decision');
  lines.push('   - edges are [from,to] pairs referencing existing node ids in the same flow');
  lines.push('   - id must be unique and title must be a non-empty string');
  lines.push(`   - suite.root must be "${relativeRoot}" (relative to the flowlens config directory)`);
  lines.push(`   - project must be "${project}"`);
  lines.push('3. Write the full JSON document to the draft path above.');
  lines.push(
    '   flowlens validates that draft and persists it to the flows file as soon as you exit.'
  );
  lines.push('4. Recommended before exiting: validate the draft yourself');
  lines.push(
    `   ${node} ${shellQuote(cliPath)} write-flows --file ${shellQuote(draftPath)} --config ${shellQuote(configPath)}`
  );
  lines.push('   If the command returns ok=false, fix the draft and repeat until ok=true.');
  lines.push(
    '5. flowlens rebuilds the graph automatically after you exit; you do not need to run build.'
  );
  lines.push('6. Reply with: number of flows, how many covered/partial/uncovered, and the flows path.');
  lines.push('');
  if (existing.length) {
    lines.push(
      `The current flows file already has ${existing.length} flow(s). Read it first and keep existing ids and test join keys unless they are clearly wrong.`
    );
    lines.push('');
  }
  lines.push('Constraints:');
  lines.push('- Do not create or modify files inside the target repository.');
  lines.push('- Only write the draft path above; write-flows persists it inside the flowlens data dir.');
  lines.push('- Do not invent tests that are not present in the repository.');
  lines.push('- Do not run Playwright or the local E2E environment; this task is mapping only.');
  return lines.join('\n');
}

export async function mapProject(options = {}) {
  const project = resolveAgentProject(options);
  if (!fs.existsSync(project.configPath)) {
    throw new Error(`flowlens config not found: ${project.configPath}; run flowlens init first`);
  }
  const configured =
    project.config &&
    project.config.agent &&
    typeof project.config.agent === 'object' &&
    !Array.isArray(project.config.agent);
  let agent;
  if (options.agent && typeof options.agent === 'object') agent = options.agent;
  else if (configured) agent = project.agent;
  else agent = resolveAgentForEnvironment(options.env);
  const flowsPath = path.resolve(project.configDir, project.config.flows ?? 'flows.json');
  const currentFlows = readJsonSafe(flowsPath);
  const flowsBefore = Array.isArray(currentFlows && currentFlows.flows) ? currentFlows.flows.length : 0;
  const { node, cliPath } = currentCli();
  const draftPath = path.join(os.tmpdir(), `flowlens-${slug(project.project)}-flows.json`);
  const prompt = buildMapPrompt({
    project: project.project,
    suite: project.suite,
    configPath: project.configPath,
    flowsPath,
    draftPath,
    node,
    cliPath,
    relativeRoot: path.relative(project.configDir, project.suite) || '.',
    currentFlows,
  });
  const base = {
    project: project.project,
    suite: project.suite,
    configPath: project.configPath,
    flowsPath,
    draftPath,
    agent: {
      command: agent.command,
      argsTemplate: agent.argsTemplate,
      source: agent.source ?? 'config',
    },
    flowsBefore,
    write: null,
    prompt,
  };
  if (options.dryRun) return { ...base, ok: true, dryRun: true };
  fs.rmSync(draftPath, { force: true });
  const result = await runAgent({
    command: agent.command,
    args: agent.argsTemplate,
    prompt,
    cwd: project.suite,
    env: agent.env,
    timeoutMs: options.timeoutMs,
    onLog: options.onLog,
  });
  const draft = readJsonSafe(draftPath);
  let write = null;
  if (draft) {
    const errors = validateFlows(draft);
    if (errors.length) {
      write = { ok: false, errors };
    } else {
      fs.mkdirSync(path.dirname(flowsPath), { recursive: true });
      fs.writeFileSync(flowsPath, `${JSON.stringify(draft, null, 2)}\n`, 'utf8');
      write = { ok: true, errors: [] };
    }
  }
  fs.rmSync(draftPath, { force: true });
  let buildResult = null;
  let buildError = null;
  try {
    buildResult = build({ configPath: project.configPath, outDir: options.outDir });
  } catch (error) {
    buildError = error && error.message ? error.message : String(error);
  }
  const stats = buildResult && buildResult.graph ? buildResult.graph.stats : null;
  const draftErrors = write && !write.ok ? write.errors : [];
  return {
    ...base,
    ok: result.code === 0 && !buildError && (!write || write.ok),
    exitCode: result.code,
    durationMs: result.durationMs,
    error:
      result.error ??
      buildError ??
      (draftErrors.length ? `draft validation failed: ${draftErrors.join('; ')}` : null),
    write,
    log: result.log,
    build: buildResult
      ? {
          graphPath: buildResult.graphPath,
          stats,
          warnings: buildResult.warnings,
        }
      : null,
    buildError,
    flowsAfter: stats ? stats.flows : null,
  };
}
