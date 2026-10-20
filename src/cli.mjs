#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';
import { startServer } from './server.mjs';
import { startMcp } from './mcp.mjs';
import { envUp, envDown, envStatus } from './env.mjs';
import { resolveConfigPath, resolveDataDir, projectDir } from './paths.mjs';

const REPORTER_PATH = fileURLToPath(new URL('./reporter.mjs', import.meta.url));

const AGENTS_MD = `# flowlens - agent workflow

flowlens maps user flows to E2E coverage and embeds Playwright video/trace evidence.
Agents drive it through the MCP server (\`npx flowlens-cli mcp\`) or the CLI.

All project data (config, flows, labels, env, out, env) lives outside this repo, under
\`<dataDir>/<project>/\` (default dataDir \`~/.flowlens/projects\`), so nothing about the
host repo is stored in the flowlens tool repo.

## Loop

1. Scan the target repo (read-only) to find specs, routes and controllers.
2. Author \`flows.json\` (schemaVersion 1) and write it with \`flowlens_write_flows\`.
3. For every flow with coverage \`uncovered\` or \`partial\`, implement the suggested Playwright spec.
4. Run Playwright with the flowlens reporter so results land in a run JSON.
5. Ingest the results and rebuild the graph.
6. Serve the viewer.

## Commands

\`\`\`sh
npx flowlens-cli init --suite <repo-path> [--project <name>] [--data-dir <dir>] [--force]
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
      "nodes": [{ "id": "F1.login", "label": "Login", "kind": "interaction" }],
      "edges": [["F1.login", "F1.home"]],
      "tests": [{ "spec": "auth.spec.ts", "title": "signs in" }]
    }
  ],
  "moduleEdges": []
}
\`\`\`

\`coverage\` is one of \`covered|partial|uncovered\`; node \`kind\` is one of
\`interaction|backend|db|decision\`. Coverage is derived from the Playwright report at
build time, so run the reporter and rebuild after adding specs.
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

function runInit(args) {
  const suiteArg = typeof args.suite === 'string' ? args.suite : null;
  if (!suiteArg) {
    process.stderr.write(
      'usage: flowlens init --suite <path> [--project <name>] [--data-dir <dir>] [--force]\n'
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

  const config = { suite, projectName: project, flows: 'flows.json' };
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
  if (command === 'init') runInit(args);
  else if (command === 'build') runBuild(args);
  else if (command === 'serve') await runServe(args);
  else if (command === 'mcp') await runMcp(args);
  else if (command === 'env') await runEnv(args);
  else if (command === 'reporter-path') process.stdout.write(`${REPORTER_PATH}\n`);
  else {
    process.stderr.write(
      'usage: flowlens <init|build|serve|mcp|env|reporter-path>\n' +
        '  init  --suite <path> [--project <name>] [--data-dir <dir>] [--force]\n' +
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
