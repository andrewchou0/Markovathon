import test from 'node:test';
import assert from 'node:assert/strict';
import { readDemoMode, demoModeUrl } from './demo-mode.js';

test('starts in demo unless explicitly disabled', () => {
  assert.equal(readDemoMode(''), true);
  assert.equal(readDemoMode('?demo=1'), true);
  assert.equal(readDemoMode('?demo=0'), false);
});

test('mode links preserve other parameters and the current anchor', () => {
  assert.equal(demoModeUrl('http://127.0.0.1:5173/?filter=single#response', false), '/?filter=single&demo=0#response');
  assert.equal(demoModeUrl('http://127.0.0.1:5173/?demo=0', true), '/?demo=1');
});
