import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_DATA_DIR = path.join(os.homedir(), '.flowlens', 'projects');

export function resolveDataDir(explicit) {
  if (typeof explicit === 'string' && explicit) return path.resolve(explicit);
  const fromEnv = process.env.FLOWLENS_DATA_DIR;
  if (typeof fromEnv === 'string' && fromEnv) return path.resolve(fromEnv);
  return DEFAULT_DATA_DIR;
}

export function projectDir(dataDir, project) {
  return path.join(resolveDataDir(dataDir), String(project));
}

export function projectConfigPath(dataDir, project) {
  return path.join(projectDir(dataDir, project), 'flowlens.config.json');
}

export function resolveConfigPath(options = {}) {
  if (typeof options.configPath === 'string' && options.configPath) {
    return path.resolve(options.configPath);
  }
  const dataDir = resolveDataDir(options.dataDir);
  if (typeof options.project === 'string' && options.project) {
    return projectConfigPath(dataDir, options.project);
  }
  const cwdConfig = path.resolve('flowlens.config.json');
  if (fs.existsSync(cwdConfig)) return cwdConfig;
  const cwdProject = path.basename(process.cwd());
  const dataConfig = projectConfigPath(dataDir, cwdProject);
  if (fs.existsSync(dataConfig)) return dataConfig;
  return cwdConfig;
}
