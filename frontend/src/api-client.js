// Local API requests are cancellable and bounded so startup, polling, and reset
// cannot leave the workspace waiting forever or overwrite a newer operation.
const DEFAULT_BASE = import.meta.env?.VITE_API_BASE ?? 'http://localhost:8000';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function describeEvent(event) {
  if (!event) return '';
  const place = event.affected_location ? ` — ${event.affected_location}` : '';
  const headline = String(event.description ?? event.id ?? '').split(/ [—–-] /)[0];
  return `${headline}${place}`;
}

function invalidResponse(label) {
  return new ApiError(`The backend returned invalid ${label}. Retry after checking the local API.`, 502);
}
const strings = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');
const records = (value, label, fields) => {
  if (!Array.isArray(value) || !value.every((item) => item && fields.every((field) => typeof item[field] === 'string') && item.id.trim()) || new Set(value.map((item) => item.id)).size !== value.length) throw invalidResponse(label);
  return value;
};
function validateAnalysis(value) {
  if (!value?.event || typeof value.event.id !== 'string' || !strings(value.directly_affected) || !strings(value.cascading_affected) || typeof value.risk_summary !== 'string' || typeof value.draft_report !== 'string') throw invalidResponse('analysis');
  return value;
}

// Analysis may make two sequential wording calls, each with a 30s gateway
// timeout followed by a 90s Ollama timeout before returning a template.
export function createApiClient({ base = DEFAULT_BASE, fetchImpl, requestTimeoutMs = 270000, readTimeoutMs = 10000 } = {}) {
  const doFetch = fetchImpl ?? ((...args) => fetch(...args));
  const normalizedBase = String(base).replace(/\/+$/, '');
  const url = (path) => `${normalizedBase}${path}`;

  async function request(path, options = {}, timeoutMs = readTimeoutMs) {
    const controller = new AbortController();
    const signal = options.signal;
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener('abort', abort, { once: true });
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      let response;
      try {
        response = await doFetch(url(path), { ...options, signal: controller.signal });
      } catch (cause) {
        if (signal?.aborted) throw new DOMException('Request cancelled.', 'AbortError');
        if (timedOut) throw new ApiError('The local backend took too long to respond. Check the services and retry.', 408);
        if (cause?.name === 'AbortError') throw cause;
        throw new ApiError(`Cannot reach the local backend at ${normalizedBase}. Start it with: uvicorn backend.api.main:app --port 8000`, 0);
      }
      if (!response.ok) {
        let detail = '';
        try { const body = await response.json(); detail = typeof body?.detail === 'string' ? body.detail : ''; } catch { /* HTTP status still explains failure. */ }
        if (response.status === 404) throw new ApiError(detail || 'Not found on the backend.', 404);
        if (response.status === 422) throw new ApiError(detail || 'The backend rejected that request body.', 422);
        if (response.status === 503) throw new ApiError(detail || 'The agent module is not available on the backend.', 503);
        throw new ApiError(detail || `Backend returned HTTP ${response.status}. Check the local services and retry.`, response.status);
      }
      try { return await response.json(); } catch {
        if (signal?.aborted) throw new DOMException('Request cancelled.', 'AbortError');
        if (timedOut) throw new ApiError('The local backend took too long to respond. Check the services and retry.', 408);
        throw invalidResponse('JSON');
      }
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }

  const postJson = (path, body, options = {}) => request(path, {
    ...options, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }, requestTimeoutMs);

  return {
    base: normalizedBase,
    getSuppliers: async (options) => {
      const value = records(await request('/api/suppliers', options), 'supplier records', ['id', 'name', 'part_supplied', 'location', 'compliance_status']);
      if (!value.every((item) => strings(item.downstream_dependents) && typeof item.single_source === 'boolean' && Number.isFinite(item.financial_risk_score))) throw invalidResponse('supplier records');
      return value;
    },
    getEvents: async (options) => records(await request('/api/events', options), 'event records', ['id', 'description', 'affected_location', 'severity', 'type', 'timestamp']),
    analyze: async (eventId, options) => {
      if (typeof eventId !== 'string' || !eventId.trim()) throw new ApiError('Choose a disruption before running an analysis.', 422);
      return validateAnalysis(await postJson('/api/analyze', { event_id: eventId }, options));
    },
    regenerateDraft: async (analysisResult, options) => {
      validateAnalysis(analysisResult);
      const value = await postJson('/api/actions/draft', { analysis_result: analysisResult }, options);
      if (typeof value?.draft_report !== 'string') throw invalidResponse('draft wording');
      return value;
    },
    offlineStatus: (options) => request('/api/offline-status', options),
    monitorStatus: (options) => request('/api/monitor/status', options),
    monitorActivity: (limit = 12, options) => request(`/api/monitor/activity?limit=${encodeURIComponent(limit)}`, options),
  };
}
