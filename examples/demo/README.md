# flowlens synthetic example

A minimal, committable example of the flowlens data format. It contains no real project
data, only one trivial flow ("Create an item") so the `flows.json` schema is visible.

Files:

- `flowlens.config.json` - points the suite at this directory and names the flows file.
- `flows.json` - one flow with `interaction`, `backend` and `decision` nodes.

Build it (writes to `examples/demo/out/`):

```sh
node ../../src/cli.mjs build --config examples/demo/flowlens.config.json
```

With no Playwright report present, build emits the flow graph without test results.

Schema rules:

- `schemaVersion` is `1`.
- A flow has `id`, `title`, `coverage` (`covered|partial|uncovered`), optional `actors`,
  `nodes` and `edges` (pairs of node ids).
- A node has `id`, `kind` (`interaction|backend|db|decision`) and `label`.
- `tests` links a flow to Playwright specs (`spec` + `title`). At build time coverage is
  derived from the Playwright report, so run the reporter and rebuild after adding specs.
