import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { build } from '../src/build.mjs';

test('build matches an isolated spec outside the suite and derives coverage', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flowlens-build-'));
  try {
    const suite = path.join(root, 'suite');
    const data = path.join(root, 'data');
    const specDir = path.join(data, 'specs');
    fs.mkdirSync(suite, { recursive: true });
    fs.mkdirSync(specDir, { recursive: true });

    const configPath = path.join(data, 'flowlens.config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          suite,
          projectName: 'isolated-test',
          flows: 'flows.json',
          tests: { mode: 'isolated', dir: 'specs' },
          agent: { command: 'opencode', argsTemplate: ['run', '{{prompt}}'] },
        },
        null,
        2
      )
    );
    fs.writeFileSync(
      path.join(data, 'flows.json'),
      JSON.stringify(
        {
          schemaVersion: 1,
          project: 'isolated-test',
          suite: { root: '.', projectName: 'chromium' },
          flows: [
            {
              id: 'F1',
              title: 'Isolated smoke',
              coverage: 'uncovered',
              nodes: [{ id: 'run', label: 'Run isolated test', kind: 'interaction' }],
              edges: [],
              tests: [{ spec: 'passes.spec.ts', title: 'runs isolated' }],
            },
          ],
          moduleEdges: [],
        },
        null,
        2
      )
    );

    const runPath = path.join(data, 'run.json');
    fs.writeFileSync(
      runPath,
      JSON.stringify({
        tests: [
          {
            file: path.join(specDir, 'passes.spec.ts'),
            title: 'runs isolated',
            fullTitle: 'passes.spec.ts › runs isolated',
            project: '',
            outcome: 'expected',
            duration: 4,
            steps: [],
            attachments: [],
          },
        ],
      })
    );

    const result = build({ configPath, runPath });
    assert.equal(result.graph.flows[0].coverage, 'covered');
    assert.equal(result.graph.flows[0].tests[0].outcome, 'expected');
    assert.equal(result.graph.flows[0].tests[0].results.length, 1);
    assert.equal(result.graph.nodes[0].coverage, 'covered');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
