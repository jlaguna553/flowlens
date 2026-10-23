import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAgentInvocation, shellQuote, taskForFlow } from '../src/agent.mjs';
import { extractModel, modelCandidates, withModel } from '../src/models.mjs';

test('shellQuote handles Windows and POSIX paths', () => {
  assert.equal(shellQuote('C:\\repo', 'win32'), 'C:\\repo');
  assert.equal(shellQuote('C:\\repo path', 'win32'), '"C:\\repo path"');
  assert.equal(shellQuote("/tmp/repo path", 'linux'), "'/tmp/repo path'");
});

test('taskForFlow emits a Windows command with environment and isolated config', () => {
  const graph = {
    flows: [
      {
        id: 'F1',
        title: 'Checkout',
        coverage: 'uncovered',
        testTask: { suggestedSpecFile: 'checkout.spec.ts' },
      },
    ],
    nodes: [],
    agent: {
      suiteRoot: 'C:\\repo',
      outputDir: 'C:\\data\\out',
      specDir: 'C:\\data\\specs',
      playwrightConfig: 'C:\\data\\playwright.isolated.config.ts',
      nodePath: 'C:\\repo\\node_modules',
      reporterPath: 'C:\\repo\\src\\reporter.mjs',
      platform: 'win32',
    },
  };
  const task = taskForFlow(graph, 'F1');
  assert.ok(task);
  assert.match(task.reporterHint, /^cd \/d /);
  assert.match(task.reporterHint, /set "NODE_PATH=C:\\repo\\node_modules"/);
  assert.match(task.reporterHint, /set "FLOWLENS_RUN_OUTPUT=C:\\data\\out/);
  assert.match(task.reporterHint, /--config=C:\\data\\playwright\.isolated\.config\.ts/);
  assert.match(task.reporterHint, /--reporter=C:\\repo\\src\\reporter\.mjs/);
});

test('taskForFlow returns null for an unknown flow', () => {
  assert.equal(taskForFlow({ flows: [] }, 'missing'), null);
});

test('model helpers preserve and replace the model argument', () => {
  assert.equal(extractModel(['run', '--model', 'opencode/free', '{{prompt}}']), 'opencode/free');
  const updated = withModel(['run', '{{prompt}}'], 'opencode/free');
  assert.deepEqual(updated, ['run', '--model', 'opencode/free', '{{prompt}}']);
  assert.equal(modelCandidates({ preferred: 'opencode/free' })[0], 'opencode/free');
});

test('array argsTemplate is passed without shell interpolation', () => {
  const invocation = buildAgentInvocation(
    { command: 'opencode', argsTemplate: ['run', '--model', 'opencode/free', '{{prompt}}'] },
    'a prompt with spaces'
  );
  assert.equal(invocation.command, 'opencode');
  assert.deepEqual(invocation.args, ['run', '--model', 'opencode/free', 'a prompt with spaces']);
  assert.equal(invocation.shell, false);
});
