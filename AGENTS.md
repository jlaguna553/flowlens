# flowlens - agent workflow

flowlens maps user flows to E2E coverage and embeds Playwright video/trace evidence.
Agents drive it through the MCP server (`npx flowlens-cli mcp`) or the CLI.

flowlens is generic: it stores no data about the repo it runs against. All project data
(config, flows, labels, env, out, env) lives outside this repo, under
`<dataDir>/<project>/` (default dataDir `~/.flowlens/projects`).

## Loop

1. Run `flowlens init --suite <repo-path> --project <name>`. It scaffolds the project and
   launches the configured local agent to map `flows.json` automatically: scan specs,
   routes and controllers, validate the draft, persist it and build the graph. The agent
   that installed flowlens (opencode/claude session) is detected and stored in the config.
2. Review `flows.json`; re-map with `flowlens map` or edit it by hand (MCP:
   `flowlens_scaffold_flows` + `flowlens_write_flows`).
3. Bring up the local test env (`flowlens_env_up`, dry-run first) if the flows need one.
4. For every flow with coverage `uncovered` or `partial`, implement the suggested Playwright
   spec (`flowlens_uncovered_tasks`, then `flowlens_implement_test` to launch the agent).
5. Run Playwright with the flowlens reporter so results land in a run JSON.
6. Ingest the results (`flowlens_ingest_results`) and rebuild the graph (`flowlens_build`).
7. Serve the viewer (`flowlens_serve`).

## Commands

```sh
npx flowlens-cli init --suite <repo-path> [--project <name>] [--data-dir <dir>] [--agent opencode|claude] [--no-map] [--timeout <ms>] [--force]
npx flowlens-cli map [--project <name>|--config <path>] [--data-dir <dir>] [--agent opencode|claude] [--dry-run] [--timeout <ms>]
npx flowlens-cli write-flows --file <flows.json> [--project <name>|--config <path>] [--data-dir <dir>]
npx flowlens-cli env up --project <name> [--data-dir <dir>] [--dry-run]
npx flowlens-cli env status --project <name>
npx flowlens-cli env down --project <name>
npx flowlens-cli build --project <name>
npx flowlens-cli build --config <dataDir>/<project>/flowlens.config.json [--run <path>] [--report <dir>] [--out <dir>]
npx flowlens-cli serve --project <name> [--port 8020]
npx flowlens-cli mcp --project <name>
```

Any command also accepts `--config <path>` instead of `--project`, and `--data-dir <dir>`
(or `FLOWLENS_DATA_DIR`).

`init` maps flows automatically unless `--no-map` is passed or `flows.json` already contains
flows. The agent is chosen from `--agent`, then from the session that launched flowlens
(opencode/claude), then from the installed binaries, and is stored in the config.
`flowlens map --dry-run` prints the mapping prompt without launching the agent;
`flowlens write-flows` validates a draft against schemaVersion 1 and persists it.

## MCP tools

`flowlens_status`, `flowlens_build`, `flowlens_serve {port?,host?}`,
`flowlens_scan {repoPath}`, `flowlens_scaffold_flows {repoPath, suite?, project?}`,
`flowlens_write_flows {flows, configPath?}`, `flowlens_coverage`,
`flowlens_uncovered_tasks`, `flowlens_implement_test {flowId, dryRun?}`,
`flowlens_ingest_results {runPath|reportDir}`,
`flowlens_env_up {dryRun?, configPath?, envPath?, port?}`, `flowlens_env_down {configPath?, envPath?}`,
`flowlens_env_status {configPath?, envPath?}`.

## Local E2E environment

`flowlens env up|status|down` brings up a declarative local E2E environment from
`<configDir>/env.json` (or the `env` block of `flowlens.config.json`). The block declares
`{ workdir?, compose:[paths], services:[names], ports:{name:port}, env:{k:v},
healthcheck:[{url|command, timeoutMs, intervalMs}], seed:[{command}|{request}] }`.
Healthchecks are polled (url via fetch or command via `sh -c`) until success or timeout;
seeds run commands or HTTP requests. Everything generated (override, logs, notes, state)
lives in `<configDir>/env/`, outside the host repo, so it never enters your commits.
Use `--dry-run` to review planned commands without executing anything.

Self-sustaining loop: `env up` -> `flowlens_uncovered_tasks` -> the agent writes the
tests -> they run with the flowlens reporter -> `flowlens_ingest_results` ->
`flowlens_build` -> `flowlens_serve`.

## flows.json schema (schemaVersion 1)

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

`coverage` is one of `covered|partial|uncovered`; node `kind` is one of
`interaction|backend|db|decision`. Node ids are unique within a flow; reuse the same
`id`/`sharedKey` for shared steps, and backend/db nodes with the same `endpoint` merge
automatically. `mermaid` is the flow's Mermaid sequence diagram. Nodes can also include
source metadata for Node Info: `file`, `line`, `component`, `selector` (interaction);
`file`, `line`, `payloadExample` (backend); `table`, `dbFields` (db). Omit what cannot be
verified. Coverage is derived from the Playwright report at build time, so run the reporter
and rebuild after adding specs.
