import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient, describeEvent, ApiError } from './api-client.js';

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const analysis = { event: { id: 'evt_004' }, directly_affected: ['sup_007'], cascading_affected: ['sup_005'], risk_summary: 'Affected suppliers.', draft_report: 'Unsent draft.' };

test('reads suppliers and events from the documented paths', async () => {
  const calls = [];
  const client = createApiClient({
    base: 'http://localhost:8000',
    fetchImpl: async (url) => { calls.push(url); return ok([]); },
  });
  await client.getSuppliers();
  await client.getEvents();
  assert.deepEqual(calls, ['http://localhost:8000/api/suppliers', 'http://localhost:8000/api/events']);
});

test('analyze posts the event_id the contract specifies', async () => {
  let seen;
  const client = createApiClient({
    base: 'http://localhost:8000/',
    fetchImpl: async (url, options) => { seen = { url, ...options }; return ok(analysis); },
  });
  await client.analyze('evt_004');
  assert.equal(seen.url, 'http://localhost:8000/api/analyze');
  assert.equal(seen.method, 'POST');
  assert.deepEqual(JSON.parse(seen.body), { event_id: 'evt_004' });
});

test('a trailing slash on the base never doubles up', async () => {
  let seen;
  const client = createApiClient({ base: 'http://localhost:8000/', fetchImpl: async (url) => { seen = url; return ok([]); } });
  await client.getEvents();
  assert.equal(seen, 'http://localhost:8000/api/events');
});

test('an unreachable backend explains how to start it', async () => {
  const client = createApiClient({ fetchImpl: async () => { throw new TypeError('fetch failed'); } });
  await assert.rejects(() => client.getEvents(), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 0);
    assert.match(error.message, /uvicorn backend\.api\.main:app/);
    return true;
  });
});

test('surfaces the backend detail for a 404 rather than a generic message', async () => {
  const client = createApiClient({
    fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({ detail: 'Unknown event_id: evt_999' }) }),
  });
  await assert.rejects(() => client.analyze('evt_999'), /Unknown event_id: evt_999/);
});

test('a 503 from the agent guard is reported as such', async () => {
  const client = createApiClient({
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ detail: 'backend/agent/ is not available yet.' }) }),
  });
  await assert.rejects(() => client.analyze('evt_001'), (error) => error.status === 503);
});

test('an error body that is not JSON still yields a usable message', async () => {
  const client = createApiClient({
    fetchImpl: async () => ({ ok: false, status: 500, json: async () => { throw new Error('not json'); } }),
  });
  await assert.rejects(() => client.getSuppliers(), /HTTP 500/);
});

test('event labels stay readable for every seeded event', () => {
  assert.equal(
    describeEvent({ id: 'evt_004', description: 'Export licence suspension on rare-earth concentrate, indefinite', affected_location: 'Antofagasta, CL' }),
    'Export licence suspension on rare-earth concentrate, indefinite — Antofagasta, CL',
  );
  // Descriptions carry their own em dash; the label takes the first clause only.
  assert.equal(
    describeEvent({ id: 'evt_001', description: 'Port closure, Gulf Coast, 48hrs — inbound alloy shipments held', affected_location: 'Gulf Coast, LA' }),
    'Port closure, Gulf Coast, 48hrs — Gulf Coast, LA',
  );
  assert.equal(describeEvent(null), '');
});


test('malformed successful JSON becomes an actionable API error', async () => {
  const client = createApiClient({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('broken JSON'); } }) });
  await assert.rejects(() => client.getEvents(), (error) => error instanceof ApiError && error.status === 502 && /invalid JSON/.test(error.message));
});

test('empty records remain a valid connected empty workspace', async () => {
  const client = createApiClient({ fetchImpl: async () => ok([]) });
  assert.deepEqual(await client.getEvents(), []);
  assert.deepEqual(await client.getSuppliers(), []);
});

test('invalid supplier and event payloads fail before the UI renders them', async () => {
  for (const payload of [null, {}, [{ id: 'incomplete' }]]) {
    const client = createApiClient({ fetchImpl: async () => ok(payload) });
    await assert.rejects(() => client.getEvents(), (error) => error.status === 502);
    await assert.rejects(() => client.getSuppliers(), (error) => error.status === 502);
  }
});

test('rejects malformed analysis without inventing affected suppliers', async () => {
  const client = createApiClient({ fetchImpl: async () => ok({ ...analysis, cascading_affected: null }) });
  await assert.rejects(() => client.analyze('evt_004'), /invalid analysis/);
});

test('blank event selection does not send a request', async () => {
  let called = false;
  const client = createApiClient({ fetchImpl: async () => { called = true; return ok(analysis); } });
  await assert.rejects(() => client.analyze(' '), (error) => error.status === 422);
  assert.equal(called, false);
});

test('regeneration posts the unchanged analysis and requires draft wording', async () => {
  let sent;
  const client = createApiClient({ fetchImpl: async (_, options) => { sent = JSON.parse(options.body); return ok({ draft_report: 'New wording.' }); } });
  assert.deepEqual(await client.regenerateDraft(analysis), { draft_report: 'New wording.' });
  assert.deepEqual(sent, { analysis_result: analysis });
  const broken = createApiClient({ fetchImpl: async () => ok({}) });
  await assert.rejects(() => broken.regenerateDraft(analysis), /invalid draft wording/);
});

const pendingFetch = async (_, { signal }) => new Promise((resolve, reject) => {
  if (signal.aborted) reject(new DOMException('aborted', 'AbortError'));
  else signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
});

test('reset cancellation propagates as AbortError rather than connection failure', async () => {
  const controller = new AbortController();
  const client = createApiClient({ fetchImpl: pendingFetch });
  const request = client.analyze('evt_004', { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, (error) => error.name === 'AbortError' && !(error instanceof ApiError));
});

test('already aborted startup reads do not hang', async () => {
  const controller = new AbortController(); controller.abort();
  const client = createApiClient({ fetchImpl: pendingFetch });
  await assert.rejects(client.getEvents({ signal: controller.signal }), (error) => error.name === 'AbortError');
});

test('a hung read times out with retry guidance', async () => {
  const client = createApiClient({ fetchImpl: pendingFetch, readTimeoutMs: 5 });
  await assert.rejects(client.getEvents(), (error) => error.status === 408 && /retry/.test(error.message));
});

test('analysis has its own longer timeout budget', async () => {
  const client = createApiClient({ fetchImpl: async () => { await new Promise((resolve) => setTimeout(resolve, 15)); return ok(analysis); }, readTimeoutMs: 5, requestTimeoutMs: 100 });
  assert.deepEqual(await client.analyze('evt_004'), analysis);
});
