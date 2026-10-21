# flowlens

flowlens maps a repository's **user flows** and their end-to-end coverage, then embeds the
Playwright **video / trace / steps** evidence in a local viewer. It also ships an **MCP
plugin**, so a local AI agent (opencode, Claude, ...) can map the flows, stand up a local
test environment, and implement the tests that are missing.

flowlens is **generic**: it stores nothing about the repo it runs against. Every project
artifact (config, flows, labels, env, build output) lives **outside the target repo**, under
a data dir you control (default `~/.flowlens/projects/<project>/`). Clone it anywhere, point
it at any repository, and nothing lands in the target repo's commits.

A flow is a small graph of nodes:

- `interaction` - a user action in the UI
- `backend` - an API call / endpoint
- `db` - a database step
- `decision` - a branch or outcome

Each flow carries a coverage state: `covered`, `partial`, or `uncovered`.

## What you get

- **Flow graph** with friendly node names, coverage colors and a coverage filter.
- **Evidence** per flow: video, Playwright trace and step list, synced to the graph.
- **Local test env** you declare once (`env.json`) and bring up/down with Docker, kept
  outside git.
- **MCP plugin** (`flowlens mcp`) exposing the whole pipeline as tools for a local agent.
- **"Implementar test"** panel in the viewer that can launch your local agent to write and
  run the missing spec.

## Requirements

- **Node.js >= 20** (ESM, zero runtime dependencies).
- A target repository. It may or may not have a Playwright E2E suite.
- **Docker** (optional). Only needed if you use `flowlens env` to bring up a local test
  environment.
- A **local agent** (opencode, Claude, ...) if you want the MCP integration.
- **Host browser deps** if you run Playwright directly on the host. The viewer/reporter
  themselves don't need a browser, but a local Playwright chromium run needs the usual
  shared libraries, e.g. `libnspr4`, `libnss3`, `libasound2`. In practice the E2E suite
  usually runs inside Docker, so the host may not need them.

## Install

Run it with `npx` (nothing to install):

```sh
npx flowlens-cli init --suite /path/to/target-repo --project my-app
```

Or install it globally:

```sh
npm install -g flowlens-cli
flowlens init --suite /path/to/target-repo --project my-app
```

### Install straight from GitHub (no npm registry needed)

The repository is self-contained, so you can run it without publishing to npm:

```sh
npx -y github:jlaguna553/flowlens init --suite /path/to/target-repo --project my-app
```

Or install it globally from the repository:

```sh
npm install -g github:jlaguna553/flowlens
flowlens init --suite /path/to/target-repo --project my-app
```

MCP clients can use the same spec:

```json
"command": ["npx", "-y", "github:jlaguna553/flowlens", "mcp", "--project", "my-app"]
```

The CLI binary is always `flowlens`, regardless of how the package was installed.

There are no runtime dependencies. It's plain Node with a single `package.json` and the
`src/` tree. Node.js >= 20 is required.

For development on flowlens itself, clone the repo and run the CLI directly:

```sh
git clone https://github.com/jlaguna553/flowlens
cd flowlens
node src/cli.mjs init --suite /path/to/target-repo --project my-app
```

Regenerating the viewer after editing `src/viewer/render.ts` requires Node >= 22.13:
`npm run build:viewer`.

## Configure it in another repo

Run `init` once per project, pointing `--suite` at the target repo (or at its E2E suite
root):

```sh
npx flowlens-cli init \
  --suite /path/to/target-repo/e2e \
  --project my-app
```

`init` writes the project data **outside the target repo**, under
`~/.flowlens/projects/<project>/` by default. Nothing is added to the target repo, so none
of it shows up in your commits:

```
~/.flowlens/projects/my-app/
  flowlens.config.json   suite path + flows pointer (+ optional agent/env blocks)
  flows.json             the flow graph the agent authors
  labels.json            optional friendly-name patterns for backend/db labels
  env.json               optional local E2E environment declaration
  out/                   built graph.json + viewer (index.html, vendor, trace assets)
  env/                   generated compose override, logs, notes, state
```

`init` options:

| Flag | Meaning |
| --- | --- |
| `--suite <path>` | **Required.** Target repo or its E2E suite root. |
| `--project <name>` | Project name. Defaults to the suite directory name. |
| `--data-dir <dir>` | Data dir. Defaults to `~/.flowlens/projects` or `FLOWLENS_DATA_DIR`. |
| `--agent opencode\|claude` | Agent used to map flows. Defaults to the agent that launched `init` (opencode/claude session), else the first installed one. |
| `--no-map` | Skip the automatic flow mapping. |
| `--timeout <ms>` | Kill the mapping agent after this many milliseconds. |
| `--force` | Overwrite an existing config / flows / AGENTS skeleton. |

### Automatic flow mapping

`init` does not stop at an empty `flows.json`: it scans the project and **launches your
local agent to map the flows automatically**. The agent reads the repo (Playwright specs,
frontend routes, backend controllers), writes a draft, and flowlens validates it, persists
`flows.json`, and rebuilds the graph. The whole mapping stays outside the target repo.

The agent is chosen in this order:

1. `--agent opencode|claude`, if given.
2. The agent that launched the command, detected from its environment (`opencode` or
   `claude` session markers). This is what makes `init` use "the agent you installed
   flowlens with".
3. The first installed agent (`opencode`, then `claude`); default `opencode`.

The chosen agent is stored in `flowlens.config.json`, so later `map` / `implement-test`
runs reuse it. If the agent is not installed or fails, `init` still succeeds, keeps the
scaffolded files, and prints a warning with the exact `flowlens map` command to retry.
Mapping is also skipped when `flows.json` already contains flows. The mapping prompt asks the
agent to reuse shared node ids/`sharedKey`s and to emit a Mermaid sequence diagram per flow,
so re-map after upgrading to populate the **Secuencia** tab.

Re-map at any time:

```sh
# print the prompt without launching the agent
npx flowlens-cli map --project my-app --dry-run

# launch the configured agent again
npx flowlens-cli map --project my-app

# use a specific agent for this run
npx flowlens-cli map --project my-app --agent claude
```

Agents that do not use the MCP server can validate a draft themselves with
`flowlens write-flows --file <draft.json> --config <config>`; it returns
`{ ok, path, errors }` and writes only when the document matches `schemaVersion` 1.

At the end, `init` checks for host browser libs and prints a warning if `libnspr4` /
`libnss3` are missing (see Troubleshooting).

Every other command accepts `--project <name>` **or** `--config <path>`, plus
`--data-dir <dir>`. With neither, flowlens looks for `flowlens.config.json` in the current
directory, then for `<dataDir>/<cwd-name>/flowlens.config.json`.

## Wire the MCP plugin

flowlens speaks MCP over stdio. Start it with:

```sh
npx flowlens-cli mcp --project my-app
```

Arguments: `--project <name> | --config <path>`, `--data-dir <dir>`, `--out <dir>`,
`--port <n>`. Use `--config` when you don't want to rely on the data dir.

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

### Claude Desktop (`claude_desktop_config.json`) and Claude Code (`.mcp.json`)

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

To keep the project data away from the default dir, add the selection flags to the command
array, e.g. `--config /path/to/flowlens.config.json` or `--data-dir /path/to/data`.

### Tools exposed

| Tool | Inputs |
| --- | --- |
| `flowlens_status` | none |
| `flowlens_build` | none |
| `flowlens_serve` | `{ port?, host? }` (default port `8020`) |
| `flowlens_scan` | `{ repoPath }` |
| `flowlens_scaffold_flows` | `{ repoPath, suite?, project? }` |
| `flowlens_write_flows` | `{ flows, configPath? }` |
| `flowlens_coverage` | none |
| `flowlens_uncovered_tasks` | none |
| `flowlens_implement_test` | `{ flowId, dryRun? }` |
| `flowlens_ingest_results` | `{ runPath?, reportDir?, configPath? }` |
| `flowlens_env_up` | `{ dryRun?, configPath?, envPath?, port? }` |
| `flowlens_env_down` | `{ configPath?, envPath? }` |
| `flowlens_env_status` | `{ configPath?, envPath? }` |

`flowlens_scan`, `flowlens_scaffold_flows` and the `repoPath` they receive are **read-only**.
All writes go under the project data dir. The one exception is `flowlens_implement_test`,
which launches your configured local agent in the suite cwd, so that agent may write the
suggested spec inside the target repo (that's the point).

## The agent workflow (3 capabilities)

Give the agent the prompt, let it call the tools. The three capabilities below are the
whole loop.

### 1. Map the flows

`init` already does this automatically with the configured agent (see
[Automatic flow mapping](#automatic-flow-mapping)). Use `flowlens map` to re-map later, or
the manual loop below when you want the agent to show you the draft before writing it.

> Scan the repo at `/path/to/target-repo`. Draft a `flows.json` of user flows from it, show
> me the draft for review, then write it. After writing, build the graph and start the
> viewer so I can see it.

The agent calls `flowlens_scan { repoPath }` (read-only: Playwright specs, frontend routes,
backend routes/controllers), then `flowlens_scaffold_flows { repoPath }` to get a **draft**
`flows.json` (one covered flow per Playwright `describe`, plus uncovered route candidates),
reviews and edits it, then `flowlens_write_flows { flows }` to validate and persist it.
Finally `flowlens_build` and `flowlens_serve` render the graph.

`flowlens_write_flows` validates against `schemaVersion` 1 and returns
`{ ok, path, errors, warnings }`. An invalid document returns `ok: false` with `errors` and
writes nothing.

`flows.json` shape (`schemaVersion` 1):

```json
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
      "mermaid": "sequenceDiagram\n  actor User\n  participant UI\n  participant API\n  User->>UI: Login\n  UI->>API: POST /auth/login\n  API-->>UI: 200 + token"
    }
  ],
  "moduleEdges": []
}
```

Rules: `coverage` is `covered|partial|uncovered`; node `kind` is
`interaction|backend|db|decision`; `edges` are `[from,to]` pairs of existing node ids;
`tests` are `{ spec, title }` join keys. Node ids only need to be unique inside a flow:
reuse the same `id`/`sharedKey` for a step shared by several flows (for example login or
branch selection). Backend/db nodes with the same `endpoint` are merged automatically, even
when their ids differ. Shared nodes render once, keep every flow that uses them, and the
viewer lists those flows in Node Info.

`mermaid` is optional but recommended: a Mermaid `sequenceDiagram` for the flow. The viewer
shows it in the **Secuencia** tab with zoom and full-screen controls. Nodes can also carry
source metadata used by Node Info: `file`, `line`, `component` and `selector` for
interactions; `file`, `line` and `payloadExample` for backend calls; `table` and `dbFields`
for database nodes. Omit values the mapper cannot verify. Coverage is derived from the
Playwright report at build time (see the reporter section), so run the reporter and rebuild
after adding specs.

### 2. Stand up the local test env

> Bring up the local E2E environment for this project. Dry-run it first so I can review the
> commands, then run it for real.

Declare the environment in `env.json` next to the config (or in an `env` block of
`flowlens.config.json`):

```json
{
  "workdir": ".",
  "compose": ["docker-compose.yml"],
  "services": ["db", "api", "web"],
  "ports": { "web": 8081, "api": 54540 },
  "env": { "BASE_URL": "http://localhost:{{port.web}}" },
  "healthcheck": [{ "url": "http://localhost:{{port.web}}", "timeoutMs": 180000 }],
  "seed": [{ "command": "docker exec -i my-db ./seed.sh" }]
}
```

The agent calls `flowlens_env_up { dryRun: true }` first to preview the planned commands
without executing, then `flowlens_env_up` for real: it runs
`docker compose up -d`, waits for each healthcheck (URL via `fetch` or command via `sh -c`,
polled until success or `timeoutMs`), and runs each seed (shell command or HTTP request).
`flowlens_env_status` reports container state plus healthchecks, and `flowlens_env_down`
tears it down.

`{{port.<name>}}` and `{{env.<KEY>}}` are interpolated in healthcheck/seed targets, and
every port is exported as `FLOWLENS_PORT_<NAME>`. Everything generated (compose override,
`logs/`, `notes.json`, `state.json`) lives under `<configDir>/env/`, outside the target
repo. **No secrets in `env.json`**: reference shell vars such as `$DB_PASSWORD` and export
them before `env up`.

The CLI equivalents are `flowlens env up|status|down`. Use `--dry-run` to review commands
without running them.

### 3. Implement the missing tests

> List the uncovered and partial flows. For each one, implement the suggested Playwright
> spec and run it with the flowlens reporter, then ingest the results so coverage updates.

The agent calls `flowlens_uncovered_tasks` (needs a prior `flowlens_build`). For every
`uncovered` / `partial` flow it returns the flow, its nodes, `actors`, a
`suggestedSpecFile`, a `reporterHint` (the exact command), an `outputPath`, and
`acceptance` criteria. The agent writes the spec, runs it, then calls
`flowlens_ingest_results` (`{ runPath }`, falling back to `<out>/run.json`) to rebuild the
graph and refresh coverage.

To let flowlens launch the agent for you, call `flowlens_implement_test { flowId }`. With
`dryRun: true` it returns the generated prompt without launching anything. Otherwise it
runs the configured local agent in the suite cwd, streams its log, and rebuilds the graph
on exit, returning `{ id }` to watch the run.

The viewer does the same thing: open a `partial` / `uncovered` flow, go to the
**Implementar test** tab, and press **Ejecutar agente**. That posts to
`POST /api/implement-test { flowId }` (returns `202 { id }`); `GET /api/implement-test?id=<id>`
returns `{ id, flowId, status, log, ok, exitCode, rebuilt }`.

The agent command is configured in `flowlens.config.json` (an `agent` block) or in
`agent.json`:

```json
{
  "suite": "/absolute/path/to/target-repo/e2e",
  "projectName": "my-app",
  "flows": "flows.json",
  "agent": {
    "command": "opencode",
    "argsTemplate": ["run", "{{prompt}}"]
  }
}
```

`suite` is resolved relative to the **config file**, which lives outside the target repo
(`<dataDir>/<project>/`). `flowlens init` writes it as an absolute path; if you create the
config by hand, use an absolute path. A relative path such as `"e2e"` points at
`<dataDir>/<project>/e2e` and will fail when the agent is launched.

Default when absent: `{ "command": "opencode", "argsTemplate": ["run", "{{prompt}}"] }`.
Claude users: `{ "command": "claude", "argsTemplate": ["-p", "{{prompt}}"] }`.
`{{prompt}}` is replaced with the generated prompt. An **array** `argsTemplate` is spawned
with `shell: false`, so the prompt is a single argv element and nothing is shell-interpreted.
A **string** `argsTemplate` is treated as a shell command line and the prompt is
single-quote escaped before substitution. `agent.env` adds child environment variables;
never store secrets there.

## Reporter

Coverage and evidence come from Playwright runs. Point Playwright at the bundled reporter
and a run JSON inside the project data dir:

```sh
cd /path/to/target-repo/e2e
REPORTER=$(npx -y flowlens-cli reporter-path)
FLOWLENS_RUN_OUTPUT=~/.flowlens/projects/my-app/out/run.json \
  npx playwright test \
  --reporter="$REPORTER" \
  --output=~/.flowlens/projects/my-app/out/test-results

npx flowlens-cli build --project my-app \
  --run ~/.flowlens/projects/my-app/out/run.json
```

The reporter refuses to run unless `FLOWLENS_RUN_OUTPUT` is set. `flowlens reporter-path`
prints the absolute path to the bundled `src/reporter.mjs` (also returned by the MCP tools
as `reporterHint`), and `--output=<abs>` sets where Playwright stores the traces/videos
that flowlens later embeds.

Build flags: `build [--project <name>|--config <path>] [--data-dir <dir>] [--run <path>]
[--report <dir>] [--out <dir>]`. With no `--run` and no `playwright-report/`, build emits
the flow graph without test results.

## Viewer

```sh
npx flowlens-cli serve --project my-app --port 8017
```

Open the printed URL (the MCP `flowlens_serve` tool defaults to port `8020`; the CLI
`serve` defaults to `8017`). The viewer shows:

- **Graph** of flows and nodes, colored by flow and by node kind (`Front`, `Back`, `BD`,
  `Decision`), with three layouts: **Graphify** (original force graph), **Galaxia**
  (constellation layout with starfield and flow clusters) and **Organigrama**
  (top-down hierarchical tree).
- **Collapsible, resizable sections**: Node Info, Evidence, Kinds, Flows. Each has its own
  scroll and a drag handle; the collapsed state is remembered.
- **Node Info**: label, endpoint, kind, coverage, payload, response and neighbors, plus
  type-specific details: frontend file/line, component and selector; backend source,
  file/line and request payload example; database table and touched fields. Shared nodes list
  every flow that uses them.
- **Flows legend**: flow titles, select all, and a **coverage filter**
  (All / Covered / Partial / Uncovered) that filters both the graph and the list. Hover a
  flow to preview its Mermaid sequence diagram; click the flow to zoom/highlight it and open
  **Secuencia**, or click the preview to open the full-screen diagram (`Clear` resets focus).
- **Hover a node** for a compact info card with its type-specific details; clicking the card
  expands it. **Click the node itself** to focus/zoom its flow and load its evidence.
- **Hover an edge** for a large Mermaid preview of the flow(s) it belongs to; **click the edge**
  to focus/zoom its flow. Click the preview to open the full-screen sequence diagram.
- **Click a node** to zoom and focus its flow, and jump the video to that node's step.
- **Playback bar**: play/pause, scrubber, time, and a speed selector (`0.1x` to `2x`). As
  it plays, a cursor animates along the flow from node to node.
- **Evidence tabs**: **Video**, **Trace**, **Pasos** (steps), **Secuencia** (Mermaid
  sequence diagram with zoom and full-screen), and **Implementar test**
  (spec, command, acceptance criteria, uncovered nodes, and the **Ejecutar agente**
  button with a live log).
- **Search** across nodes, plus light / dark / system themes.

## Troubleshooting

**Browser deps missing.** `init` warns when `libnspr4.so` / `libnss3.so` are absent. If you
run Playwright on the host, install them, e.g.
`sudo apt-get install -y libnspr4 libnss3 libasound2`. If your suite runs in Docker, you
can ignore the warning.

**Docker not available.** `flowlens env up` needs the `docker` CLI. Use
`flowlens_env_up { dryRun: true }` (or `flowlens env up --dry-run`) to inspect the planned
commands without Docker.

**Port in use.** Pass another `--port` to `serve` / `mcp`, or `{ port }` to
`flowlens_serve`. `flowlens env up --port <n>` overrides `ports.main` (or the first
declared port).

**MCP not loading.** Run the exact command from your config by hand
(`npx flowlens-cli mcp --project my-app`). If it exits immediately, check
Node is >= 20 and that `--project` / `--config` points at an existing
`flowlens.config.json` under the data dir.

**Agent command.** The default is opencode (`opencode run "<prompt>"`). For Claude use
`{ "command": "claude", "argsTemplate": ["-p", "{{prompt}}"] }`. Put the block in
`flowlens.config.json` or `agent.json`. The array form avoids the shell; use the string
form only when you need a shell pipeline.

**Implementar test fails / the panel shows an error.** The run log now prints the exact
command and working directory (`[flowlens] agent command: ...`, `[flowlens] agent cwd: ...`)
and flowlens validates both before spawning. Common messages:

- `agent command not found: opencode` — install the agent in the same environment that runs
  `flowlens serve`, or set `agent.command` / use `--agent claude`.
- `suite directory not found: ...` — the config's `suite` must be an absolute path (or
  relative to the config file, not the target repo). `init` writes it absolute.
- `flow not found in graph: F16` — the flow ID is not in the built graph (IDs are
  case-sensitive). Rebuild with `flowlens build --project <name>` and use the exact ID.
- `HTTP 404/500: <html>...` — the panel is not reaching the flowlens server. Serve the
  viewer with `flowlens serve`, don't open `out/index.html` directly, and make sure any
  proxy forwards `POST /api/implement-test` as JSON.
- The agent exits nonzero with its own message (for example a provider/model error). If
  `agent.argsTemplate` pins `--model`, that model must exist and be authenticated in the
  environment that runs the server. Reproduce the launch by hand from the same `suite` and
  with the same user: `opencode run "Reply with exactly: OK"`. If the default model returns
  `UnknownError: Unexpected server error`, pin a model that works, e.g.
  `"argsTemplate": ["run", "--model", "opencode/deepseek-v4.1-flash-free", "{{prompt}}"]`.
  Capture the full `[flowlens]` log from the panel; if the server was restarted the in-memory
  run log is lost, so copy it before restarting.

**Automatic mapping failed.** `init` maps flows with the configured agent. If the agent is
missing or the run fails, `init` keeps the scaffolded files and prints a warning. Retry with
`flowlens map --project my-app` (add `--dry-run` to see the prompt first, `--agent claude`
to switch agents). Use `init --no-map` to skip mapping entirely; `init` also skips it when
`flows.json` already has flows.

## Privacy

The flowlens repo contains no project data. All config, flows, labels, env and build output
live under `<dataDir>/<project>/`. The only committed example is the synthetic
`examples/demo/`. If something genuinely must live inside the target repo, flowlens records
it in `.git/info/exclude`, never the tracked `.gitignore`.
