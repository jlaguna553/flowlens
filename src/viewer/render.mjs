// GENERATED FILE - do not edit.
// Source: src/viewer/render.ts (regenerate with: npm run build:viewer)

import { fileURLToPath } from "node:url";

export const VIS_NETWORK_FILE = fileURLToPath(new URL("./vendor/vis-network.min.js", import.meta.url));

export const DEFAULT_VENDOR_HREF = "./vendor/vis-network.min.js";

                                   
                   
                     
                 
                    
                         
 

                               
                      
                 
                
                    
                              
                
                    
                   
                     
                    
                    
                              
                         
 

                               
                         
                       
                           
                           
                 
                    
                         
 

                                     
                
                       
                    
                   
                         
 

                                        
                         
                   
                 
                     
                   
                         
 

                                   
                         
                       
                                    
                         
 

                                 
                 
                   
                      
                                     
                              
                         
 

                               
                
                 
                   
                             
                         
 

                                       
              
                 
                
                         
 

                                   
                             
                         
                                 
                         
 

                                
                        
                     
                     
                   
                         
 

                               
                       
                
                 
                    
                 
                         
                              
                         
 

                                   
                   
                       
                
                         
 

                                
                         
                         
                         
                         
                                               
                        
                         
 

                                
                 
                      
 

const FLOW_PALETTE = ["#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F", "#EDC948", "#B07AA1", "#FF9DA7", "#9C755F", "#BAB0AC"];

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

const MAX_LABEL_LEN = 256;

const KIND_COLORS                         = { backend: "#4C6EF5", db: "#E8A33D", decision: "#B07AA1" };

const KIND_LABELS                         = { interaction: "Front", backend: "Back", db: "BD", decision: "Decision" };

const NODE_SIZE = 26;

const NODE_FONT_SIZE = 12;

const KIND_ORDER = ["interaction", "backend", "db", "decision"];

const SHARED_FILL = "#8A8F98";
const SHARED_BORDER = "#5B6068";

export function sanitizeLabel(value         )         {
  if (value === null || value === undefined) {
    return "";
  }
  let text = String(value).replace(CONTROL_CHARS, "");
  if (text.length > MAX_LABEL_LEN) {
    text = text.slice(0, MAX_LABEL_LEN);
  }
  return text;
}

export function jsSafe(value         )         {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function escHtml(value         )         {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeColor(value         , fallback        )         {
  const text = String(value ?? "");
  return /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(text) ? text : fallback;
}

function resolveFlow(node              )         {
  const raw = node.flow ?? node.community ?? "unassigned";
  return sanitizeLabel(raw) || "unassigned";
}

function normalizeKind(value         )         {
  const kind = sanitizeLabel(value).toLowerCase();
  return kind === "backend" || kind === "db" || kind === "decision" ? kind : "interaction";
}

function normalizeResponse(value         )                                                                                    {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value                           ;
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

function glyphColor(hex        )         {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
    return "#ffffff";
  }
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#16162a" : "#ffffff";
}

function iconInner(kind        , glyph        , bg        )         {
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

function iconSvg(kind        , bg        )         {
  const glyph = glyphColor(bg);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + NODE_SIZE + '" height="' + NODE_SIZE + '" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="' + bg + '"/>' + iconInner(kind, glyph, bg) + "</svg>";
  return "data:image/svg+xml;base64," + Buffer.from(svg, "utf8").toString("base64");
}

function endpointId(link              , primary        , alternate        )                {
  const value = link[primary] ?? link[alternate];
  return value === null || value === undefined ? null : String(value);
}

function instanceOfLinkArray(value         )                 {
  return Array.isArray(value) ? value : [];
}

function buildPayload(graph               ) {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const links = graph.links !== undefined ? instanceOfLinkArray(graph.links) : instanceOfLinkArray(graph.edges);

  const flowNames = new Map                ();
  const flowCoverage = new Map                ();
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

  const degree = new Map                ();
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
  const order           = [];
  const seenFlows = new Set        ();
  for (const node of nodes) {
    const flow = resolveFlow(node);
    if (!seenFlows.has(flow)) {
      seenFlows.add(flow);
      order.push(flow);
    }
  }
  const flowIndex = new Map                ();
  order.forEach((flow, index) => flowIndex.set(flow, index));

  const visNodes            = [];
  const seenNodeIds = new Set        ();
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
      kind,
      shared,
      coverage: sanitizeLabel(node.coverage ?? ""),
      endpoint: sanitizeLabel(node.endpoint ?? ""),
      payload: sanitizeLabel(node.payload ?? ""),
      response: normalizeResponse(node.response),
      degree: deg,
    });
  }

  const counts = new Map                ();
  const kindCounts = new Map                ();
  const nodeCoverage = new Map                ();
  let sharedCount = 0;
  for (const node of visNodes) {
    const item = node                                                                     ;
    counts.set(item.flow, (counts.get(item.flow) ?? 0) + 1);
    kindCounts.set(item.kind, (kindCounts.get(item.kind) ?? 0) + 1);
    if (item.coverage && !nodeCoverage.has(item.flow)) {
      nodeCoverage.set(item.flow, item.coverage);
    }
    if (item.shared) {
      sharedCount += 1;
    }
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
    };
  });

  return { nodes: visNodes, edges: visEdges, legend, kinds };
}

const TRACE_PREFIX = "/_pw/trace/";
const TRACE_VIEWER = TRACE_PREFIX + "index.html";
const ARTIFACT_PREFIX = "/api/artifact/";
const SAFE_ARTIFACT_ID = /^[A-Za-z0-9._-]{1,128}$/;

function toMillis(value         )         {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function safeArtifactId(value         , known             )                {
  if (typeof value !== "string" || !SAFE_ARTIFACT_ID.test(value)) {
    return null;
  }
  if (known.size > 0 && !known.has(value)) {
    return null;
  }
  return value;
}

function artifactUrl(id        )         {
  return ARTIFACT_PREFIX + encodeURIComponent(id);
}

function traceUrl(id        )         {
  return TRACE_VIEWER + "?trace=" + artifactUrl(id);
}

function sanitizeTestTask(value         )                                                                                                                   {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value                           ;
  const acceptanceIn = Array.isArray(raw.acceptance) ? raw.acceptance : [];
  const acceptance           = [];
  for (const item of acceptanceIn) {
    const text = sanitizeLabel(item);
    if (text) {
      acceptance.push(text);
    }
  }
  const nodesIn = Array.isArray(raw.nodes) ? raw.nodes : [];
  const nodes                                                = [];
  for (const node of nodesIn) {
    const item = node && typeof node === "object" ? node                            : {};
    const id = sanitizeLabel(item.id ?? "");
    const label = sanitizeLabel(item.label ?? item.id ?? "");
    if (!id && !label) {
      continue;
    }
    nodes.push({ id, label: label || id, kind: sanitizeLabel(item.kind ?? "") });
  }
  return { suggestedSpecFile: sanitizeLabel(raw.suggestedSpecFile ?? ""), acceptance, nodes };
}

function sanitizeAgent(value         )                                                                                  {
  const raw = value && typeof value === "object" ? value                            : {};
  return {
    reporterPath: sanitizeLabel(raw.reporterPath ?? ""),
    suiteRoot: sanitizeLabel(raw.suiteRoot ?? ""),
    outputDir: sanitizeLabel(raw.outputDir ?? ""),
    specDir: sanitizeLabel(raw.specDir ?? ""),
  };
}

function buildEvidence(graph               ) {
  const flowsIn                 = Array.isArray(graph.flows) ? graph.flows : [];
  const artifacts = graph.artifacts && typeof graph.artifacts === "object" ? graph.artifacts : {};
  const known = new Set        (Object.keys(artifacts));
  const agent = sanitizeAgent(graph.agent);
  const flows            = [];

  for (const flow of flowsIn) {
    if (!flow || flow.id === null || flow.id === undefined) {
      continue;
    }
    const id = sanitizeLabel(flow.id);
    if (!id) {
      continue;
    }
    const testsIn                 = Array.isArray(flow.tests) ? flow.tests : [];
    const tests            = [];

    for (const test of testsIn) {
      if (!test) {
        continue;
      }
      const resultsIn                   = Array.isArray(test.results) ? test.results : [];
      const results            = [];
      const timeline = test.timeline && typeof test.timeline === "object" ? test.timeline : {};

      for (const result of resultsIn) {
        if (!result) {
          continue;
        }
        const entriesIn                          = Array.isArray(timeline.entries) ? timeline.entries : [];
        const entries            = [];
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

        const attachmentsIn                       = Array.isArray(result.attachments) ? result.attachments : [];
        let videoId = safeArtifactId(timeline.videoArtifact, known);
        let traceId                = null;
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
        }

        results.push({
          retry: toMillis(result.retry),
          videoBaseMs: toMillis(timeline.videoBaseMs),
          videoSrc: videoId ? artifactUrl(videoId) : null,
          traceSrc: traceId ? traceUrl(traceId) : null,
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
      tests,
      testTask: sanitizeTestTask(flow.testTask),
    });
  }

  return { tracePrefix: TRACE_PREFIX, artifactPrefix: ARTIFACT_PREFIX, agent, flows };
}

function styles()         {
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
  #graph { flex: 1; min-width: 0; }
  #resize-handle { width: 6px; flex-shrink: 0; cursor: col-resize; background: var(--border); position: relative; z-index: 5; }
  #resize-handle:hover, #resize-handle:focus-visible, #resize-handle.dragging { background: #4E79A7; outline: none; }
  .sidebar-divider { height: 6px; flex: 0 0 auto; cursor: row-resize; background: var(--border); position: relative; z-index: 4; touch-action: none; }
  .sidebar-divider::after { content: ''; position: absolute; left: 50%; top: 2px; width: 34px; height: 2px; margin-left: -17px; border-radius: 1px; background: var(--input-border); }
  .sidebar-divider:hover, .sidebar-divider:focus-visible, .sidebar-divider.dragging { background: #4E79A7; outline: none; }
  #sidebar { width: 420px; flex-shrink: 0; background: var(--panel); border-left: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
  #theme-wrap, #search-wrap, #playback-bar, #kinds-legend-wrap, #stats { flex: 0 0 auto; }
  #theme-wrap { display: flex; gap: 4px; padding: 8px 12px; border-bottom: 1px solid var(--border); }
  #theme-wrap button { flex: 1; background: var(--bg); color: var(--text-2); border: 1px solid var(--input-border); border-radius: 4px; padding: 4px 0; font-size: 11px; cursor: pointer; }
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
  #evidence-tabs { display: flex; gap: 4px; padding: 8px 12px; border-bottom: 1px solid var(--border); }
  .ev-tab { flex: 1; background: var(--bg); color: var(--text-2); border: 1px solid var(--input-border); border-radius: 4px; padding: 5px 0; font-size: 11px; cursor: pointer; }
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
</style>`;
}

function themeInitScript()         {
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

function viewerScript(nodesJson        , edgesJson        , legendJson        , kindsJson        , evidenceJson        )         {
  return `<script>
const RAW_NODES = ${nodesJson};
const RAW_EDGES = ${edgesJson};
const LEGEND = ${legendJson};
const KINDS = ${kindsJson};
const EVIDENCE = ${evidenceJson};

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/\\u003c/g, '&lt;').replace(/\\u003e/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const nodesDS = new vis.DataSet(RAW_NODES.map(function (n, i) {
  return {
    id: n.id, label: n.label, color: n.color, size: n.size, font: n.font, title: n.title,
    shape: n.shape, image: n.image, shapeProperties: n.shapeProperties, borderWidth: n.borderWidth,
    x: 30 * Math.sqrt(i) * Math.cos(i * 2.4),
    y: 30 * Math.sqrt(i) * Math.sin(i * 2.4),
    flow: n.flow, flowName: n.flowName, kind: n.kind, shared: n.shared, coverage: n.coverage, endpoint: n.endpoint, payload: n.payload, response: n.response, degree: n.degree,
  };
}));

const edgesDS = new vis.DataSet(RAW_EDGES.map(function (e, i) {
  return {
    id: i, from: e.from, to: e.to, label: '', title: e.title, dashes: e.dashes, width: e.width, color: e.color,
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
  edges: { smooth: { type: 'continuous', roundness: 0.2 }, selectionWidth: 3 },
});

const THEME_KEY = 'flowlens-theme';
const themeMQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
let themeLabelColor = '#ffffff';
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
  const labelColor = getComputedStyle(root).getPropertyValue('--node-label').trim();
  if (labelColor && labelColor !== themeLabelColor) {
    themeLabelColor = labelColor;
    nodesDS.update(nodesDS.get().map(function (n) { return { id: n.id, font: Object.assign({}, n.font, { color: labelColor }) }; }));
  }
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
function showInfo(nodeId) {
  const n = nodesDS.get(nodeId);
  if (!n) return;
  const neighborIds = network.getConnectedNodes(nodeId);
  const items = neighborIds.map(function (nid) {
    const nb = nodesDS.get(nid);
    const color = nb && nb.color ? nb.color.background : '#555';
    return '<span class="neighbor-link" data-nid="' + esc(nid) + '" style="border-left-color:' + esc(color) + '">' + esc(nb ? nb.label : nid) + '</span>';
  }).join('');
  let html = '<div class="field"><b>' + esc(n.label) + '</b></div>';
  if (n.endpoint) html += '<div class="field">Endpoint: ' + esc(n.endpoint) + '</div>';
  if (n.kind) html += '<div class="field">Kind: ' + esc(n.kind) + '</div>';
  if (n.flowName) html += '<div class="field">Flow: ' + esc(n.flowName) + '</div>';
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
  infoContent.innerHTML = html;
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
network.on('hoverNode', function (params) { hoveredNodeId = params.node; container.style.cursor = 'pointer'; });
network.on('blurNode', function () { hoveredNodeId = null; container.style.cursor = 'default'; });
network.on('click', function (params) {
  if (params.nodes.length > 0) {
    const clicked = params.nodes[0];
    showInfo(clicked);
    loadNodeEvidence(clicked);
    const node = nodesDS.get(clicked);
    if (node && node.flow) focusFlow(node.flow);
  }
  else if (hoveredNodeId === null) emptyInfo();
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
function nodeHidden(n) {
  return hiddenFlows.has(n.flow) || !flowMatchesCoverage(n.flow);
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
  item.addEventListener('click', function (e) {
    if (e.target === cb) return;
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
  RAW_NODES.forEach(function (n) { if (n.flow === flow) ids.push(n.id); });
  return ids;
}
function flowColorFor(flow) {
  const found = LEGEND.filter(function (c) { return c.cid === flow; })[0];
  return found ? found.color : '#4E79A7';
}
function edgeInFlow(edge, flow) {
  const fromNode = nodesDS.get(edge.from);
  const toNode = nodesDS.get(edge.to);
  return !!((fromNode && fromNode.flow === flow) || (toNode && toNode.flow === flow));
}
function updateLegendFocus() {
  LEGEND.forEach(function (c) {
    const item = legendItems[c.cid];
    if (item) item.classList.toggle('focused', c.cid === focusedFlowId);
  });
  const clearBtn = document.getElementById('flow-focus-clear');
  if (clearBtn) clearBtn.hidden = !focusedFlowId;
}
function applyFlowFocus() {
  const flow = focusedFlowId;
  nodesDS.update(RAW_NODES.map(function (n) {
    if (!flow || n.flow === flow) {
      return { id: n.id, color: n.color, font: Object.assign({}, n.font, { color: themeLabelColor }) };
    }
    const dimColor = { background: '#33334a', border: '#2a2a3e', highlight: { background: '#33334a', border: '#2a2a3e' } };
    return { id: n.id, color: dimColor, font: Object.assign({}, n.font, { color: '#5f5f75' }) };
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
}
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
  const flowData = setEvidenceFlow(String(flow));
  if (network.getSelectedNodes().length === 0 && flowNeedsTest(flowData)) {
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
const evTabButtons = Array.prototype.slice.call(document.querySelectorAll('[data-ev-tab]'));
const implementTabBtn = document.querySelectorAll('[data-ev-tab="implement"]')[0] || null;
const evidenceState = { flowId: null, testIndex: 0, tab: 'video', videoBaseMs: 0, track: [], appliedKey: null };
let evVideo = null;
let evTraceFrame = null;

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

function buildTestCommand(task) {
  const agent = EVIDENCE.agent || {};
  const suiteRoot = agent.suiteRoot || '.';
  const outputDir = agent.outputDir || 'out';
  const reporterPath = agent.reporterPath || '';
  const spec = task && task.suggestedSpecFile ? task.suggestedSpecFile : 'e2e/<flow>.spec.ts';
  return 'cd ' + suiteRoot + ' && FLOWLENS_RUN_OUTPUT=' + outputDir + '/run.json npx playwright test ' + spec + ' --reporter=' + reporterPath + ' --output=' + outputDir + '/test-results';
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
}

evTabButtons.forEach(function (b) {
  b.addEventListener('click', function () { setEvidenceTab(b.getAttribute('data-ev-tab')); });
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
  const flowId = node.flow === null || node.flow === undefined ? '' : String(node.flow);
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

setEvidenceTab('video');
emptyInfo();
</script>`;
}

export function renderHtml(graph                = { nodes: [] }, options                = {})         {
  const payload = buildPayload(graph);
  const evidence = buildEvidence(graph);
  const nodesJson = jsSafe(payload.nodes);
  const edgesJson = jsSafe(payload.edges);
  const legendJson = jsSafe(payload.legend);
  const kindsJson = jsSafe(payload.kinds);
  const evidenceJson = jsSafe(evidence);
  const vendorHref = escHtml(options.vendorHref ?? DEFAULT_VENDOR_HREF);
  const title = escHtml(sanitizeLabel(options.title ?? "flowlens"));
  const stats = payload.nodes.length + " nodes &middot; " + payload.edges.length + " edges &middot; " + payload.legend.length + " flows";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>flowlens - ${title}</title>
<script src="${vendorHref}"></script>
${styles()}
${themeInitScript()}
</head>
<body>
<div id="graph"></div>
<div id="resize-handle" role="separator" aria-orientation="vertical" aria-label="Resize sidebar" tabindex="0"></div>
<div id="sidebar">
  <div id="theme-wrap" role="group" aria-label="Theme">
    <button type="button" data-theme-choice="light">Light</button>
    <button type="button" data-theme-choice="dark">Dark</button>
    <button type="button" data-theme-choice="system">System</button>
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
    <div id="evidence-tabs" role="tablist">
      <button type="button" class="ev-tab" data-ev-tab="video" role="tab" aria-pressed="true">Video</button>
      <button type="button" class="ev-tab" data-ev-tab="trace" role="tab" aria-pressed="false">Trace</button>
      <button type="button" class="ev-tab" data-ev-tab="steps" role="tab" aria-pressed="false">Pasos</button>
      <button type="button" class="ev-tab" data-ev-tab="implement" role="tab" aria-pressed="false" hidden disabled>Implementar test</button>
    </div>
    <div id="evidence-body"></div>
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
${viewerScript(nodesJson, edgesJson, legendJson, kindsJson, evidenceJson)}
</body>
</html>`;
}
