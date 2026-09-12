import test from 'node:test';
import assert from 'node:assert/strict';
import records from './fixtures/operations-scenario.json' with { type: 'json' };
import { getOperationalPlan } from './operations-demo.js';

const scenario = () => structuredClone(records);
const option = (plan, id) => plan.options.find(item => item.id === id);
const shipment = (planOption, id) => planOption.shipments.find(item => item.orderId === id);
const close = (actual, expected) => assert(Math.abs(actual - expected) < 1e-5, `${actual} differs from ${expected}`);

function checkConservation(plan, input) {
  for (const item of plan.options.filter(value => value.feasible)) {
    const inventory = item.inventory;
    assert.equal(inventory.releasedSensors, input.wms.sensorArrays.physicalUnits - input.wms.sensorArrays.qualityHoldUnits - input.wms.sensorArrays.allocatedUnits);
    assert.equal(inventory.sensorsUsed + inventory.sensorsRemaining, inventory.releasedSensors);
    assert.equal(inventory.heldSensorsUsed, 0);
    assert.equal(inventory.finishedModulesUsed + inventory.finishedModulesRemaining, inventory.releasedFinishedModules);
    assert(inventory.sensorsRemaining >= 0);
    assert(inventory.finishedModulesRemaining >= 0);
    const modules = item.shipments.filter(order => order.orderId !== 'kits');
    assert.equal(modules.reduce((total, order) => total + order.produced, 0) * input.mes.sensorsPerPowertrain, inventory.sensorsUsed);
    assert.equal(modules.reduce((total, order) => total + order.fromFinishedGoods, 0), inventory.finishedModulesUsed);
    for (const part of inventory.kitInputs) {
      assert.equal(part.usedUnits + part.remainingUnits, part.releasedUnits);
      assert.equal(part.heldUnitsUsed, 0);
      assert(part.remainingUnits >= 0);
      assert.equal(part.usedUnits, inventory.kitsBuilt * input.mes.serviceKits.bom.find(value => value.partId === part.partId).unitsPerKit);
    }
    const work = item.schedule.filter(row => ['production', 'changeover'].includes(row.kind));
    let lastEnd = 0;
    for (const row of work) {
      assert(row.startHour >= lastEnd - 1e-5, `${item.id} has overlapping line work`);
      assert(row.endHour >= row.startHour);
      assert(row.endHour <= input.mes.horizonHours + 1e-5);
      lastEnd = row.endHour;
    }
    close(item.metrics.productiveHours, work.filter(row => row.kind === 'production').reduce((total, row) => total + row.endHour - row.startHour, 0));
    close(item.metrics.productiveHours + item.metrics.setupHours + item.metrics.idleHours, input.mes.horizonHours);
    for (const row of item.shipments) {
      assert.equal(row.shipped + row.unfilled, row.quantity);
      assert.equal(row.onTime + row.late, row.quantity);
      assert(row.onTime <= row.shipped);
      assert(row.unfilled >= 0);
    }
    close(item.metrics.lateFees, item.shipments.reduce((sum, row) => sum + row.late * row.lateFeePerUnit, 0));
    close(item.metrics.modeledCost, item.metrics.lateFees + item.metrics.setupCost);
  }
}

test('comparison derives the three plans from released inventory, queue policy and customer terms', () => {
  const plan = getOperationalPlan('evt_004');
  assert.equal(plan.recommended.id, 'resequence');
  const baseline = option(plan, 'baseline');
  const priority = option(plan, 'priority');
  const resequence = option(plan, 'resequence');
  assert.equal(shipment(baseline, 'standard').onTime, 180);
  assert.equal(shipment(baseline, 'priority').onTime, 20);
  assert.equal(shipment(baseline, 'priority').late, 160);
  assert.equal(shipment(baseline, 'kits').late, 160);
  assert.equal(baseline.metrics.modeledCost, 160 * 150 + 160 * 10);
  assert.equal(priority.metrics.modeledCost, 160 * 25 + 160 * 10);
  assert.equal(resequence.metrics.modeledCost, 160 * 25 + 600);
  assert.equal(resequence.metrics.modeledCost, 4600);
  assert.equal(resequence.metrics.costReduction, 21000);
  assert.deepEqual(plan.comparisonBreakdown, { priorityAllocationSavings: 20000, kitLateFeesAvoided: 1600, additionalSetupCost: 600, resequenceReduction: 21000 });
  checkConservation(plan, records);
});

test('recommended schedule reserves finished modules and fits the approved kit job into 26 hours', () => {
  const recommended = getOperationalPlan('evt_004').recommended;
  assert.equal(shipment(recommended, 'priority').fromFinishedGoods, 40);
  assert.equal(shipment(recommended, 'priority').produced, 140);
  assert.equal(shipment(recommended, 'priority').completionHour, 7);
  assert.equal(shipment(recommended, 'standard').produced, 20);
  assert.equal(shipment(recommended, 'standard').unfilled, 160);
  assert.equal(shipment(recommended, 'kits').completionHour, 26);
  assert.deepEqual(recommended.schedule.filter(row => ['production', 'changeover'].includes(row.kind)).map(row => [row.kind, row.orderId, row.startHour, row.endHour, row.quantity]), [
    ['production', 'priority', 0, 7, 140],
    ['production', 'standard', 7, 8, 20],
    ['changeover', 'kits', 8, 10, 0],
    ['production', 'kits', 10, 26, 160],
  ]);
  assert.equal(recommended.metrics.productiveHours, 24);
  assert.equal(recommended.metrics.productiveHoursRecovered, 16);
  assert.equal(recommended.metrics.setupHours, 2);
  assert.equal(recommended.metrics.elapsedHours, 26);
  assert(recommended.schedule.some(row => row.kind === 'defer' && row.orderId === 'standard' && row.quantity === 160));
});

test('more physical stock under quarantine provides no extra capacity', () => {
  const changed = scenario();
  changed.wms.sensorArrays.physicalUnits += 300;
  changed.wms.sensorArrays.qualityHoldUnits += 300;
  const plan = getOperationalPlan('evt_004', changed);
  assert.equal(plan.recommended.metrics.modeledCost, 4600);
  assert.equal(plan.recommended.inventory.sensorsUsed, 160);
  assert.equal(plan.recommended.inventory.heldSensors, 340);
  assert.equal(plan.recommended.inventory.heldSensorsUsed, 0);
  checkConservation(plan, changed);
});

test('allocated stock stays unavailable and lower released stock changes promised output', () => {
  const changed = scenario();
  changed.wms.sensorArrays.allocatedUnits = 40;
  const plan = getOperationalPlan('evt_004', changed);
  assert.equal(plan.recommended.inventory.releasedSensors, 120);
  assert.equal(plan.recommended.metrics.priorityOnTime, 160);
  assert.equal(shipment(plan.recommended, 'priority').late, 20);
  assert.equal(plan.recommended.metrics.standardLate, 180);
  assert.match(plan.draft, /160\/180 priority modules/);
  checkConservation(plan, changed);
});

test('deadline arithmetic counts produced-but-late priority units instead of declaring all shipments on time', () => {
  const changed = scenario();
  changed.orders.items.find(order => order.id === 'priority').dueHour = 4;
  const plan = getOperationalPlan('evt_004', changed);
  const priority = shipment(plan.recommended, 'priority');
  assert.equal(priority.shipped, 180);
  assert.equal(priority.unfilled, 0);
  assert.equal(priority.onTime, 40 + 4 * 20);
  assert.equal(priority.late, 60);
  assert.equal(plan.recommended.metrics.lateFees, 60 * 150 + 160 * 25);
  checkConservation(plan, changed);
});

test('kit materials and time both limit production; unreleased kit inputs are never consumed', () => {
  const changed = scenario();
  changed.wms.kitInputs.find(input => input.partId === 'SERVICE-FASTENER').qualityHoldUnits = 64;
  const plan = getOperationalPlan('evt_004', changed);
  assert.equal(plan.recommended.inventory.kitsBuilt, (640 - 64) / 4);
  assert.equal(plan.recommended.metrics.kitsOnTime, 144);
  assert.equal(shipment(plan.recommended, 'kits').late, 16);
  assert.equal(plan.recommended.metrics.modeledCost, 160 * 25 + 16 * 10 + 600);
  checkConservation(plan, changed);
  const slow = scenario();
  slow.mes.powertrainUnitsPerHour = 5;
  const constrained = getOperationalPlan('evt_004', slow);
  assert.equal(option(constrained, 'resequence').metrics.kitsOnTime, 60);
  assert.equal(option(constrained, 'resequence').metrics.elapsedHours, 40);
  checkConservation(constrained, slow);
});

test('ample released sensors remove the queue block and preserve the current plan on a cost tie', () => {
  const changed = scenario();
  changed.wms.sensorArrays.physicalUnits = 360;
  const plan = getOperationalPlan('evt_004', changed);
  assert.equal(plan.recommended.id, 'baseline');
  assert.equal(plan.recommended.metrics.lateFees, 0);
  assert.equal(plan.recommended.metrics.modeledCost, 600);
  assert.equal(plan.recommended.metrics.kitsOnTime, 160);
  assert.equal(shipment(plan.recommended, 'priority').completionHour, 16);
  assert.equal(plan.recommended.metrics.elapsedHours, 34);
  assert.equal(plan.recommended.metrics.costReduction, 0);
  checkConservation(plan, changed);
});

test('priority allocation wins when kit fees avoided do not cover the changeover', () => {
  const changed = scenario();
  changed.mes.serviceKits.changeoverCost = 2000;
  const plan = getOperationalPlan('evt_004', changed);
  assert.equal(plan.recommended.id, 'priority');
  assert.equal(plan.recommended.metrics.modeledCost, 5600);
  assert.equal(option(plan, 'resequence').metrics.modeledCost, 6000);
  assert.equal(plan.recommended.metrics.setupCost, 0);
  assert.equal(plan.recommended.metrics.productiveHoursRecovered, 0);
  checkConservation(plan, changed);
});

test('MES release uses the actual deferral hour when no standard production fits', () => {
  const changed = scenario();
  changed.orders.items.find(order => order.id === 'priority').quantity = 200;
  const plan = getOperationalPlan('evt_004', changed);
  assert.equal(plan.recommended.id, 'resequence');
  assert.equal(shipment(plan.recommended, 'standard').produced, 0);
  const release = plan.actions.find(action => action.owner === 'MES scheduler');
  assert.equal(release.atHour, 8);
  assert.match(release.text, /At hour 8, park the 180 unfilled standard modules/);
  assert.doesNotMatch(release.text, /Build.*0 standard/);
  assert.equal(plan.recommended.metrics.elapsedHours, 26);
  checkConservation(plan, changed);
});

test('kit release requires BOM approval, an independent material path, and a qualified crew', () => {
  for (const flag of ['bomApproved', 'qualifiedCrewAvailable']) {
    const changed = scenario();
    changed.mes.serviceKits[flag] = false;
    const plan = getOperationalPlan('evt_004', changed);
    assert.equal(option(plan, 'resequence').feasible, false);
    assert.equal(plan.recommended.id, 'priority');
    assert(option(plan, 'resequence').blockedReason.length > 20);
  }
  const changed = scenario();
  changed.mes.serviceKits.bom[0].partId = 'SENSOR-ARRAY';
  changed.wms.kitInputs[0].partId = 'SENSOR-ARRAY';
  const plan = getOperationalPlan('evt_004', changed);
  assert.equal(option(plan, 'resequence').feasible, false);
  assert.match(option(plan, 'resequence').blockedReason, /disrupted material/);
  assert.equal(plan.recommended.id, 'priority');
});

test('qualification time is not treated as an available receipt', () => {
  const alternate = option(getOperationalPlan('evt_004'), 'alternate');
  assert.equal(alternate.feasible, false);
  assert.equal(alternate.metrics, null);
  assert.match(alternate.blockedReason, /120 scheduled hours/);
  assert.match(alternate.blockedReason, /40-hour horizon/);
  assert.match(alternate.blockedReason, /No qualified, committed receipt/);
  assert.deepEqual(alternate.refs, ['E5', 'E8']);
});

test('conservation and deadlines hold across low, partial and abundant released-stock inputs', () => {
  for (const releasedSensors of [0, 20, 80, 120, 140, 159, 160, 200, 300, 320, 400]) {
    const changed = scenario();
    changed.wms.sensorArrays.physicalUnits = releasedSensors + changed.wms.sensorArrays.qualityHoldUnits;
    const plan = getOperationalPlan('evt_004', changed);
    checkConservation(plan, changed);
    assert.equal(plan.recommended.metrics.modeledCost, Math.min(...plan.options.filter(item => item.feasible).map(item => item.metrics.modeledCost)));
  }
});

test('operational evidence and draft keep simulated scope, approval, owners, remaining misses and source references visible', () => {
  const plan = getOperationalPlan('evt_004');
  assert.equal(plan.simulated, true);
  assert.deepEqual(plan.sources.map(source => source.id), ['E5', 'E6', 'E7', 'E8']);
  for (const source of plan.sources) {
    assert.equal(source.simulated, true);
    assert.match(source.kind, /^Simulated /);
    assert.match(source.text, /^SIMULATED\./);
    assert.equal(source.sourcePath, 'frontend/src/fixtures/operations-scenario.json');
    assert.equal(source.recordIds.length, 1);
  }
  const referenceIds = new Set(['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8']);
  for (const item of [...plan.findings, ...plan.actions, ...plan.reviewTriggers]) assert(item.refs.every(id => referenceIds.has(id)));
  assert(plan.actions.every(action => action.owner && Number.isFinite(action.atHour)));
  assert.match(plan.draft, /160 late standard units/);
  assert.match(plan.draft, /26/);
  assert.match(plan.draft, /Quality Lead/);
  assert.match(plan.draft, /SIMULATED DEMO PROPOSAL/);
  assert.doesNotMatch(plan.draft, /Qwen|fixture/);
  assert.match(plan.draft, /approve the proposed stock allocation/);
  assert.match(plan.draft, /nothing has been sent, reserved, purchased, or rescheduled/);
  assert.match(plan.riskSummary, /remains unresolved/);
  assert(plan.assumptions.some(text => /not a connected-system result/.test(text)));
});

test('the operational plan is scoped to evt_004 and does not mutate input records or later replays', () => {
  for (const eventId of ['evt_001', 'evt_002', 'evt_003', 'evt_005', 'evt_999']) assert.equal(getOperationalPlan(eventId), null);
  const input = scenario();
  const before = structuredClone(input);
  const plan = getOperationalPlan('evt_004', input);
  plan.recommended.metrics.modeledCost = -1;
  plan.sources[0].text = 'Changed';
  assert.deepEqual(input, before);
  assert.equal(getOperationalPlan('evt_004', input).recommended.metrics.modeledCost, 4600);
  assert.equal(getOperationalPlan('evt_004').recommended.metrics.modeledCost, 4600);
});

test('inconsistent inventory and unsupported receipt/timing assumptions are rejected rather than quietly modeled', () => {
  const negative = scenario();
  negative.wms.sensorArrays.qualityHoldUnits = 201;
  assert.throws(() => getOperationalPlan('evt_004', negative), /exceed physical stock/);
  const unmarked = scenario();
  unmarked.simulated = false;
  assert.throws(() => getOperationalPlan('evt_004', unmarked), /explicitly simulated/);
  const receipts = scenario();
  receipts.wms.committedIncomingSensorUnits = 100;
  assert.throws(() => getOperationalPlan('evt_004', receipts), /arrival-time modeling/);
  const deadline = scenario();
  deadline.orders.items[0].dueHour = 100;
  assert.throws(() => getOperationalPlan('evt_004', deadline), /within the modeled horizon/);
  const sequence = scenario();
  sequence.mes.currentSequence = ['kits', 'standard', 'priority'];
  assert.throws(() => getOperationalPlan('evt_004', sequence), /kits must be last/);
  const midSequence = scenario();
  midSequence.mes.prioritySequence = ['priority', 'kits', 'standard'];
  assert.throws(() => getOperationalPlan('evt_004', midSequence), /kits must be last/);
});
