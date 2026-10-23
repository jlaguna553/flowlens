import { fileURLToPath } from "node:url";

export const VIS_NETWORK_FILE = fileURLToPath(new URL("./vendor/vis-network.min.js", import.meta.url));

export const DEFAULT_VENDOR_HREF = "./vendor/vis-network.min.js";

export interface FlowlensResponse {
  status?: unknown;
  mimeType?: unknown;
  size?: unknown;
  preview?: unknown;
  [key: string]: unknown;
}

export interface FlowlensNode {
  id: string | number;
  label?: string;
  flow?: string;
  flowName?: string;
  flows?: (string | number)[];
  flowNames?: string[];
  community?: string | number;
  kind?: string;
  coverage?: string;
  shared?: boolean;
  sourceRef?: string;
  endpoint?: string;
  file?: string;
  line?: number;
  component?: string;
  selector?: string;
  payloadExample?: unknown;
  table?: string;
  dbFields?: string[];
  payload?: unknown;
  response?: FlowlensResponse;
  [key: string]: unknown;
}

export interface FlowlensLink {
  from?: string | number;
  to?: string | number;
  source?: string | number;
  target?: string | number;
  label?: string;
  relation?: string;
  flows?: (string | number)[];
  [key: string]: unknown;
}

export interface FlowlensAttachment {
  name?: string;
  contentType?: string;
  artifact?: string;
  exists?: boolean;
  [key: string]: unknown;
}

export interface FlowlensTimelineEntry {
  node?: string | number;
  startMs?: number;
  endMs?: number;
  stepTitle?: string;
  approx?: boolean;
  [key: string]: unknown;
}

export interface FlowlensTimeline {
  videoArtifact?: string;
  videoBaseMs?: number;
  entries?: FlowlensTimelineEntry[];
  [key: string]: unknown;
}

export interface FlowlensResult {
  retry?: number;
  startMs?: number;
  durationMs?: number;
  attachments?: FlowlensAttachment[];
  timeline?: FlowlensTimeline;
  screenshotSrc?: string;
  [key: string]: unknown;
}

export interface FlowlensTest {
  spec?: string;
  title?: string;
  outcome?: string;
  results?: FlowlensResult[];
  [key: string]: unknown;
}

export interface FlowlensTestTaskNode {
  id?: string;
  label?: string;
  kind?: string;
  [key: string]: unknown;
}

export interface FlowlensTestTask {
  suggestedSpecFile?: string;
  acceptance?: unknown[];
  nodes?: FlowlensTestTaskNode[];
  [key: string]: unknown;
}

export interface FlowlensAgent {
  reporterPath?: string;
  suiteRoot?: string;
  outputDir?: string;
  specDir?: string;
  specMode?: string;
  playwrightConfig?: string;
  nodePath?: string;
  platform?: string;
  [key: string]: unknown;
}

export interface FlowlensFlow {
  id?: string | number;
  name?: string;
  title?: string;
  coverage?: string;
  notes?: string;
  tests?: FlowlensTest[];
  testTask?: FlowlensTestTask;
  mermaid?: string;
  [key: string]: unknown;
}

export interface FlowlensArtifact {
  absPath?: string;
  contentType?: string;
  name?: string;
  [key: string]: unknown;
}

export interface FlowlensGraph {
  nodes?: FlowlensNode[];
  links?: FlowlensLink[];
  edges?: FlowlensLink[];
  flows?: FlowlensFlow[];
  artifacts?: Record<string, FlowlensArtifact>;
  agent?: FlowlensAgent;
  [key: string]: unknown;
}

export interface RenderOptions {
  title?: string;
  vendorHref?: string;
  mermaidHref?: string;
  graph3dHref?: string;
}

const FLOW_PALETTE = ["#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F", "#EDC948", "#B07AA1", "#FF9DA7", "#9C755F", "#BAB0AC"];

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

const MAX_LABEL_LEN = 256;

const KIND_COLORS: Record<string, string> = { backend: "#4C6EF5", db: "#E8A33D", decision: "#B07AA1" };

const KIND_LABELS: Record<string, string> = { interaction: "Front", backend: "Back", db: "BD", decision: "Decision" };

const NODE_SIZE = 26;

const NODE_FONT_SIZE = 12;

const KIND_ORDER = ["interaction", "backend", "db", "decision"];

const SHARED_FILL = "#8A8F98";
const SHARED_BORDER = "#5B6068";

export function sanitizeLabel(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  let text = String(value).replace(CONTROL_CHARS, "");
  if (text.length > MAX_LABEL_LEN) {
    text = text.slice(0, MAX_LABEL_LEN);
  }
  return text;
}

export function sanitizeDiagram(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, 20000);
}

export function sanitizeExample(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.slice(0, 4000);
  try {
    return JSON.stringify(value, null, 2).slice(0, 4000);
  } catch {
    return "";
  }
}

export function sanitizeStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => sanitizeLabel(entry)).filter(Boolean) : [];
}

export function jsSafe(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function escHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeColor(value: unknown, fallback: string): string {
  const text = String(value ?? "");
  return /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(text) ? text : fallback;
}

function resolveFlow(node: FlowlensNode): string {
  const raw = node.flow ?? node.community ?? "unassigned";
  return sanitizeLabel(raw) || "unassigned";
}

function normalizeKind(value: unknown): string {
  const kind = sanitizeLabel(value).toLowerCase();
  return kind === "backend" || kind === "db" || kind === "decision" ? kind : "interaction";
}

function normalizeResponse(value: unknown): { status: string; mimeType: string; size: number | null; preview: string } | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const status = sanitizeLabel(raw.status ?? "");
  const mimeType = sanitizeLabel(raw.mimeType ?? "");
  const preview = sanitizeLabel(raw.preview ?? "");
  const sizeNum = Number(raw.size);
  const size = Number.isFinite(sizeNum) && sizeNum >= 0 ? Math.round(sizeNum) : null;
  if (!status && !mimeType && size === null && !preview) {
    return null;
  }
  return { status, mimeType, size, preview };
}

function glyphColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
    return "#ffffff";
  }
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#16162a" : "#ffffff";
}

function iconInner(kind: string, glyph: string, bg: string): string {
  if (kind === "backend") {
    return '<g fill="' + glyph + '"><rect x="8.5" y="6.5" width="15" height="7" rx="2.2"/><rect x="8.5" y="18.5" width="15" height="7" rx="2.2"/></g><circle cx="12" cy="10" r="1.3" fill="' + bg + '"/><circle cx="12" cy="22" r="1.3" fill="' + bg + '"/>';
  }
  if (kind === "db") {
    return '<ellipse cx="16" cy="9" rx="7.5" ry="3.2" fill="' + glyph + '"/><path d="M8.5 9 V22.5 a7.5 3.2 0 0 0 15 0 V9" fill="none" stroke="' + glyph + '" stroke-width="2.6"/><path d="M8.5 15.5 a7.5 3.2 0 0 0 15 0" fill="none" stroke="' + glyph + '" stroke-width="2.2"/>';
  }
  if (kind === "decision") {
    return '<rect x="9.5" y="9.5" width="13" height="13" rx="2.5" fill="none" stroke="' + glyph + '" stroke-width="2.6" transform="rotate(45 16 16)"/>';
  }
  return '<path d="M14.5 6 L14.5 24.5 L19.7 19.2 L23.5 26.5 L26.7 25 L22.8 17.6 L29 17.6 Z" fill="' + glyph + '"/>';
}

function iconSvg(kind: string, bg: string): string {
  const glyph = glyphColor(bg);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + NODE_SIZE + '" height="' + NODE_SIZE + '" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="' + bg + '"/>' + iconInner(kind, glyph, bg) + "</svg>";
  return "data:image/svg+xml;base64," + Buffer.from(svg, "utf8").toString("base64");
}

function endpointId(link: FlowlensLink, primary: string, alternate: string): string | null {
  const value = link[primary] ?? link[alternate];
  return value === null || value === undefined ? null : String(value);
}

function instanceOfLinkArray(value: unknown): FlowlensLink[] {
  return Array.isArray(value) ? value : [];
}

function buildPayload(graph: FlowlensGraph) {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const links = graph.links !== undefined ? instanceOfLinkArray(graph.links) : instanceOfLinkArray(graph.edges);

  const flowNames = new Map<string, string>();
  const flowCoverage = new Map<string, string>();
  if (Array.isArray(graph.flows)) {
    for (const flow of graph.flows) {
      if (!flow || flow.id === null || flow.id === undefined) {
        continue;
      }
      const id = sanitizeLabel(flow.id);
      if (id) {
        flowNames.set(id, sanitizeLabel(flow.title ?? flow.name ?? id) || id);
        flowCoverage.set(id, sanitizeLabel(flow.coverage ?? ""));
      }
    }
  }

  const degree = new Map<string, number>();
  for (const link of links) {
    const from = endpointId(link, "from", "source");
    const to = endpointId(link, "to", "target");
    if (from !== null) {
      degree.set(from, (degree.get(from) ?? 0) + 1);
    }
    if (to !== null) {
      degree.set(to, (degree.get(to) ?? 0) + 1);
    }
  }
  const order: string[] = [];
  const seenFlows = new Set<string>();
  for (const node of nodes) {
    const flow = resolveFlow(node);
    if (!seenFlows.has(flow)) {
      seenFlows.add(flow);
      order.push(flow);
    }
  }
  const flowIndex = new Map<string, number>();
  order.forEach((flow, index) => flowIndex.set(flow, index));

  const visNodes: unknown[] = [];
  const seenNodeIds = new Set<string>();
  for (const node of nodes) {
    const id = node.id === null || node.id === undefined ? "" : String(node.id);
    if (seenNodeIds.has(id)) {
      continue;
    }
    seenNodeIds.add(id);
    const label = sanitizeLabel(node.label ?? id) || id;
    const flow = resolveFlow(node);
    const kind = normalizeKind(node.kind);
    const shared = node.shared === true;
    const flowColor = FLOW_PALETTE[(flowIndex.get(flow) ?? 0) % FLOW_PALETTE.length];
    const baseColor = shared ? SHARED_FILL : (KIND_COLORS[kind] ?? flowColor);
    const frameColor = shared ? SHARED_BORDER : baseColor;
    const deg = degree.get(id) ?? 0;
    visNodes.push({
      id,
      label,
      color: { background: baseColor, border: frameColor, highlight: { background: "#ffffff", border: frameColor } },
      size: NODE_SIZE,
      shape: "image",
      image: iconSvg(kind, baseColor),
      shapeProperties: shared ? { useImageSize: true, useBorderWithImage: true, borderDashes: [4, 3] } : { useImageSize: true, useBorderWithImage: true },
      borderWidth: shared ? 3 : 1.5,
      font: { size: NODE_FONT_SIZE, color: "#ffffff" },
      title: label,
      flow,
      flowName: flowNames.get(flow) ?? flow,
      flows: Array.isArray(node.flows) && node.flows.length
        ? node.flows.map(function (f) { return sanitizeLabel(f); }).filter(Boolean)
        : [flow],
      flowNames: Array.isArray(node.flowNames) && node.flowNames.length
        ? node.flowNames.map(function (f) { return sanitizeLabel(f); }).filter(Boolean)
        : [flowNames.get(flow) ?? flow],
      kind,
      shared,
      coverage: sanitizeLabel(node.coverage ?? ""),
      endpoint: sanitizeLabel(node.endpoint ?? ""),
      file: sanitizeLabel(node.file ?? ""),
      line: Number.isInteger(Number(node.line)) && Number(node.line) > 0 ? Number(node.line) : null,
      component: sanitizeLabel(node.component ?? ""),
      selector: sanitizeLabel(node.selector ?? ""),
      payloadExample: sanitizeExample(node.payloadExample),
      table: sanitizeLabel(node.table ?? ""),
      dbFields: sanitizeStringList(node.dbFields),
      payload: sanitizeLabel(node.payload ?? ""),
      response: normalizeResponse(node.response),
      degree: deg,
    });
  }

  const counts = new Map<string, number>();
  const kindCounts = new Map<string, number>();
  const nodeCoverage = new Map<string, string>();
  let sharedCount = 0;
  for (const node of visNodes) {
    const item = node as { flow: string; flows?: string[]; kind: string; shared: boolean; coverage: string };
    const itemFlows = Array.isArray(item.flows) && item.flows.length ? item.flows : [item.flow];
    for (const flow of itemFlows) {
      counts.set(flow, (counts.get(flow) ?? 0) + 1);
      if (item.coverage && !nodeCoverage.has(flow)) nodeCoverage.set(flow, item.coverage);
    }
    kindCounts.set(item.kind, (kindCounts.get(item.kind) ?? 0) + 1);
    if (item.shared) sharedCount += 1;
  }

  const legend = order.map((flow) => {
    const index = flowIndex.get(flow) ?? 0;
    return {
      cid: flow,
      color: FLOW_PALETTE[index % FLOW_PALETTE.length],
      label: flowNames.get(flow) ?? flow,
      count: counts.get(flow) ?? 0,
      coverage: flowCoverage.get(flow) ?? nodeCoverage.get(flow) ?? "",
    };
  });

  const kinds = KIND_ORDER.filter((kind) => (kindCounts.get(kind) ?? 0) > 0).map((kind) => {
    const color = KIND_COLORS[kind] ?? FLOW_PALETTE[0];
    return { cid: kind, shape: "image", image: iconSvg(kind, color), color, label: KIND_LABELS[kind], count: kindCounts.get(kind) ?? 0 };
  });
  if (sharedCount > 0) {
    kinds.push({ cid: "shared", shape: "image", image: iconSvg("interaction", SHARED_FILL), color: SHARED_FILL, label: "Shared", count: sharedCount });
  }

  const visEdges = links.map((link) => {
    const from = endpointId(link, "from", "source");
    const to = endpointId(link, "to", "target");
    const relation = sanitizeLabel(link.relation ?? link.label ?? "");
    const color = safeColor(link.color, "#8892a6");
    return {
      from: from ?? "",
      to: to ?? "",
      label: relation,
      title: relation,
      dashes: false,
      width: 2,
      color: { color, opacity: 0.7 },
      flows: Array.isArray(link.flows)
        ? link.flows.map(function (f) { return sanitizeLabel(f); }).filter(Boolean)
        : [],
    };
  });

  return { nodes: visNodes, edges: visEdges, legend, kinds };
}

const TRACE_PREFIX = "/_pw/trace/";
const TRACE_VIEWER = TRACE_PREFIX + "index.html";
const ARTIFACT_PREFIX = "/api/artifact/";
const SAFE_ARTIFACT_ID = /^[A-Za-z0-9._-]{1,128}$/;

function toMillis(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function safeArtifactId(value: unknown, known: Set<string>): string | null {
  if (typeof value !== "string" || !SAFE_ARTIFACT_ID.test(value)) {
    return null;
  }
  if (known.size > 0 && !known.has(value)) {
    return null;
  }
  return value;
}

function artifactUrl(id: string): string {
  return ARTIFACT_PREFIX + encodeURIComponent(id);
}

function traceUrl(id: string): string {
  return TRACE_VIEWER + "?trace=" + artifactUrl(id);
}

function sanitizeTestTask(value: unknown): { suggestedSpecFile: string; acceptance: string[]; nodes: { id: string; label: string; kind: string }[] } | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const acceptanceIn = Array.isArray(raw.acceptance) ? raw.acceptance : [];
  const acceptance: string[] = [];
  for (const item of acceptanceIn) {
    const text = sanitizeLabel(item);
    if (text) {
      acceptance.push(text);
    }
  }
  const nodesIn = Array.isArray(raw.nodes) ? raw.nodes : [];
  const nodes: { id: string; label: string; kind: string }[] = [];
  for (const node of nodesIn) {
    const item = node && typeof node === "object" ? node as Record<string, unknown> : {};
    const id = sanitizeLabel(item.id ?? "");
    const label = sanitizeLabel(item.label ?? item.id ?? "");
    if (!id && !label) {
      continue;
    }
    nodes.push({ id, label: label || id, kind: sanitizeLabel(item.kind ?? "") });
  }
  return { suggestedSpecFile: sanitizeLabel(raw.suggestedSpecFile ?? ""), acceptance, nodes };
}

function sanitizeAgent(value: unknown): { reporterPath: string; suiteRoot: string; outputDir: string; specDir: string } {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    reporterPath: sanitizeLabel(raw.reporterPath ?? ""),
    suiteRoot: sanitizeLabel(raw.suiteRoot ?? ""),
    outputDir: sanitizeLabel(raw.outputDir ?? ""),
    specDir: sanitizeLabel(raw.specDir ?? ""),
    specMode: sanitizeLabel(raw.specMode ?? ""),
    playwrightConfig: sanitizeLabel(raw.playwrightConfig ?? ""),
    nodePath: sanitizeLabel(raw.nodePath ?? ""),
    platform: sanitizeLabel(raw.platform ?? ""),
  };
}

function buildEvidence(graph: FlowlensGraph) {
  const flowsIn: FlowlensFlow[] = Array.isArray(graph.flows) ? graph.flows : [];
  const artifacts = graph.artifacts && typeof graph.artifacts === "object" ? graph.artifacts : {};
  const known = new Set<string>(Object.keys(artifacts));
  const agent = sanitizeAgent(graph.agent);
  const flows: unknown[] = [];

  for (const flow of flowsIn) {
    if (!flow || flow.id === null || flow.id === undefined) {
      continue;
    }
    const id = sanitizeLabel(flow.id);
    if (!id) {
      continue;
    }
    const testsIn: FlowlensTest[] = Array.isArray(flow.tests) ? flow.tests : [];
    const tests: unknown[] = [];

    for (const test of testsIn) {
      if (!test) {
        continue;
      }
      const resultsIn: FlowlensResult[] = Array.isArray(test.results) ? test.results : [];
      const results: unknown[] = [];
      const timeline = test.timeline && typeof test.timeline === "object" ? test.timeline : {};

      for (const result of resultsIn) {
        if (!result) {
          continue;
        }
        const entriesIn: FlowlensTimelineEntry[] = Array.isArray(timeline.entries) ? timeline.entries : [];
        const entries: unknown[] = [];
        for (const entry of entriesIn) {
          if (!entry || entry.node === null || entry.node === undefined) {
            continue;
          }
          const startMs = toMillis(entry.startMs);
          const endMs = toMillis(entry.endMs);
          entries.push({
            node: sanitizeLabel(entry.node),
            startMs,
            endMs: endMs >= startMs ? endMs : startMs,
            stepTitle: sanitizeLabel(entry.stepTitle ?? ""),
            approx: entry.approx === true,
          });
        }

        const attachmentsIn: FlowlensAttachment[] = Array.isArray(result.attachments) ? result.attachments : [];
        let videoId = safeArtifactId(timeline.videoArtifact, known);
        let traceId: string | null = null;
        let shotId: string | null = null;
        for (const attachment of attachmentsIn) {
          if (!attachment) {
            continue;
          }
          const name = sanitizeLabel(attachment.name ?? "").toLowerCase();
          const artifact = safeArtifactId(attachment.artifact, known);
          if (!artifact) {
            continue;
          }
          if (name === "video" && !videoId) {
            videoId = artifact;
          }
          if (name === "trace" && !traceId) {
            traceId = artifact;
          }
          if ((name === "screenshot" || name === "image") && !shotId) {
            shotId = artifact;
          }
        }

        results.push({
          retry: toMillis(result.retry),
          videoBaseMs: toMillis(timeline.videoBaseMs),
          videoSrc: videoId ? artifactUrl(videoId) : null,
          traceSrc: traceId ? traceUrl(traceId) : null,
          screenshotSrc: shotId ? artifactUrl(shotId) : null,
          entries,
        });
      }

      tests.push({
        spec: sanitizeLabel(test.spec ?? ""),
        title: sanitizeLabel(test.title ?? ""),
        outcome: sanitizeLabel(test.outcome ?? ""),
        results,
      });
    }

    flows.push({
      id,
      title: sanitizeLabel(flow.title ?? flow.name ?? id) || id,
      coverage: sanitizeLabel(flow.coverage ?? ""),
      notes: sanitizeLabel(flow.notes ?? ""),
      mermaid: sanitizeDiagram(flow.mermaid ?? ""),
      tests,
      testTask: sanitizeTestTask(flow.testTask),
    });
  }

  return { tracePrefix: TRACE_PREFIX, artifactPrefix: ARTIFACT_PREFIX, agent, flows };
}

function styles(): string {
  return `<style>
  :root {
    --bg: #0f0f1a; --panel: #1a1a2e; --border: #2a2a4e; --input-border: #3a3a5e;
    --text: #e0e0e0; --text-2: #aaa; --text-3: #ccc; --muted: #555; --count: #666;
    --neighbor-border: #333; --node-label: #ffffff;
  }
  [data-theme="light"] {
    --bg: #ffffff; --panel: #f8f9fa; --border: #d9dee5; --input-border: #c3cad4;
    --text: #222222; --text-2: #666666; --text-3: #333333; --muted: #888888; --count: #777777;
    --neighbor-border: #ccc; --node-label: #222222;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; display: flex; height: 100vh; overflow: hidden; }
  #graph { flex: 1; min-width: 0; position: relative; }
  #resize-handle { width: 6px; flex-shrink: 0; cursor: col-resize; background: var(--border); position: relative; z-index: 5; }
  #resize-handle:hover, #resize-handle:focus-visible, #resize-handle.dragging { background: #4E79A7; outline: none; }
  .sidebar-divider { height: 6px; flex: 0 0 auto; cursor: row-resize; background: var(--border); position: relative; z-index: 4; touch-action: none; }
  .sidebar-divider::after { content: ''; position: absolute; left: 50%; top: 2px; width: 34px; height: 2px; margin-left: -17px; border-radius: 1px; background: var(--input-border); }
  .sidebar-divider:hover, .sidebar-divider:focus-visible, .sidebar-divider.dragging { background: #4E79A7; outline: none; }
  #sidebar { width: 420px; flex-shrink: 0; background: var(--panel); border-left: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
  #theme-wrap, #search-wrap, #playback-bar, #kinds-legend-wrap, #stats { flex: 0 0 auto; }
  #theme-wrap { display: flex; gap: 4px; padding: 8px 12px; border-bottom: 1px solid var(--border); align-items: center; }
  #theme-wrap button { flex: 1; background: var(--bg); color: var(--text-2); border: 1px solid var(--input-border); border-radius: 4px; padding: 4px 0; font-size: 11px; cursor: pointer; }
  #lang-select { flex: 0 0 auto; background: var(--bg); color: var(--text-2); border: 1px solid var(--input-border); border-radius: 4px; padding: 4px 2px; font-size: 10px; cursor: pointer; }
  #sidebar-hide { flex: 0 0 auto; background: var(--bg); color: var(--text-2); border: 1px solid var(--input-border); border-radius: 4px; padding: 4px 7px; font-size: 13px; line-height: 1; cursor: pointer; }
  #sidebar-hide:hover, #lang-select:hover { color: var(--text); border-color: #4E79A7; }
  #sidebar-show { position: fixed; top: 14px; right: 14px; z-index: 35; display: none; align-items: center; justify-content: center; width: 32px; height: 30px; background: var(--panel); color: var(--text-2); border: 1px solid var(--border); border-radius: 6px; box-shadow: 0 4px 14px rgba(0,0,0,0.25); font-size: 15px; cursor: pointer; }
  #sidebar-show:hover { color: var(--text); border-color: #4E79A7; }
  body.sidebar-collapsed #sidebar, body.sidebar-collapsed #resize-handle { display: none; }
  body.sidebar-collapsed #sidebar-show { display: inline-flex; }
  #theme-wrap button:hover { color: var(--text); }
  #theme-wrap button[aria-pressed="true"] { background: #4E79A7; border-color: #4E79A7; color: #fff; }
  #search-wrap { padding: 12px; border-bottom: 1px solid var(--border); }
  #search { width: 100%; background: var(--bg); border: 1px solid var(--input-border); color: var(--text); padding: 7px 10px; border-radius: 6px; font-size: 13px; outline: none; }
  #search:focus { border-color: #4E79A7; }
  #search-results { max-height: 140px; overflow-y: auto; padding: 4px 12px; border-bottom: 1px solid var(--border); display: none; }
  .search-item { padding: 4px 6px; cursor: pointer; border-radius: 4px; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .search-item:hover { background: var(--border); }
  #info-panel { padding: 12px 14px; border-bottom: 1px solid var(--border); flex: 0 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
  #info-panel h3, #legend-wrap h3 { font-size: 13px; color: var(--text-2); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; flex: 0 0 auto; }
  #info-content { font-size: 13px; color: var(--text-3); line-height: 1.6; flex: 1 1 auto; min-height: 0; overflow-y: auto; }
  #info-content .field { margin-bottom: 5px; }
  #info-content .field b { color: var(--text); }
  #info-content .empty { color: var(--muted); font-style: italic; }
  #info-content .info-code { margin: 4px 0 6px; padding: 8px; max-height: 180px; overflow: auto; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
  .node-shot-media { display: block; width: 100%; max-height: 170px; margin: 4px 0 8px; object-fit: contain; background: #000; border: 1px solid var(--border); border-radius: 6px; }
  .node-modal-body .node-shot-media { max-height: 360px; }
  .neighbor-link { display: block; padding: 2px 6px; margin: 2px 0; border-radius: 3px; cursor: pointer; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-left: 3px solid var(--neighbor-border); }
  .neighbor-link:hover { background: var(--border); }
  #neighbors-list { max-height: 160px; overflow-y: auto; margin-top: 4px; }
  #legend-wrap { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 12px; }
  #kinds-legend-wrap { padding: 10px 12px 4px; border-top: 1px solid var(--border); min-height: 0; overflow-y: auto; }
  #kinds-legend-wrap h3 { font-size: 13px; color: var(--text-2); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
  .kind-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 12px; }
  .kind-icon { width: 16px; height: 16px; flex-shrink: 0; display: block; }
  #legend-controls { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding: 4px 0; flex-wrap: wrap; }
  #legend-controls label { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; color: var(--text-2); user-select: none; }
  #legend-controls label:hover { color: var(--text); }
  .legend-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer; border-radius: 4px; font-size: 12px; }
  .legend-item:hover { background: var(--border); padding-left: 4px; }
  .legend-item.dimmed { opacity: 0.35; }
  .legend-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
  .legend-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .legend-id { flex-shrink: 0; font-size: 10px; color: var(--text-2); background: var(--border); border-radius: 3px; padding: 1px 5px; line-height: 1.4; }
  .legend-item[hidden] { display: none; }
  .legend-count { color: var(--count); font-size: 11px; }
  .legend-cb, #select-all-cb { appearance: none; -webkit-appearance: none; width: 14px; height: 14px; border: 1.5px solid var(--input-border); border-radius: 3px; background: var(--bg); cursor: pointer; position: relative; flex-shrink: 0; }
  .legend-cb:checked, #select-all-cb:checked { background: #4E79A7; border-color: #4E79A7; }
  .legend-cb:checked::after, #select-all-cb:checked::after { content: ''; position: absolute; left: 3.5px; top: 1px; width: 4px; height: 7px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg); }
  #select-all-cb:indeterminate { background: #4E79A7; border-color: #4E79A7; }
  #select-all-cb:indeterminate::after { content: ''; position: absolute; left: 2px; top: 5px; width: 8px; height: 2px; background: #fff; border: none; transform: none; }
  #stats { padding: 10px 14px; border-top: 1px solid var(--border); font-size: 11px; color: var(--muted); margin-top: auto; }
  .collapsible-section.collapsed > :not(.section-header) { display: none; }
  .section-header { display: flex; align-items: center; gap: 6px; width: 100%; background: none; border: none; color: var(--text-2); font: inherit; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; padding: 0; margin-bottom: 8px; text-align: left; flex: 0 0 auto; }
  .section-header:hover { color: var(--text); }
  .section-header:focus-visible { outline: 1px solid #4E79A7; outline-offset: 2px; }
  .collapsible-section.collapsed .section-header { margin-bottom: 0; }
  .section-chevron { flex-shrink: 0; width: 0; height: 0; border-left: 5px solid currentColor; border-top: 4px solid transparent; border-bottom: 4px solid transparent; transform: rotate(90deg); transition: transform 0.15s ease; }
  .collapsible-section.collapsed .section-chevron { transform: rotate(0deg); }
  #evidence-panel .section-header { padding: 12px 14px 0; margin-bottom: 0; }
  #coverage-filter { margin-left: auto; background: var(--bg); color: var(--text); border: 1px solid var(--input-border); border-radius: 4px; padding: 3px 6px; font-size: 11px; cursor: pointer; outline: none; }
  #coverage-filter:focus { border-color: #4E79A7; }
  #flow-focus-clear { background: var(--bg); color: var(--text-2); border: 1px solid var(--input-border); border-radius: 4px; padding: 3px 8px; font-size: 11px; cursor: pointer; }
  #flow-focus-clear:hover { color: var(--text); border-color: #4E79A7; }
  #flow-focus-clear[hidden] { display: none; }
  .legend-item.focused { background: rgba(78,121,167,0.22); }
  #playback-bar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-top: 1px solid var(--border); background: var(--panel); }
  #play-toggle { flex: 0 0 auto; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; background: var(--bg); color: var(--text); border: 1px solid var(--input-border); border-radius: 6px; cursor: pointer; }
  #play-toggle:hover { border-color: #4E79A7; color: #4E79A7; }
  #play-toggle[disabled] { opacity: 0.4; cursor: default; }
  #play-toggle svg { display: block; }
  #play-scrubber { flex: 1 1 auto; min-width: 0; accent-color: #4E79A7; cursor: pointer; }
  #play-scrubber[disabled] { opacity: 0.4; cursor: default; }
  #play-time { flex: 0 0 auto; font-size: 11px; color: var(--text-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
  #play-speed { flex: 0 0 auto; background: var(--bg); color: var(--text); border: 1px solid var(--input-border); border-radius: 6px; padding: 3px 6px; font-size: 11px; cursor: pointer; outline: none; }
  #evidence-panel { border-top: 1px solid var(--border); display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; overflow: hidden; }
  #evidence-panel h3 { font-size: 13px; color: var(--text-2); padding: 12px 14px 0; text-transform: uppercase; letter-spacing: 0.05em; }
  #evidence-tabs-row { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-bottom: 1px solid var(--border); flex: 0 0 auto; }
  #evidence-tabs { display: flex; gap: 4px; flex: 1 1 auto; min-width: 0; }
  .ev-float-btn { flex: 0 0 auto; background: var(--bg); color: var(--text-2); border: 1px solid var(--input-border); border-radius: 4px; padding: 5px 8px; font-size: 11px; line-height: 1; cursor: pointer; white-space: nowrap; }
  .ev-float-btn:hover { color: var(--text); border-color: #4E79A7; }
  .ev-float-btn:focus-visible { outline: 2px solid #4E79A7; outline-offset: 2px; }
  .ev-float-btn[hidden] { display: none; }
  .ev-tab { flex: 1; min-width: 0; background: var(--bg); color: var(--text-2); border: 1px solid var(--input-border); border-radius: 4px; padding: 5px 2px; font-size: 10px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ev-tab:hover { color: var(--text); }
  .ev-tab[aria-pressed="true"] { background: #4E79A7; border-color: #4E79A7; color: #fff; }
  .ev-tab[hidden] { display: none; }
  #evidence-body { padding: 10px 12px 14px; overflow-y: auto; min-height: 0; flex: 1 1 auto; }
  #evidence-body.ev-body-trace { display: flex; flex-direction: column; overflow: hidden; }
  #evidence-body.ev-body-video { display: flex; flex-direction: column; overflow: hidden; }
  .ev-flow { font-size: 12px; color: var(--text); margin-bottom: 2px; }
  .ev-note { font-size: 11px; color: var(--muted); margin-bottom: 8px; }
  .ev-empty { font-size: 12px; color: var(--muted); font-style: italic; }
  .ev-test-select { width: 100%; background: var(--bg); border: 1px solid var(--input-border); color: var(--text); border-radius: 6px; padding: 5px 8px; font-size: 12px; margin-bottom: 8px; outline: none; }
  .ev-video-wrap { flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; }
  .ev-video { display: block; width: auto; height: auto; max-width: 100%; max-height: 100%; object-fit: contain; background: #000; border-radius: 6px; }
  .ev-trace { width: 100%; height: 60vh; min-height: 420px; border: 1px solid var(--border); border-radius: 6px; background: #fff; }
  .ev-body-trace .ev-trace { flex: 1 1 auto; height: auto; min-height: 420px; }
  .ev-steps { list-style: none; display: flex; flex-direction: column; gap: 2px; }
  .ev-step { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 5px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; color: var(--text-3); border-left: 3px solid transparent; }
  .ev-step:hover { background: var(--border); }
  .ev-step.active { background: rgba(99, 102, 241, 0.25); color: var(--text); border-left-color: #6366f1; }
  .ev-step-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ev-step-dur { flex-shrink: 0; color: var(--count); font-size: 11px; }
  .ev-impl { margin: 8px 0 4px; padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); }
  .ev-impl-title { font-size: 12px; font-weight: 600; color: var(--text); margin-bottom: 6px; }
  .ev-impl-sub { font-size: 11px; color: var(--text-2); margin: 8px 0 4px; text-transform: uppercase; letter-spacing: 0.04em; }
  .ev-impl-list { list-style: disc; margin: 0 0 0 18px; font-size: 12px; color: var(--text-3); line-height: 1.5; }
  .ev-cmd { display: block; margin: 6px 0; padding: 8px; background: var(--panel); border: 1px solid var(--border); border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: var(--text); white-space: pre-wrap; word-break: break-word; }
  .ev-run { margin: 8px 0 10px; padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); }
  .ev-run-btn { width: 100%; background: #4E79A7; color: #ffffff; border: 1px solid #4E79A7; border-radius: 6px; padding: 8px 12px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .ev-run-btn:hover:not([disabled]) { background: #3d6390; border-color: #3d6390; }
  .ev-run-btn[disabled] { opacity: 0.5; cursor: default; }
  .ev-run-btn:focus-visible { outline: 2px solid #4E79A7; outline-offset: 2px; }
  .ev-run-status { font-size: 12px; color: var(--text-3); margin: 8px 0 4px; }
  .ev-run-status[data-state="failed"] { color: #E15759; }
  .ev-run-status[data-state="running"] { color: #EDC948; }
  .ev-run-status[data-state="done"] { color: #59A14F; }
  .ev-run-log { margin: 0; padding: 8px; max-height: 220px; overflow: auto; background: var(--panel); border: 1px solid var(--border); border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: var(--text); white-space: pre-wrap; word-break: break-word; }
  .ev-float-placeholder { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px 14px; font-size: 12px; color: var(--muted); font-style: italic; }
  .ev-float-placeholder[hidden] { display: none; }
  .ev-float-dock { flex: 0 0 auto; background: var(--bg); color: var(--text-2); border: 1px solid var(--input-border); border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer; font-style: normal; }
  .ev-float-dock:hover { color: var(--text); border-color: #4E79A7; }
  #float-layer { position: fixed; inset: 0; z-index: 80; pointer-events: none; }
  .float-window { position: fixed; display: flex; flex-direction: column; min-width: 360px; min-height: 320px; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 18px 50px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.25); overflow: hidden; resize: both; pointer-events: auto; }
  .float-window.maximized { left: 8px !important; top: 8px !important; width: calc(100vw - 16px) !important; height: calc(100vh - 16px) !important; resize: none; border-radius: 8px; }
  .float-titlebar { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 6px 8px 6px 12px; background: var(--bg); border-bottom: 1px solid var(--border); cursor: move; user-select: none; touch-action: none; }
  .float-window.maximized .float-titlebar { cursor: default; }
  .float-title { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-2); }
  .float-actions { flex: 0 0 auto; display: flex; gap: 4px; }
  .float-action { height: 24px; padding: 0 8px; background: var(--panel); color: var(--text-2); border: 1px solid var(--input-border); border-radius: 4px; font-size: 11px; line-height: 1; cursor: pointer; }
  .float-action:hover { color: var(--text); border-color: #4E79A7; }
  .float-action:focus-visible { outline: 2px solid #4E79A7; outline-offset: 1px; }
  .float-content { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
  .float-content #evidence-tabs-row { flex: 0 0 auto; }
  .float-content #evidence-body { flex: 1 1 auto; min-height: 0; }
  .float-window #evidence-body.ev-body-trace, .float-window #evidence-body.ev-body-video { overflow: hidden; }
  .float-window .ev-trace { flex: 1 1 auto; height: auto; min-height: 0; }
  .float-window .ev-run-log { max-height: 45vh; }

  .ev-sequence { display: flex; flex-direction: column; gap: 8px; min-height: 360px; }
  .ev-seq-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
  .ev-seq-title { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--text-2); }
  .ev-seq-btn { background: var(--bg); color: var(--text-2); border: 1px solid var(--input-border); border-radius: 4px; padding: 4px 8px; font-size: 11px; line-height: 1; cursor: pointer; }
  .ev-seq-btn:hover:not([disabled]) { color: var(--text); border-color: #4E79A7; }
  .ev-seq-btn[disabled] { opacity: 0.45; cursor: default; }
  .ev-seq-btn:focus-visible { outline: 2px solid #4E79A7; outline-offset: 2px; }
  .ev-seq-zoom { min-width: 42px; text-align: center; font-size: 11px; color: var(--text-2); font-variant-numeric: tabular-nums; }
  .ev-seq-viewport { flex: 1 1 auto; min-height: 320px; overflow: auto; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); padding: 12px; }
  .ev-seq-canvas { display: inline-block; min-width: 100%; transform-origin: top left; }
  .ev-seq-canvas svg { max-width: 100%; height: auto; }
  .ev-seq-empty { color: var(--muted); font-style: italic; font-size: 12px; line-height: 1.5; }
  .seq-modal { position: fixed; inset: 0; z-index: 95; background: rgba(0,0,0,0.68); display: flex; align-items: center; justify-content: center; padding: 16px; }
  .seq-modal[hidden] { display: none; }
  .seq-modal-panel { width: 96vw; height: 92vh; display: flex; flex-direction: column; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 24px 70px rgba(0,0,0,0.5); overflow: hidden; }
  .seq-modal-panel:fullscreen { width: 100vw; height: 100vh; border-radius: 0; }
  .seq-modal-bar { flex: 0 0 auto; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 8px 12px; background: var(--bg); border-bottom: 1px solid var(--border); }
  .seq-modal-title { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-2); }
  .seq-modal-body { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 18px; background: var(--bg); }
  .seq-modal-canvas { display: inline-block; min-width: 100%; transform-origin: top left; }
  .seq-modal-canvas svg { max-width: 100%; height: auto; }


  #view-switch { position: fixed; top: 14px; left: 14px; z-index: 25; display: flex; gap: 4px; padding: 4px; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.2); }
  #view-switch button { border: 1px solid transparent; background: transparent; color: var(--text-2); font-size: 11px; padding: 5px 9px; border-radius: 5px; cursor: pointer; }
  #view-switch button:hover { color: var(--text); }
  #view-switch button:focus-visible { outline: 2px solid #4E79A7; outline-offset: 1px; }
  #view-switch button[aria-pressed="true"] { background: #4E79A7; border-color: #4E79A7; color: #fff; }
  #graph3d { position: fixed; z-index: 2; background: #05060f; }
  #graph3d[hidden] { display: none; }
  #graph3d canvas { display: block; }
  body.galaxy-view #graph { background-color: #05060f; background-image: radial-gradient(ellipse at 50% 45%, rgba(78,121,167,0.2), transparent 55%), radial-gradient(ellipse at 18% 72%, rgba(176,122,161,0.14), transparent 45%), radial-gradient(1px 1px at 20px 30px, rgba(255,255,255,0.9), transparent), radial-gradient(1px 1px at 70px 120px, rgba(255,255,255,0.55), transparent), radial-gradient(1.5px 1.5px at 140px 60px, rgba(255,255,255,0.7), transparent); background-size: auto, auto, 220px 220px, 340px 340px, 480px 480px; }
  body.galaxy-view #graph canvas { position: relative; z-index: 1; }
  body.galaxy-view #view-switch { background: rgba(10,12,24,0.78); border-color: rgba(120,140,200,0.35); backdrop-filter: blur(8px); }

  .node-preview, .edge-preview { position: fixed; z-index: 91; display: flex; flex-direction: column; padding: 10px; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 16px 40px rgba(0,0,0,0.45); }
  .node-preview { width: 320px; max-height: 300px; }
  .edge-preview { width: 460px; max-width: calc(100vw - 16px); max-height: 360px; }
  .node-preview[hidden], .edge-preview[hidden] { display: none; }
  .node-preview-title, .edge-preview-title { margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 600; color: var(--text); }
  .node-preview-body { max-height: 220px; overflow: auto; font-size: 12px; color: var(--text-3); line-height: 1.55; }
  .edge-preview-canvas { max-height: 280px; overflow: auto; padding: 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; }
  .edge-preview-canvas svg { max-width: 100%; height: auto; }
  .node-preview-body .field, .node-modal-body .field { margin-bottom: 5px; }
  .node-preview-body .field b, .node-modal-body .field b { color: var(--text); }
  .node-preview-body .info-code, .node-modal-body .info-code { margin: 4px 0 8px; padding: 8px; max-height: 160px; overflow: auto; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
  .node-preview-body .neighbor-link, .node-modal-body .neighbor-link { display: block; padding: 2px 6px; margin: 2px 0; border-radius: 3px; cursor: pointer; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-left: 3px solid var(--neighbor-border); }
  .node-preview-body .neighbor-link:hover, .node-modal-body .neighbor-link:hover { background: var(--border); }
  .node-modal { position: fixed; inset: 0; z-index: 96; background: rgba(0,0,0,0.68); display: flex; align-items: center; justify-content: center; padding: 16px; }
  .node-modal[hidden] { display: none; }
  .node-modal-panel { width: min(860px, 94vw); height: 84vh; display: flex; flex-direction: column; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 24px 70px rgba(0,0,0,0.5); overflow: hidden; }
  .node-modal-bar { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--bg); border-bottom: 1px solid var(--border); }
  .node-modal-title { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-2); }
  .node-modal-body { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 18px; font-size: 13px; color: var(--text-3); line-height: 1.6; }
  .flow-preview { position: fixed; z-index: 90; width: 360px; max-width: calc(100vw - 16px); padding: 10px; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 16px 40px rgba(0,0,0,0.45); }
  .flow-preview[hidden] { display: none; }
  .flow-preview-title { margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 600; color: var(--text); }
  .flow-preview-canvas { max-height: 260px; overflow: auto; padding: 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; }
  .flow-preview-canvas svg { max-width: 100%; height: auto; }
  .flow-preview-hint { margin-top: 6px; text-align: right; font-size: 10px; color: var(--muted); }
</style>`;
}

function themeInitScript(): string {
  return `<script id="flowlens-theme-init">
(function () {
  var pref = null;
  try { pref = localStorage.getItem('flowlens-theme'); } catch (e) {}
  var t = pref === 'light' ? 'light'
    : pref === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light'
    : 'dark';
  document.documentElement.setAttribute('data-theme', t);
})();
</script>`;
}

function viewerScript(nodesJson: string, edgesJson: string, legendJson: string, kindsJson: string, evidenceJson: string): string {
  return `<script>
const RAW_NODES = ${nodesJson};
const RAW_EDGES = ${edgesJson};
const LEGEND = ${legendJson};
const KINDS = ${kindsJson};
const EVIDENCE = ${evidenceJson};

const LANG_KEY = 'flowlens-lang';
const LANG_SELECT = document.getElementById('lang-select');
const LANG_PAIRS = [
  ['Light', 'Claro'], ['Dark', 'Oscuro'], ['System', 'Sistema'], ['Theme', 'Tema'], ['Language', 'Idioma'],
  ['Search nodes...', 'Buscar nodos...'],
  ['Node Info', 'Info del nodo'], ['Evidence', 'Evidencia'], ['Kinds', 'Tipos'], ['Flows', 'Flujos'],
  ['Steps', 'Pasos'], ['Sequence', 'Secuencia'], ['Implement', 'Implementar'], ['Float', 'Flotar'],
  ['Select All', 'Seleccionar todo'], ['All', 'Todos'], ['Covered', 'Cubiertos'], ['Partial', 'Parciales'], ['Uncovered', 'Sin cubrir'], ['Clear', 'Limpiar'],
  ['Galaxy', 'Galaxia'], ['Org chart', 'Organigrama'],
  ['Hide panel', 'Ocultar panel'], ['Show panel', 'Mostrar panel'],
  ['Max', 'Máx'], ['Restore', 'Restaurar'], ['Dock', 'Anclar'], ['Close', 'Cerrar'], ['Full screen', 'Pantalla completa'], ['Reset', 'Reiniciar'],
  ['Click para ampliar', 'Click to expand'], ['Click para maximizar', 'Click to maximize'], ['Click para ver el diagrama completo', 'Click to open the full diagram'],
  ['Shared node', 'Nodo compartido'], ['Test frame', 'Frame del test'], ['Payload example:', 'Ejemplo de payload:'],
  ['Click a node to load evidence', 'Haz click en un nodo para cargar su evidencia'], ['Click a node to inspect it', 'Haz click en un nodo para inspeccionarlo'],
  ['sin datos del flujo', 'no flow data'], ['sin cobertura', 'no coverage'], ['sin video', 'no video'], ['sin trace', 'no trace'], ['sin pasos', 'no steps'], ['sin tareas de test', 'no test tasks'],
  ['Sin datos del flujo', 'No flow data'], ['Sin cobertura', 'No coverage'], ['Sin video', 'No video'], ['Sin trace', 'No trace'], ['Sin pasos', 'No steps'], ['Sin tareas de test', 'No test tasks'],
  ['Sin diagrama Mermaid. Vuelve a mapear los flujos para generarlo.', 'No Mermaid diagram. Re-map the flows to generate it.'],
  ['Sin diagrama Mermaid.', 'No Mermaid diagram.'],
  ['Mermaid no está disponible.', 'Mermaid is not available.'],
  ['Error al renderizar Mermaid:', 'Error rendering Mermaid:'],
  ['listo para ejecutar', 'ready to run'], ['running', 'running'], ['failed', 'failed'], ['done ok', 'done ok'], ['Ejecutando…', 'Running…'], ['Ejecutar agente', 'Run agent'],
  ['Implementar test', 'Implement test'], ['Spec sugerido:', 'Suggested spec:'], ['Comando a ejecutar', 'Command to run'], ['Criterios de aceptación', 'Acceptance criteria'], ['Nodos sin cubrir', 'Uncovered nodes'],
  ['Coverage: Covered', 'Cobertura: Cubiertos'], ['Coverage: Partial', 'Cobertura: Parciales'], ['Coverage: Uncovered', 'Cobertura: Sin cubrir'],
];
const PREFIX_PAIRS = [
  ['Kind: ', 'Tipo: '], ['Flow: ', 'Flujo: '], ['Component: ', 'Componente: '], ['Source: ', 'Fuente: '],
  ['Payload example:', 'Ejemplo de payload:'], ['Table: ', 'Tabla: '], ['Fields: ', 'Campos: '], ['Shared by: ', 'Compartido por: '],
  ['Coverage: Covered', 'Cobertura: Cubiertos'], ['Coverage: Partial', 'Cobertura: Parciales'], ['Coverage: Uncovered', 'Cobertura: Sin cubrir'], ['Coverage: ', 'Cobertura: '],
  ['Degree: ', 'Grado: '], ['Neighbors (', 'Vecinos ('], ['Respuesta: ', 'Response: '],
  ['Spec sugerido: ', 'Suggested spec: '], ['Evidence · ', 'Evidencia · '], ['Secuencia · ', 'Sequence · '],
  ['Arista compartida por ', 'Shared edge by '], [' flujos · Click para maximizar', ' flows · Click to maximize'],
];
const I18N_MAP = { en: new Map(), es: new Map() };
const I18N_PREFIX = { en: [], es: [] };
LANG_PAIRS.forEach(function (pair) {
  if (pair[0] !== pair[1]) {
    I18N_MAP.en.set(pair[1], pair[0]);
    I18N_MAP.es.set(pair[0], pair[1]);
  }
});
PREFIX_PAIRS.forEach(function (pair) {
  I18N_PREFIX.en.push([pair[1], pair[0]]);
  I18N_PREFIX.es.push([pair[0], pair[1]]);
});
const I18N_SKIP = '.legend-label, .legend-id, .search-item, .ev-flow, .node-preview-title, .edge-preview-title, .node-modal-title, .neighbor-link, pre, code, svg, .ev-cmd, .ev-run-log';
let currentLang = 'en';
try {
  const savedLang = localStorage.getItem(LANG_KEY);
  if (savedLang === 'en' || savedLang === 'es') currentLang = savedLang;
  else currentLang = String(navigator.language || '').toLowerCase().indexOf('es') === 0 ? 'es' : 'en';
} catch (e) {
  currentLang = 'en';
}
function translateString(value, map, prefixes) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return value;
  if (map.has(trimmed)) return value.replace(trimmed, map.get(trimmed));
  for (const prefix of prefixes) {
    if (trimmed.indexOf(prefix[0]) === 0) return value.replace(prefix[0], prefix[1]);
  }
  return value;
}
function translateDom(root) {
  if (!root) return;
  const map = I18N_MAP[currentLang];
  const prefixes = I18N_PREFIX[currentLang];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const updates = [];
  let node;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent || parent.closest(I18N_SKIP)) continue;
    const next = translateString(node.nodeValue, map, prefixes);
    if (next !== node.nodeValue) updates.push([node, next]);
  }
  updates.forEach(function (entry) { entry[0].nodeValue = entry[1]; });
  root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(function (element) {
    if (element.closest(I18N_SKIP)) return;
    ['placeholder', 'title', 'aria-label'].forEach(function (attr) {
      const value = element.getAttribute(attr);
      if (!value) return;
      const next = translateString(value, map, prefixes);
      if (next !== value) element.setAttribute(attr, next);
    });
  });
}
let i18nScheduled = false;
const i18nObserver = new MutationObserver(function () {
  if (i18nScheduled) return;
  i18nScheduled = true;
  requestAnimationFrame(function () {
    i18nScheduled = false;
    translateDom(document.body);
  });
});
i18nObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
function applyLanguage(lang) {
  currentLang = lang === 'es' ? 'es' : 'en';
  try { localStorage.setItem(LANG_KEY, currentLang); } catch (e) {}
  document.documentElement.lang = currentLang;
  if (LANG_SELECT) LANG_SELECT.value = currentLang;
  translateDom(document.body);
}
if (LANG_SELECT) LANG_SELECT.addEventListener('change', function () { applyLanguage(LANG_SELECT.value); });

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/\\u003c/g, '&lt;').replace(/\\u003e/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const nodesDS = new vis.DataSet(RAW_NODES.map(function (n, i) {
  return {
    id: n.id, label: n.label, color: n.color, size: n.size, font: n.font, title: n.title,
    shape: n.shape, image: n.image, shapeProperties: n.shapeProperties, borderWidth: n.borderWidth,
    x: 30 * Math.sqrt(i) * Math.cos(i * 2.4),
    y: 30 * Math.sqrt(i) * Math.sin(i * 2.4),
    flow: n.flow, flowName: n.flowName, flows: n.flows, flowNames: n.flowNames, kind: n.kind, shared: n.shared, coverage: n.coverage, endpoint: n.endpoint, file: n.file, line: n.line, component: n.component, selector: n.selector, payloadExample: n.payloadExample, table: n.table, dbFields: n.dbFields, payload: n.payload, response: n.response, degree: n.degree,
  };
}));

const edgesDS = new vis.DataSet(RAW_EDGES.map(function (e, i) {
  return {
    id: i, from: e.from, to: e.to, label: '', title: e.title, dashes: e.dashes, width: e.width, color: e.color, flows: e.flows,
    arrows: { to: { enabled: true, scaleFactor: 0.5 } },
  };
}));

const container = document.getElementById('graph');
const network = new vis.Network(container, { nodes: nodesDS, edges: edgesDS }, {
  physics: {
    enabled: true,
    solver: 'forceAtlas2Based',
    forceAtlas2Based: { gravitationalConstant: -60, centralGravity: 0.005, springLength: 120, springConstant: 0.08, damping: 0.4, avoidOverlap: 0.8 },
    stabilization: { iterations: 200, fit: true },
  },
  interaction: { hover: true, tooltipDelay: 100, hideEdgesOnDrag: true, navigationButtons: false, keyboard: false },
  nodes: { shape: 'dot', borderWidth: 1.5 },
  edges: { smooth: { type: 'continuous', roundness: 0.2 }, hoverWidth: 3, selectionWidth: 3 },
});

const THEME_KEY = 'flowlens-theme';
const VIEW_KEY = 'flowlens-view-mode';
const themeMQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
let themeLabelColor = '#ffffff';
let viewMode = 'original';
let viewAnimationFrame = null;
const graph3dEl = document.getElementById('graph3d');
let view3dGraph = null;
let view3dFocusedFlow = null;
function themePref() {
  let p = null;
  try { p = localStorage.getItem(THEME_KEY); } catch (e) {}
  return p === 'light' || p === 'dark' || p === 'system' ? p : null;
}
function applyTheme(pref) {
  const t = pref === 'light' ? 'light' : (pref === 'system' && themeMQ && themeMQ.matches) ? 'light' : 'dark';
  const root = document.documentElement;
  root.setAttribute('data-theme', t);
  document.querySelectorAll('[data-theme-choice]').forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.dataset.themeChoice === (pref || 'dark')));
  });
  const labelColor = viewMode === 'galaxy' ? '#ffffff' : getComputedStyle(root).getPropertyValue('--node-label').trim();
  if (labelColor && labelColor !== themeLabelColor) {
    themeLabelColor = labelColor;
    nodesDS.update(nodesDS.get().map(function (n) { return { id: n.id, font: Object.assign({}, n.font, { color: labelColor }) }; }));
  }
  window.dispatchEvent(new CustomEvent('flowlens-themechange'));
}
document.querySelectorAll('[data-theme-choice]').forEach(function (b) {
  b.addEventListener('click', function () {
    const pref = b.dataset.themeChoice;
    try { localStorage.setItem(THEME_KEY, pref); } catch (e) {}
    applyTheme(pref);
  });
});
if (themeMQ) {
  const onSchemeChange = function () { if (themePref() === 'system') applyTheme('system'); };
  if (themeMQ.addEventListener) themeMQ.addEventListener('change', onSchemeChange);
  else if (themeMQ.addListener) themeMQ.addListener(onSchemeChange);
}
applyTheme(themePref());

const SIDEBAR_KEY = 'flowlens-sidebar-width';
const SIDEBAR_MIN = 320;
const SIDEBAR_DEFAULT = 420;
const sidebarEl = document.getElementById('sidebar');
const handleEl = document.getElementById('resize-handle');
function maxSidebarWidth() { return Math.round(window.innerWidth * 0.7); }
function currentSidebarWidth() { return parseFloat(sidebarEl.style.width) || SIDEBAR_DEFAULT; }
function applySidebarWidth(px) {
  const clamped = Math.max(SIDEBAR_MIN, Math.min(px, maxSidebarWidth()));
  sidebarEl.style.width = clamped + 'px';
  return clamped;
}
function persistSidebarWidth() {
  try { localStorage.setItem(SIDEBAR_KEY, String(currentSidebarWidth())); } catch (e) {}
}
function resizeGraph() {
  network.setSize(container.clientWidth + 'px', container.clientHeight + 'px');
  network.redraw();
}
(function initSidebarWidth() {
  let saved = NaN;
  try { saved = parseFloat(localStorage.getItem(SIDEBAR_KEY)); } catch (e) {}
  applySidebarWidth(Number.isFinite(saved) && saved > 0 ? saved : SIDEBAR_DEFAULT);
})();
let sidebarDragging = false;
function onDragMove(clientX) {
  applySidebarWidth(window.innerWidth - clientX);
  resizeGraph();
}
handleEl.addEventListener('pointerdown', function (e) {
  sidebarDragging = true;
  handleEl.classList.add('dragging');
  if (handleEl.setPointerCapture) { try { handleEl.setPointerCapture(e.pointerId); } catch (err) {} }
  e.preventDefault();
});
window.addEventListener('pointermove', function (e) { if (sidebarDragging) onDragMove(e.clientX); });
function endSidebarDrag() {
  if (!sidebarDragging) return;
  sidebarDragging = false;
  handleEl.classList.remove('dragging');
  persistSidebarWidth();
}
window.addEventListener('pointerup', endSidebarDrag);
window.addEventListener('pointercancel', endSidebarDrag);
handleEl.addEventListener('keydown', function (e) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const delta = e.key === 'ArrowLeft' ? 24 : -24;
  applySidebarWidth(currentSidebarWidth() + delta);
  persistSidebarWidth();
  resizeGraph();
  e.preventDefault();
});
window.addEventListener('resize', function () { applySidebarWidth(currentSidebarWidth()); resizeGraph(); fillFlexibleSection(); });

const SECTION_IDS = ['info-panel', 'evidence-panel', 'kinds-legend-wrap', 'legend-wrap'];
const SECTION_HEADER = 24;
const SECTION_MIN = { 'info-panel': SECTION_HEADER, 'evidence-panel': SECTION_HEADER, 'kinds-legend-wrap': SECTION_HEADER, 'legend-wrap': SECTION_HEADER };
const SECTIONS_KEY = 'flowlens-sidebar-sections';
const sectionEls = {};
SECTION_IDS.forEach(function (id) { sectionEls[id] = document.getElementById(id); });
function readSectionStore() {
  let raw = null;
  try { raw = localStorage.getItem(SECTIONS_KEY); } catch (e) {}
  if (!raw) return {};
  try { const parsed = JSON.parse(raw); return parsed && typeof parsed === 'object' ? parsed : {}; } catch (e) { return {}; }
}
function sectionMin(id) { return SECTION_MIN[id] || SECTION_HEADER; }
function applySectionHeight(id, px) {
  const el = sectionEls[id];
  if (!el) return null;
  const height = Math.max(SECTION_HEADER, Math.round(px));
  el.style.flex = '0 0 ' + height + 'px';
  return height;
}
function currentSectionHeight(id) {
  const el = sectionEls[id];
  return el ? el.getBoundingClientRect().height : 0;
}
function otherSections(id) {
  return SECTION_IDS.filter(function (other) { return other !== id && sectionEls[other]; });
}
function captureSectionHeights() {
  const out = {};
  SECTION_IDS.forEach(function (id) { if (sectionEls[id]) out[id] = Math.round(currentSectionHeight(id)); });
  return out;
}
function sidebarFreeSpace() {
  let used = 0;
  const children = sidebarEl.children;
  if (children) {
    for (let i = 0; i < children.length; i++) used += children[i].getBoundingClientRect().height;
  }
  return Math.max(0, Math.round(sidebarEl.clientHeight - used));
}
function sectionGrowRoom(id, snapshot) {
  let room = 0;
  otherSections(id).forEach(function (other) {
    const h = snapshot && isFinite(snapshot[other]) ? snapshot[other] : Math.round(currentSectionHeight(other));
    room += Math.max(0, h - SECTION_HEADER);
  });
  return room;
}
function persistSectionHeights() {
  const out = {};
  SECTION_IDS.forEach(function (id) {
    const el = sectionEls[id];
    if (!el || !el.style.flex) return;
    const match = /0 0 (\\d+(?:\\.\\d+)?)px/.exec(el.style.flex);
    if (match) out[id] = Math.round(parseFloat(match[1]));
  });
  try { localStorage.setItem(SECTIONS_KEY, JSON.stringify(out)); } catch (e) {}
}
function adjustSections(ownerId, take) {
  const drag = sectionDrag;
  if (!drag) return;
  const snapshot = drag.startHeights || {};
  const order = otherSections(ownerId).slice().reverse();
  if (take > 0) {
    for (let i = 0; i < order.length && take > 0; i++) {
      const other = order[i];
      const cur = isFinite(drag.current[other]) ? drag.current[other] : Math.round(currentSectionHeight(other));
      const shrink = Math.min(Math.max(0, cur - SECTION_HEADER), take);
      if (shrink > 0) { drag.current[other] = cur - shrink; take -= shrink; applySectionHeight(other, drag.current[other]); }
    }
  } else if (take < 0) {
    let give = -take;
    for (let i = 0; i < order.length && give > 0; i++) {
      const other = order[i];
      const cur = isFinite(drag.current[other]) ? drag.current[other] : Math.round(currentSectionHeight(other));
      const target = isFinite(snapshot[other]) ? snapshot[other] : cur;
      const grow = Math.min(give, Math.max(0, target - cur));
      if (grow > 0) { drag.current[other] = cur + grow; give -= grow; applySectionHeight(other, drag.current[other]); }
    }
    if (give > 0 && order.length) {
      const other = order[0];
      drag.current[other] = (isFinite(drag.current[other]) ? drag.current[other] : 0) + give;
      applySectionHeight(other, drag.current[other]);
    }
  }
}
function resizeSection(id, nextHeight) {
  const el = sectionEls[id];
  if (!el) return;
  const drag = sectionDrag;
  const snapshot = drag && drag.startHeights ? drag.startHeights : null;
  const base = snapshot && isFinite(snapshot[id]) ? snapshot[id] : Math.round(currentSectionHeight(id));
  const free = drag && isFinite(drag.startFree) ? drag.startFree : 0;
  const max = base + free + sectionGrowRoom(id, snapshot);
  const desired = Math.max(SECTION_HEADER, Math.min(Math.round(nextHeight), max));
  if (!drag) { applySectionHeight(id, desired); return; }
  if (!drag.current) drag.current = {};
  if (!isFinite(drag.current[id])) drag.current[id] = base;
  const delta = desired - drag.current[id];
  if (delta === 0) return;
  drag.current[id] = desired;
  applySectionHeight(id, desired);
  adjustSections(id, delta);
}
function fillFlexibleSection() {
  const wrap = sectionEls['legend-wrap'];
  if (!wrap || isCollapsed('legend-wrap')) return;
  wrap.style.flex = '1 1 auto';
}
(function restoreSectionHeights() {
  const store = readSectionStore();
  const cap = Math.max(120, (sidebarEl.clientHeight || 600) - 96);
  SECTION_IDS.forEach(function (id) {
    const saved = store[id];
    if (typeof saved === 'number' && isFinite(saved)) applySectionHeight(id, Math.min(saved, cap));
  });
})();
fillFlexibleSection();
let sectionDrag = null;
const dividerEls = Array.prototype.slice.call(document.querySelectorAll('.sidebar-divider'));
dividerEls.forEach(function (divider) {
  divider.addEventListener('pointerdown', function (e) {
    const id = divider.getAttribute('data-section');
    if (!sectionEls[id]) return;
    const heights = captureSectionHeights();
    sectionDrag = { id: id, startY: e.clientY, startH: heights[id] || Math.round(currentSectionHeight(id)), startHeights: heights, startFree: sidebarFreeSpace(), current: Object.assign({}, heights) };
    divider.classList.add('dragging');
    if (divider.setPointerCapture) { try { divider.setPointerCapture(e.pointerId); } catch (err) {} }
    e.preventDefault();
  });
  divider.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const id = divider.getAttribute('data-section');
    if (!sectionEls[id]) return;
    const heights = captureSectionHeights();
    sectionDrag = { id: id, startY: 0, startH: heights[id] || Math.round(currentSectionHeight(id)), startHeights: heights, startFree: sidebarFreeSpace(), current: Object.assign({}, heights) };
    resizeSection(id, (heights[id] || Math.round(currentSectionHeight(id))) + (e.key === 'ArrowUp' ? -24 : 24));
    endSectionDrag();
    e.preventDefault();
  });
});
window.addEventListener('pointermove', function (e) {
  if (!sectionDrag) return;
  resizeSection(sectionDrag.id, sectionDrag.startH + (e.clientY - sectionDrag.startY));
});
function endSectionDrag() {
  if (!sectionDrag) return;
  sectionDrag = null;
  dividerEls.forEach(function (divider) { divider.classList.remove('dragging'); });
  persistSectionHeights();
  fillFlexibleSection();
}
window.addEventListener('pointerup', endSectionDrag);
window.addEventListener('pointercancel', endSectionDrag);

const COLLAPSED_KEY = 'flowlens-sidebar-collapsed';
function readCollapsedStore() {
  let raw = null;
  try { raw = localStorage.getItem(COLLAPSED_KEY); } catch (e) {}
  if (!raw) return {};
  try { const parsed = JSON.parse(raw); return parsed && typeof parsed === 'object' ? parsed : {}; } catch (e) { return {}; }
}
function isCollapsed(id) {
  const el = sectionEls[id];
  return !!(el && el.classList.contains('collapsed'));
}
function applyCollapsed(id, collapsed) {
  const el = sectionEls[id];
  if (!el) return;
  el.classList.toggle('collapsed', collapsed);
  const header = el.querySelector('.section-header');
  if (header) header.setAttribute('aria-expanded', String(!collapsed));
  if (collapsed) {
    el.style.flex = '0 0 auto';
  } else {
    const saved = readSectionStore()[id];
    if (typeof saved === 'number' && isFinite(saved)) applySectionHeight(id, saved);
    else el.style.flex = '';
  }
  fillFlexibleSection();
}
function persistCollapsed() {
  const store = {};
  SECTION_IDS.forEach(function (id) { if (isCollapsed(id)) store[id] = true; });
  try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(store)); } catch (e) {}
}
(function restoreCollapsed() {
  const store = readCollapsedStore();
  SECTION_IDS.forEach(function (id) { if (store[id]) applyCollapsed(id, true); });
})();
document.querySelectorAll('.section-header').forEach(function (header) {
  header.addEventListener('click', function () {
    const id = header.getAttribute('data-collapse');
    if (SECTION_IDS.indexOf(id) === -1) return;
    applyCollapsed(id, !isCollapsed(id));
    persistCollapsed();
  });
});

network.once('stabilizationIterationsDone', function () {
  network.setOptions({ physics: { enabled: false } });
});

const infoContent = document.getElementById('info-content');
let focusedFlowId = null;
function emptyInfo() {
  infoContent.textContent = '';
  const span = document.createElement('span');
  span.className = 'empty';
  span.textContent = 'Click a node to inspect it';
  infoContent.appendChild(span);
}
function coverageText(node) {
  if (!node.coverage) return '';
  if (node.coverage === 'covered') return 'Covered';
  if (node.coverage === 'partial') return 'Partial';
  return 'Uncovered';
}
function nodeTestMoment(node) {
  if (!node || node.kind !== 'interaction') return null;
  const flows = nodeFlows(node);
  const preferred = focusedFlowId && flows.indexOf(focusedFlowId) !== -1 ? focusedFlowId : null;
  const ordered = preferred ? [preferred].concat(flows.filter(function (flow) { return flow !== preferred; })) : flows;
  for (const flowId of ordered) {
    const flow = EVIDENCE_BY_FLOW[String(flowId)];
    if (!flow || !Array.isArray(flow.tests)) continue;
    for (const test of flow.tests) {
      for (const result of test.results || []) {
        const entries = Array.isArray(result.entries) ? result.entries : [];
        const entry = entries.find(function (candidate) {
          return String(candidate.node) === String(node.id);
        });
        if (entry && result.videoSrc) {
          const start = Number(entry.startMs) || 0;
          return { kind: 'video', src: result.videoSrc, time: Math.max(0, start / 1000) };
        }
        if (result.screenshotSrc) {
          return { kind: 'image', src: result.screenshotSrc, time: 0 };
        }
      }
    }
  }
  return null;
}

function hydrateNodeMedia(root) {
  if (!root) return;
  root.querySelectorAll('video[data-shot-time]').forEach(function (video) {
    const time = Number(video.dataset.shotTime) || 0;
    const seek = function () {
      try {
        video.currentTime = video.duration ? Math.min(time, video.duration) : time;
        video.pause();
      } catch (e) {}
    };
    if (video.readyState >= 1) seek();
    else video.addEventListener('loadedmetadata', seek, { once: true });
    video.addEventListener('seeked', function () { try { video.pause(); } catch (e) {} }, { once: true });
  });
}

function nodeInfoHtml(n) {
  if (!n) return '';
  const neighborIds = network.getConnectedNodes(n.id);
  const items = neighborIds.map(function (nid) {
    const nb = nodesDS.get(nid);
    const color = nb && nb.color ? nb.color.background : '#555';
    return '<span class="neighbor-link" data-nid="' + esc(nid) + '" style="border-left-color:' + esc(color) + '">' + esc(nb ? nb.label : nid) + '</span>';
  }).join('');
  let html = '<div class="field"><b>' + esc(n.label) + '</b></div>';
  if (n.endpoint) html += '<div class="field">Endpoint: ' + esc(n.endpoint) + '</div>';
  if (n.kind) html += '<div class="field">Kind: ' + esc(n.kind) + '</div>';
  if (n.shared && Array.isArray(n.flowNames) && n.flowNames.length > 1) {
    html += '<div class="field"><b>Shared by:</b> ' + n.flowNames.map(esc).join(', ') + '</div>';
  } else if (n.flowName) {
    html += '<div class="field">Flow: ' + esc(n.flowName) + '</div>';
  }
  if (n.shared) html += '<div class="field">Shared node</div>';
  const sourceLine = n.file ? (n.line ? n.file + ':' + n.line : n.file) : '';
  if (n.kind === 'interaction') {
    if (sourceLine) html += '<div class="field"><b>Frontend:</b> ' + esc(sourceLine) + '</div>';
    if (n.component) html += '<div class="field"><b>Component:</b> ' + esc(n.component) + '</div>';
    if (n.selector) html += '<div class="field"><b>Selector:</b> ' + esc(n.selector) + '</div>';
  } else if (n.kind === 'backend') {
    if (sourceLine) html += '<div class="field"><b>Source:</b> ' + esc(sourceLine) + '</div>';
    if (n.payloadExample) {
      html += '<div class="field"><b>Payload example:</b></div><pre class="info-code">' + esc(n.payloadExample) + '</pre>';
    }
  } else if (n.kind === 'db') {
    if (n.table) html += '<div class="field"><b>Table:</b> ' + esc(n.table) + '</div>';
    if (n.dbFields && n.dbFields.length) html += '<div class="field"><b>Fields:</b> ' + esc(n.dbFields.join(', ')) + '</div>';
    if (sourceLine) html += '<div class="field"><b>Source:</b> ' + esc(sourceLine) + '</div>';
  } else if (sourceLine) {
    html += '<div class="field"><b>Source:</b> ' + esc(sourceLine) + '</div>';
  }
  const shot = nodeTestMoment(n);
  if (shot) {
    html += '<div class="field"><b>Test frame</b></div>';
    if (shot.kind === 'image') {
      html += '<img class="node-shot-media" src="' + esc(shot.src) + '" alt="Test frame" loading="lazy">';
    } else {
      html += '<video class="node-shot-media" src="' + esc(shot.src) + '" muted playsinline preload="auto" data-shot-time="' + shot.time + '" aria-label="Test frame"></video>';
    }
  }
  const cov = coverageText(n);
  if (cov) html += '<div class="field">Coverage: ' + esc(cov) + '</div>';
  if (n.payload) html += '<div class="field">Payload: ' + esc(n.payload) + '</div>';
  if (n.response) {
    const r = n.response;
    let line = 'Respuesta:';
    if (r.status) line += ' ' + r.status;
    if (r.mimeType) line += ' ' + r.mimeType;
    if (r.size !== null && r.size !== undefined && r.size !== '') line += ' ' + r.size + 'B';
    html += '<div class="field">' + esc(line) + '</div>';
    if (r.preview) html += '<div class="field">' + esc(r.preview) + '</div>';
  }
  html += '<div class="field">Degree: ' + esc(n.degree) + '</div>';
  if (neighborIds.length) {
    html += '<div class="field">Neighbors (' + neighborIds.length + ')</div><div id="neighbors-list">' + items + '</div>';
  }
  return html;
}
function showInfo(nodeId) {
  const n = nodesDS.get(nodeId);
  if (!n) return;
  infoContent.innerHTML = nodeInfoHtml(n);
  hydrateNodeMedia(infoContent);
}
function focusNode(nodeId) {
  network.selectNodes([nodeId]);
  showInfo(nodeId);
  loadNodeEvidence(nodeId);
  const node = nodesDS.get(nodeId);
  if (node && node.flow) focusFlow(node.flow);
}
document.addEventListener('click', function (e) {
  const el = e.target.closest ? e.target.closest('.neighbor-link') : null;
  if (el && el.dataset.nid !== undefined) focusNode(el.dataset.nid);
});

let hoveredNodeId = null;
network.on('hoverNode', function (params) {
  hoveredNodeId = params.node;
  container.style.cursor = 'pointer';
  showNodePreview(params.node);
});
network.on('blurNode', function () { hoveredNodeId = null; container.style.cursor = 'default'; scheduleHideNodePreview(); });
network.on('hoverEdge', function (params) { showEdgePreview(params.edge); });
network.on('blurEdge', function () { scheduleHideEdgePreview(); });
network.on('click', function (params) {
  if (params.nodes.length > 0) {
    const clicked = params.nodes[0];
    showInfo(clicked);
    loadNodeEvidence(clicked);
    const node = nodesDS.get(clicked);
    if (node && node.flow) focusFlow(node.flow);
  } else if (params.edges.length > 0) {
    const target = edgeTargetFor(params.edges[0]);
    if (target) {
      hideEdgePreviewNow();
      setFlowFocus(target.flowId, true);
    }
  } else if (hoveredNodeId === null) {
    emptyInfo();
  }
});

const searchInput = document.getElementById('search');
const searchResults = document.getElementById('search-results');
searchInput.addEventListener('input', function () {
  const q = searchInput.value.toLowerCase().trim();
  searchResults.textContent = '';
  if (!q) { searchResults.style.display = 'none'; return; }
  const matches = RAW_NODES.filter(function (n) { return n.label.toLowerCase().indexOf(q) !== -1; }).slice(0, 20);
  if (!matches.length) { searchResults.style.display = 'none'; return; }
  searchResults.style.display = 'block';
  matches.forEach(function (n) {
    const el = document.createElement('div');
    el.className = 'search-item';
    el.textContent = n.label;
    el.style.borderLeft = '3px solid ' + n.color.background;
    el.style.paddingLeft = '8px';
    el.addEventListener('click', function () {
      network.selectNodes([n.id]);
      showInfo(n.id);
      loadNodeEvidence(n.id);
      focusFlow(n.flow);
      searchResults.style.display = 'none';
      searchInput.value = '';
    });
    searchResults.appendChild(el);
  });
});
document.addEventListener('click', function (e) {
  if (!searchResults.contains(e.target) && e.target !== searchInput) searchResults.style.display = 'none';
});

const hiddenFlows = new Set();
let legendRendered = false;
const FLOW_COVERAGE = {};
LEGEND.forEach(function (c) { FLOW_COVERAGE[c.cid] = c.coverage || ''; });
const COVERAGE_KEY = 'flowlens-coverage-filter';
let coverageFilter = 'all';
const coverageSelect = document.getElementById('coverage-filter');
const selectAllCb = document.getElementById('select-all-cb');
function updateSelectAllState() {
  const total = LEGEND.length;
  const hidden = hiddenFlows.size;
  selectAllCb.checked = hidden === 0;
  selectAllCb.indeterminate = hidden > 0 && hidden < total;
}
function flowMatchesCoverage(flow) {
  if (coverageFilter === 'all') return true;
  return (FLOW_COVERAGE[flow] || '') === coverageFilter;
}
function nodeFlows(n) {
  if (Array.isArray(n.flows) && n.flows.length) return n.flows;
  return n.flow === null || n.flow === undefined || n.flow === '' ? [] : [n.flow];
}
function nodeHidden(n) {
  const flows = nodeFlows(n);
  return flows.length > 0 && flows.every(function (flow) {
    return hiddenFlows.has(flow) || !flowMatchesCoverage(flow);
  });
}
function applyLegendVisibility() {
  LEGEND.forEach(function (c) {
    const item = legendItems[c.cid];
    if (item) item.hidden = !flowMatchesCoverage(c.cid);
  });
}
function applyVisibility() {
  nodesDS.update(RAW_NODES.map(function (n) { return { id: n.id, hidden: nodeHidden(n) }; }));
  const updates = [];
  edgesDS.get().forEach(function (e) {
    const fromNode = nodesDS.get(e.from);
    const toNode = nodesDS.get(e.to);
    const visible = fromNode && toNode && !fromNode.hidden && !toNode.hidden;
    updates.push({ id: e.id, hidden: !visible });
  });
  if (updates.length) edgesDS.update(updates);
  if (legendRendered) applyLegendVisibility();
  updateSelectAllState();
}
function setCoverageFilter(value) {
  coverageFilter = value === 'covered' || value === 'partial' || value === 'uncovered' ? value : 'all';
  if (coverageSelect) coverageSelect.value = coverageFilter;
  try { localStorage.setItem(COVERAGE_KEY, coverageFilter); } catch (e) {}
  applyVisibility();
}
function toggleAllFlows(hide) {
  document.querySelectorAll('.legend-item').forEach(function (item) {
    if (hide) item.classList.add('dimmed'); else item.classList.remove('dimmed');
  });
  document.querySelectorAll('.legend-cb').forEach(function (cb) { cb.checked = !hide; });
  LEGEND.forEach(function (c) { if (hide) hiddenFlows.add(c.cid); else hiddenFlows.delete(c.cid); });
  applyVisibility();
}
selectAllCb.addEventListener('change', function () { toggleAllFlows(!selectAllCb.checked); });
if (coverageSelect) {
  let savedFilter = 'all';
  try { savedFilter = localStorage.getItem(COVERAGE_KEY) || 'all'; } catch (e) {}
  setCoverageFilter(savedFilter);
  coverageSelect.addEventListener('change', function () { setCoverageFilter(coverageSelect.value); });
}

const legendEl = document.getElementById('legend');
const legendItems = {};
LEGEND.forEach(function (c) {
  const item = document.createElement('div');
  item.className = 'legend-item';
  item.setAttribute('data-cid', c.cid);
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = 'legend-cb';
  cb.checked = true;
  cb.addEventListener('change', function (e) {
    e.stopPropagation();
    if (cb.checked) { hiddenFlows.delete(c.cid); item.classList.remove('dimmed'); }
    else { hiddenFlows.add(c.cid); item.classList.add('dimmed'); }
    applyVisibility();
  });
  item.innerHTML = '<div class="legend-dot" style="background:' + esc(c.color) + '"></div><span class="legend-label" title="' + esc(c.cid) + '">' + esc(c.label) + '</span><span class="legend-id" title="' + esc(c.cid) + '">' + esc(c.cid) + '</span><span class="legend-count">' + esc(c.count) + '</span>';
  item.prepend(cb);
  item.addEventListener('mouseenter', function () { showFlowPreview(c.cid, item); });
  item.addEventListener('mouseleave', scheduleHideFlowPreview);
  item.addEventListener('click', function (e) {
    if (e.target === cb) return;
    hideFlowPreviewNow();
    setFlowFocus(c.cid, true);
  });
  legendItems[c.cid] = item;
  legendEl.appendChild(item);
});
legendRendered = true;
applyLegendVisibility();

const kindsEl = document.getElementById('kinds-legend');
KINDS.forEach(function (k) {
  const item = document.createElement('div');
  item.className = 'kind-item';
  const icon = document.createElement('img');
  icon.className = 'kind-icon';
  icon.width = 16;
  icon.height = 16;
  icon.alt = '';
  icon.src = k.image;
  const label = document.createElement('span');
  label.className = 'legend-label';
  label.textContent = k.label;
  const count = document.createElement('span');
  count.className = 'legend-count';
  count.textContent = String(k.count);
  item.appendChild(icon);
  item.appendChild(label);
  item.appendChild(count);
  kindsEl.appendChild(item);
});

function flowNodeIds(flow) {
  const ids = [];
  RAW_NODES.forEach(function (n) { if (nodeFlows(n).indexOf(flow) !== -1) ids.push(n.id); });
  return ids;
}
function flowColorFor(flow) {
  const found = LEGEND.filter(function (c) { return c.cid === flow; })[0];
  return found ? found.color : '#4E79A7';
}
function edgeInFlow(edge, flow) {
  if (Array.isArray(edge.flows) && edge.flows.length) return edge.flows.indexOf(flow) !== -1;
  const fromNode = nodesDS.get(edge.from);
  const toNode = nodesDS.get(edge.to);
  return !!(
    (fromNode && nodeFlows(fromNode).indexOf(flow) !== -1) ||
    (toNode && nodeFlows(toNode).indexOf(flow) !== -1)
  );
}
function updateLegendFocus() {
  LEGEND.forEach(function (c) {
    const item = legendItems[c.cid];
    if (item) item.classList.toggle('focused', c.cid === focusedFlowId);
  });
  const clearBtn = document.getElementById('flow-focus-clear');
  if (clearBtn) clearBtn.hidden = !focusedFlowId;
}
const starSpriteCache = new Map();

function starColorRgba(color, alpha) {
  const value = String(color || '#ffffff').trim();
  let r = 255;
  let g = 255;
  let b = 255;
  const short = value.match(/^#([0-9a-f]{3})$/i);
  const long = value.match(/^#([0-9a-f]{6})$/i);
  if (short) {
    r = parseInt(short[1][0] + short[1][0], 16);
    g = parseInt(short[1][1] + short[1][1], 16);
    b = parseInt(short[1][2] + short[1][2], 16);
  } else if (long) {
    r = parseInt(long[1].slice(0, 2), 16);
    g = parseInt(long[1].slice(2, 4), 16);
    b = parseInt(long[1].slice(4, 6), 16);
  }
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function createStarSprite(color, dim) {
  const key = String(color) + '|' + (dim ? 'dim' : 'bright');
  if (starSpriteCache.has(key)) return starSpriteCache.get(key);
  const size = 128;
  const center = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const alpha = dim ? 0.28 : 1;

  const halo = ctx.createRadialGradient(center, center, 0, center, center, center);
  halo.addColorStop(0, 'rgba(255,255,255,' + (0.96 * alpha) + ')');
  halo.addColorStop(0.045, 'rgba(255,255,255,' + (0.9 * alpha) + ')');
  halo.addColorStop(0.13, starColorRgba(color, 0.76 * alpha));
  halo.addColorStop(0.32, starColorRgba(color, 0.3 * alpha));
  halo.addColorStop(0.64, starColorRgba(color, 0.07 * alpha));
  halo.addColorStop(1, starColorRgba(color, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(center, center, center, 0, Math.PI * 2);
  ctx.fill();

  const spikes = [
    [0, 1],
    [Math.PI / 2, 0.86],
    [Math.PI / 4, 0.46],
    [-Math.PI / 4, 0.34],
  ];
  for (const spike of spikes) {
    const angle = spike[0];
    const strength = spike[1];
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(angle);
    const gradient = ctx.createLinearGradient(-center, 0, center, 0);
    gradient.addColorStop(0, starColorRgba(color, 0));
    gradient.addColorStop(0.42, starColorRgba(color, 0.08 * strength * alpha));
    gradient.addColorStop(0.5, 'rgba(255,255,255,' + (0.96 * strength * alpha) + ')');
    gradient.addColorStop(0.58, starColorRgba(color, 0.08 * strength * alpha));
    gradient.addColorStop(1, starColorRgba(color, 0));
    ctx.fillStyle = gradient;
    const thickness = Math.max(1, 1.5 * strength);
    ctx.fillRect(-center, -thickness / 2, size, thickness);
    ctx.restore();
  }

  const core = ctx.createRadialGradient(center, center, 0, center, center, size * 0.09);
  core.addColorStop(0, 'rgba(255,255,255,' + alpha + ')');
  core.addColorStop(0.55, 'rgba(255,255,255,' + (0.72 * alpha) + ')');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(center, center, size * 0.09, 0, Math.PI * 2);
  ctx.fill();

  const url = canvas.toDataURL('image/png');
  starSpriteCache.set(key, url);
  return url;
}

function galaxyStarWeight(node) {
  const flowCount = Array.isArray(node.flows) && node.flows.length ? node.flows.length : 1;
  const degree = Math.max(0, Number(node.degree) || 0);
  return (flowCount - 1) * 2.5 + Math.min(degree, 16) * 0.45 + (node.shared ? 0.5 : 0);
}

function galaxyStarSize(node, maxWeight) {
  const weight = galaxyStarWeight(node);
  const ratio = maxWeight > 0 ? weight / maxWeight : 0;
  return Math.round((node.shared ? 28 : 22) + ratio * 30);
}

function galaxyNodeGlow(node) {
  const base = node && node.color && node.color.background ? node.color.background : '#ffffff';
  return node && node.shared ? '#ffd166' : base;
}

function galaxyTransparentColor() {
  return {
    background: 'rgba(0,0,0,0)',
    border: 'rgba(0,0,0,0)',
    hover: { background: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)' },
    highlight: { background: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)' },
  };
}

function applyFlowFocus() {
  const flow = focusedFlowId;
  nodesDS.update(RAW_NODES.map(function (n) {
    if (!flow || nodeFlows(n).indexOf(flow) !== -1) {
      return Object.assign({
        id: n.id,
        color: viewMode === 'galaxy' ? galaxyTransparentColor() : n.color,
        font: Object.assign({}, n.font, { color: viewMode === 'galaxy' ? '#ffffff' : themeLabelColor }),
      }, viewMode === 'galaxy' ? { image: n.galaxyImage } : {});
    }
    const dimColor = viewMode === 'galaxy'
      ? galaxyTransparentColor()
      : { background: '#33334a', border: '#2a2a3e', highlight: { background: '#33334a', border: '#2a2a3e' } };
    return Object.assign({
      id: n.id,
      color: dimColor,
      font: Object.assign({}, n.font, { color: viewMode === 'galaxy' ? '#8a8fa8' : '#5f5f75' }),
    }, viewMode === 'galaxy' ? { image: n.galaxyDimImage || n.galaxyImage } : {});
  }));
  const accent = flow ? flowColorFor(flow) : null;
  const updates = [];
  edgesDS.get().forEach(function (e) {
    if (!flow) {
      const base = RAW_EDGES[e.id];
      updates.push({ id: e.id, width: base ? base.width : 2, color: base ? base.color : { color: '#8892a6', opacity: 0.7 } });
    } else if (edgeInFlow(e, flow)) {
      updates.push({ id: e.id, width: 4, color: { color: accent, opacity: 1 } });
    } else {
      updates.push({ id: e.id, width: 1, color: { color: '#8892a6', opacity: 0.08 } });
    }
  });
  if (updates.length) edgesDS.update(updates);
  updateLegendFocus();
  network.redraw();
  view3dApplyColors();
}
function galaxyHash(text) {
  const value = String(text);
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function edgeGalaxyColor(edge) {
  let flow = Array.isArray(edge.flows) && edge.flows.length ? edge.flows[0] : null;
  if (!flow) {
    const fromNode = nodesDS.get(edge.from);
    const toNode = nodesDS.get(edge.to);
    const fromFlows = fromNode ? nodeFlows(fromNode) : [];
    const toFlows = toNode ? nodeFlows(toNode) : [];
    flow = fromFlows[0] || toFlows[0] || null;
  }
  return flow ? flowColorFor(flow) : '#8892a6';
}

function organigramPositions() {
  const ids = RAW_NODES.map(function (node) { return String(node.id); });
  const incoming = new Map();
  const outgoing = new Map();
  const nodeById = new Map();
  RAW_NODES.forEach(function (node) {
    const id = String(node.id);
    incoming.set(id, 0);
    outgoing.set(id, []);
    nodeById.set(id, node);
  });
  RAW_EDGES.forEach(function (edge) {
    const from = String(edge.from);
    const to = String(edge.to);
    if (!outgoing.has(from) || !incoming.has(to)) return;
    outgoing.get(from).push(to);
    incoming.set(to, (incoming.get(to) || 0) + 1);
  });
  const levels = new Map();
  let roots = ids.filter(function (id) { return (incoming.get(id) || 0) === 0; });
  if (!roots.length && ids.length) roots = [ids[0]];
  const queue = [];
  roots.forEach(function (id) { levels.set(id, 0); queue.push(id); });
  while (queue.length) {
    const id = queue.shift();
    const nextLevel = (levels.get(id) || 0) + 1;
    (outgoing.get(id) || []).forEach(function (next) {
      if (!levels.has(next)) {
        levels.set(next, nextLevel);
        queue.push(next);
      }
    });
  }
  ids.forEach(function (id) { if (!levels.has(id)) levels.set(id, 0); });
  const groups = new Map();
  ids.forEach(function (id) {
    const level = levels.get(id);
    if (!groups.has(level)) groups.set(level, []);
    groups.get(level).push(id);
  });
  const flowOrder = new Map();
  LEGEND.forEach(function (flow, index) { flowOrder.set(flow.cid, index); });
  const positions = new Map();
  Array.from(groups.keys()).sort(function (a, b) { return a - b; }).forEach(function (level) {
    const list = groups.get(level).slice().sort(function (left, right) {
      const a = nodeById.get(left);
      const b = nodeById.get(right);
      const af = a ? flowOrder.get(a.flow) || 0 : 0;
      const bf = b ? flowOrder.get(b.flow) || 0 : 0;
      if (af !== bf) return af - bf;
      return String(a ? a.label : left).localeCompare(String(b ? b.label : right));
    });
    const width = (list.length - 1) * 170;
    list.forEach(function (id, index) {
      positions.set(id, { x: -width / 2 + index * 170, y: level * 150 });
    });
  });
  return positions;
}

function galaxyPositions() {
  const centers = new Map();
  const count = Math.max(1, LEGEND.length);
  LEGEND.forEach(function (flow, index) {
    const angle = index * 2.399963 + 0.35;
    const radius = 165 + (index / count) * 235;
    centers.set(flow.cid, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  });
  const positions = new Map();
  RAW_NODES.forEach(function (node) {
    const flows = nodeFlows(node);
    const known = flows.map(function (flow) { return centers.get(flow); }).filter(Boolean);
    let cx = 0;
    let cy = 0;
    if (known.length) {
      known.forEach(function (center) { cx += center.x; cy += center.y; });
      cx /= known.length;
      cy /= known.length;
    } else {
      const base = galaxyHash(node.id) * Math.PI * 2;
      cx = Math.cos(base) * 90;
      cy = Math.sin(base) * 90;
    }
    const angle = galaxyHash(String(node.id) + ':angle') * Math.PI * 2;
    const radius = node.shared
      ? 22 + galaxyHash(String(node.id) + ':shared') * 38
      : 54 + galaxyHash(String(node.id) + ':radius') * 92 + Math.min(10, node.degree || 0) * 3;
    positions.set(node.id, { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  });
  return positions;
}

function updateViewButtons() {
  document.querySelectorAll('[data-view-mode]').forEach(function (button) {
    button.setAttribute('aria-pressed', String(button.dataset.viewMode === viewMode));
  });
}

function stopViewAnimation() {
  if (viewAnimationFrame) {
    cancelAnimationFrame(viewAnimationFrame);
    viewAnimationFrame = null;
  }
}

function animateViewPositions(targets, duration) {
  stopViewAnimation();
  if (!targets) return;
  const start = new Map();
  RAW_NODES.forEach(function (node) {
    const current = nodesDS.get(node.id);
    start.set(String(node.id), {
      x: Number(current && current.x) || 0,
      y: Number(current && current.y) || 0,
    });
  });
  const ids = Array.from(targets.keys());
  const started = performance.now();
  function frame(now) {
    const progress = Math.min(1, (now - started) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    nodesDS.update(ids.map(function (id) {
      const from = start.get(id) || { x: 0, y: 0 };
      const to = targets.get(id) || from;
      return {
        id: id,
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased,
      };
    }));
    network.redraw();
    if (progress < 1) {
      viewAnimationFrame = requestAnimationFrame(frame);
      return;
    }
    viewAnimationFrame = null;
    const fitIds = focusedFlowId ? flowNodeIds(focusedFlowId) : RAW_NODES.map(function (node) { return node.id; });
    network.fit({ nodes: fitIds, animation: { duration: 450, easingFunction: 'easeInOutQuad' } });
  }
  viewAnimationFrame = requestAnimationFrame(frame);
}

function build3dData() {
  return {
    nodes: RAW_NODES.map(function (node) { return Object.assign({}, node); }),
    links: RAW_EDGES.map(function (edge, index) {
      return { id: index, source: edge.from, target: edge.to, flows: edge.flows };
    }),
  };
}

const graphElFor3d = document.getElementById('graph');
if (graphElFor3d && typeof ResizeObserver === 'function') {
  const resize3dObserver = new ResizeObserver(function () {
    if (viewMode !== '3d') return;
    position3dContainer();
    if (view3dGraph) view3dGraph.width(graph3dEl.clientWidth).height(graph3dEl.clientHeight);
  });
  resize3dObserver.observe(graphElFor3d);
}

function position3dContainer() {
  if (!graph3dEl) return;
  const graphEl = document.getElementById('graph');
  if (!graphEl) return;
  const rect = graphEl.getBoundingClientRect();
  graph3dEl.style.left = rect.left + 'px';
  graph3dEl.style.top = rect.top + 'px';
  graph3dEl.style.width = rect.width + 'px';
  graph3dEl.style.height = rect.height + 'px';
}

function view3dNodeColor(node) {
  if (!node) return '#ffffff';
  const base = node.shared ? '#ffd166' : (node.color && node.color.background) || '#ffffff';
  if (!view3dFocusedFlow) return base;
  return nodeFlows(node).indexOf(view3dFocusedFlow) !== -1 ? base : '#2a3048';
}

function view3dLinkColor(link) {
  const base = edgeGalaxyColor(link);
  if (!view3dFocusedFlow) return base;
  const flows = Array.isArray(link.flows) ? link.flows : [];
  return flows.indexOf(view3dFocusedFlow) !== -1 ? base : '#3a4055';
}

function view3dApplyColors() {
  view3dFocusedFlow = focusedFlowId || null;
  if (!view3dGraph) return;
  view3dGraph
    .nodeColor(function (node) { return view3dNodeColor(node); })
    .linkColor(function (link) { return view3dLinkColor(link); })
    .linkWidth(function (link) {
      return view3dFocusedFlow && Array.isArray(link.flows) && link.flows.indexOf(view3dFocusedFlow) !== -1 ? 2.1 : 1.15;
    });
  view3dGraph.refresh();
}

function focus3dFlow(flowId) {
  if (!view3dGraph || flowId === null || flowId === undefined || flowId === '') return;
  const nodes = view3dGraph.graphData().nodes.filter(function (node) {
    return nodeFlows(node).indexOf(flowId) !== -1;
  });
  if (!nodes.length) return;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  nodes.forEach(function (node) {
    cx += Number(node.x) || 0;
    cy += Number(node.y) || 0;
    cz += Number(node.z) || 0;
  });
  cx /= nodes.length;
  cy /= nodes.length;
  cz /= nodes.length;
  let spread = 0;
  nodes.forEach(function (node) {
    const dx = (Number(node.x) || 0) - cx;
    const dy = (Number(node.y) || 0) - cy;
    const dz = (Number(node.z) || 0) - cz;
    spread = Math.max(spread, Math.sqrt(dx * dx + dy * dy + dz * dz));
  });
  const distance = Math.max(140, spread * 2.5);
  view3dGraph.cameraPosition(
    { x: cx + distance * 0.35, y: cy + distance * 0.22, z: cz + distance },
    { x: cx, y: cy, z: cz },
    900
  );
}

function select3dFlow(flowId) {
  if (flowId === null || flowId === undefined || flowId === '') return;
  focusedFlowId = String(flowId);
  applyFlowFocus();
  updateLegendFocus();
  const flow = setEvidenceFlow(String(flowId));
  if (flow && flow.mermaid) setEvidenceTab('sequence');
  else if (flowNeedsTest(flow)) setEvidenceTab('implement');
  focus3dFlow(focusedFlowId);
}

function ensure3dGraph() {
  if (typeof ForceGraph3D === 'undefined') {
    if (graph3dEl) {
      graph3dEl.innerHTML = '<div class="ev-seq-empty" style="padding:24px">La vista 3D no está disponible: falta el bundle vendorizado.</div>';
    }
    return null;
  }
  if (!view3dGraph) {
    view3dGraph = ForceGraph3D()(graph3dEl)
      .backgroundColor('#05060f')
      .showNavInfo(false)
      .nodeLabel('')
      .nodeRelSize(4)
      .nodeOpacity(0.95)
      .nodeColor(view3dNodeColor)
      .nodeVal(function (node) {
        return Math.max(1, galaxyStarWeight(node || {}));
      })
      .linkColor(view3dLinkColor)
      .linkOpacity(0.4)
      .linkWidth(function (link) {
        return view3dFocusedFlow && Array.isArray(link.flows) && link.flows.indexOf(view3dFocusedFlow) !== -1 ? 2.1 : 1.15;
      })
      .linkDirectionalArrowLength(3)
      .linkDirectionalArrowRelPos(1)
      .onNodeHover(function (node) {
        if (node) {
          hideEdgePreviewNow();
          showNodePreview(node.id);
        } else {
          scheduleHideNodePreview();
        }
      })
      .onLinkHover(function (link) {
        if (link) {
          hideNodePreviewNow();
          showEdgePreview(link.id);
        } else {
          scheduleHideEdgePreview();
        }
      })
      .onNodeClick(function (node) {
        const flows = node ? nodeFlows(node) : [];
        const flowId = focusedFlowId && flows.indexOf(focusedFlowId) !== -1
          ? focusedFlowId
          : (node && node.flow !== undefined && node.flow !== null ? node.flow : flows[0]);
        select3dFlow(flowId);
        hideNodePreviewNow();
      })
      .onLinkClick(function (link) {
        const target = edgeTargetFor(link.id);
        if (target) select3dFlow(target.flowId);
        hideEdgePreviewNow();
      })
      .onBackgroundClick(function () {
        hideNodePreviewNow();
        hideEdgePreviewNow();
      });
  }
  position3dContainer();
  const width = (graph3dEl && graph3dEl.clientWidth) || document.getElementById('graph').clientWidth;
  const height = (graph3dEl && graph3dEl.clientHeight) || document.getElementById('graph').clientHeight;
  view3dGraph.width(width).height(height);
  view3dGraph.graphData(build3dData());
  view3dFocusedFlow = focusedFlowId || null;
  view3dApplyColors();
  setTimeout(function () { if (viewMode === '3d') view3dApplyColors(); }, 180);
  view3dGraph.resumeAnimation();
  setTimeout(function () {
    if (viewMode === '3d' && view3dGraph) view3dGraph.zoomToFit(800, 70);
  }, 500);
  return view3dGraph;
}

function applyViewMode(mode) {
  viewMode = mode === 'galaxy' || mode === 'organigram' || mode === '3d' ? mode : 'original';
  stopViewAnimation();
  try { localStorage.setItem(VIEW_KEY, viewMode); } catch (e) {}
  document.body.classList.toggle('galaxy-view', viewMode === 'galaxy');
  document.body.classList.toggle('view-3d', viewMode === '3d');
  if (graph3dEl) graph3dEl.hidden = viewMode !== '3d';
  updateViewButtons();
  if (viewMode === '3d') {
    network.stopSimulation();
    ensure3dGraph();
    return;
  }
  if (view3dGraph) view3dGraph.pauseAnimation();
  if (viewMode === 'galaxy') {
    network.stopSimulation();
    network.setOptions({ physics: { enabled: false } });
    const positions = galaxyPositions();
    const maxStarWeight = RAW_NODES.reduce(function (max, node) {
      return Math.max(max, galaxyStarWeight(node));
    }, 0);
    RAW_NODES.forEach(function (node) {
      const glow = galaxyNodeGlow(node);
      node.galaxyImage = createStarSprite(glow, false);
      node.galaxyDimImage = createStarSprite(glow, true);
      node.galaxyStarSize = galaxyStarSize(node, maxStarWeight);
    });
    nodesDS.update(RAW_NODES.map(function (node) {
      return {
        id: node.id,
        shape: 'image',
        image: node.galaxyImage,
        shapeProperties: { useImageSize: false },
        size: node.galaxyStarSize,
        borderWidth: 0,
        borderWidthSelected: 0,
        color: galaxyTransparentColor(),
        shadow: { enabled: false },
      };
    }));
    edgesDS.update(RAW_EDGES.map(function (edge, index) {
      return { id: index, color: { color: edgeGalaxyColor(edge), opacity: 0.5 }, width: 1.5 };
    }));
    applyFlowFocus();
    animateViewPositions(positions, 820);
    return;
  } else if (viewMode === 'organigram') {
    network.stopSimulation();
    network.setOptions({ physics: { enabled: false } });
    const positions = organigramPositions();
    nodesDS.update(RAW_NODES.map(function (node) {
      return {
        id: node.id,
        shape: 'image',
        image: node.image,
        shapeProperties: node.shapeProperties,
        size: node.size,
        borderWidth: node.shared ? 3 : 1.5,
        borderWidthSelected: 2,
        shadow: { enabled: false },
      };
    }));
    edgesDS.update(RAW_EDGES.map(function (edge, index) {
      return { id: index, color: edge.color, width: edge.width };
    }));
    applyFlowFocus();
    animateViewPositions(positions, 820);
    return;
  } else {
    network.setOptions({ physics: { enabled: true } });
    nodesDS.update(RAW_NODES.map(function (node) {
      return {
        id: node.id,
        shape: 'image',
        image: node.image,
        shapeProperties: node.shapeProperties,
        size: node.size,
        borderWidth: node.shared ? 3 : 1.5,
        borderWidthSelected: 2,
        shadow: { enabled: false },
      };
    }));
    edgesDS.update(RAW_EDGES.map(function (edge, index) {
      return { id: index, color: edge.color, width: edge.width };
    }));
    network.stabilize(180);
    network.fit({ animation: true });
  }
  applyFlowFocus();
}

document.querySelectorAll('[data-view-mode]').forEach(function (button) {
  button.addEventListener('click', function () { applyViewMode(button.dataset.viewMode); });
});

function focusFlow(flow) {
  if (flow === null || flow === undefined || flow === '') return;
  focusedFlowId = flow;
  applyFlowFocus();
  const ids = flowNodeIds(flow);
  if (ids.length) network.fit({ nodes: ids, animation: true });
}
function clearFlowFocus() {
  focusedFlowId = null;
  applyFlowFocus();
  network.fit({ animation: true });
  if (viewMode === '3d' && view3dGraph) view3dGraph.zoomToFit(800, 70);
}
function setFlowFocus(flow, zoom) {
  if (flow === null || flow === undefined || flow === '' || flow === focusedFlowId) {
    clearFlowFocus();
    return;
  }
  focusedFlowId = flow;
  applyFlowFocus();
  const ids = flowNodeIds(flow);
  if (zoom && ids.length) network.fit({ nodes: ids, animation: true });
  if (viewMode === '3d' && view3dGraph && ids.length) {
    focus3dFlow(flow);
  }
  const flowData = setEvidenceFlow(String(flow));
  if (flowData && flowData.mermaid) {
    setEvidenceTab('sequence');
  } else if (network.getSelectedNodes().length === 0 && flowNeedsTest(flowData)) {
    setEvidenceTab('implement');
  }
}
const flowFocusClear = document.getElementById('flow-focus-clear');
if (flowFocusClear) flowFocusClear.addEventListener('click', function () { clearFlowFocus(); });
updateLegendFocus();

const EVIDENCE_BY_FLOW = {};
EVIDENCE.flows.forEach(function (f) { EVIDENCE_BY_FLOW[String(f.id)] = f; });

const viewerState = { cursorMs: -1, track: [], animTrack: [], activeNode: null };

const playback = { playing: false, ms: 0, duration: 0, speed: 1, rafId: null, lastTs: 0 };

function nodeKind(id) {
  const n = nodesDS.get(id);
  return n && n.kind ? n.kind : 'interaction';
}

function nodePayload(id) {
  const n = nodesDS.get(id);
  return n && n.payload ? String(n.payload) : '';
}

function nodeResponse(id) {
  const n = nodesDS.get(id);
  return n && n.response ? n.response : null;
}

function buildAnimTrack(track, dwell) {
  const sorted = (Array.isArray(track) ? track.slice() : []).sort(function (a, b) { return (Number(a.startMs) || 0) - (Number(b.startMs) || 0); });
  const anim = [];
  let acc = 0;
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const startMs = Number(entry.startMs) || 0;
    const rawEnd = Number(entry.endMs);
    const endMs = isFinite(rawEnd) && rawEnd >= startMs ? rawEnd : startMs;
    const displayDur = Math.max(endMs - startMs, dwell);
    anim.push({
      node: entry.node,
      startMs: startMs,
      endMs: endMs,
      stepTitle: entry.stepTitle,
      approx: entry.approx,
      displayStart: acc,
      displayDur: displayDur,
      displayEnd: acc + displayDur,
    });
    acc += displayDur;
  }
  return anim;
}

function animIndexAt(track, d) {
  let fallback = -1;
  let containing = -1;
  let progress = 1;
  for (let i = 0; i < track.length; i++) {
    const entry = track[i];
    const start = Number(entry.displayStart);
    const end = Number(entry.displayEnd);
    if (!isFinite(start) || !isFinite(end)) continue;
    if (start > d) break;
    fallback = i;
    if (d < end) {
      containing = i;
      progress = end > start ? (d - start) / (end - start) : 1;
      break;
    }
  }
  const index = containing >= 0 ? containing : fallback;
  return { index: index, progress: progress < 0 ? 0 : (progress > 1 ? 1 : progress) };
}

function trackIndexAt(track, ms) {
  return animIndexAt(track, ms).index;
}

function displayTotalMs() {
  const track = viewerState.animTrack;
  return track.length ? Number(track[track.length - 1].displayEnd) || 0 : 0;
}

function mediaMsForDisplay(d) {
  const found = animIndexAt(viewerState.animTrack, d);
  if (found.index < 0) return 0;
  const entry = viewerState.animTrack[found.index];
  const start = Number(entry.startMs) || 0;
  const end = Number(entry.endMs);
  const realEnd = isFinite(end) ? end : start;
  return start + found.progress * (realEnd - start);
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawTargetRing(ctx, target, alpha) {
  if (!target) return;
  ctx.beginPath();
  ctx.arc(target.x, target.y, 15, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(99,102,241,' + (0.18 * alpha) + ')';
  ctx.fill();
  ctx.strokeStyle = 'rgba(99,102,241,' + (0.6 * alpha) + ')';
  ctx.lineWidth = 2;
  ctx.stroke();
}

const TRAIL_MS = 300;

const ANIM_DWELL_MS = 900;

function drawActiveRing(ctx, target) {
  if (!target) return;
  const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  const pulse = 0.5 + 0.5 * Math.sin(now / 280);
  ctx.beginPath();
  ctx.arc(target.x, target.y, 16 + 3 * pulse, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(target.x, target.y, 16 + 3 * pulse, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(99,102,241,0.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawCursorMarker(ctx, x, y, t, target) {
  drawTargetRing(ctx, target, 0.5 + 0.5 * t);
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 18);
  ctx.lineTo(5, 13);
  ctx.lineTo(9, 20);
  ctx.lineTo(12.5, 18);
  ctx.lineTo(8.5, 11);
  ctx.lineTo(15, 11);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#16162a';
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  if (target && t > 0.72) {
    const p = (t - 0.72) / 0.28;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 10 + 20 * p, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.8 * (1 - p)) + ')';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
}

function drawPacketMarker(ctx, x, y, t, payload) {
  drawTargetRing(ctx, { x: x, y: y }, 0.4);
  ctx.save();
  roundRectPath(ctx, x - 11, y - 8, 22, 16, 3);
  ctx.fillStyle = '#4C6EF5';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('{}', x, y + 0.5);
  if (payload) {
    const text = payload.length > 26 ? payload.slice(0, 25) + '\u2026' : payload;
    ctx.font = '10px monospace';
    const w = ctx.measureText(text).width + 10;
    roundRectPath(ctx, x + 15, y - 8, w, 16, 3);
    ctx.fillStyle = 'rgba(15,15,26,0.88)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#e0e0e0';
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 20, y + 0.5);
  }
  ctx.restore();
}

function drawResponseMarker(ctx, x, y, status) {
  ctx.save();
  const text = status ? '\\u21a9 ' + status : '\\u21a9';
  ctx.font = 'bold 10px monospace';
  const w = Math.max(20, ctx.measureText(text).width + 12);
  roundRectPath(ctx, x - w / 2, y - 8, w, 16, 3);
  ctx.fillStyle = '#2f9e6f';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

function drawDecisionMarker(ctx, x, y, target) {
  drawTargetRing(ctx, target, 0.5);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#B07AA1';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.fillRect(-7, -7, 14, 14);
  ctx.strokeRect(-7, -7, 14, 14);
  ctx.restore();
}

function drawDbPulse(ctx, target, t) {
  if (!target) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(target.x, target.y, 12 + 22 * t, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(232,163,61,' + (0.9 * (1 - t)) + ')';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(target.x, target.y, 5 + 3 * (1 - t), 0, Math.PI * 2);
  ctx.fillStyle = '#E8A33D';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function activeEntryIndices(track, ms, trailMs) {
  const active = [];
  const trail = [];
  for (let i = 0; i < track.length; i++) {
    const entry = track[i];
    const startMs = Number(entry.displayStart);
    const endMs = Number(entry.displayEnd);
    if (!isFinite(startMs) || !isFinite(endMs)) continue;
    if (startMs <= ms && ms < endMs) active.push(i);
    else if (endMs <= ms && ms - endMs < trailMs) trail.push(i);
  }
  return { active: active, trail: trail };
}

function overlayPositions(track, indices) {
  const raw = [];
  const seen = {};
  for (let k = 0; k < indices.length; k++) {
    const i = indices[k];
    const entry = track[i];
    const prev = i > 0 ? track[i - 1] : entry;
    [entry.node, prev.node].forEach(function (id) {
      if (id === null || id === undefined) return;
      const key = String(id);
      if (!key || seen[key]) return;
      seen[key] = true;
      raw.push(id);
    });
  }
  return raw.length ? network.getPositions(raw) : {};
}

function drawEntryMarker(ctx, track, i, positions, d, mode) {
  const seg = track[i];
  const prev = i > 0 ? track[i - 1] : seg;
  const to = positions[String(seg.node)];
  const from = positions[String(prev.node)];
  const startMs = Number(seg.displayStart);
  const dur = Number(seg.displayDur);
  let t = 1;
  if (from && to && dur > 0) {
    t = (d - startMs) / dur;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
  }
  const anchor = to || from;
  let placed = false;
  let x = 0;
  let y = 0;
  if (from && to) {
    x = from.x + (to.x - from.x) * t;
    y = from.y + (to.y - from.y) * t;
    placed = true;
  } else if (anchor) {
    x = anchor.x + 24;
    y = anchor.y + 20;
    placed = true;
  }
  if (!placed) return;
  const kind = nodeKind(seg.node);
  ctx.save();
  if (mode === 'trail') ctx.globalAlpha = Math.max(0.08, 1 - (d - Number(seg.displayEnd)) / TRAIL_MS);
  if (mode === 'active') {
    drawActiveRing(ctx, from);
    drawActiveRing(ctx, to);
  }
  if (kind === 'db') drawDbPulse(ctx, anchor, t);
  else if (kind === 'backend') {
    drawPacketMarker(ctx, x, y, t, nodePayload(seg.node));
    const response = nodeResponse(seg.node);
    if (response && t >= 0.45) {
      let rx;
      let ry;
      if (from && to) {
        const back = (t - 0.45) / 0.55;
        const bp = back < 0 ? 0 : (back > 1 ? 1 : back);
        rx = to.x + (from.x - to.x) * bp;
        ry = to.y + (from.y - to.y) * bp;
      } else {
        rx = anchor.x + 24;
        ry = anchor.y + 20;
      }
      drawResponseMarker(ctx, rx, ry, response.status);
    }
  }
  else if (kind === 'decision') drawDecisionMarker(ctx, x, y, anchor);
  else drawCursorMarker(ctx, x, y, t, anchor);
  ctx.restore();
}

function drawTimelineOverlay(ctx) {
  const ms = viewerState.cursorMs;
  const track = viewerState.animTrack;
  if (ms < 0 || !track.length) return;
  const found = activeEntryIndices(track, ms, TRAIL_MS);
  if (!found.active.length && !found.trail.length) return;
  const positions = overlayPositions(track, found.active.concat(found.trail));
  for (let k = 0; k < found.trail.length; k++) drawEntryMarker(ctx, track, found.trail[k], positions, ms, 'trail');
  for (let k = 0; k < found.active.length; k++) drawEntryMarker(ctx, track, found.active[k], positions, ms, 'active');
}
network.on('afterDrawing', drawTimelineOverlay);

window.flowlensViewer = {
  selectNode: function (id) { focusNode(id); },
  highlightNode: function (id) { network.selectNodes([id]); network.redraw(); },
  onTime: function (ms) {
    const value = Number(ms);
    if (!isFinite(value) || value < 0) {
      viewerState.cursorMs = -1;
      viewerState.activeNode = null;
      network.selectNodes([]);
      highlightActiveStep(null);
      network.redraw();
      return;
    }
    viewerState.cursorMs = value;
    const idx = animIndexAt(viewerState.animTrack, value).index;
    const nodeId = idx >= 0 ? String(viewerState.animTrack[idx].node) : null;
    if (nodeId !== viewerState.activeNode) {
      viewerState.activeNode = nodeId;
      if (nodeId !== null) network.selectNodes([nodeId]);
    }
    highlightActiveStep(idx);
    network.redraw();
  },
  setTrack: function (track) {
    viewerState.track = Array.isArray(track) ? track : [];
    viewerState.animTrack = buildAnimTrack(viewerState.track, ANIM_DWELL_MS);
    viewerState.cursorMs = -1;
    viewerState.activeNode = null;
    network.redraw();
  },
};

const evidenceBody = document.getElementById('evidence-body');
const evidenceTabsRow = document.getElementById('evidence-tabs-row');
const evidencePanelEl = document.getElementById('evidence-panel');
const evidencePlaceholderEl = document.getElementById('evidence-placeholder');
const evidenceFloatBtn = document.getElementById('evidence-float-btn');
const evidenceDockBtn = document.getElementById('evidence-dock-btn');
const floatLayerEl = document.getElementById('float-layer');
const evTabButtons = Array.prototype.slice.call(document.querySelectorAll('[data-ev-tab]'));
const implementTabBtn = document.querySelectorAll('[data-ev-tab="implement"]')[0] || null;
const evidenceState = { flowId: null, testIndex: 0, tab: 'video', videoBaseMs: 0, track: [], appliedKey: null };
let evVideo = null;
let evTraceFrame = null;
let floatWindow = null;
let floatMaximized = false;
let floatRestoreRect = null;
let floatDrag = null;
let floatResizeObserver = null;
const sequenceModalEl = document.getElementById('sequence-modal');
const sequenceModalCanvas = document.getElementById('sequence-modal-canvas');
const sequenceModalTitleEl = document.getElementById('sequence-modal-title');
const sequenceModalZoomEl = document.getElementById('sequence-modal-zoom');
const sequenceModalClose = document.getElementById('sequence-modal-close');
const sequenceModalZoomOut = document.getElementById('sequence-modal-zoom-out');
const sequenceModalZoomIn = document.getElementById('sequence-modal-zoom-in');
const sequenceModalZoomReset = document.getElementById('sequence-modal-zoom-reset');
const sequenceModalFullscreen = document.getElementById('sequence-modal-fullscreen');
let sequenceState = { code: '', flowId: null, zoom: 1 };
let sequenceModalState = { code: '', flowId: null, zoom: 1 };
let sequenceRenderId = 0;
const flowPreviewEl = document.getElementById('flow-preview');
const flowPreviewTitleEl = document.getElementById('flow-preview-title');
const flowPreviewCanvas = document.getElementById('flow-preview-canvas');
const sequencePreviewCache = new Map();
let flowPreviewFlowId = null;
let flowPreviewHideTimer = null;
let flowPreviewToken = 0;
const nodePreviewEl = document.getElementById('node-preview');
const nodePreviewTitleEl = document.getElementById('node-preview-title');
const nodePreviewBodyEl = document.getElementById('node-preview-body');
const edgePreviewEl = document.getElementById('edge-preview');
const edgePreviewTitleEl = document.getElementById('edge-preview-title');
const edgePreviewCanvas = document.getElementById('edge-preview-canvas');
const edgePreviewHintEl = document.getElementById('edge-preview-hint');
const nodeModalEl = document.getElementById('node-modal');
const nodeModalTitleEl = document.getElementById('node-modal-title');
const nodeModalBodyEl = document.getElementById('node-modal-body');
const nodeModalClose = document.getElementById('node-modal-close');
let nodePreviewNodeId = null;
let nodePreviewHideTimer = null;
let edgePreviewFlowId = null;
let edgePreviewHideTimer = null;
let edgePreviewToken = 0;
let lastPointer = { x: 0, y: 0 };
document.addEventListener('pointermove', function (event) {
  lastPointer = { x: event.clientX, y: event.clientY };
});

function flowNeedsTest(flow) {
  return !!flow && (flow.coverage === 'partial' || flow.coverage === 'uncovered');
}

function currentEvidenceFlow() {
  return EVIDENCE_BY_FLOW[String(evidenceState.flowId)] || null;
}

function updateImplementTab() {
  if (!implementTabBtn) return;
  const needs = flowNeedsTest(currentEvidenceFlow());
  implementTabBtn.hidden = !needs;
  implementTabBtn.disabled = !needs;
  if (!needs && evidenceState.tab === 'implement') {
    evidenceState.tab = 'video';
    evTabButtons.forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-ev-tab') === 'video'));
    });
  }
}

function setEvidenceFlow(flowId) {
  const id = flowId === null || flowId === undefined ? '' : String(flowId);
  const changed = evidenceState.flowId !== id;
  evidenceState.flowId = id;
  if (changed) { evidenceState.testIndex = 0; evidenceState.appliedKey = null; }
  const flow = currentEvidenceFlow();
  updateImplementTab();
  updateFloatTitle();
  if (changed) {
    applyCurrentTest();
    const autoImplement = flowNeedsTest(flow) && (!flow.tests || !flow.tests.length);
    setEvidenceTab(autoImplement ? 'implement' : evidenceState.tab);
  }
  return flow;
}

function ensureVideo() {
  if (evVideo) return evVideo;
  evVideo = document.createElement('video');
  evVideo.className = 'ev-video';
  evVideo.controls = true;
  evVideo.preload = 'metadata';
  evVideo.addEventListener('timeupdate', function () {
    if (!evVideo.getAttribute('src')) return;
    if (playback.playing) return;
    if (viewerState.animTrack.length) { updateControls(); return; }
    playback.ms = evVideo.currentTime * 1000;
    applyPlaybackMs();
  });
  evVideo.addEventListener('pause', function () { if (playback.playing) pausePlayback(); });
  evVideo.addEventListener('ended', function () {
    pausePlayback();
    playback.ms = playback.duration;
    updateControls();
    if (window.flowlensViewer) window.flowlensViewer.onTime(-1);
  });
  evVideo.addEventListener('loadedmetadata', function () {
    playback.duration = playbackDuration();
    updateControls();
  });
  return evVideo;
}

function removeTraceFrame() {
  if (evTraceFrame && evTraceFrame.parentNode) evTraceFrame.parentNode.removeChild(evTraceFrame);
  evTraceFrame = null;
}

function setTraceLayout(on) {
  const panel = document.getElementById('evidence-panel');
  if (!panel) return;
  if (on) { evidenceBody.classList.add('ev-body-trace'); panel.classList.add('ev-trace-active'); }
  else { evidenceBody.classList.remove('ev-body-trace'); panel.classList.remove('ev-trace-active'); }
}

function setVideoLayout(on) {
  if (!evidenceBody) return;
  if (on) evidenceBody.classList.add('ev-body-video');
  else evidenceBody.classList.remove('ev-body-video');
}

function appendEmpty(text) {
  const div = document.createElement('div');
  div.className = 'ev-empty';
  div.textContent = text;
  evidenceBody.appendChild(div);
}

function appendFlowHeader(flow) {
  const title = document.createElement('div');
  title.className = 'ev-flow';
  title.textContent = flow ? flow.title : String(evidenceState.flowId);
  evidenceBody.appendChild(title);
  if (flow && flow.coverage) {
    const meta = document.createElement('div');
    meta.className = 'ev-note';
    meta.textContent = flow.coverage + (flow.notes ? ' - ' + flow.notes : '');
    evidenceBody.appendChild(meta);
  }
}

function appendTestSelector(flow) {
  const select = document.createElement('select');
  select.className = 'ev-test-select';
  flow.tests.forEach(function (test, i) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = test.title || test.spec || ('Test ' + (i + 1));
    if (i === evidenceState.testIndex) option.selected = true;
    select.appendChild(option);
  });
  select.addEventListener('change', function () {
    evidenceState.testIndex = Number(select.value) || 0;
    evidenceState.appliedKey = null;
    applyCurrentTest();
    renderEvidenceBody();
  });
  evidenceBody.appendChild(select);
}

function applyTest(flow, test) {
  const result = test && test.results && test.results.length ? test.results[0] : null;
  evidenceState.videoBaseMs = result ? result.videoBaseMs : 0;
  evidenceState.track = result && Array.isArray(result.entries) ? result.entries : [];
  const key = flow.id + '#' + evidenceState.testIndex;
  if (key === evidenceState.appliedKey) return;
  evidenceState.appliedKey = key;
  if (window.flowlensViewer) window.flowlensViewer.setTrack(evidenceState.track);
  const video = ensureVideo();
  if (result && result.videoSrc) video.src = result.videoSrc;
  else video.removeAttribute('src');
  try { video.load(); } catch (e) {}
  resetPlayback();
}

function applyCurrentTest() {
  const flow = EVIDENCE_BY_FLOW[String(evidenceState.flowId)];
  if (!flow || !flow.tests || !flow.tests.length) {
    evidenceState.track = [];
    evidenceState.videoBaseMs = 0;
    if (window.flowlensViewer) window.flowlensViewer.setTrack([]);
    resetPlayback();
    return null;
  }
  const test = flow.tests[evidenceState.testIndex] || flow.tests[0];
  applyTest(flow, test);
  return test;
}

function renderVideoTab(result) {
  removeTraceFrame();
  if (!result || !result.videoSrc) { appendEmpty('sin video'); return; }
  const wrap = document.createElement('div');
  wrap.className = 'ev-video-wrap';
  wrap.appendChild(ensureVideo());
  evidenceBody.appendChild(wrap);
  setVideoLayout(true);
}

function renderTraceTab(result) {
  if (!result || !result.traceSrc) { appendEmpty('sin trace'); return; }
  removeTraceFrame();
  evTraceFrame = document.createElement('iframe');
  evTraceFrame.className = 'ev-trace';
  evTraceFrame.setAttribute('title', 'Playwright trace viewer');
  evTraceFrame.setAttribute('src', result.traceSrc);
  evidenceBody.appendChild(evTraceFrame);
  setTraceLayout(true);
}

function renderStepsTab(result) {
  removeTraceFrame();
  const entries = viewerState.animTrack.length ? viewerState.animTrack : (result && Array.isArray(result.entries) ? result.entries : []);
  if (!entries.length) { appendEmpty('sin pasos'); return; }
  const list = document.createElement('ol');
  list.className = 'ev-steps';
  entries.forEach(function (entry, i) {
    const item = document.createElement('li');
    item.className = 'ev-step';
    item.setAttribute('data-step-index', String(i));
    const title = document.createElement('span');
    title.className = 'ev-step-title';
    title.textContent = entry.stepTitle || String(entry.node);
    const dur = document.createElement('span');
    dur.className = 'ev-step-dur';
    const span = entry.displayDur !== undefined ? entry.displayDur : (entry.endMs - entry.startMs);
    dur.textContent = (span > 0 ? span : 0) + ' ms';
    item.appendChild(title);
    item.appendChild(dur);
    item.addEventListener('click', function () { seekToEntry(entry); });
    list.appendChild(item);
  });
  evidenceBody.appendChild(list);
  const idx = viewerState.cursorMs >= 0 ? trackIndexAt(viewerState.animTrack, viewerState.cursorMs) : -1;
  highlightActiveStep(idx >= 0 ? idx : null);
}

function cliQuote(value, platform) {
  const text = String(value ?? '');
  if (platform === 'win32') return '"' + text.replace(/"/g, '""') + '"';
  if (!text) return "''";
  return "'" + text.replace(/'/g, "'\\''") + "'";
}

function trimTrailingSeparators(value) {
  const separator = String.fromCharCode(92);
  let text = String(value ?? '');
  while (text.length && (text.charAt(text.length - 1) === '/' || text.charAt(text.length - 1) === separator)) {
    text = text.slice(0, -1);
  }
  return text;
}

function buildTestCommand(task) {
  const agent = EVIDENCE.agent || {};
  const platform = agent.platform || (navigator.userAgent.indexOf('Windows') !== -1 ? 'win32' : 'linux');
  const suiteRoot = agent.suiteRoot || '.';
  const outputDir = agent.outputDir || 'out';
  const reporterPath = agent.reporterPath || '';
  let spec = task && task.suggestedSpecFile ? task.suggestedSpecFile : 'e2e/<flow>.spec.ts';
  const separator = String.fromCharCode(92);
  const isAbsoluteSpec =
    spec.charAt(0) === '/' ||
    spec.charAt(0) === separator ||
    (spec.length > 2 && spec.charAt(1) === ':' && (spec.charAt(2) === '/' || spec.charAt(2) === separator));
  if (!isAbsoluteSpec) {
    spec = trimTrailingSeparators(suiteRoot) + '/' + spec;
  }
  const runPath = trimTrailingSeparators(outputDir) + '/run.json';
  const testResults = trimTrailingSeparators(outputDir) + '/test-results';
  const playwrightConfig = agent.playwrightConfig || '';
  const nodePath = agent.nodePath || '';
  const configArg = playwrightConfig ? ' --config=' + cliQuote(playwrightConfig, platform) : '';
  if (platform === 'win32') {
    const env = [];
    if (nodePath) env.push('set "NODE_PATH=' + nodePath + '"');
    env.push('set "FLOWLENS_RUN_OUTPUT=' + runPath + '"');
    return 'cd /d ' + cliQuote(suiteRoot, 'win32') + ' && ' + env.join(' && ') + ' && npx playwright test ' + cliQuote(spec, 'win32') + configArg + ' --reporter=' + cliQuote(reporterPath, 'win32') + ' --output=' + cliQuote(testResults, 'win32');
  }
  const env = [];
  if (nodePath) env.push('NODE_PATH=' + cliQuote(nodePath, platform));
  env.push('FLOWLENS_RUN_OUTPUT=' + cliQuote(runPath, platform));
  return 'cd ' + cliQuote(suiteRoot, platform) + ' && ' + env.join(' ') + ' npx playwright test ' + cliQuote(spec, platform) + configArg + ' --reporter=' + cliQuote(reporterPath, platform) + ' --output=' + cliQuote(testResults, platform);
}

function appendImplList(parent, heading, items) {
  if (!items.length) return;
  const title = document.createElement('div');
  title.className = 'ev-impl-sub';
  title.textContent = heading;
  parent.appendChild(title);
  const list = document.createElement('ul');
  list.className = 'ev-impl-list';
  items.forEach(function (text) {
    const li = document.createElement('li');
    li.textContent = text;
    list.appendChild(li);
  });
  parent.appendChild(list);
}

const implementRuns = {};

function implementRunState(flowId) {
  const key = String(flowId);
  if (!implementRuns[key]) {
    implementRuns[key] = { id: null, status: 'idle', log: '', ok: null, exitCode: null, rebuilt: false, els: null };
  }
  return implementRuns[key];
}

function implementStatusText(state) {
  if (state.status === 'running') return 'running';
  if (state.status === 'error') return 'failed';
  if (state.status === 'done') {
    if (state.ok === false) {
      return 'failed' + (state.exitCode !== null && state.exitCode !== undefined ? ' (exit ' + state.exitCode + ')' : '');
    }
    return 'done ok' + (state.exitCode !== null && state.exitCode !== undefined ? ' (exit ' + state.exitCode + ')' : '');
  }
  return 'listo para ejecutar';
}

function implementStatusState(state) {
  if (state.status === 'running') return 'running';
  if (state.status === 'error') return 'failed';
  if (state.status === 'done') return state.ok === false ? 'failed' : 'done';
  return 'idle';
}

function updateImplementView(flowId) {
  const state = implementRunState(flowId);
  if (!state.els) return;
  const running = state.status === 'running';
  const needs = flowNeedsTest(EVIDENCE_BY_FLOW[String(flowId)]);
  state.els.status.textContent = implementStatusText(state);
  state.els.status.setAttribute('data-state', implementStatusState(state));
  state.els.button.disabled = running || !needs;
  state.els.button.textContent = running ? 'Ejecutando\u2026' : 'Ejecutar agente';
  state.els.log.textContent = state.log;
  state.els.log.scrollTop = state.els.log.scrollHeight;
}

function appendImplementRun(section, flow) {
  const state = implementRunState(flow.id);
  const wrap = document.createElement('div');
  wrap.className = 'ev-run';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ev-run-btn';
  button.setAttribute('data-run-implement', String(flow.id));
  button.addEventListener('click', function () { startImplementRun(flow.id); });
  const status = document.createElement('div');
  status.className = 'ev-run-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const log = document.createElement('pre');
  log.className = 'ev-run-log';
  log.setAttribute('aria-live', 'polite');
  wrap.appendChild(button);
  wrap.appendChild(status);
  wrap.appendChild(log);
  section.appendChild(wrap);
  state.els = { button: button, status: status, log: log };
  updateImplementView(flow.id);
}

function readResponseJson(res) {
  return res.text().then(function (text) {
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        const snippet = text.replace(/\s+/g, ' ').slice(0, 200);
        throw new Error('HTTP ' + res.status + (snippet ? ': ' + snippet : ''));
      }
    }
    return { ok: res.ok, status: res.status, data: data || {} };
  });
}

function startImplementRun(flowId) {
  const state = implementRunState(flowId);
  if (state.status === 'running') return;
  state.id = null;
  state.status = 'running';
  state.log = '';
  state.ok = null;
  state.exitCode = null;
  state.rebuilt = false;
  updateImplementView(flowId);
  fetch('/api/implement-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId: String(flowId) }),
  }).then(function (res) {
    return readResponseJson(res);
  }).then(function (result) {
    const data = result.data;
    state.id = data && data.id !== null && data.id !== undefined ? String(data.id) : null;
    if (state.id === null) {
      const message = data && data.error ? String(data.error) : 'missing run id';
      throw new Error(result.ok === false ? message : 'missing run id');
    }
    return pollImplementRun(flowId);
  }).catch(function (error) {
    state.status = 'error';
    const message = error && error.message ? error.message : String(error);
    state.log = (state.log ? state.log + '\\n' : '') + '[flowlens] ' + message;
    updateImplementView(flowId);
  });
}

function pollImplementRun(flowId) {
  const state = implementRunState(flowId);
  return fetch('/api/implement-test?id=' + encodeURIComponent(String(state.id)), { cache: 'no-store' }).then(function (res) {
    return readResponseJson(res).then(function (result) {
      if (!result.ok) {
        throw new Error(result.data && result.data.error ? String(result.data.error) : 'HTTP ' + result.status);
      }
      return result.data;
    });
  }).then(function (data) {
    if (data && data.log !== null && data.log !== undefined) {
      const incoming = String(data.log);
      state.log = incoming.indexOf(state.log) === 0 ? incoming : state.log + incoming;
    }
    if (data && typeof data.status === 'string') state.status = data.status;
    updateImplementView(flowId);
    if (state.status === 'running' || state.status === 'pending' || state.status === 'queued') {
      return new Promise(function (resolve) { setTimeout(resolve, 1000); }).then(function () { return pollImplementRun(flowId); });
    }
    state.ok = data && typeof data.ok === 'boolean' ? data.ok : state.ok;
    state.exitCode = data && data.exitCode !== null && data.exitCode !== undefined ? data.exitCode : state.exitCode;
    state.rebuilt = !!(data && data.rebuilt);
    if (state.status !== 'done') state.status = 'done';
    updateImplementView(flowId);
    if (state.rebuilt || state.ok === true) refreshGraph();
    return null;
  });
}

function refreshGraph() {
  return fetch('/api/graph.json', { cache: 'no-store' }).then(function (res) {
    return res.json();
  }).then(function (graph) {
    if (graph && typeof graph === 'object') applyGraph(graph);
    return null;
  }).catch(function () { return null; });
}

function browserSanitize(value) {
  if (value === null || value === undefined) return '';
  let text = String(value).replace(/[\\u0000-\\u001f\\u007f]/g, '');
  if (text.length > 256) text = text.slice(0, 256);
  return text;
}

function browserMillis(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function browserArtifact(value, known) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(value)) return null;
  if (Object.keys(known).length > 0 && !known[value]) return null;
  return value;
}

function browserTestTask(value) {
  if (!value || typeof value !== 'object') return null;
  const acceptanceIn = Array.isArray(value.acceptance) ? value.acceptance : [];
  const acceptance = [];
  acceptanceIn.forEach(function (item) {
    const text = browserSanitize(item);
    if (text) acceptance.push(text);
  });
  const nodesIn = Array.isArray(value.nodes) ? value.nodes : [];
  const nodes = [];
  nodesIn.forEach(function (node) {
    const item = node && typeof node === 'object' ? node : {};
    const id = browserSanitize(item.id === null || item.id === undefined ? '' : item.id);
    const rawLabel = item.label === null || item.label === undefined ? item.id : item.label;
    const label = browserSanitize(rawLabel === null || rawLabel === undefined ? '' : rawLabel);
    if (!id && !label) return;
    nodes.push({ id: id, label: label || id, kind: browserSanitize(item.kind === null || item.kind === undefined ? '' : item.kind) });
  });
  return {
    suggestedSpecFile: browserSanitize(value.suggestedSpecFile === null || value.suggestedSpecFile === undefined ? '' : value.suggestedSpecFile),
    acceptance: acceptance,
    nodes: nodes,
  };
}

function deriveEvidence(graph) {
  const flowsIn = Array.isArray(graph.flows) ? graph.flows : [];
  const artifacts = graph.artifacts && typeof graph.artifacts === 'object' ? graph.artifacts : {};
  const known = {};
  Object.keys(artifacts).forEach(function (key) { known[key] = true; });
  const agent = graph.agent && typeof graph.agent === 'object' ? graph.agent : {};
  const flows = [];
  flowsIn.forEach(function (flow) {
    if (!flow || flow.id === null || flow.id === undefined) return;
    const id = browserSanitize(flow.id);
    if (!id) return;
    const testsIn = Array.isArray(flow.tests) ? flow.tests : [];
    const tests = [];
    testsIn.forEach(function (test) {
      if (!test || typeof test !== 'object') return;
      const resultsIn = Array.isArray(test.results) ? test.results : [];
      const timeline = test.timeline && typeof test.timeline === 'object' ? test.timeline : {};
      const results = [];
      resultsIn.forEach(function (result) {
        if (!result || typeof result !== 'object') return;
        const entriesIn = Array.isArray(timeline.entries) ? timeline.entries : [];
        const entries = [];
        entriesIn.forEach(function (entry) {
          if (!entry || entry.node === null || entry.node === undefined) return;
          const startMs = browserMillis(entry.startMs);
          const endMs = browserMillis(entry.endMs);
          entries.push({
            node: browserSanitize(entry.node),
            startMs: startMs,
            endMs: endMs >= startMs ? endMs : startMs,
            stepTitle: browserSanitize(entry.stepTitle === null || entry.stepTitle === undefined ? '' : entry.stepTitle),
            approx: entry.approx === true,
          });
        });
        const attachmentsIn = Array.isArray(result.attachments) ? result.attachments : [];
        let videoId = browserArtifact(timeline.videoArtifact, known);
        let traceId = null;
        attachmentsIn.forEach(function (attachment) {
          if (!attachment || typeof attachment !== 'object') return;
          const name = browserSanitize(attachment.name === null || attachment.name === undefined ? '' : attachment.name).toLowerCase();
          const artifact = browserArtifact(attachment.artifact, known);
          if (!artifact) return;
          if (name === 'video' && !videoId) videoId = artifact;
          if (name === 'trace' && !traceId) traceId = artifact;
        });
        results.push({
          retry: browserMillis(result.retry),
          videoBaseMs: browserMillis(timeline.videoBaseMs),
          videoSrc: videoId ? '/api/artifact/' + encodeURIComponent(videoId) : null,
          traceSrc: traceId ? '/_pw/trace/index.html?trace=/api/artifact/' + encodeURIComponent(traceId) : null,
          entries: entries,
        });
      });
      tests.push({
        spec: browserSanitize(test.spec === null || test.spec === undefined ? '' : test.spec),
        title: browserSanitize(test.title === null || test.title === undefined ? '' : test.title),
        outcome: browserSanitize(test.outcome === null || test.outcome === undefined ? '' : test.outcome),
        results: results,
      });
    });
    const rawTitle = flow.title !== null && flow.title !== undefined && flow.title !== '' ? flow.title : (flow.name !== null && flow.name !== undefined && flow.name !== '' ? flow.name : id);
    flows.push({
      id: id,
      title: browserSanitize(rawTitle) || id,
      coverage: browserSanitize(flow.coverage === null || flow.coverage === undefined ? '' : flow.coverage),
      notes: browserSanitize(flow.notes === null || flow.notes === undefined ? '' : flow.notes),
      tests: tests,
      testTask: browserTestTask(flow.testTask),
    });
  });
  const agentOut = {
    reporterPath: browserSanitize(agent.reporterPath === null || agent.reporterPath === undefined ? '' : agent.reporterPath),
    suiteRoot: browserSanitize(agent.suiteRoot === null || agent.suiteRoot === undefined ? '' : agent.suiteRoot),
    outputDir: browserSanitize(agent.outputDir === null || agent.outputDir === undefined ? '' : agent.outputDir),
    specDir: browserSanitize(agent.specDir === null || agent.specDir === undefined ? '' : agent.specDir),
  };
  return { tracePrefix: '/_pw/trace/', artifactPrefix: '/api/artifact/', agent: agentOut, flows: flows };
}

function applyGraph(graph) {
  const nodeList = Array.isArray(graph.nodes) ? graph.nodes : [];
  const flowList = Array.isArray(graph.flows) ? graph.flows : [];
  const coverageById = {};
  nodeList.forEach(function (node) {
    if (!node || node.id === null || node.id === undefined) return;
    coverageById[String(node.id)] = browserSanitize(node.coverage === null || node.coverage === undefined ? '' : node.coverage);
  });
  const nodeUpdates = [];
  RAW_NODES.forEach(function (node) {
    const key = String(node.id);
    if (Object.prototype.hasOwnProperty.call(coverageById, key)) node.coverage = coverageById[key];
    nodeUpdates.push({ id: node.id, coverage: node.coverage });
  });
  if (nodeUpdates.length) nodesDS.update(nodeUpdates);
  const flowCoverage = {};
  flowList.forEach(function (flow) {
    if (!flow || flow.id === null || flow.id === undefined) return;
    const id = browserSanitize(flow.id);
    if (!id) return;
    flowCoverage[id] = browserSanitize(flow.coverage === null || flow.coverage === undefined ? '' : flow.coverage);
  });
  LEGEND.forEach(function (entry) {
    if (Object.prototype.hasOwnProperty.call(flowCoverage, entry.cid)) {
      entry.coverage = flowCoverage[entry.cid];
      FLOW_COVERAGE[entry.cid] = entry.coverage;
    }
  });
  const evidence = deriveEvidence(graph);
  EVIDENCE.agent = evidence.agent;
  EVIDENCE.flows = evidence.flows;
  Object.keys(EVIDENCE_BY_FLOW).forEach(function (key) { delete EVIDENCE_BY_FLOW[key]; });
  evidence.flows.forEach(function (flow) { EVIDENCE_BY_FLOW[String(flow.id)] = flow; });
  applyVisibility();
  updateImplementTab();
  if (focusedFlowId) applyFlowFocus();
  if (evidenceState.flowId) renderEvidenceBody();
  updateStats(graph);
}

function updateStats(graph) {
  const statsEl = document.getElementById('stats');
  if (!statsEl) return;
  const nodeCount = Array.isArray(graph.nodes) ? graph.nodes.length : 0;
  const edgeList = Array.isArray(graph.links) ? graph.links : (Array.isArray(graph.edges) ? graph.edges : []);
  const flowCount = Array.isArray(graph.flows) ? graph.flows.length : 0;
  statsEl.textContent = nodeCount + ' nodes \u00b7 ' + edgeList.length + ' edges \u00b7 ' + flowCount + ' flows';
}

function appendImplementTest(flow) {
  const task = flow && flow.testTask ? flow.testTask : {};
  const section = document.createElement('div');
  section.className = 'ev-impl';
  section.setAttribute('data-test-task', String(flow.id));
  const heading = document.createElement('div');
  heading.className = 'ev-impl-title';
  heading.textContent = 'Implementar test';
  section.appendChild(heading);
  const spec = document.createElement('div');
  spec.className = 'ev-note';
  spec.textContent = 'Spec sugerido: ' + (task.suggestedSpecFile || 'e2e/' + flow.id + '.spec.ts');
  section.appendChild(spec);
  const cmdLabel = document.createElement('div');
  cmdLabel.className = 'ev-impl-sub';
  cmdLabel.textContent = 'Comando a ejecutar';
  section.appendChild(cmdLabel);
  const cmd = document.createElement('code');
  cmd.className = 'ev-cmd';
  cmd.textContent = buildTestCommand(task);
  section.appendChild(cmd);
  appendImplementRun(section, flow);
  const acceptance = Array.isArray(task.acceptance) ? task.acceptance : [];
  appendImplList(section, 'Criterios de aceptación', acceptance);
  const nodes = Array.isArray(task.nodes) ? task.nodes : [];
  appendImplList(section, 'Nodos sin cubrir', nodes.map(function (n) {
    return n && n.label ? n.label : String(n && n.id ? n.id : n);
  }));
  evidenceBody.appendChild(section);
}

function renderEvidenceBody() {
  removeTraceFrame();
  setTraceLayout(false);
  setVideoLayout(false);
  evidenceBody.textContent = '';
  if (!evidenceState.flowId) { appendEmpty('Click a node to load evidence'); return; }
  const flow = currentEvidenceFlow();
  if (!flow) { appendEmpty('sin datos del flujo'); return; }
  appendFlowHeader(flow);
  if (evidenceState.tab === 'implement') {
    if (flowNeedsTest(flow)) appendImplementTest(flow);
    else appendEmpty('sin tareas de test');
    return;
  }
  if (evidenceState.tab === 'sequence') {
    renderSequenceTab(flow);
    return;
  }
  if (!flow.tests || !flow.tests.length) {
    appendEmpty('sin cobertura');
    return;
  }
  if (flow.tests.length > 1) appendTestSelector(flow);
  const test = flow.tests[evidenceState.testIndex] || flow.tests[0];
  const result = test && test.results && test.results.length ? test.results[0] : null;
  if (evidenceState.tab === 'trace') renderTraceTab(result);
  else if (evidenceState.tab === 'steps') renderStepsTab(result);
  else renderVideoTab(result);
}

function sequenceMermaidTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'default' : 'dark';
}

function renderSequenceMermaid(target, code) {
  if (!target) return Promise.resolve();
  const api = typeof window.mermaid !== 'undefined' ? window.mermaid : null;
  if (!api) {
    target.innerHTML = '<div class="ev-seq-empty">Mermaid no está disponible.</div>';
    return Promise.resolve();
  }
  try {
    api.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: sequenceMermaidTheme(),
      sequence: { useMaxWidth: true, wrap: true },
    });
  } catch (error) {}
  const id = 'flowlens-sequence-' + (++sequenceRenderId);
  return api.render(id, code).then(function (result) {
    const svg = typeof result === 'string' ? result : result && result.svg;
    target.innerHTML = svg || '';
    if (result && typeof result.bindFunctions === 'function') result.bindFunctions(target);
  }).catch(function (error) {
    target.innerHTML = '<div class="ev-seq-empty">Error al renderizar Mermaid: ' +
      esc(error && error.message ? error.message : error) + '</div>';
  });
}

function setSequenceZoom(kind, zoom) {
  const state = kind === 'modal' ? sequenceModalState : sequenceState;
  state.zoom = Math.min(4, Math.max(0.25, zoom));
  const target = kind === 'modal' ? sequenceModalCanvas : evidenceBody.querySelector('.ev-seq-canvas');
  const label = kind === 'modal' ? sequenceModalZoomEl : evidenceBody.querySelector('.ev-seq-zoom');
  if (target) target.style.transform = 'scale(' + state.zoom + ')';
  if (label) label.textContent = Math.round(state.zoom * 100) + '%';
}

function openSequenceModal(flow) {
  if (!sequenceModalEl) return;
  sequenceModalState.code = flow && flow.mermaid ? flow.mermaid : '';
  sequenceModalState.flowId = flow ? flow.id : null;
  sequenceModalState.zoom = 1;
  if (sequenceModalTitleEl) {
    sequenceModalTitleEl.textContent = 'Secuencia' + (flow && flow.title ? ' · ' + flow.title : '');
    sequenceModalTitleEl.title = sequenceModalTitleEl.textContent;
  }
  if (sequenceModalZoomEl) sequenceModalZoomEl.textContent = '100%';
  sequenceModalEl.hidden = false;
  if (sequenceModalCanvas) {
    if (sequenceModalState.code) renderSequenceMermaid(sequenceModalCanvas, sequenceModalState.code);
    else sequenceModalCanvas.innerHTML = '<div class="ev-seq-empty">Sin diagrama Mermaid.</div>';
  }
  setSequenceZoom('modal', 1);
  if (sequenceModalClose) sequenceModalClose.focus();
}

function closeSequenceModal() {
  if (!sequenceModalEl) return;
  sequenceModalEl.hidden = true;
  if (sequenceModalCanvas) sequenceModalCanvas.innerHTML = '';
}

function positionFlowPreview(item) {
  if (!flowPreviewEl || !item) return;
  const rect = item.getBoundingClientRect();
  const width = 360;
  let left = rect.left - width - 14;
  if (left < 8) left = Math.min(window.innerWidth - width - 8, rect.right + 14);
  const top = Math.min(Math.max(8, rect.top - 24), Math.max(8, window.innerHeight - 340));
  flowPreviewEl.style.left = Math.max(8, left) + 'px';
  flowPreviewEl.style.top = top + 'px';
}

function hideFlowPreviewNow() {
  if (flowPreviewHideTimer) {
    clearTimeout(flowPreviewHideTimer);
    flowPreviewHideTimer = null;
  }
  flowPreviewFlowId = null;
  flowPreviewToken += 1;
  if (flowPreviewEl) flowPreviewEl.hidden = true;
}

function scheduleHideFlowPreview() {
  if (flowPreviewHideTimer) clearTimeout(flowPreviewHideTimer);
  flowPreviewHideTimer = setTimeout(hideFlowPreviewNow, 220);
}

function showFlowPreview(flowId, item) {
  if (!flowPreviewEl || !item) return;
  if (flowPreviewHideTimer) {
    clearTimeout(flowPreviewHideTimer);
    flowPreviewHideTimer = null;
  }
  const flow = EVIDENCE_BY_FLOW[String(flowId)];
  flowPreviewFlowId = String(flowId);
  positionFlowPreview(item);
  flowPreviewEl.hidden = false;
  if (flowPreviewTitleEl) {
    flowPreviewTitleEl.textContent = flow && flow.title ? flow.title : String(flowId);
    flowPreviewTitleEl.title = flowPreviewTitleEl.textContent;
  }
  if (!flowPreviewCanvas) return;
  flowPreviewCanvas.innerHTML = '';
  if (!flow || !flow.mermaid) {
    flowPreviewCanvas.innerHTML = '<div class="ev-seq-empty">Sin diagrama Mermaid. Re-mapea para generarlo.</div>';
    return;
  }
  const key = String(flowId) + '|' + sequenceMermaidTheme();
  const cached = sequencePreviewCache.get(key);
  if (cached) {
    flowPreviewCanvas.innerHTML = cached;
    return;
  }
  const token = ++flowPreviewToken;
  const host = document.createElement('div');
  renderSequenceMermaid(host, flow.mermaid).then(function () {
    if (token !== flowPreviewToken || flowPreviewFlowId !== String(flowId)) return;
    const html = host.innerHTML;
    if (!html) return;
    sequencePreviewCache.set(key, html);
    flowPreviewCanvas.innerHTML = html;
  });
}

if (flowPreviewEl) {
  flowPreviewEl.addEventListener('mouseenter', function () {
    if (flowPreviewHideTimer) {
      clearTimeout(flowPreviewHideTimer);
      flowPreviewHideTimer = null;
    }
  });
  flowPreviewEl.addEventListener('mouseleave', scheduleHideFlowPreview);
}
if (flowPreviewCanvas) {
  flowPreviewCanvas.addEventListener('click', function () {
    const flow = flowPreviewFlowId ? EVIDENCE_BY_FLOW[flowPreviewFlowId] : null;
    if (flow) openSequenceModal(flow);
    hideFlowPreviewNow();
  });
}
window.addEventListener('resize', hideFlowPreviewNow);

function positionHoverCard(element, width, height) {
  if (!element) return;
  const left = Math.max(8, Math.min(window.innerWidth - width - 8, lastPointer.x + 12));
  const top = Math.max(8, Math.min(window.innerHeight - height - 8, lastPointer.y + 12));
  element.style.left = left + 'px';
  element.style.top = top + 'px';
}

function hideNodePreviewNow() {
  if (nodePreviewHideTimer) {
    clearTimeout(nodePreviewHideTimer);
    nodePreviewHideTimer = null;
  }
  nodePreviewNodeId = null;
  if (nodePreviewEl) nodePreviewEl.hidden = true;
}

function scheduleHideNodePreview() {
  if (nodePreviewHideTimer) clearTimeout(nodePreviewHideTimer);
  nodePreviewHideTimer = setTimeout(hideNodePreviewNow, 220);
}

function showNodePreview(nodeId) {
  if (!nodePreviewEl) return;
  const node = nodesDS.get(nodeId);
  if (!node) return;
  hideEdgePreviewNow();
  hideFlowPreviewNow();
  if (nodePreviewHideTimer) {
    clearTimeout(nodePreviewHideTimer);
    nodePreviewHideTimer = null;
  }
  nodePreviewNodeId = nodeId;
  if (nodePreviewTitleEl) nodePreviewTitleEl.textContent = node.label || String(nodeId);
  if (nodePreviewBodyEl) { nodePreviewBodyEl.innerHTML = nodeInfoHtml(node); hydrateNodeMedia(nodePreviewBodyEl); }
  nodePreviewEl.hidden = false;
  positionHoverCard(nodePreviewEl, 320, 300);
}

function openNodeInfoModal(nodeId) {
  if (!nodeModalEl) return;
  const node = nodesDS.get(nodeId);
  if (!node) return;
  if (nodeModalTitleEl) {
    nodeModalTitleEl.textContent = node.label || String(nodeId);
    nodeModalTitleEl.title = nodeModalTitleEl.textContent;
  }
  if (nodeModalBodyEl) { nodeModalBodyEl.innerHTML = nodeInfoHtml(node); hydrateNodeMedia(nodeModalBodyEl); }
  hideNodePreviewNow();
  hideEdgePreviewNow();
  nodeModalEl.hidden = false;
  if (nodeModalClose) nodeModalClose.focus();
}

function closeNodeInfoModal() {
  if (!nodeModalEl) return;
  nodeModalEl.hidden = true;
  if (nodeModalBodyEl) nodeModalBodyEl.innerHTML = '';
}

function edgeTargetFor(edgeId) {
  const edge = edgesDS.get(edgeId);
  if (!edge) return null;
  let flows = Array.isArray(edge.flows) ? edge.flows.slice() : [];
  if (!flows.length) {
    const fromNode = nodesDS.get(edge.from);
    const toNode = nodesDS.get(edge.to);
    const fromFlows = fromNode ? nodeFlows(fromNode) : [];
    const toFlows = toNode ? nodeFlows(toNode) : [];
    flows = fromFlows.concat(toFlows);
  }
  const unique = [];
  flows.forEach(function (flow) {
    if (flow !== null && flow !== undefined && unique.indexOf(flow) === -1) unique.push(flow);
  });
  const chosen = focusedFlowId && unique.indexOf(focusedFlowId) !== -1 ? focusedFlowId : unique[0];
  const flow = chosen !== null && chosen !== undefined ? EVIDENCE_BY_FLOW[String(chosen)] : null;
  return flow ? { flowId: String(chosen), flow: flow, count: unique.length } : null;
}

function hideEdgePreviewNow() {
  if (edgePreviewHideTimer) {
    clearTimeout(edgePreviewHideTimer);
    edgePreviewHideTimer = null;
  }
  edgePreviewFlowId = null;
  edgePreviewToken += 1;
  if (edgePreviewEl) edgePreviewEl.hidden = true;
}

function scheduleHideEdgePreview() {
  if (edgePreviewHideTimer) clearTimeout(edgePreviewHideTimer);
  edgePreviewHideTimer = setTimeout(hideEdgePreviewNow, 220);
}

function showEdgePreview(edgeId) {
  if (!edgePreviewEl) return;
  const target = edgeTargetFor(edgeId);
  if (!target) {
    hideEdgePreviewNow();
    return;
  }
  hideNodePreviewNow();
  hideFlowPreviewNow();
  if (edgePreviewHideTimer) {
    clearTimeout(edgePreviewHideTimer);
    edgePreviewHideTimer = null;
  }
  edgePreviewFlowId = target.flowId;
  if (edgePreviewTitleEl) {
    edgePreviewTitleEl.textContent = (target.flow.title || target.flowId) +
      (target.count > 1 ? ' · ' + target.count + ' flujos' : '');
    edgePreviewTitleEl.title = edgePreviewTitleEl.textContent;
  }
  if (edgePreviewHintEl) {
    edgePreviewHintEl.textContent = target.count > 1
      ? 'Arista compartida por ' + target.count + ' flujos · Click para maximizar'
      : 'Click para maximizar';
  }
  edgePreviewEl.hidden = false;
  positionHoverCard(edgePreviewEl, 460, 360);
  if (!edgePreviewCanvas) return;
  edgePreviewCanvas.innerHTML = '';
  if (!target.flow.mermaid) {
    edgePreviewCanvas.innerHTML = '<div class="ev-seq-empty">Este flujo todavía no tiene diagrama Mermaid.</div>';
    return;
  }
  const key = target.flowId + '|' + sequenceMermaidTheme();
  const cached = sequencePreviewCache.get(key);
  if (cached) {
    edgePreviewCanvas.innerHTML = cached;
    return;
  }
  const token = ++edgePreviewToken;
  const host = document.createElement('div');
  renderSequenceMermaid(host, target.flow.mermaid).then(function () {
    if (token !== edgePreviewToken || edgePreviewFlowId !== target.flowId) return;
    const html = host.innerHTML;
    if (!html) return;
    sequencePreviewCache.set(key, html);
    edgePreviewCanvas.innerHTML = html;
  });
}

if (nodePreviewEl) {
  nodePreviewEl.addEventListener('mouseenter', function () {
    if (nodePreviewHideTimer) {
      clearTimeout(nodePreviewHideTimer);
      nodePreviewHideTimer = null;
    }
  });
  nodePreviewEl.addEventListener('mouseleave', scheduleHideNodePreview);
  nodePreviewEl.addEventListener('click', function () {
    if (nodePreviewNodeId !== null) openNodeInfoModal(nodePreviewNodeId);
  });
}
if (edgePreviewEl) {
  edgePreviewEl.addEventListener('mouseenter', function () {
    if (edgePreviewHideTimer) {
      clearTimeout(edgePreviewHideTimer);
      edgePreviewHideTimer = null;
    }
  });
  edgePreviewEl.addEventListener('mouseleave', scheduleHideEdgePreview);
}
if (edgePreviewCanvas) {
  edgePreviewCanvas.addEventListener('click', function () {
    const flow = edgePreviewFlowId ? EVIDENCE_BY_FLOW[edgePreviewFlowId] : null;
    if (flow) {
      openSequenceModal(flow);
      hideEdgePreviewNow();
    }
  });
}
if (nodeModalClose) nodeModalClose.addEventListener('click', closeNodeInfoModal);
if (nodeModalEl) {
  nodeModalEl.addEventListener('click', function (event) {
    if (event.target === nodeModalEl) closeNodeInfoModal();
  });
}
if (nodeModalBodyEl) {
  nodeModalBodyEl.addEventListener('click', function (event) {
    const link = event.target.closest ? event.target.closest('.neighbor-link') : null;
    if (link && link.dataset.nid !== undefined) openNodeInfoModal(link.dataset.nid);
  });
}
window.addEventListener('keydown', function (event) {
  if (event.key === 'Escape' && nodeModalEl && !nodeModalEl.hidden) {
    event.stopImmediatePropagation();
    closeNodeInfoModal();
  }
}, true);
window.addEventListener('resize', function () {
  hideNodePreviewNow();
  hideEdgePreviewNow();
  if (viewMode === '3d' && view3dGraph && graph3dEl) {
    position3dContainer();
    view3dGraph.width(graph3dEl.clientWidth).height(graph3dEl.clientHeight);
  }
});
window.addEventListener('scroll', function (event) {
  const target = event.target;
  const insidePreview = target && target.nodeType && (
    (flowPreviewEl && flowPreviewEl.contains(target)) ||
    (edgePreviewEl && edgePreviewEl.contains(target)) ||
    (nodePreviewEl && nodePreviewEl.contains(target))
  );
  if (insidePreview) return;
  hideFlowPreviewNow();
  hideNodePreviewNow();
  hideEdgePreviewNow();
}, true);

if (window.flowlensViewer) {
  window.flowlensViewer.showNodePreview = showNodePreview;
  window.flowlensViewer.openNodeInfo = openNodeInfoModal;
  window.flowlensViewer.showEdgePreview = showEdgePreview;
  window.flowlensViewer.select3dFlow = select3dFlow;

}

function renderSequenceTab(flow) {
  removeTraceFrame();
  sequenceState.code = flow && flow.mermaid ? flow.mermaid : '';
  sequenceState.flowId = flow ? flow.id : null;
  sequenceState.zoom = 1;
  const wrap = document.createElement('div');
  wrap.className = 'ev-sequence';
  const toolbar = document.createElement('div');
  toolbar.className = 'ev-seq-toolbar';
  const title = document.createElement('div');
  title.className = 'ev-seq-title';
  title.textContent = flow && flow.title ? 'Secuencia · ' + flow.title : 'Secuencia';
  title.title = title.textContent;
  const zoomOut = document.createElement('button');
  zoomOut.type = 'button';
  zoomOut.className = 'ev-seq-btn';
  zoomOut.textContent = '-';
  zoomOut.title = 'Zoom out';
  zoomOut.setAttribute('aria-label', 'Zoom out');
  const zoomLabel = document.createElement('span');
  zoomLabel.className = 'ev-seq-zoom';
  zoomLabel.textContent = '100%';
  const zoomIn = document.createElement('button');
  zoomIn.type = 'button';
  zoomIn.className = 'ev-seq-btn';
  zoomIn.textContent = '+';
  zoomIn.title = 'Zoom in';
  zoomIn.setAttribute('aria-label', 'Zoom in');
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'ev-seq-btn';
  reset.textContent = 'Reset';
  const full = document.createElement('button');
  full.type = 'button';
  full.className = 'ev-seq-btn';
  full.textContent = 'Pantalla completa';
  toolbar.appendChild(title);
  toolbar.appendChild(zoomOut);
  toolbar.appendChild(zoomLabel);
  toolbar.appendChild(zoomIn);
  toolbar.appendChild(reset);
  toolbar.appendChild(full);
  const viewport = document.createElement('div');
  viewport.className = 'ev-seq-viewport';
  const canvas = document.createElement('div');
  canvas.className = 'ev-seq-canvas';
  viewport.appendChild(canvas);
  wrap.appendChild(toolbar);
  wrap.appendChild(viewport);
  evidenceBody.appendChild(wrap);
  if (!sequenceState.code) {
    canvas.innerHTML = '<div class="ev-seq-empty">Sin diagrama Mermaid. Vuelve a mapear los flujos para generarlo.</div>';
    [zoomOut, zoomIn, reset, full].forEach(function (button) { button.disabled = true; });
    return;
  }
  zoomOut.addEventListener('click', function () { setSequenceZoom('inline', sequenceState.zoom - 0.25); });
  zoomIn.addEventListener('click', function () { setSequenceZoom('inline', sequenceState.zoom + 0.25); });
  reset.addEventListener('click', function () { setSequenceZoom('inline', 1); });
  full.addEventListener('click', function () { openSequenceModal(flow); });
  renderSequenceMermaid(canvas, sequenceState.code);
}

if (sequenceModalClose) sequenceModalClose.addEventListener('click', closeSequenceModal);
if (sequenceModalZoomOut) sequenceModalZoomOut.addEventListener('click', function () { setSequenceZoom('modal', sequenceModalState.zoom - 0.25); });
if (sequenceModalZoomIn) sequenceModalZoomIn.addEventListener('click', function () { setSequenceZoom('modal', sequenceModalState.zoom + 0.25); });
if (sequenceModalZoomReset) sequenceModalZoomReset.addEventListener('click', function () { setSequenceZoom('modal', 1); });
if (sequenceModalFullscreen) {
  sequenceModalFullscreen.addEventListener('click', function () {
    const panel = sequenceModalEl ? sequenceModalEl.querySelector('.seq-modal-panel') : null;
    if (panel && panel.requestFullscreen) panel.requestFullscreen();
  });
}
if (sequenceModalEl) {
  sequenceModalEl.addEventListener('click', function (event) {
    if (event.target === sequenceModalEl) closeSequenceModal();
  });
}
window.addEventListener('keydown', function (event) {
  if (event.key === 'Escape' && sequenceModalEl && !sequenceModalEl.hidden) {
    event.stopImmediatePropagation();
    closeSequenceModal();
  }
}, true);
window.addEventListener('flowlens-themechange', function () {
  if (evidenceState.tab === 'sequence' && evidenceState.flowId) renderEvidenceBody();
  if (sequenceModalEl && !sequenceModalEl.hidden && sequenceModalState.code) {
    renderSequenceMermaid(sequenceModalCanvas, sequenceModalState.code);
  }
});

function highlightActiveStep(idx) {
  const items = document.querySelectorAll('.ev-step');
  for (let i = 0; i < items.length; i++) {
    if (idx !== null && String(i) === String(idx)) items[i].classList.add('active');
    else items[i].classList.remove('active');
  }
}

function setEvidenceTab(tab) {
  evidenceState.tab = tab;
  evTabButtons.forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.getAttribute('data-ev-tab') === tab));
  });
  renderEvidenceBody();
  updateFloatTitle();
}

evTabButtons.forEach(function (b) {
  b.addEventListener('click', function () { setEvidenceTab(b.getAttribute('data-ev-tab')); });
});

const FLOAT_KEY = 'flowlens-evidence-float';

function readFloatState() {
  try {
    const raw = localStorage.getItem(FLOAT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function writeFloatState(rect, maximized) {
  try {
    localStorage.setItem(FLOAT_KEY, JSON.stringify({
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      maximized: !!maximized,
    }));
  } catch (e) {}
}

function currentFloatRect() {
  if (!floatWindow) return null;
  const r = floatWindow.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function clampFloatRect(rect) {
  const margin = 8;
  const maxWidth = Math.max(280, window.innerWidth - margin * 2);
  const maxHeight = Math.max(260, window.innerHeight - margin * 2);
  const width = Math.min(Math.max(Number(rect.width) || 560, 360), maxWidth);
  const height = Math.min(Math.max(Number(rect.height) || 560, 320), maxHeight);
  const left = Math.min(
    Math.max(Number(rect.left) || margin, margin),
    Math.max(margin, window.innerWidth - width - margin)
  );
  const top = Math.min(
    Math.max(Number(rect.top) || margin, margin),
    Math.max(margin, window.innerHeight - height - margin)
  );
  return { left: left, top: top, width: width, height: height };
}

function applyFloatRect(rect) {
  if (!floatWindow) return;
  floatWindow.style.left = Math.round(rect.left) + 'px';
  floatWindow.style.top = Math.round(rect.top) + 'px';
  floatWindow.style.width = Math.round(rect.width) + 'px';
  floatWindow.style.height = Math.round(rect.height) + 'px';
}

function defaultFloatRect() {
  const width = Math.min(640, Math.max(380, window.innerWidth - 80));
  const height = Math.min(680, Math.max(360, window.innerHeight - 120));
  return { left: window.innerWidth - width - 24, top: 56, width: width, height: height };
}

function updateFloatTitle() {
  if (!floatWindow) return;
  const title = floatWindow.querySelector('.float-title');
  if (!title) return;
  const labels = { video: 'Video', trace: 'Trace', steps: 'Pasos', sequence: 'Secuencia', implement: 'Implementar test' };
  const flow = currentEvidenceFlow();
  title.textContent = 'Evidence \u00b7 ' + (labels[evidenceState.tab] || 'Evidence') +
    (flow && flow.title ? ' \u00b7 ' + flow.title : '');
  title.title = title.textContent;
}

function updateFloatControls() {
  if (evidenceFloatBtn) {
    evidenceFloatBtn.hidden = !!floatWindow;
    evidenceFloatBtn.textContent = 'Float';
    evidenceFloatBtn.title = 'Float evidence';
    evidenceFloatBtn.setAttribute('aria-label', 'Float evidence');
  }
  if (!floatWindow) return;
  const maxBtn = floatWindow.querySelector('[data-float-max]');
  if (maxBtn) {
    maxBtn.textContent = floatMaximized ? 'Restore' : 'Max';
    maxBtn.title = floatMaximized ? 'Restore window' : 'Maximize window';
    maxBtn.setAttribute('aria-label', floatMaximized ? 'Restore window' : 'Maximize window');
  }
}

function saveFloatState() {
  if (!floatWindow) return;
  if (floatMaximized && floatRestoreRect) {
    writeFloatState(floatRestoreRect, true);
    return;
  }
  const rect = currentFloatRect();
  if (rect) writeFloatState(rect, false);
}

function toggleFloatMaximize(force) {
  if (!floatWindow) return;
  const want = force === undefined ? !floatMaximized : !!force;
  if (want === floatMaximized) return;
  if (want) {
    const rect = currentFloatRect();
    if (rect) floatRestoreRect = rect;
    floatWindow.classList.add('maximized');
    floatMaximized = true;
  } else {
    floatWindow.classList.remove('maximized');
    floatMaximized = false;
    if (floatRestoreRect) applyFloatRect(clampFloatRect(floatRestoreRect));
  }
  updateFloatControls();
  saveFloatState();
}

function floatEvidence() {
  if (floatWindow) return;
  const saved = readFloatState();
  const win = document.createElement('div');
  win.className = 'float-window';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-modal', 'false');
  win.setAttribute('aria-label', 'Evidence tools');
  win.setAttribute('tabindex', '-1');

  const titlebar = document.createElement('div');
  titlebar.className = 'float-titlebar';
  const title = document.createElement('span');
  title.className = 'float-title';
  title.textContent = 'Evidence';
  const actions = document.createElement('div');
  actions.className = 'float-actions';
  const maxBtn = document.createElement('button');
  maxBtn.type = 'button';
  maxBtn.className = 'float-action';
  maxBtn.setAttribute('data-float-max', '');
  maxBtn.textContent = 'Max';
  maxBtn.title = 'Maximize window';
  maxBtn.setAttribute('aria-label', 'Maximize window');
  const dockBtn = document.createElement('button');
  dockBtn.type = 'button';
  dockBtn.className = 'float-action';
  dockBtn.setAttribute('data-float-dock', '');
  dockBtn.textContent = 'Dock';
  dockBtn.title = 'Dock evidence';
  dockBtn.setAttribute('aria-label', 'Dock evidence');
  actions.appendChild(maxBtn);
  actions.appendChild(dockBtn);
  titlebar.appendChild(title);
  titlebar.appendChild(actions);

  const content = document.createElement('div');
  content.className = 'float-content';
  win.appendChild(titlebar);
  win.appendChild(content);

  floatWindow = win;
  if (floatLayerEl) floatLayerEl.appendChild(win);
  else document.body.appendChild(win);
  content.appendChild(evidenceTabsRow);
  content.appendChild(evidenceBody);
  evidencePanelEl.classList.add('floating');
  evidencePlaceholderEl.hidden = false;

  const base = saved && saved.width && saved.height ? saved : defaultFloatRect();
  applyFloatRect(clampFloatRect(base));
  if (window.innerWidth < 760 || saved.maximized) toggleFloatMaximize(true);
  updateFloatControls();
  updateFloatTitle();

  maxBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleFloatMaximize();
  });
  dockBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    dockEvidence();
  });
  titlebar.addEventListener('dblclick', function (e) {
    if (e.target && e.target.closest && e.target.closest('button')) return;
    toggleFloatMaximize();
  });
  titlebar.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || floatMaximized) return;
    if (e.target && e.target.closest && e.target.closest('button')) return;
    const rect = currentFloatRect();
    if (!rect) return;
    floatDrag = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top };
    try {
      titlebar.setPointerCapture(e.pointerId);
    } catch (err) {}
    e.preventDefault();
  });
  titlebar.addEventListener('pointermove', function (e) {
    if (!floatDrag || !floatWindow) return;
    const rect = currentFloatRect();
    if (!rect) return;
    applyFloatRect(clampFloatRect({
      left: floatDrag.left + e.clientX - floatDrag.x,
      top: floatDrag.top + e.clientY - floatDrag.y,
      width: rect.width,
      height: rect.height,
    }));
  });
  function endDrag(e) {
    if (!floatDrag) return;
    floatDrag = null;
    try {
      titlebar.releasePointerCapture(e.pointerId);
    } catch (err) {}
    saveFloatState();
  }
  titlebar.addEventListener('pointerup', endDrag);
  titlebar.addEventListener('pointercancel', endDrag);

  if (typeof ResizeObserver === 'function') {
    floatResizeObserver = new ResizeObserver(function () {
      if (!floatWindow || floatMaximized || floatDrag) return;
      saveFloatState();
    });
    floatResizeObserver.observe(win);
  }
  try {
    win.focus();
  } catch (e) {}
}

function dockEvidence() {
  if (!floatWindow) return;
  if (floatResizeObserver) {
    floatResizeObserver.disconnect();
    floatResizeObserver = null;
  }
  if (evidenceTabsRow) evidencePanelEl.insertBefore(evidenceTabsRow, evidencePlaceholderEl);
  if (evidenceBody) evidencePanelEl.insertBefore(evidenceBody, evidencePlaceholderEl);
  evidencePanelEl.classList.remove('floating');
  evidencePlaceholderEl.hidden = true;
  if (floatWindow.parentNode) floatWindow.parentNode.removeChild(floatWindow);
  floatWindow = null;
  floatMaximized = false;
  floatRestoreRect = null;
  floatDrag = null;
  updateFloatControls();
  if (typeof fillFlexibleSection === 'function') fillFlexibleSection();
  if (typeof network !== 'undefined' && network && typeof network.redraw === 'function') {
    setTimeout(function () { network.redraw(); }, 0);
  }
}

if (evidenceFloatBtn) {
  evidenceFloatBtn.addEventListener('click', function () {
    if (floatWindow) dockEvidence();
    else floatEvidence();
  });
}
if (evidenceDockBtn) evidenceDockBtn.addEventListener('click', dockEvidence);
window.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && floatWindow) {
    e.stopPropagation();
    dockEvidence();
  }
});
window.addEventListener('resize', function () {
  if (!floatWindow || floatMaximized) return;
  const rect = currentFloatRect();
  if (!rect) return;
  applyFloatRect(clampFloatRect(rect));
  saveFloatState();
});

function findEntryForNode(nodeId) {
  const target = String(nodeId);
  for (let i = 0; i < viewerState.animTrack.length; i++) {
    if (String(viewerState.animTrack[i].node) === target) return viewerState.animTrack[i];
  }
  return null;
}

function seekToEntry(entry) {
  if (!entry) return;
  const display = Number(entry.displayStart);
  const real = Number(entry.startMs);
  setPlaybackMs(isFinite(display) ? display : (isFinite(real) && real >= 0 ? real : 0));
}

function loadNodeEvidence(nodeId) {
  const node = nodesDS.get(nodeId);
  if (!node) return;
  const flows = nodeFlows(node);
  const preferred = focusedFlowId && flows.indexOf(focusedFlowId) !== -1 ? focusedFlowId : node.flow;
  const flowId = preferred === null || preferred === undefined ? '' : String(preferred);
  setEvidenceFlow(flowId);
  const entry = findEntryForNode(nodeId);
  if (entry) seekToEntry(entry);
}

const playToggle = document.getElementById('play-toggle');
const playScrubber = document.getElementById('play-scrubber');
const playSpeed = document.getElementById('play-speed');
const playTime = document.getElementById('play-time');
const playIconPath = document.getElementById('play-icon-path');
const PLAY_ICON = 'M8 5 L19 12 L8 19 Z';
const PAUSE_ICON = 'M7 5 L10 5 L10 19 L7 19 Z M14 5 L17 5 L17 19 L14 19 Z';

function formatMs(ms) {
  const total = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ':' + (s < 10 ? '0' + s : String(s));
}

function videoHasSrc() {
  return !!(evVideo && evVideo.getAttribute('src'));
}

function playbackDuration() {
  const total = displayTotalMs();
  if (total > 0) return total;
  if (videoHasSrc() && isFinite(evVideo.duration) && evVideo.duration > 0) {
    return Math.round(evVideo.duration * 1000);
  }
  return 0;
}

function updatePlayButton() {
  if (!playToggle) return;
  playToggle.setAttribute('aria-pressed', String(playback.playing));
  playToggle.setAttribute('aria-label', playback.playing ? 'Pause' : 'Play');
  if (playIconPath) playIconPath.setAttribute('d', playback.playing ? PAUSE_ICON : PLAY_ICON);
}

function updateControls() {
  if (!playScrubber) return;
  const duration = Math.round(playback.duration);
  playScrubber.max = String(duration);
  playScrubber.value = String(Math.round(Math.min(playback.ms, playback.duration)));
  const enabled = playback.duration > 0;
  playScrubber.disabled = !enabled;
  playToggle.disabled = !enabled;
  playTime.textContent = formatMs(playback.ms) + ' / ' + formatMs(playback.duration);
  updatePlayButton();
}

function syncVideoToDisplay(d) {
  if (!videoHasSrc()) return;
  const media = mediaMsForDisplay(d);
  evVideo.playbackRate = playback.speed;
  try { evVideo.currentTime = media / 1000; } catch (e) {}
}

function applyPlaybackMs() {
  if (window.flowlensViewer) window.flowlensViewer.onTime(playback.ms);
  if (viewerState.animTrack.length) syncVideoToDisplay(playback.ms);
  updateControls();
}

function tick(ts) {
  if (!playback.playing) { playback.rafId = null; return; }
  const now = typeof ts === 'number' ? ts : Date.now();
  const dt = Math.max(0, Math.min(250, now - playback.lastTs));
  playback.lastTs = now;
  if (!viewerState.animTrack.length && videoHasSrc() && !evVideo.paused) {
    playback.ms = evVideo.currentTime * 1000;
  } else {
    playback.ms += dt * playback.speed;
  }
  if (playback.ms >= playback.duration) {
    playback.ms = playback.duration;
    applyPlaybackMs();
    pausePlayback();
    return;
  }
  applyPlaybackMs();
  playback.rafId = requestAnimationFrame(tick);
}

function startClock() {
  if (playback.playing) return;
  playback.playing = true;
  playback.lastTs = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  updatePlayButton();
  playback.rafId = requestAnimationFrame(tick);
}

function playPlayback() {
  playback.duration = playbackDuration();
  if (playback.duration <= 0) return;
  if (playback.ms >= playback.duration) playback.ms = 0;
  if (viewerState.animTrack.length) {
    syncVideoToDisplay(playback.ms);
  } else if (videoHasSrc()) {
    evVideo.playbackRate = playback.speed;
    try { evVideo.currentTime = playback.ms / 1000; } catch (e) {}
    const p = evVideo.play();
    if (p && p.catch) p.catch(function () {});
  }
  startClock();
}

function pausePlayback() {
  playback.playing = false;
  if (playback.rafId) { cancelAnimationFrame(playback.rafId); playback.rafId = null; }
  if (videoHasSrc() && !evVideo.paused) { try { evVideo.pause(); } catch (e) {} }
  updatePlayButton();
}

function setPlaybackMs(ms) {
  playback.duration = playbackDuration();
  const value = Number(ms);
  playback.ms = isFinite(value) ? Math.max(0, Math.min(value, playback.duration)) : 0;
  if (!viewerState.animTrack.length && videoHasSrc()) { try { evVideo.currentTime = playback.ms / 1000; } catch (e) {} }
  applyPlaybackMs();
}

function resetPlayback() {
  pausePlayback();
  playback.ms = 0;
  playback.duration = playbackDuration();
  updateControls();
}

if (playToggle) playToggle.addEventListener('click', function () { if (playback.playing) pausePlayback(); else playPlayback(); });
if (playScrubber) {
  playScrubber.addEventListener('input', function () { setPlaybackMs(Number(playScrubber.value)); });
  playScrubber.addEventListener('change', function () { setPlaybackMs(Number(playScrubber.value)); });
}
if (playSpeed) playSpeed.addEventListener('change', function () {
  const s = Number(playSpeed.value);
  playback.speed = isFinite(s) && s > 0 ? s : 1;
  if (videoHasSrc()) evVideo.playbackRate = playback.speed;
});

const SIDEBAR_COLLAPSED_KEY = 'flowlens-sidebar-collapsed';
const sidebarHideBtn = document.getElementById('sidebar-hide');
const sidebarShowBtn = document.getElementById('sidebar-show');
function applySidebarCollapsed(collapsed) {
  const value = !!collapsed;
  document.body.classList.toggle('sidebar-collapsed', value);
  try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? '1' : '0'); } catch (e) {}
  if (sidebarShowBtn) sidebarShowBtn.hidden = !value;
  if (sidebarHideBtn) sidebarHideBtn.setAttribute('aria-expanded', String(!value));
  resizeGraph();
  network.redraw();
  if (viewMode === '3d') {
    position3dContainer();
    if (view3dGraph && graph3dEl) view3dGraph.width(graph3dEl.clientWidth).height(graph3dEl.clientHeight);
  }
}
if (sidebarHideBtn) sidebarHideBtn.addEventListener('click', function () { applySidebarCollapsed(true); });
if (sidebarShowBtn) sidebarShowBtn.addEventListener('click', function () { applySidebarCollapsed(false); });
try {
  if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1') applySidebarCollapsed(true);
} catch (e) {}

updateViewButtons();
try {
  const savedView = localStorage.getItem(VIEW_KEY);
  if (savedView === 'galaxy' || savedView === 'organigram' || savedView === '3d') applyViewMode(savedView);
} catch (e) {}
setEvidenceTab('video');
emptyInfo();
applyLanguage(currentLang);
</script>`;
}

export function renderHtml(graph: FlowlensGraph = { nodes: [] }, options: RenderOptions = {}): string {
  const payload = buildPayload(graph);
  const evidence = buildEvidence(graph);
  const nodesJson = jsSafe(payload.nodes);
  const edgesJson = jsSafe(payload.edges);
  const legendJson = jsSafe(payload.legend);
  const kindsJson = jsSafe(payload.kinds);
  const evidenceJson = jsSafe(evidence);
  const vendorHref = escHtml(options.vendorHref ?? DEFAULT_VENDOR_HREF);
  const mermaidHref = escHtml(options.mermaidHref ?? "./vendor/mermaid.min.js");
  const graph3dHref = escHtml(options.graph3dHref ?? "./vendor/3d-force-graph.min.js");
  const title = escHtml(sanitizeLabel(options.title ?? "flowlens"));
  const stats = payload.nodes.length + " nodes &middot; " + payload.edges.length + " edges &middot; " + payload.legend.length + " flows";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>flowlens - ${title}</title>
<script src="${vendorHref}"></script>
<script src="${mermaidHref}"></script>
<script src="${graph3dHref}"></script>
${styles()}
${themeInitScript()}
</head>
<body>
<div id="graph"></div>
<div id="graph3d" hidden></div>
<button type="button" id="sidebar-show" title="Show panel" aria-label="Show panel" hidden>&raquo;</button>
<div id="view-switch" role="group" aria-label="Graph view">
  <button type="button" data-view-mode="original" aria-pressed="true" title="Graphify original">Graphify</button>
  <button type="button" data-view-mode="galaxy" aria-pressed="false" title="Estrellas más grandes = nodos más compartidos o conectados">Galaxia</button>
  <button type="button" data-view-mode="organigram" aria-pressed="false" title="Vista jerárquica tipo organigrama">Organigrama</button>
  <button type="button" data-view-mode="3d" aria-pressed="false" title="Vista 3D interactiva">3D</button>
</div>
<div id="resize-handle" role="separator" aria-orientation="vertical" aria-label="Resize sidebar" tabindex="0"></div>
<div id="sidebar">
  <div id="theme-wrap" role="group" aria-label="Theme">
    <button type="button" data-theme-choice="light">Light</button>
    <button type="button" data-theme-choice="dark">Dark</button>
    <button type="button" data-theme-choice="system">System</button>
    <select id="lang-select" aria-label="Language" title="Language">
      <option value="en">EN</option>
      <option value="es">ES</option>
    </select>
    <button type="button" id="sidebar-hide" title="Hide panel" aria-label="Hide panel">&laquo;</button>
  </div>
  <div id="search-wrap">
    <input id="search" type="text" placeholder="Search nodes..." autocomplete="off">
    <div id="search-results"></div>
  </div>
  <div id="info-panel" class="collapsible-section">
    <button type="button" class="section-header" data-collapse="info-panel" aria-expanded="true">
      <span class="section-chevron" aria-hidden="true"></span>
      <span class="section-title">Node Info</span>
    </button>
    <div id="info-content"></div>
  </div>
  <div class="sidebar-divider" role="separator" aria-orientation="horizontal" aria-label="Resize Node Info" data-section="info-panel" tabindex="0"></div>
  <div id="playback-bar" role="group" aria-label="Playback controls">
    <button type="button" id="play-toggle" aria-pressed="false" aria-label="Play" disabled>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path id="play-icon-path" d="M8 5 L19 12 L8 19 Z" fill="currentColor"></path></svg>
    </button>
    <input type="range" id="play-scrubber" min="0" max="0" step="1" value="0" aria-label="Scrub timeline" disabled>
    <span id="play-time">0:00 / 0:00</span>
    <select id="play-speed" aria-label="Playback speed">
<option value="0.1">0.1x</option>
<option value="0.25">0.25x</option>
<option value="0.5">0.5x</option>
<option value="0.75">0.75x</option>
<option value="1" selected>1x</option>
<option value="1.5">1.5x</option>
<option value="2">2x</option>
    </select>
  </div>
  <div id="evidence-panel" class="collapsible-section">
    <button type="button" class="section-header" data-collapse="evidence-panel" aria-expanded="true">
      <span class="section-chevron" aria-hidden="true"></span>
      <span class="section-title">Evidence</span>
    </button>
    <div id="evidence-tabs-row">
      <div id="evidence-tabs" role="tablist">
        <button type="button" class="ev-tab" data-ev-tab="video" role="tab" aria-pressed="true" title="Video">Video</button>
        <button type="button" class="ev-tab" data-ev-tab="trace" role="tab" aria-pressed="false" title="Trace">Trace</button>
        <button type="button" class="ev-tab" data-ev-tab="steps" role="tab" aria-pressed="false" title="Pasos">Pasos</button>
        <button type="button" class="ev-tab" data-ev-tab="sequence" role="tab" aria-pressed="false" title="Secuencia">Secuencia</button>
        <button type="button" class="ev-tab" data-ev-tab="implement" role="tab" aria-pressed="false" title="Implementar test" hidden disabled>Implementar</button>
      </div>
      <button type="button" id="evidence-float-btn" class="ev-float-btn" title="Float evidence" aria-label="Float evidence">Float</button>
    </div>
    <div id="evidence-body"></div>
    <div id="evidence-placeholder" class="ev-float-placeholder" hidden>
      <span>Evidence is in a floating window.</span>
      <button type="button" id="evidence-dock-btn" class="ev-float-dock">Dock</button>
    </div>
  </div>
  <div class="sidebar-divider" role="separator" aria-orientation="horizontal" aria-label="Resize Evidence" data-section="evidence-panel" tabindex="0"></div>
  <div id="kinds-legend-wrap" class="collapsible-section">
    <button type="button" class="section-header" data-collapse="kinds-legend-wrap" aria-expanded="true">
      <span class="section-chevron" aria-hidden="true"></span>
      <span class="section-title">Kinds</span>
    </button>
    <div id="kinds-legend"></div>
  </div>
  <div class="sidebar-divider" role="separator" aria-orientation="horizontal" aria-label="Resize Kinds legend" data-section="kinds-legend-wrap" tabindex="0"></div>
  <div id="legend-wrap" class="collapsible-section">
    <button type="button" class="section-header" data-collapse="legend-wrap" aria-expanded="true">
      <span class="section-chevron" aria-hidden="true"></span>
      <span class="section-title">Flows</span>
    </button>
    <div id="legend-controls">
      <label><input type="checkbox" id="select-all-cb" checked>Select All</label>
      <select id="coverage-filter" aria-label="Coverage filter">
<option value="all" selected>All</option>
<option value="covered">Covered</option>
<option value="partial">Partial</option>
<option value="uncovered">Uncovered</option>
      </select>
      <button type="button" id="flow-focus-clear" hidden>Clear</button>
    </div>
    <div id="legend"></div>
  </div>
  <div class="sidebar-divider" role="separator" aria-orientation="horizontal" aria-label="Resize Flows legend" data-section="legend-wrap" tabindex="0"></div>
  <div id="stats">${stats}</div>
</div>
<div id="float-layer"></div>
<div id="flow-preview" class="flow-preview" hidden>
  <div class="flow-preview-title" id="flow-preview-title"></div>
  <div class="flow-preview-canvas" id="flow-preview-canvas"></div>
  <div class="flow-preview-hint">Click para ver el diagrama completo</div>
</div>
<div id="node-preview" class="node-preview" hidden>
  <div class="node-preview-title" id="node-preview-title"></div>
  <div class="node-preview-body" id="node-preview-body"></div>
  <div class="flow-preview-hint">Click para ampliar</div>
</div>
<div id="edge-preview" class="edge-preview" hidden>
  <div class="edge-preview-title" id="edge-preview-title"></div>
  <div class="edge-preview-canvas" id="edge-preview-canvas"></div>
  <div class="flow-preview-hint" id="edge-preview-hint">Click para maximizar</div>
</div>
<div id="node-modal" class="node-modal" hidden>
  <div class="node-modal-panel" role="dialog" aria-modal="true" aria-label="Node information">
    <div class="node-modal-bar">
      <span class="node-modal-title" id="node-modal-title"></span>
      <button type="button" class="ev-seq-btn" id="node-modal-close">Cerrar</button>
    </div>
    <div class="node-modal-body" id="node-modal-body"></div>
  </div>
</div>
<div id="sequence-modal" class="seq-modal" hidden>
  <div class="seq-modal-panel" role="dialog" aria-modal="true" aria-label="Diagrama de secuencia">
    <div class="seq-modal-bar">
      <span class="seq-modal-title" id="sequence-modal-title">Secuencia</span>
      <button type="button" class="ev-seq-btn" id="sequence-modal-zoom-out" aria-label="Zoom out">-</button>
      <span class="ev-seq-zoom" id="sequence-modal-zoom">100%</span>
      <button type="button" class="ev-seq-btn" id="sequence-modal-zoom-in" aria-label="Zoom in">+</button>
      <button type="button" class="ev-seq-btn" id="sequence-modal-zoom-reset">Reset</button>
      <button type="button" class="ev-seq-btn" id="sequence-modal-fullscreen">Pantalla completa</button>
      <button type="button" class="ev-seq-btn" id="sequence-modal-close">Cerrar</button>
    </div>
    <div class="seq-modal-body" id="sequence-modal-body">
      <div class="seq-modal-canvas" id="sequence-modal-canvas"></div>
    </div>
  </div>
</div>
${viewerScript(nodesJson, edgesJson, legendJson, kindsJson, evidenceJson)}
</body>
</html>`;
}
