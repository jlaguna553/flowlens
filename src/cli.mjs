#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';
import { startServer } from './server.mjs';
import { startMcp, validateFlows } from './mcp.mjs';
import { envUp, envDown, envStatus } from './env.mjs';
import { mapProject, agentForAlias, resolveAgentForEnvironment } from './map.mjs';
import { resolveConfigPath, resolveDataDir, projectDir } from './paths.mjs';

const REPORTER_PATH = fileURLToPath(new URL('./reporter.mjs', import.meta.url));

const AGENTS_MD = `# flowlens - agent workflow

flowlens maps user flows to E2E coverage and embeds Playwright video/trace evidence.
Agents drive it through the MCP server (\`npx flowlens-cli mcp\`) or the CLI.

All project data (config, flows, labels, env, out, env) lives outside this repo, under
\`<dataDir>/<project>/\` (default dataDir \`~/.flowlens/projects\`), so nothing about the
host repo is stored in the flowlens tool repo.

## Loop

1. Run \`flowlens init --suite <repo-path> --project <name>\`. init scaffolds the project and
   launches the configured local agent to map \`flows.json\` automatically (scan specs, routes
   and controllers; review the draft; validate it; build the graph).
2. Review \`flows.json\`; re-map with \`flowlens map\` or edit it by hand.
3. For every flow with coverage \`uncovered\` or \`partial\`, implement the suggested Playwright spec.
4. Run Playwright with the flowlens reporter so results land in a run JSON.
5. Ingest the results and rebuild the graph.
6. Serve the viewer.

\`init\` maps flows automatically unless you pass \`--no-map\` or the flows file already has
flows. It uses the agent that installed flowlens (an opencode/claude session) or the first
installed one, and stores it in the config. \`flowlens map\` re-runs mapping later;
\`flowlens map --dry-run\` prints the mapping prompt without launching the agent.

## Commands

\`\`\`sh
npx flowlens-cli init --suite <repo-path> [--project <name>] [--data-dir <dir>] [--agent opencode|claude] [--no-map] [--force]
npx flowlens-cli map [--project <name>|--config <path>] [--data-dir <dir>] [--agent opencode|claude] [--dry-run] [--timeout <ms>]
npx flowlens-cli write-flows --file <flows.json> [--project <name>|--config <path>] [--data-dir <dir>]
npx flowlens-cli env up --project <name> [--data-dir <dir>]
npx flowlens-cli env status --project <name>
npx flowlens-cli env down --project <name>
npx flowlens-cli build --project <name>
npx flowlens-cli build --config <dataDir>/<project>/flowlens.config.json [--run <path>] [--out <dir>]
npx flowlens-cli serve --project <name> [--port 8020]
npx flowlens-cli mcp --project <name>
npx flowlens-cli reporter-path
\`\`\`

Any command also accepts \`--config <path>\` to point at an explicit config file instead of
\`--project\`. Every command accepts \`--data-dir <dir>\` (or \`FLOWLENS_DATA_DIR\`).

## MCP tools

\`flowlens_status\`, \`flowlens_build\`, \`flowlens_serve\`, \`flowlens_scan {repoPath}\`,
\`flowlens_write_flows {flows, configPath?}\`, \`flowlens_coverage\`,
\`flowlens_uncovered_tasks\`, \`flowlens_implement_test {flowId, dryRun?}\`,
\`flowlens_ingest_results {runPath|reportDir}\`,
\`flowlens_env_up {dryRun?, configPath?, envPath?}\`, \`flowlens_env_down {configPath?}\`,
\`flowlens_env_status {configPath?}\`.

## Local E2E environment

\`flowlens env up|status|down\` brings up a declarative local E2E environment from
\`<configDir>/env.json\` (or the \`env\` block of \`flowlens.config.json\`). The block declares
\`{ workdir?, compose:[paths], services:[names], ports:{name:port}, env:{k:v},
healthcheck:[{url|command, timeoutMs, intervalMs}], seed:[{command}|{request}] }\`.
Healthchecks are polled (url via fetch or command via \`sh -c\`) until success or timeout;
seeds run commands or HTTP requests. Everything generated (override, logs, notes, state)
lives in \`<configDir>/env/\`, outside the host repo, so it never enters your commits.
Use \`--dry-run\` to review planned commands without executing anything.

Self-sustaining loop: \`env up\` -> \`flowlens_uncovered_tasks\` -> the agent writes the
tests -> they run with the flowlens reporter -> \`flowlens_ingest_results\` ->
\`flowlens_build\` -> \`flowlens_serve\`.

## flows.json schema (schemaVersion 1)

\`\`\`json
{
  "schemaVersion": 1,
  "project": "my-app",
  "suite": { "root": "e2e", "projectName": "chromium" },
  "flows": [
    {
      "id": "F1",
      "title": "Sign in",
      "coverage": "covered",
      "actors": ["user"],
      "nodes": [
        { "id": "login", "label": "Login", "kind": "interaction", "sharedKey": "auth.login" },
        { "id": "auth", "label": "POST /auth/login", "kind": "backend", "endpoint": "POST /auth/login" }
      ],
      "edges": [["login", "auth"]],
      "tests": [{ "spec": "auth.spec.ts", "title": "signs in" }],
      "mermaid": "sequenceDiagram\\n  actor User\\n  participant UI\\n  participant API\\n  User->>UI: Login\\n  UI->>API: POST /auth/login\\n  API-->>UI: 200 + token"
    }
  ],
  "moduleEdges": []
}
\`\`\`

\`coverage\` is one of \`covered|partial|uncovered\`; node \`kind\` is one of
\`interaction|backend|db|decision\`. Node ids are unique within a flow; reuse the same
\`id\`/\`sharedKey\` for shared steps, and backend/db nodes with the same \`endpoint\`
merge automatically. \`mermaid\` is the flow's Mermaid sequence diagram. Nodes can also
carry source metadata for Node Info: \`file\`, \`line\`, \`component\`, \`selector\`
(interaction); \`file\`, \`line\`, \`payloadExample\` (backend); \`table\`, \`dbFields\`
(db). Coverage is derived from the Playwright report at build time, so run the reporter and
rebuild after adding specs.
`;

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[index + 1];
      if (next !== undefined && !next.startsWith('--')) {
        parsed[key] = next;
        index += 1;
      } else {
        parsed[key] = true;
      }
    } else {
      parsed._.push(arg);
    }
  }
  return parsed;
}

function missingBrowserLibs() {
  const libs = ['libnspr4.so', 'libnss3.so'];
  let listing = '';
  try {
    listing = execFileSync('ldconfig', ['-p'], { encoding: 'utf8' });
  } catch {
    listing = '';
  }
  if (listing) {
    return libs.filter((lib) => !listing.includes(lib));
  }
  const dirs = ['/usr/lib/x86_64-linux-gnu', '/lib/x86_64-linux-gnu', '/usr/lib', '/lib'];
  return libs.filter((lib) => !dirs.some((dir) => fs.existsSync(path.join(dir, lib))));
}

function selectionArgs(args) {
  return {
    configPath: typeof args.config === 'string' ? args.config : undefined,
    project: typeof args.project === 'string' ? args.project : undefined,
    dataDir: typeof args['data-dir'] === 'string' ? args['data-dir'] : undefined,
  };
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function resolveFlowsPath(configPath) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return path.resolve(path.dirname(configPath), config.flows ?? 'flows.json');
}

function resolveInitAgent(args) {
  const requested = typeof args.agent === 'string' ? args.agent : null;
  if (requested) {
    const agent = agentForAlias(requested);
    if (!agent) throw new Error(`unknown agent "${requested}"; use opencode or claude`);
    return { ...agent, source: 'flag' };
  }
  return resolveAgentForEnvironment();
}

function resolveMapAgent(args) {
  const requested = typeof args.agent === 'string' ? args.agent : null;
  if (!requested) return undefined;
  const agent = agentForAlias(requested);
  if (!agent) throw new Error(`unknown agent "${requested}"; use opencode or claude`);
  return { ...agent, source: 'flag' };
}

async function runInit(args) {
  const suiteArg = typeof args.suite === 'string' ? args.suite : null;
  if (!suiteArg) {
    process.stderr.write(
      'usage: flowlens init --suite <path> [--project <name>] [--data-dir <dir>] [--agent opencode|claude] [--no-map] [--timeout <ms>] [--force]\n'
    );
    process.exitCode = 1;
    return;
  }
  const suite = path.resolve(suiteArg);
  const project = typeof args.project === 'string' ? args.project : path.basename(suite);
  const dataDir = resolveDataDir(typeof args['data-dir'] === 'string' ? args['data-dir'] : undefined);
  const configPath =
    typeof args.config === 'string'
      ? path.resolve(args.config)
      : path.join(projectDir(dataDir, project), 'flowlens.config.json');
  const configDir = path.dirname(configPath);
  fs.mkdirSync(configDir, { recursive: true });
  const force = args.force === true;
  const chosenAgent = resolveInitAgent(args);

  const config = {
    suite,
    projectName: project,
    flows: 'flows.json',
    agent: {
      command: chosenAgent.command,
      argsTemplate: chosenAgent.argsTemplate,
    },
  };
  if (!force && fs.existsSync(configPath)) {
    process.stdout.write(`[flowlens] kept existing ${configPath}\n`);
  } else {
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    process.stdout.write(`[flowlens] wrote ${configPath}\n`);
  }

  const flowsPath = path.resolve(configDir, 'flows.json');
  if (!force && fs.existsSync(flowsPath)) {
    process.stdout.write(`[flowlens] kept existing ${flowsPath}\n`);
  } else {
    const relativeRoot = path.relative(configDir, suite) || '.';
    const scaffold = {
      schemaVersion: 1,
      project,
      suite: { root: relativeRoot, projectName: project },
      flows: [],
      moduleEdges: [],
    };
    fs.writeFileSync(flowsPath, `${JSON.stringify(scaffold, null, 2)}\n`, 'utf8');
    process.stdout.write(`[flowlens] wrote ${flowsPath}\n`);
  }

  const agentsPath = path.join(configDir, 'AGENTS.md');
  if (!force && fs.existsSync(agentsPath)) {
    process.stdout.write(`[flowlens] kept existing ${agentsPath}\n`);
  } else {
    fs.writeFileSync(agentsPath, AGENTS_MD, 'utf8');
    process.stdout.write(`[flowlens] wrote ${agentsPath}\n`);
  }

  process.stdout.write(`[flowlens] data-dir ${dataDir}\n`);
  process.stdout.write(`[flowlens] project ${project} at ${configDir}\n`);

  const missing = missingBrowserLibs();
  if (missing.length) {
    process.stderr.write(
      `WARNING: host browser deps missing (${missing.join(', ')}). Playwright chromium will not launch; install e.g. sudo apt-get install -y libnspr4 libnss3\n`
    );
  } else {
    process.stdout.write('[flowlens] host browser deps present\n');
  }

  const flowsDoc = readJsonSafe(flowsPath);
  const hasFlows = Array.isArray(flowsDoc && flowsDoc.flows) && flowsDoc.flows.length > 0;
  if (args['no-map'] === true) {
    process.stdout.write('[flowlens] mapping skipped (--no-map)\n');
    return;
  }
  if (hasFlows) {
    process.stdout.write('[flowlens] kept existing flows; run flowlens map to re-map\n');
    return;
  }
  const savedConfig = readJsonSafe(configPath);
  const savedAgent =
    savedConfig && savedConfig.agent && typeof savedConfig.agent === 'object'
      ? savedConfig.agent
      : null;
  const mapCommand = savedAgent && savedAgent.command ? savedAgent.command : chosenAgent.command;
  process.stdout.write(`[flowlens] mapping flows with ${mapCommand}...\n`);
  try {
    const mapped = await mapProject({
      configPath,
      timeoutMs: typeof args.timeout === 'string' ? Number(args.timeout) : undefined,
      onLog: (line) => process.stdout.write(`[agent] ${line}\n`),
    });
    if (mapped.ok && (mapped.flowsAfter ?? 0) > 0) {
      const stats = mapped.build?.stats ?? {};
      process.stdout.write(
        `[flowlens] mapped ${stats.flows ?? 0} flow(s), ${stats.nodes ?? 0} node(s), ${stats.links ?? 0} link(s) -> ${mapped.flowsPath}\n`
      );
      if (mapped.build?.graphPath) {
        process.stdout.write(`[flowlens] build -> ${mapped.build.graphPath}\n`);
      }
    } else {
      process.stderr.write(
        `[flowlens] WARNING: automatic mapping did not finish cleanly (${mapped.error ?? 'no flows produced'}); flows left at ${flowsPath}. Retry with: flowlens map --config ${configPath}\n`
      );
    }
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    process.stderr.write(
      `[flowlens] WARNING: automatic mapping failed: ${message}. Retry with: flowlens map --config ${configPath}\n`
    );
  }
}

async function runMap(args) {
  const dryRun = args['dry-run'] === true || args.dryRun === true;
  const timeoutMs = typeof args.timeout === 'string' ? Number(args.timeout) : undefined;
  let agent;
  try {
    agent = resolveMapAgent(args);
  } catch (error) {
    process.stderr.write(`[flowlens] error: ${error && error.message ? error.message : error}\n`);
    process.exitCode = 1;
    return;
  }
  try {
    const result = await mapProject({
      ...selectionArgs(args),
      agent,
      dryRun,
      timeoutMs,
      outDir: typeof args.out === 'string' ? args.out : undefined,
      onLog: (line) => process.stdout.write(`[agent] ${line}\n`),
    });
    if (dryRun) {
      process.stdout.write(`${result.prompt}\n`);
      process.stderr.write(
        `[flowlens] dry-run: agent ${result.agent.command} ${JSON.stringify(result.agent.argsTemplate)}\n`
      );
      return;
    }
    if (result.ok && (result.flowsAfter ?? 0) > 0) {
      const stats = result.build?.stats ?? {};
      process.stdout.write(
        `[flowlens] mapped ${stats.flows ?? 0} flow(s), ${stats.nodes ?? 0} node(s), ${stats.links ?? 0} link(s) -> ${result.flowsPath} (${result.durationMs}ms)\n`
      );
    } else if (result.ok) {
      process.stderr.write(
        `[flowlens] WARNING: agent finished but produced no flows (${result.flowsPath})\n`
      );
      process.exitCode = 1;
    } else {
      process.stderr.write(
        `[flowlens] mapping failed: ${result.error ?? `agent exited with code ${result.exitCode}`}\n`
      );
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`[flowlens] error: ${error && error.message ? error.message : error}\n`);
    process.exitCode = 1;
  }
}

function runWriteFlows(args) {
  const file = typeof args.file === 'string' ? path.resolve(args.file) : null;
  if (!file) {
    process.stderr.write(
      'usage: flowlens write-flows --file <flows.json> [--project <name>|--config <path>] [--data-dir <dir>]\n'
    );
    process.exitCode = 1;
    return;
  }
  const configPath = resolveConfigPath(selectionArgs(args));
  if (!fs.existsSync(configPath)) {
    process.stderr.write(`[flowlens] error: config not found: ${configPath}\n`);
    process.exitCode = 1;
    return;
  }
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    process.stdout.write(
      `${JSON.stringify({ ok: false, path: null, errors: [`cannot read ${file}: ${message}`] }, null, 2)}\n`
    );
    process.exitCode = 1;
    return;
  }
  const flowsPath = resolveFlowsPath(configPath);
  const errors = validateFlows(doc);
  if (errors.length) {
    process.stdout.write(`${JSON.stringify({ ok: false, path: flowsPath, errors }, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }
  fs.mkdirSync(path.dirname(flowsPath), { recursive: true });
  fs.writeFileSync(flowsPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `${JSON.stringify({ ok: true, path: flowsPath, errors: [], flows: doc.flows.length }, null, 2)}\n`
  );
}

function runBuild(args) {
  const result = build({
    ...selectionArgs(args),
    runPath: typeof args.run === 'string' ? args.run : undefined,
    reportDir: typeof args.report === 'string' ? args.report : undefined,
    outDir: typeof args.out === 'string' ? args.out : undefined,
  });
  for (const warning of result.warnings) {
    process.stderr.write(`[flowlens] WARNING: ${warning}\n`);
  }
  process.stdout.write(
    `[flowlens] build -> ${result.graphPath} (flows=${result.graph.stats.flows} nodes=${result.graph.stats.nodes} links=${result.graph.stats.links} tests=${result.graph.stats.tests} artifacts=${result.graph.stats.artifacts} mappedNodes=${result.graph.stats.mappedNodes})\n`
  );
}

function resolveServeOut(args) {
  if (typeof args.out === 'string') return path.resolve(args.out);
  const configPath = resolveConfigPath(selectionArgs(args));
  if (!fs.existsSync(configPath)) return null;
  return path.join(path.dirname(path.resolve(configPath)), 'out');
}

async function runServe(args) {
  const outDir = resolveServeOut(args);
  if (!outDir) {
    process.stderr.write(
      'usage: flowlens serve [--project <name>] [--config <path>] [--data-dir <dir>] [--out <dir>] [--port <n>]\n'
    );
    process.exitCode = 1;
    return;
  }
  const port = typeof args.port === 'string' ? Number(args.port) : 8017;
  const { url } = await startServer({
    outDir,
    port,
    configPath: resolveConfigPath(selectionArgs(args)),
  });
  process.stdout.write(`[flowlens] serve -> ${url} (out=${outDir})\n`);
}

async function runMcp(args) {
  await startMcp({
    ...selectionArgs(args),
    outDir: typeof args.out === 'string' ? args.out : undefined,
    port: typeof args.port === 'string' ? Number(args.port) : undefined,
  });
}

async function runEnv(args) {
  const action = args._[1];
  const options = {
    ...selectionArgs(args),
    envPath: typeof args.env === 'string' ? args.env : undefined,
    dryRun: args['dry-run'] === true || args.dryRun === true,
    port: typeof args.port === 'string' ? Number(args.port) : undefined,
  };
  let result;
  if (action === 'up') result = await envUp(options);
  else if (action === 'down') result = await envDown(options);
  else if (action === 'status') result = await envStatus(options);
  else {
    process.stderr.write(
      'usage: flowlens env <up|down|status> [--project <name>] [--config <path>] [--data-dir <dir>] [--env <path>] [--dry-run] [--port <n>]\n'
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.ok === false && !result.dryRun && action !== 'status') process.exitCode = 1;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  if (command === 'init') await runInit(args);
  else if (command === 'map') await runMap(args);
  else if (command === 'write-flows') runWriteFlows(args);
  else if (command === 'build') runBuild(args);
  else if (command === 'serve') await runServe(args);
  else if (command === 'mcp') await runMcp(args);
  else if (command === 'env') await runEnv(args);
  else if (command === 'reporter-path') process.stdout.write(`${REPORTER_PATH}\n`);
  else {
    process.stderr.write(
      'usage: flowlens <init|map|write-flows|build|serve|mcp|env|reporter-path>\n' +
        '  init  --suite <path> [--project <name>] [--data-dir <dir>] [--agent opencode|claude] [--no-map] [--timeout <ms>] [--force]\n' +
        '  map   [--project <name>|--config <path>] [--data-dir <dir>] [--agent opencode|claude] [--dry-run] [--timeout <ms>]\n' +
        '  write-flows --file <flows.json> [--project <name>|--config <path>] [--data-dir <dir>]\n' +
        '  build [--project <name>|--config <path>] [--data-dir <dir>] [--run <path>] [--report <dir>] [--out <dir>]\n' +
        '  serve [--project <name>|--config <path>] [--data-dir <dir>] [--out <dir>] [--port <n>]\n' +
        '  mcp   [--project <name>|--config <path>] [--data-dir <dir>] [--out <dir>] [--port <n>]\n' +
        '  env   <up|down|status> [--project <name>|--config <path>] [--data-dir <dir>] [--env <path>] [--dry-run] [--port <n>]\n' +
        '  reporter-path  print the absolute path to the Playwright reporter\n'
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`[flowlens] error: ${error && error.message ? error.message : error}\n`);
  process.exitCode = 1;
});
