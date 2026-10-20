import fs from 'node:fs';
import path from 'node:path';
import { unzip } from './zip.mjs';

const REPORT_TEMPLATE =
  /<template id="playwrightReportBase64"[^>]*>data:application\/zip;base64,([A-Za-z0-9+/=]+)<\/template>/;

function reportSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.map((step) => ({
    title: step.title,
    startMs: step.startTime ? Date.parse(step.startTime) : null,
    durationMs: typeof step.duration === 'number' ? step.duration : 0,
    children: reportSteps(step.steps),
  }));
}

function reportAttachment(attachment, reportDir) {
  const relPath = attachment.path ?? null;
  const absPath = relPath ? path.join(reportDir, relPath) : null;
  return {
    name: attachment.name,
    contentType: attachment.contentType ?? null,
    relPath,
    absPath,
    exists: absPath ? fs.existsSync(absPath) : false,
  };
}

function reportResult(result, reportDir) {
  return {
    retry: typeof result.retry === 'number' ? result.retry : 0,
    startMs: result.startTime ? Date.parse(result.startTime) : null,
    durationMs: typeof result.duration === 'number' ? result.duration : 0,
    steps: reportSteps(result.steps),
    attachments: (result.attachments ?? []).map((attachment) => reportAttachment(attachment, reportDir)),
  };
}

function reportTest(test, fallbackFile, reportDir) {
  return {
    file: test.location?.file ?? fallbackFile ?? null,
    title: test.title ?? null,
    project: test.projectName ?? null,
    outcome: test.outcome ?? null,
    results: (test.results ?? []).map((result) => reportResult(result, reportDir)),
  };
}

export function resolveFromReportModel(reportDir) {
  const indexHtml = fs.readFileSync(path.join(reportDir, 'index.html'), 'utf8');
  const match = indexHtml.match(REPORT_TEMPLATE);
  if (!match) throw new Error('playwrightReportBase64 template not found');

  const files = unzip(Buffer.from(match[1], 'base64'));
  const tests = [];

  for (const [name, data] of files) {
    if (!name.endsWith('.json')) continue;
    const model = JSON.parse(data.toString('utf8'));
    if (!Array.isArray(model.tests)) continue;
    for (const test of model.tests) {
      tests.push(reportTest(test, model.fileName, reportDir));
    }
  }

  return { source: 'report-model', tests };
}

function reporterResultStartMs(steps) {
  let earliest = null;
  const visit = (list) => {
    for (const step of list) {
      if (typeof step.startTime === 'number' && (earliest === null || step.startTime < earliest)) {
        earliest = step.startTime;
      }
      if (Array.isArray(step.steps)) visit(step.steps);
    }
  };
  visit(Array.isArray(steps) ? steps : []);
  return earliest;
}

function reporterSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.map((step) => ({
    title: step.title,
    startMs: typeof step.startTime === 'number' ? step.startTime : null,
    durationMs: typeof step.duration === 'number' ? step.duration : 0,
    children: reporterSteps(step.steps),
  }));
}

function reporterAttachment(attachment) {
  const absPath = attachment.path ?? null;
  return {
    name: attachment.name,
    contentType: attachment.contentType ?? null,
    relPath: null,
    absPath,
    exists:
      typeof attachment.exists === 'boolean'
        ? attachment.exists
        : absPath
          ? fs.existsSync(absPath)
          : false,
  };
}

function reporterResult(entry) {
  return {
    retry: typeof entry.retry === 'number' ? entry.retry : 0,
    startMs: reporterResultStartMs(entry.steps),
    durationMs: typeof entry.duration === 'number' ? entry.duration : 0,
    steps: reporterSteps(entry.steps),
    attachments: (entry.attachments ?? []).map(reporterAttachment),
  };
}

export function resolveFromReporterJson(runJsonPath) {
  const doc = JSON.parse(fs.readFileSync(runJsonPath, 'utf8'));
  const entries = Array.isArray(doc.tests) ? doc.tests : [];

  const groups = new Map();
  for (const entry of entries) {
    const identity = entry.fullTitle ?? entry.title ?? '';
    const key = `${entry.file ?? ''}\u0000${identity}\u0000${entry.project ?? ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }

  const tests = [];
  for (const group of groups.values()) {
    const first = group[0];
    const last = group[group.length - 1];
    tests.push({
      file: first.file ?? null,
      title: first.title ?? null,
      project: first.project ?? null,
      outcome: last.outcome ?? null,
      results: group.map(reporterResult),
    });
  }

  return { source: 'reporter', tests };
}
