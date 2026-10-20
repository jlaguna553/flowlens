import fs from 'node:fs';
import path from 'node:path';

function serializeSteps(steps) {
  if (!steps) return [];
  return steps.map((step) => ({
    title: step.title,
    startTime: step.startTime instanceof Date ? step.startTime.getTime() : null,
    duration: typeof step.duration === 'number' ? step.duration : 0,
    category: step.category,
    error: step.error ? String(step.error.message ?? step.error) : undefined,
    steps: serializeSteps(step.steps),
  }));
}

function serializeAttachments(attachments, outputDir) {
  if (!attachments) return [];
  return attachments.map((attachment) => {
    let absPath = null;
    if (attachment.path) {
      absPath = path.isAbsolute(attachment.path)
        ? attachment.path
        : path.resolve(outputDir, attachment.path);
    }
    return {
      name: attachment.name,
      contentType: attachment.contentType,
      path: absPath,
      exists: absPath ? fs.existsSync(absPath) : false,
    };
  });
}

class FlowLensReporter {
  constructor(options = {}) {
    this.options = options;
    this.outputFile = process.env.FLOWLENS_RUN_OUTPUT;
    if (!this.outputFile) {
      throw new Error(
        'FLOWLENS_RUN_OUTPUT is not set. The FlowLens reporter refuses to run without an output path.'
      );
    }
    this.outputFile = path.resolve(this.outputFile);

    this.results = [];
    this.startedAt = null;
    this.config = null;
    this.outputDir = null;
  }

  onBegin(config, suite) {
    this.config = config;
    this.startedAt = new Date();
    this.outputDir = config && config.rootDir ? config.rootDir : process.cwd();
  }

  onTestBegin(test, result) {}

  onTestEnd(test, result) {
    let file = test.location && test.location.file ? test.location.file : null;
    if (file && !path.isAbsolute(file)) file = path.resolve(this.outputDir, file);

    let project = null;
    try {
      project = test.parent && test.parent.project ? test.parent.project()?.name ?? null : null;
    } catch {
      project = null;
    }

    let outcome = null;
    try {
      outcome = test.outcome();
    } catch {
      outcome = result.status;
    }

    this.results.push({
      title: test.title,
      titlePath: test.titlePath(),
      fullTitle: test.titlePath().filter(Boolean).join(' › '),
      file,
      project,
      outcome,
      status: result.status,
      retry: result.retry,
      duration: result.duration,
      errors: (result.errors || []).map((error) => String((error && error.message) || error)),
      attachments: serializeAttachments(result.attachments, this.outputDir),
      steps: serializeSteps(result.steps, this.outputDir),
    });
  }

  async onEnd(result) {
    const doc = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      startedAt: this.startedAt ? this.startedAt.toISOString() : null,
      summary: {
        status: result.status,
        totalDurationMs:
          this.startedAt instanceof Date ? Date.now() - this.startedAt.getTime() : null,
        testCount: this.results.length,
      },
      config: this.config
        ? {
            rootDir: this.config.rootDir,
            configFile: this.config.configFile ?? null,
            version: this.config.version ?? null,
            projects: (this.config.projects || []).map((project) => ({ name: project.name })),
          }
        : null,
      tests: this.results,
    };

    fs.mkdirSync(path.dirname(this.outputFile), { recursive: true });
    fs.writeFileSync(this.outputFile, JSON.stringify(doc, null, 2), 'utf8');
    process.stderr.write(
      `[flowlens-reporter] wrote ${this.outputFile} (${this.results.length} results)\n`
    );
  }
}

export default FlowLensReporter;
