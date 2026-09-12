import test from 'node:test';
import assert from 'node:assert/strict';
import { getRevealGroups } from './reveal.js';

const suppliers = [
  { id: 'sup_001', downstream_dependents: ['sup_002', 'sup_003'] },
  { id: 'sup_002', downstream_dependents: ['sup_004'] },
  { id: 'sup_003', downstream_dependents: [] },
  { id: 'sup_004', downstream_dependents: ['sup_001'] },
];

test('does not invent impact beyond the analysis, even when an edge continues', () => {
  assert.deepEqual(getRevealGroups({ directly_affected: ['sup_001'], cascading_affected: ['sup_002', 'sup_003'] }, suppliers), [['sup_001'], ['sup_002', 'sup_003']]);
});
test('reveals by hop, terminates on cycles, and never repeats a direct supplier', () => {
  assert.deepEqual(getRevealGroups({ directly_affected: ['sup_001'], cascading_affected: ['sup_004', 'sup_003', 'sup_002', 'sup_001'] }, suppliers), [['sup_001'], ['sup_002', 'sup_003'], ['sup_004']]);
});
test('retains API-reported impact when an edge or supplier is absent', () => {
  assert.deepEqual(getRevealGroups({ directly_affected: ['sup_001'], cascading_affected: ['sup_099'] }, suppliers), [['sup_001'], ['sup_099']]);
});
test('handles an empty result', () => {
  assert.deepEqual(getRevealGroups({ directly_affected: [], cascading_affected: [] }, suppliers), []);
});
