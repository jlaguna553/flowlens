import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import spawn from 'cross-spawn';

const MODEL_FLAG = '--model';
const PREFERRED_FREE = 'opencode/deepseek-v4.1-flash-free';

export function extractModel(argsTemplate) {
  if (Array.isArray(argsTemplate)) {
    const index = argsTemplate.indexOf(MODEL_FLAG);
    if (index >= 0 && index + 1 < argsTemplate.length) return String(argsTemplate[index + 1]);
    return null;
  }
  if (typeof argsTemplate === 'string') {
    const match = argsTemplate.match(/(?:^|\s)--model(?:\s+|=)("[^"]+"|'[^']+'|\S+)/);
    if (!match) return null;
    return match[1].replace(/^["']|["']$/g, '');
  }
  return null;
}

export function withModel(argsTemplate, model) {
  if (!model) return argsTemplate;
  if (Array.isArray(argsTemplate)) {
    const list = argsTemplate.map((entry) => String(entry));
    const index = list.indexOf(MODEL_FLAG);
    if (index >= 0) list.splice(index, index + 1 < list.length ? 2 : 1);
    const runIndex = list.indexOf('run');
    if (runIndex >= 0) list.splice(runIndex + 1, 0, MODEL_FLAG, String(model));
    else list.unshift(MODEL_FLAG, String(model));
    return list;
  }
  if (typeof argsTemplate === 'string') {
    if (/(?:^|\s)--model(?:\s+|=)/.test(argsTemplate)) {
      return argsTemplate.replace(
        /(?:^|\s)--model(?:\s+|=)("[^"]+"|'[^']+'|\S+)/,
        (match) => match.replace(/(--model\s+)(?:"[^"]+"|'[^']+'|\S+)/, `$1${model}`)
      );
    }
    return argsTemplate;
  }
  return argsTemplate;
}

function modelStateFiles() {
  const files = [];
  if (process.env.XDG_STATE_HOME) files.push(path.join(process.env.XDG_STATE_HOME, 'opencode', 'model.json'));
  if (process.env.LOCALAPPDATA) files.push(path.join(process.env.LOCALAPPDATA, 'opencode', 'model.json'));
  if (process.env.APPDATA) files.push(path.join(process.env.APPDATA, 'opencode', 'model.json'));
  files.push(path.join(os.homedir(), '.local', 'state', 'opencode', 'model.json'));
  return [...new Set(files)];
}

export function readRecentModels() {
  for (const file of modelStateFiles()) {
    try {
      if (!fs.existsSync(file)) continue;
      const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
      const recent = Array.isArray(doc && doc.recent) ? doc.recent : [];
      const models = recent
        .map((entry) => entry && entry.providerID && entry.modelID
          ? `${entry.providerID}/${entry.modelID}`
          : null)
        .filter(Boolean);
      if (models.length) return models;
    } catch {
      // Try the next known state location.
    }
  }
  return [];
}

export function listOpencodeModels(command = 'opencode', env = process.env) {
  const result = spawn.sync(command, ['models'], {
    encoding: 'utf8',
    timeout: 15000,
    env,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) return [];
  return String(result.stdout || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[\w.-]+\/[\w.-]+$/.test(line));
}

export function modelCandidates(options = {}) {
  const explicit = options.preferred || extractModel(options.argsTemplate);
  const available = options.available || [];
  const recent = options.recent || readRecentModels();
  const ordered = [];
  const add = (model) => {
    if (typeof model !== 'string' || !model || ordered.includes(model)) return;
    ordered.push(model);
  };
  add(explicit);
  recent.forEach(add);
  add(PREFERRED_FREE);
  available.filter((model) => /^opencode\/.*-free$/.test(model)).forEach(add);
  available.filter((model) => /^opencode\//.test(model)).forEach(add);
  available.filter((model) => /^opencode-go\//.test(model)).forEach(add);
  available.forEach(add);
  return ordered;
}

export function probeModel(command, model, options = {}) {
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 45000;
  return new Promise((resolve) => {
    let child;
    let output = '';
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    const timer = setTimeout(() => {
      try {
        if (child) child.kill('SIGTERM');
      } catch {
        void 0;
      }
      finish(false);
    }, timeoutMs);
    try {
      child = spawn(command, ['run', '--model', model, 'Reply with exactly: OK'], {
        cwd: options.cwd,
        env: options.env || process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch {
      finish(false);
      return;
    }
    if (child.stdout) child.stdout.on('data', (chunk) => { output += String(chunk); });
    if (child.stderr) child.stderr.on('data', (chunk) => { output += String(chunk); });
    child.on('error', () => finish(false));
    child.on('close', (code) => {
      const failedText = /unexpected server error|model not found|api key has expired|endpoint is unavailable|provider.*(?:error|unavailable)/i.test(output);
      finish(code === 0 && !failedText);
    });
  });
}

export async function chooseOpencodeModel(options = {}) {
  const command = options.command || 'opencode';
  const available = options.available || listOpencodeModels(command, options.env);
  const candidates = modelCandidates({ ...options, available });
  if (!candidates.length) return null;
  if (options.probe === false) {
    return { model: candidates[0], checked: false, candidates, available };
  }
  const maxProbes = Number(options.maxProbes) > 0 ? Number(options.maxProbes) : 5;
  const onLog = typeof options.onLog === 'function' ? options.onLog : () => {};
  for (const model of candidates.slice(0, maxProbes)) {
    onLog(`[flowlens] checking model ${model}...`);
    const ok = await probeModel(command, model, options);
    if (ok) {
      onLog(`[flowlens] using model ${model}`);
      return { model, checked: true, candidates, available };
    }
    onLog(`[flowlens] model ${model} is not reachable; trying next`);
  }
  return null;
}

export function persistModel(configPath, agent, model) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const current = config.agent && typeof config.agent === 'object' && !Array.isArray(config.agent)
      ? config.agent
      : {};
    config.agent = {
      ...current,
      command: agent.command,
      argsTemplate: agent.argsTemplate,
      model,
    };
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    return true;
  } catch {
    return false;
  }
}

export async function ensureOpencodeModel(options = {}) {
  const agent = options.agent;
  if (!agent || agent.command !== 'opencode' || options.disabled) return { agent, model: null };
  const preferred =
    options.preferred ||
    process.env.FLOWLENS_MODEL ||
    extractModel(agent.argsTemplate);
  const picked = await chooseOpencodeModel({
    command: agent.command,
    argsTemplate: agent.argsTemplate,
    preferred,
    cwd: options.cwd,
    env: { ...process.env, ...(agent.env || {}) },
    timeoutMs: options.timeoutMs,
    probe: options.probe !== false,
    onLog: options.onLog,
  });
  if (!picked) return { agent, model: null };
  const nextAgent = {
    ...agent,
    argsTemplate: withModel(agent.argsTemplate, picked.model),
    model: picked.model,
  };
  if (options.configPath) persistModel(options.configPath, nextAgent, picked.model);
  return { agent: nextAgent, model: picked.model, checked: picked.checked };
}
