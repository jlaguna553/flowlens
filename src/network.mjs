import { unzip } from './zip.mjs';

const STATIC_ASSET = /\.(?:js|css|png|jpg|jpeg|svg|woff|woff2|ttf|otf|eot|ico|map)$/i;

const API_RESOURCE_TYPES = new Set(['xhr', 'fetch']);

const NON_HTTP = /^(?:data|blob):/i;

function isStaticAsset(pathname) {
  return STATIC_ASSET.test(pathname);
}

const THIRD_PARTY = /(^|\.)(googleapis\.com|gstatic\.com|google\.com|googleusercontent\.com|doubleclick\.net|gvt1\.com|googlevideo\.com)$/i;

const THIRD_PARTY_PATH = /^\/(?:\$rpc|maps|maps-api-v3|mapfiles|gen_204)\b/i;

function isThirdParty(hostname) {
  return THIRD_PARTY.test(hostname);
}

function isThirdPartyPath(pathname) {
  return THIRD_PARTY_PATH.test(pathname);
}

function readBody(files, postData) {
  if (!postData || typeof postData !== 'object') return null;
  if (typeof postData.text === 'string' && postData.text.length) return postData.text;
  const file = postData._file;
  if (typeof file !== 'string' || !file.length) return null;
  const data = files.get(file);
  if (!data) return null;
  const text = data.toString('utf8');
  return text.length ? text : null;
}

function readResponsePreview(files, content) {
  if (!content || typeof content !== 'object') return null;
  if (typeof content.text === 'string' && content.text.length) return content.text.slice(0, 119);
  const file = content._file;
  if (typeof file !== 'string' || !file.length) return null;
  const data = files.get(file);
  if (!data) return null;
  const text = data.toString('utf8');
  return text.length ? text.slice(0, 119) : null;
}

function readResponse(files, response) {
  if (!response || typeof response !== 'object') return null;
  const content = response.content && typeof response.content === 'object' ? response.content : {};
  const size =
    typeof content.size === 'number'
      ? content.size
      : typeof response.bodySize === 'number'
        ? response.bodySize
        : null;
  return {
    status: typeof response.status === 'number' ? response.status : null,
    mimeType: typeof content.mimeType === 'string' ? content.mimeType : null,
    size,
    preview: readResponsePreview(files, content),
  };
}

export function extractRequests(input) {
  const files = input instanceof Map ? input : unzip(input);
  const requests = [];

  for (const [name, data] of files) {
    if (!name.endsWith('.network')) continue;
    const lines = data.toString('utf8').split('\n');
    for (const line of lines) {
      if (!line) continue;
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        continue;
      }
      const snapshot = record && record.snapshot;
      const request = snapshot && snapshot.request;
      if (!request || typeof request.url !== 'string') continue;
      if (NON_HTTP.test(request.url)) continue;
      let parsed;
      try {
        parsed = new URL(request.url);
      } catch {
        continue;
      }
      if (isThirdParty(parsed.hostname)) continue;
      if (isThirdPartyPath(parsed.pathname)) continue;
      const resourceType = typeof snapshot._resourceType === 'string' ? snapshot._resourceType : null;
      if (resourceType) {
        if (!API_RESOURCE_TYPES.has(resourceType)) continue;
      } else if (isStaticAsset(parsed.pathname)) {
        continue;
      }
      const startWallMs = Date.parse(snapshot.startedDateTime);
      if (!Number.isFinite(startWallMs)) continue;
      const durationMs = typeof snapshot.time === 'number' ? snapshot.time : 0;
      requests.push({
        method: request.method,
        url: request.url,
        path: parsed.pathname,
        startWallMs,
        durationMs,
        postData: readBody(files, request.postData),
        response: readResponse(files, snapshot.response),
      });
    }
  }

  return requests;
}
