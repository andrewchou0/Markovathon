import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient, describeEvent, ApiError } from './api-client.js';

const ok = (body) => ({ ok: true, status: 200, json: async () => body });

test('reads suppliers and events from the documented paths', async () => {
  const calls = [];
  const client = createApiClient({
    base: 'http://localhost:8000',
    fetchImpl: async (url) => { calls.push(url); return ok([{ id: 'sup_001' }]); },
  });
  await client.getSuppliers();
  await client.getEvents();
  assert.deepEqual(calls, ['http://localhost:8000/api/suppliers', 'http://localhost:8000/api/events']);
});

test('analyze posts the event_id the contract specifies', async () => {
  let seen;
  const client = createApiClient({
    base: 'http://localhost:8000/',
    fetchImpl: async (url, options) => { seen = { url, ...options }; return ok({ event: {} }); },
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
