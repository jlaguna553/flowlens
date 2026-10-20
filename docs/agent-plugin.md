# flowlens agent plugin (MCP)

flowlens ships a **zero-dependency MCP server over stdio**. It speaks newline-delimited
JSON-RPC 2.0 on stdin/stdout and exposes the flowlens build/coverage pipeline as tools an
AI agent can call. The server is the same `src/mcp.mjs` used by `npx flowlens-cli mcp`.

- Transport: stdio, newline-delimited JSON-RPC 2.0
- Protocol version: `2024-11-05`
- Runtime: Node >= 20, ESM, no third-party packages
- Writes: only inside the project data dir `<dataDir>/<project>/` (config, `out/`, `env/`).
  `flowlens_scan` and the `repoPath` it receives are **read-only** (never written to). The one
  exception is `flowlens_implement_test`, which launches your configured local agent in the
  suite cwd: that agent may write the suggested spec inside the target repo (that is the
  point). flowlens itself only writes under the data dir.

## Wiring

The server selects its project from `--project <name>` (resolved under the data dir, default
`~/.flowlens/projects`) or `--config <path>`, plus optional `--data-dir <dir>`.

### opencode (`opencode.json`)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "flowlens": {
      "type": "local",
      "enabled": true,
      "command": [
        "npx",
        "-y",
        "flowlens-cli",
        "mcp",
        "--project",
        "my-app"
      ]
    }
  }
}
```

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "flowlens": {
      "command": "npx",
      "args": [
        "-y",
        "flowlens-cli",
        "mcp",
        "--project",
        "my-app"
      ]
    }
  }
}
```

### Claude Code (`.mcp.json` in the project)

```json
{
  "mcpServers": {
    "flowlens": {
      "command": "node",
      "args": ["-y", "flowlens-cli", "mcp", "--project", "my-app"]
    }
  }
}
```

When neither `--project` nor `--config` is given the server looks for
`flowlens.config.json` in the current directory, then for `<dataDir>/<cwd-name>/flowlens.config.json`.
`--data-dir <dir>` overrides the data dir. `--out <dir>` and `--port <n>` set the defaults
used by the tools.

## Tools

Every tool returns MCP content `[{ "type": "text", "text": "<JSON>" }]`. The JSON below is
the shape of that text payload.

### `flowlens_status`

Inputs: none.

Output:

```json
{
  "configPath": "~/.flowlens/projects/my-app/flowlens.config.json",
  "project": "my-app",
  "suite": "/path/to/repo/e2e",
  "outDir": "~/.flowlens/projects/my-app/out",
  "graphPath": "~/.flowlens/projects/my-app/out/graph.json",
  "config": { "suite": "/path/to/repo/e2e", "projectName": "my-app", "flows": "flows.json" },
  "graph": { "present": true, "schemaVersion": 1, "generatedAt": "...", "source": "report-model", "stats": { "flows": 4, "nodes": 22, "links": 30, "tests": 4 } }
}
```

### `flowlens_build`

Inputs: none. Runs `build({ configPath })`.

Output: `{ configPath, project, outDir, graphPath, stats, warnings }`.

### `flowlens_serve`

Inputs: `{ port?: number, host?: string }` (default port `8020`). Starts the viewer server
**in the same process** without blocking the MCP loop; repeated calls reuse the listener.

Output: `{ url, host, port, outDir, reused, pid }`.

### `flowlens_scan`

Inputs: `{ repoPath: string }`. Read-only static scan.

Output:

```json
{
  "repoPath": "...",
  "scannedFiles": 412,
  "truncated": false,
  "skippedSpecs": 37,
  "playwrightSpecs": [
    { "path": "tests/auth.spec.ts", "describes": ["Auth · Sign in"], "tests": ["signs in"], "gotoUrls": ["/login"], "helpers": ["login"], "isPlaywright": true }
  ],
  "frontendRoutes": [
    { "path": "src/app/app-routing.module.ts", "hasRouterModule": true, "hasRoutes": false, "paths": ["items/new"] }
  ],
  "backendRoutes": [
    { "path": "src/Controllers/ItemsController.cs", "isController": true, "routes": [{ "method": "POST", "path": "", "source": "aspnet-attribute" }] }
  ]
}
```

Reads at most 600 code files (`node_modules`, build output, report/test-result dirs are
skipped). Files whose content has no playwright marker are counted in `skippedSpecs`.

### `flowlens_write_flows`

Inputs: `{ flows: object, configPath?: string }`. Validates and writes the flows document.

Validation: `schemaVersion === 1`, non-empty `project`, `suite { root, projectName }`,
`flows[]` with `id`, `title`, `coverage ∈ {covered,partial,uncovered}`,
`nodes[] { id, label, kind ∈ {interaction,backend,db,decision} }`, optional `edges[]`
(`[from,to]` or `{from,to}`, endpoints must exist), optional `tests[] { spec, title }`,
optional `moduleEdges[]`.

Output: `{ ok, path, errors, warnings }`. When `tests[]` are declared, each entry is
matched against the Playwright report model; entries **not present in the report model**
are reported in `warnings`. Invalid documents return `ok: false` with `errors` and no write.

### `flowlens_coverage`

Inputs: none. Reads `<out>/graph.json`.

Output: `{ present, configPath, project, outDir, graphPath, generatedAt, source, flows: [{ id, title, coverage, actors, tests: [{spec,title,outcome}] }], covered, partial, uncovered, counts }`.

### `flowlens_uncovered_tasks`

Inputs: none. For each flow with coverage `uncovered` or `partial`:

```json
{
  "flowId": "F2",
  "title": "Create an item",
  "coverage": "uncovered",
  "nodes": [{ "id": "F2.save", "label": "POST /items", "kind": "backend" }],
  "actors": ["member"],
  "suiteRoot": "/path/to/repo/e2e",
  "suggestedSpecFile": "tests/create-an-item.spec.ts",
  "specFilePath": "/path/to/repo/e2e/tests/create-an-item.spec.ts",
  "reporterHint": "cd <suite> && FLOWLENS_RUN_OUTPUT=<out>/run.json npx playwright test tests/create-an-item.spec.ts --reporter=<flowlens>/src/reporter.mjs --output=<out>/test-results",
  "outputPath": "<out>/run.json",
  "acceptance": ["..."]
}
```

### `flowlens_implement_test`

Inputs: `{ flowId: string, dryRun?: boolean }`. Builds the implementation prompt for the flow
(the same task data as `flowlens_uncovered_tasks`: spec file, nodes, reporter command,
acceptance criteria).

- `dryRun: true` → returns the prompt without launching anything:
  `{ dryRun, flowId, project, suite, agent: { command, argsTemplate, source }, prompt, task }`.
- otherwise → launches the configured local agent in the suite cwd, streams its output, and
  rebuilds the graph when it exits:
  `{ id, flowId, status, suite, agent: { command, argsTemplate, source } }`.

Use the returned `id` with the server's `GET /api/implement-test?id=<id>` to watch the run.

### `flowlens_ingest_results`

Inputs: `{ runPath?: string, reportDir?: string, configPath?: string }`. Runs
`build({ runPath })` or `build({ reportDir })` (defaults to `<out>/run.json` if present)
and returns the updated coverage summary plus `{ outDir, graphPath, stats, warnings }`.

### `flowlens_env_up`

Inputs: `{ dryRun?: boolean, configPath?: string, envPath?: string, port?: number }`.
Brings up the declarative local E2E environment: `docker compose -f <compose...> up -d`,
then waits for each healthcheck (url via `fetch`, command via `sh -c`, polled until success
or `timeoutMs`), then runs each seed (shell command or HTTP request). With `dryRun: true`
nothing is executed and the response carries the exact planned commands under `planned`.

Output: `{ ok, action: "up", dryRun, project, configPath, envPath, envDir, workdir,
composeProject, composeFiles, services: [{ name, state, health, status, ports }],
healthchecks: [{ kind, target, ok, attempts, elapsedMs, statusCode, error }],
seeds: [{ kind, target, ok, exitCode, statusCode }], logPath, notes }`.

### `flowlens_env_down`

Inputs: `{ configPath?: string, envPath?: string }`. Runs `docker compose ... down` and
reports the resulting container state. Does not delete volumes.

Output: `{ ok, action: "down", project, envDir, services, logPath, notes }`.

### `flowlens_env_status`

Inputs: `{ configPath?: string, envPath?: string }`. Runs `docker compose ... ps -a --format
json` and re-probes each healthcheck (capped at 3s so status stays fast).

Output: `{ ok, action: "status", project, envDir, services: [{ name, state, health }],
healthchecks: [...], logPath, notes }`.

## Local E2E environment

The environment is declared generically in `<configDir>/env.json` (or an `env` block inside
`flowlens.config.json`):

```json
{
  "workdir": "/abs/path/where/compose/runs",
  "compose": ["/abs/path/docker-compose.yml"],
  "services": ["db", "api", "web"],
  "ports": { "web": 8081, "api": 54540 },
  "env": { "BASE_URL": "http://localhost:8081" },
  "healthcheck": [{ "url": "http://localhost:{{port.api}}/health", "timeoutMs": 180000 }],
  "seed": [{ "command": "..." }, { "request": { "method": "DELETE", "url": "..." } }]
}
```

- `{{port.<name>}}` and `{{env.<KEY>}}` are interpolated in healthcheck/seed targets, and
  every port is exported as `FLOWLENS_PORT_<NAME>`.
- `workdir` defaults to the directory of the first compose file.
- `composeProject` (optional) sets `COMPOSE_PROJECT_NAME`; when omitted the compose
  file's own default project name is used.
- **Isolation**: all generated files (compose override, `logs/`, `notes.json`,
  `state.json`) live under `<configDir>/env/` (i.e. `<dataDir>/<project>/env/`), outside the
  target repo. The local env uses its own ports and seed data and does not modify the repo
  or remote/shared environments. If a file genuinely must live in the repo it is appended to
  `.git/info/exclude` (never the tracked `.gitignore`).
- **No secrets**: credentials are never stored in `env.json`; reference shell variables
  (e.g. `$DB_PASSWORD`) and export them before `env up`.

The agent authors the `env` block from `flowlens_scan` (compose, services, seeds) and calls
`flowlens_env_up`/`flowlens_env_status` **before** writing or running tests.

## Local agent ("Implementar test")

The viewer's **Implementar test** panel exposes the suggested spec, reporter command and
acceptance criteria and adds an **Ejecutar agente** button. That button, the server's
`POST /api/implement-test`, and the MCP tool `flowlens_implement_test` all do the same thing:
build the prompt, launch the configured local agent (opencode/claude/…) in the suite cwd,
stream its log, and re-run `build` when it exits so the graph reflects the new coverage.

The agent is configured in `<configDir>/flowlens.config.json` (an `agent` block) or in
`<configDir>/agent.json`:

```json
{
  "command": "opencode",
  "argsTemplate": ["run", "{{prompt}}"],
  "env": {}
}
```

- Default when absent: `{ "command": "opencode", "argsTemplate": ["run", "{{prompt}}"] }`.
- Claude: `{ "command": "claude", "argsTemplate": ["-p", "{{prompt}}"] }`.
- `{{prompt}}` is substituted with the generated prompt. An **array** `argsTemplate` is
  spawned with `shell: false`, so the prompt is a single argv element and nothing is
  shell-interpreted. A **string** `argsTemplate` is treated as a shell command line and the
  prompt is single-quote shell-escaped before substitution.
- `env` adds explicit environment variables to the child; **never put secrets here**.

Server endpoints (bound to `127.0.0.1` only, and only the configured `agent.command` is ever
executed):

- `POST /api/implement-test { flowId }` → `202 { id }`, then streams the log into the run.
- `GET /api/implement-test?id=<id>` → `{ id, flowId, status, log, ok, exitCode, rebuilt }`.
- `GET /api/implement-test` → `{ runs: [...] }`.

## End-to-end workflow

```sh
# 0. bring up the local E2E environment (dry-run first to review)
#    tools/call flowlens_env_up { "dryRun": true }
npx flowlens-cli env up --project my-app
npx flowlens-cli env status --project my-app

# 1. scan (read-only) — optional, to ground flows.json
#    tools/call flowlens_scan { "repoPath": "/path/to/repo" }

# 2. author + write flows.json
#    tools/call flowlens_write_flows { "flows": { "schemaVersion": 1, ... } }

# 3. build the graph from the Playwright report
npx flowlens-cli build --project my-app

# 4. list uncovered/partial flows and get implementation tasks
#    tools/call flowlens_uncovered_tasks

# 5. implement each suggested spec, then run Playwright with the flowlens reporter
DATA_DIR="$HOME/.flowlens/projects/my-app"
cd /path/to/repo/e2e
REPORTER=$(npx -y flowlens-cli reporter-path)
FLOWLENS_RUN_OUTPUT="$DATA_DIR/out/run.json" \
  npx playwright test \
  --reporter="$REPORTER" \
  --output="$DATA_DIR/out/test-results"

# 6. ingest the run JSON and rebuild
npx flowlens-cli build --project my-app --run "$DATA_DIR/out/run.json"

# 7. serve the viewer
npx flowlens-cli serve --project my-app --port 8020

# 8. tear the local environment down when done
npx flowlens-cli env down --project my-app
```

The reporter refuses to run unless `FLOWLENS_RUN_OUTPUT` is set; `flowlens reporter-path`
prints the absolute path to the bundled `src/reporter.mjs` (also returned by the MCP tools
as `reporterHint`) and `--output=<abs>` sets where
Playwright stores traces/videos that flowlens later embeds.

Steps 4–5 can be driven for you: call `flowlens_implement_test { flowId }` (or the viewer's
**Ejecutar agente** button), which builds the prompt from the same task data, runs the
configured local agent, and rebuilds the graph on exit.
