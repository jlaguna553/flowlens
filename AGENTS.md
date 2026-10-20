# flowlens - agent workflow

flowlens maps user flows to E2E coverage and embeds Playwright video/trace evidence.
Agents drive it through the MCP server (`npx flowlens-cli mcp`) or the CLI.

flowlens is generic: it stores no data about the repo it runs against. All project data
(config, flows, labels, env, out, env) lives outside this repo, under
`<dataDir>/<project>/` (default dataDir `~/.flowlens/projects`).

## Loop

1. Scan the target repo (read-only) to find specs, routes and controllers.
2. Ask `flowlens_scaffold_flows` for a draft `flows.json` (one covered flow per Playwright
   `describe`, plus uncovered route candidates); review and edit it by hand.
3. Write the reviewed document with `flowlens_write_flows` (validates schemaVersion 1).
4. Bring up the local test env (`flowlens_env_up`, dry-run first) if the flows need one.
5. For every flow with coverage `uncovered` or `partial`, implement the suggested Playwright
   spec (`flowlens_uncovered_tasks`, then `flowlens_implement_test` to launch the agent).
6. Run Playwright with the flowlens reporter so results land in a run JSON.
7. Ingest the results (`flowlens_ingest_results`) and rebuild the graph (`flowlens_build`).
8. Serve the viewer (`flowlens_serve`).

## Commands

```sh
npx flowlens-cli init --suite <repo-path> [--project <name>] [--data-dir <dir>] [--force]
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
      "nodes": [{ "id": "F1.login", "label": "Login", "kind": "interaction" }],
      "edges": [["F1.login", "F1.home"]],
      "tests": [{ "spec": "auth.spec.ts", "title": "signs in" }]
    }
  ],
  "moduleEdges": []
}
```

`coverage` is one of `covered|partial|uncovered`; node `kind` is one of
`interaction|backend|db|decision`. Coverage is derived from the Playwright report at
build time, so run the reporter and rebuild after adding specs.
