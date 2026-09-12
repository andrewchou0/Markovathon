import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { calculateImpact, createStory } from './story.js';
import { demoClient } from './demo-client.js';

const readJson = url => JSON.parse(readFileSync(url, 'utf8'));
const fixture = name => readJson(new URL(`./fixtures/${name}.json`, import.meta.url));
const contract = name => readJson(new URL(`../../contracts/${name}.schema.json`, import.meta.url));

// Validate the exact schema keywords used by the shared contracts. This keeps
// demo-only risk metadata out of AnalysisResult and rejects Mongo's _id field.
function validate(value, schema, label) {
  if (schema.$ref) return validate(value, readJson(new URL(`../../contracts/${schema.$ref}`, import.meta.url)), label);
  if (schema.type === 'object') {
    assert(value && typeof value === 'object' && !Array.isArray(value), label);
    for (const key of schema.required ?? []) assert(Object.hasOwn(value, key), `${label}.${key} is required`);
    if (schema.additionalProperties === false) for (const key of Object.keys(value)) assert(Object.hasOwn(schema.properties, key), `${label}.${key} is outside the contract`);
    for (const [key, child] of Object.entries(schema.properties ?? {})) if (Object.hasOwn(value, key)) validate(value[key], child, `${label}.${key}`);
  } else if (schema.type === 'array') {
    assert(Array.isArray(value), `${label} must be an array`);
    value.forEach((item, index) => validate(item, schema.items, `${label}[${index}]`));
  } else if (schema.type) assert.equal(typeof value, schema.type, `${label} type`);
  if (schema.enum) assert(schema.enum.includes(value), `${label} enum`);
  if (schema.pattern) assert.match(value, new RegExp(schema.pattern), `${label} pattern`);
  if (schema.minimum !== undefined) assert(value >= schema.minimum, `${label} minimum`);
  if (schema.maximum !== undefined) assert(value <= schema.maximum, `${label} maximum`);
  if (schema.format === 'date-time') assert(Number.isFinite(Date.parse(value)), `${label} timestamp`);
}

test('demo suppliers and all five events exactly match the backend seed records', () => {
  assert.deepEqual(demoClient.suppliers, readJson(new URL('../../backend/data/seed/suppliers.json', import.meta.url)));
  assert.deepEqual(demoClient.events, readJson(new URL('../../backend/data/seed/events.json', import.meta.url)));
  assert.equal(demoClient.suppliers.length, 10);
  assert.equal(demoClient.suppliers.filter(supplier => supplier.single_source).length, 5);
  assert.equal(demoClient.events.length, 5);
});

test('all seeded demo records conform to the shared JSON contracts', () => {
  demoClient.suppliers.forEach(supplier => validate(supplier, contract('supplier'), supplier.id));
  demoClient.events.forEach(event => {
    validate(event, contract('event'), event.id);
    const analysis = demoClient.getAnalysis(event.id);
    validate(analysis, contract('analysis_result'), event.id);
    assert.deepEqual(analysis.event, event);
    assert(analysis.risk_summary.trim().length > 40);
    assert.match(analysis.draft_report, /^To: Compliance Contact\nSubject:/);
    assert.match(analysis.draft_report, /has not been sent/);
    const affected = [...analysis.directly_affected, ...analysis.cascading_affected];
    assert.equal(new Set(affected).size, affected.length, `${event.id}: impacts are unique and disjoint`);
    assert(affected.every(id => demoClient.suppliers.some(supplier => supplier.id === id)));
  });
});

test('stored risk and fallback wording equal fresh deterministic backend output', () => {
  const generator = fileURLToPath(new URL('./fixtures/generate-fixtures.py', import.meta.url));
  const output = execFileSync(process.env.PYTHON ?? 'python3', [generator, '--check'], { encoding: 'utf8', timeout: 15000 });
  assert.match(output, /fixtures match/);
});

test('default rare-earth scenario matches the video cascade and 0.961 risk score', () => {
  assert.equal(demoClient.defaultEventId, 'evt_004');
  const analysis = demoClient.getAnalysis(demoClient.defaultEventId);
  assert.deepEqual(fixture('analysis-result'), analysis);
  const story = createStory(analysis, demoClient.suppliers);
  assert.deepEqual(story.revealGroups, [['sup_007'], ['sup_005', 'sup_008'], ['sup_002', 'sup_006'], ['sup_004']]);
  assert.deepEqual(story.calculation, {
    eventId: 'evt_004', networkRiskScore: 0.961, directCount: 1, cascadingCount: 5,
    affectedCount: 6, tierCount: 3, singleSourceCount: 3, flaggedComplianceCount: 3,
    scope: 'Recorded deterministic exposure; not a probability, downtime estimate, or financial loss.',
  });
  assert.equal(demoClient.getPropagation('evt_004').network_risk_score, story.calculation.networkRiskScore);
});

test('every scenario gathers traceable records before showing impact and an unsent response', () => {
  for (const event of demoClient.events) {
    const analysis = demoClient.getAnalysis(event.id);
    const story = createStory(analysis, demoClient.suppliers);
    const frames = story.frames;
    assert.equal(story.sources.length, event.id === 'evt_004' ? 8 : 4);
    const evidenceComplete = frames.findIndex(frame => frame.sourceCount === story.sources.length);
    const impactStarts = frames.findIndex(frame => frame.impactIds.length > 0);
    assert(evidenceComplete < frames.findIndex(frame => frame.stage === 2));
    assert(frames.findIndex(frame => frame.findingCount === story.findings.length) < impactStarts);
    assert(frames.findIndex(frame => frame.calculated) < frames.findIndex(frame => frame.actionCount > 0));
    assert.equal(frames.filter(frame => frame.complete).length, 1);
    assert.equal(frames.at(-1).complete, true);
    assert.deepEqual(frames.at(-1).impactIds, [...analysis.directly_affected, ...analysis.cascading_affected]);
    assert.equal(frames[impactStarts].duration, 550);
    assert(frames.reduce((sum, frame) => sum + frame.duration, 0) >= 30000);
    for (const source of story.sources.slice(0, 4)) {
      assert.match(source.sourcePath, /^backend\/data\/seed\/(suppliers|events)\.json$/);
      assert(source.recordIds.length > 0);
      const records = source.sourcePath.endsWith('events.json') ? demoClient.events : demoClient.suppliers;
      assert(source.recordIds.every(id => records.some(record => record.id === id)));
    }
    const sourceIds = story.sources.map(source => source.id);
    for (const item of [...story.findings, ...story.actions]) assert(item.refs.every(id => sourceIds.includes(id)));
    for (const source of story.sources.slice(4)) {
      const records = fixture('operations-scenario');
      assert.equal(source.simulated, true);
      assert.equal(source.sourcePath, 'frontend/src/fixtures/operations-scenario.json');
      assert.match(source.kind, /Simulated/);
      assert(source.recordIds.every(id => [records.wms, records.mes, records.orders, records.qualityAlternate].some(record => record.recordId === id)));
    }
    assert.equal(story.calculation.coverage, undefined);
    assert.equal(story.calculation.missing, undefined);
  }
});

test('the operational walkthrough hands its calculated proposal to review without altering backend fixtures', () => {
  for (const event of demoClient.events) {
    const analysis = demoClient.getAnalysis(event.id);
    const story = createStory(analysis, demoClient.suppliers);
    validate(story.response, contract('analysis_result'), `${event.id}.review`);
    assert.deepEqual(story.response.directly_affected, analysis.directly_affected);
    assert.deepEqual(story.response.cascading_affected, analysis.cascading_affected);
    if (event.id === 'evt_004') {
      assert.equal(story.response.draft_report, story.operationalPlan.draft);
      assert.equal(story.response.risk_summary, story.operationalPlan.riskSummary);
      assert.match(story.response.draft_report, /160 late standard units/);
      assert.match(story.response.draft_report, /human approval/);
      assert.match(story.response.draft_report, /\$21,000/);
      assert.notEqual(story.response.draft_report, analysis.draft_report);
      assert.equal(story.frames.at(-1).actionCount, story.operationalPlan.actions.length);
    } else {
      assert.equal(story.operationalPlan, null);
      assert.deepEqual(story.response, analysis);
    }
    assert.match(demoClient.getAnalysis(event.id).draft_report, /^To: Compliance Contact/);
  }
});

test('unknown scenarios and altered backend exposure are rejected instead of inventing estimates', () => {
  assert.throws(() => demoClient.getAnalysis('evt_999'), /no demo analysis/);
  assert.throws(() => demoClient.getAnalysis('toString'), /no demo analysis/);
  assert.throws(() => calculateImpact('evt_999'), /No recorded impact/);
  assert.throws(() => calculateImpact('evt_004', { ...calculateImpact('evt_004'), networkRiskScore: 0.5 }), /differ/);
  const changed = demoClient.getAnalysis('evt_004');
  changed.directly_affected = ['sup_001'];
  assert.throws(() => createStory(changed, demoClient.suppliers), /differs/);
});

test('reading or editing a demo analysis does not mutate the next replay', () => {
  const analysis = demoClient.getAnalysis('evt_004');
  analysis.directly_affected.push('sup_001');
  analysis.event.description = 'Changed';
  const propagation = demoClient.getPropagation('evt_004');
  propagation.network_risk_score = 0;
  assert.deepEqual(demoClient.getAnalysis('evt_004').directly_affected, ['sup_007']);
  assert.match(demoClient.getAnalysis('evt_004').event.description, /Export licence/);
  assert.equal(demoClient.getPropagation('evt_004').network_risk_score, 0.961);
});
