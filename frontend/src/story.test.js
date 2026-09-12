import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateImpact, createStory } from './story.js';
const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)));

test('inventory coverage, gap and exposed demand use explicit inputs', () => {
  assert.deepEqual(calculateImpact('evt_001', { closureHours: 48, inventory: 120, hourlyUse: 10 }), { coverage: 12, gap: 36, exposedUnits: 360 });
  assert.deepEqual(calculateImpact('evt_001', { closureHours: 4, inventory: 120, hourlyUse: 10 }), { coverage: 12, gap: 0, exposedUnits: 0 });
  assert.throws(() => calculateImpact('evt_001', { closureHours: 48, inventory: 120, hourlyUse: 0 }));
});
test('document arithmetic cannot imply negative missing records', () => {
  assert.deepEqual(calculateImpact('evt_002', { required: 3, received: 2 }), { missing: 1, completion: 67 });
  assert.throws(() => calculateImpact('evt_002', { required: 3, received: 4 }));
});
test('story collects and synthesizes evidence before impact, plan, and final draft', () => {
  const story = createStory(fixture('analysis-result'), fixture('suppliers'));
  const frames = story.frames;
  const evidenceComplete = frames.findIndex(frame => frame.sourceCount === 4);
  const impactStarts = frames.findIndex(frame => frame.impactIds.length > 0);
  assert(evidenceComplete < frames.findIndex(frame => frame.stage === 2));
  assert(frames.findIndex(frame => frame.findingCount === 3) < impactStarts);
  assert(frames.findIndex(frame => frame.calculated) < frames.findIndex(frame => frame.actionCount > 0));
  assert.equal(frames.filter(frame => frame.complete).length, 1);
  assert.equal(frames.at(-1).complete, true);
  assert.deepEqual(frames.at(-1).impactIds, ['sup_001', 'sup_002', 'sup_003']);
  assert.equal(frames[impactStarts].duration, 550);
  assert(frames.reduce((sum, frame) => sum + frame.duration, 0) >= 30000);
});
