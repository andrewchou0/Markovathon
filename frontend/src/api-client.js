// Real client for the local backend. The counterpart to demo-client.js: same
// role, live data. Demo mode keeps its scripted walkthrough; live mode talks to
// FastAPI on localhost and works for every event in MongoDB.
//
// fetchImpl is injectable so this is testable under `node --test` with no DOM.

const DEFAULT_BASE = import.meta.env?.VITE_API_BASE ?? 'http://localhost:8000';

// Network failure and 5xx get guidance, not a raw stack trace: the most likely
// cause by far is that the operator hasn't started something.
const OFFLINE_HINT = 'Cannot reach the local backend on :8000. Start it with: uvicorn backend.api.main:app --port 8000';

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

export function createApiClient({ base = DEFAULT_BASE, fetchImpl } = {}) {
  const doFetch = fetchImpl ?? ((...args) => fetch(...args));
  const url = (path) => `${String(base).replace(/\/$/, '')}${path}`;

  async function request(path, options) {
    let response;
    try {
      response = await doFetch(url(path), options);
    } catch (cause) {
      throw new ApiError(OFFLINE_HINT, 0);
    }

    if (!response.ok) {
      let detail = '';
      try {
        const body = await response.json();
        detail = typeof body?.detail === 'string' ? body.detail : '';
      } catch {
        detail = '';
      }
      if (response.status === 404) throw new ApiError(detail || 'Not found on the backend.', 404);
      if (response.status === 422) throw new ApiError(detail || 'The backend rejected that request body.', 422);
      if (response.status === 503) throw new ApiError(detail || 'The agent module is not available on the backend.', 503);
      throw new ApiError(detail || `Backend returned HTTP ${response.status}.`, response.status);
    }

    return response.json();
  }

  const postJson = (path, body) => request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return {
    base,
    getSuppliers: () => request('/api/suppliers'),
    getEvents: () => request('/api/events'),
    analyze: (eventId) => postJson('/api/analyze', { event_id: eventId }),
    regenerateDraft: (analysisResult) => postJson('/api/actions/draft', { analysis_result: analysisResult }),
    offlineStatus: () => request('/api/offline-status'),
    monitorStatus: () => request('/api/monitor/status'),
    monitorActivity: (limit = 12) => request(`/api/monitor/activity?limit=${encodeURIComponent(limit)}`),
  };
}
