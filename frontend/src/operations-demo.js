import defaultRecords from './fixtures/operations-scenario.json' with { type: 'json' };

const ORDER_IDS = ['priority', 'standard', 'kits'];
const REFS = ['E5', 'E6', 'E7', 'E8'];
const EPSILON = 1e-9;
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
const hours = value => Number(value.toFixed(2)).toString();
const rounded = value => Math.round((value + Number.EPSILON) * 1e6) / 1e6;
const released = stock => stock.physicalUnits - stock.qualityHoldUnits - stock.allocatedUnits;
const wholeCapacity = (duration, rate) => Math.max(0, Math.floor(duration * rate + EPSILON));

function number(value, name, { min = 0, integer = false } = {}) {
  if (!Number.isFinite(value) || value < min || (integer && !Number.isInteger(value))) throw new Error(`Invalid simulated planning input: ${name}.`);
}
function stock(value, name) {
  if (!value || typeof value.partId !== 'string') throw new Error(`Missing simulated stock record: ${name}.`);
  for (const key of ['physicalUnits', 'qualityHoldUnits', 'allocatedUnits']) number(value[key], `${name}.${key}`, { integer: true });
  if (released(value) < 0) throw new Error(`Quality holds and allocations exceed physical stock: ${name}.`);
}
function validate(records) {
  if (records?.simulated !== true || records?.eventId !== 'evt_004') throw new Error('Operational planning requires explicitly simulated evt_004 records.');
  if (records.currency !== 'USD' || records.planningHour !== 0) throw new Error('This demo uses USD and a planning clock beginning at hour zero.');
  stock(records.wms?.sensorArrays, 'sensorArrays');
  stock(records.wms?.finishedPowertrain, 'finishedPowertrain');
  if (!Array.isArray(records.wms.kitInputs)) throw new Error('Missing simulated kit inventory.');
  records.wms.kitInputs.forEach((value, index) => stock(value, `kitInputs[${index}]`));
  if (new Set(records.wms.kitInputs.map(value => value.partId)).size !== records.wms.kitInputs.length) throw new Error('Kit inventory part IDs must be unique.');
  if (records.wms.committedIncomingSensorUnits !== 0) throw new Error('Incoming receipts need arrival-time modeling; this comparison assumes no committed receipts.');
  const mes = records.mes;
  if (!mes || mes.releasePolicy !== 'strict_queue') throw new Error('This comparison requires the recorded strict-queue MES release policy.');
  number(mes.horizonHours, 'horizonHours', { min: EPSILON });
  number(mes.powertrainUnitsPerHour, 'powertrainUnitsPerHour', { min: EPSILON });
  number(mes.sensorsPerPowertrain, 'sensorsPerPowertrain', { min: 1, integer: true });
  for (const key of ['currentSequence', 'prioritySequence']) {
    if (!Array.isArray(mes[key]) || mes[key].length !== ORDER_IDS.length || new Set(mes[key]).size !== ORDER_IDS.length || mes[key].some(id => !ORDER_IDS.includes(id))) throw new Error(`Invalid MES ${key}.`);
    if (mes[key].at(-1) !== 'kits') throw new Error('This comparison models module work followed by one kit changeover; kits must be last in the sequence.');
  }
  if (mes.prioritySequence[0] !== 'priority') throw new Error('The priority sequence must reserve the priority order first.');
  const kit = mes.serviceKits;
  if (!kit || typeof kit.bomApproved !== 'boolean' || typeof kit.qualifiedCrewAvailable !== 'boolean' || !Array.isArray(kit.affectedMaterialIds)) throw new Error('Kit BOM and crew approval must be explicit.');
  number(kit.unitsPerHour, 'kitUnitsPerHour', { min: EPSILON });
  number(kit.changeoverHours, 'changeoverHours');
  number(kit.changeoverCost, 'changeoverCost');
  if (!Array.isArray(kit.bom) || !kit.bom.length || new Set(kit.bom.map(item => item.partId)).size !== kit.bom.length) throw new Error('A unique, nonempty kit BOM is required.');
  for (const input of kit.bom) {
    number(input.unitsPerKit, `${input.partId}.unitsPerKit`, { min: 1, integer: true });
    if (!records.wms.kitInputs.some(item => item.partId === input.partId)) throw new Error(`Missing kit inventory for ${input.partId}.`);
  }
  const orders = records.orders?.items;
  if (!Array.isArray(orders) || orders.length !== ORDER_IDS.length || new Set(orders.map(order => order.id)).size !== ORDER_IDS.length || orders.some(order => !ORDER_IDS.includes(order.id))) throw new Error('Exactly one priority, standard, and kit order is required.');
  for (const order of orders) {
    number(order.quantity, `${order.id}.quantity`, { integer: true });
    number(order.dueHour, `${order.id}.dueHour`);
    number(order.lateFeePerUnit, `${order.id}.lateFeePerUnit`);
    if (order.dueHour > mes.horizonHours) throw new Error('Order deadlines must fall within the modeled horizon to compare late fees.');
    if (order.product !== (order.id === 'kits' ? 'serviceKit' : 'powertrain')) throw new Error(`Unexpected product for ${order.id}.`);
  }
  if (!records.qualityAlternate) throw new Error('Quality and alternate-qualification records are required.');
  number(records.qualityAlternate.alternateQualificationWorkingDays, 'alternateQualificationWorkingDays');
  number(records.qualityAlternate.scheduledHoursPerWorkingDay, 'scheduledHoursPerWorkingDay', { min: EPSILON });
}

function kitReleaseBlock(records) {
  const kit = records.mes.serviceKits;
  if (!kit.bomApproved) return 'The service-kit BOM is not approved; obtain engineering approval before releasing the kit job.';
  if (!kit.qualifiedCrewAvailable) return 'A qualified crew is not available for the service-kit job.';
  if (kit.bom.some(input => kit.affectedMaterialIds.includes(input.partId))) return 'The kit BOM depends on disrupted material, so it cannot be treated as an independent production path.';
  return null;
}

// A deterministic SIMULATED scheduling comparison, separate from the backend's
// supplier-risk engine. It allocates released stock and finite line hours only;
// no real WMS/MES/customer system or LLM is called and no action is executed.
function simulate(records, { id, title, description, sequence, bypassBlockedModule }) {
  const { mes, wms } = records;
  const kit = mes.serviceKits;
  let sensorRemaining = released(wms.sensorArrays);
  let finishedRemaining = released(wms.finishedPowertrain);
  const kitRemaining = Object.fromEntries(wms.kitInputs.map(input => [input.partId, released(input)]));
  const shipments = records.orders.items.map(order => ({
    orderId: order.id, label: order.label, quantity: order.quantity, dueHour: order.dueHour,
    lateFeePerUnit: order.lateFeePerUnit, fromFinishedGoods: 0, produced: 0, shipped: 0,
    onTime: 0, late: order.quantity, unfilled: order.quantity, completionHour: order.quantity ? null : 0, lastShipmentHour: null,
  }));
  const schedule = [];
  let clock = 0;
  let productiveHours = 0;
  let setupCost = 0;
  let setupHours = 0;
  let kitsBuilt = 0;
  let blockedReason = null;
  for (const orderId of sequence) {
    const order = records.orders.items.find(item => item.id === orderId);
    const shipment = shipments.find(item => item.orderId === orderId);
    if (!order.quantity) continue;
    if (order.product === 'powertrain') {
      const finished = Math.min(finishedRemaining, order.quantity);
      finishedRemaining -= finished;
      shipment.fromFinishedGoods = finished;
      shipment.shipped += finished;
      shipment.onTime += finished;
      if (finished) {
        shipment.lastShipmentHour = 0;
        schedule.push({ kind: 'allocate', title: `Reserve finished modules for ${order.label.toLowerCase()}`, orderId, startHour: 0, endHour: 0, quantity: finished });
      }
      const units = Math.min(order.quantity - finished, Math.floor(sensorRemaining / mes.sensorsPerPowertrain), wholeCapacity(mes.horizonHours - clock, mes.powertrainUnitsPerHour));
      if (units > 0) {
        const duration = units / mes.powertrainUnitsPerHour;
        const onTime = Math.min(units, wholeCapacity(Math.min(duration, order.dueHour - clock), mes.powertrainUnitsPerHour));
        schedule.push({ kind: 'production', title: `Build ${order.label.toLowerCase()}`, orderId, startHour: rounded(clock), endHour: rounded(clock + duration), quantity: units });
        sensorRemaining -= units * mes.sensorsPerPowertrain;
        shipment.produced = units;
        shipment.shipped += units;
        shipment.onTime += onTime;
        clock += duration;
        productiveHours += duration;
        shipment.lastShipmentHour = rounded(clock);
      }
    } else {
      const releaseBlock = kitReleaseBlock(records);
      if (releaseBlock) { blockedReason = releaseBlock; break; }
      const materialCapacity = Math.min(...kit.bom.map(input => Math.floor(kitRemaining[input.partId] / input.unitsPerKit)));
      const timeCapacity = wholeCapacity(mes.horizonHours - clock - kit.changeoverHours, kit.unitsPerHour);
      const units = Math.min(order.quantity, materialCapacity, timeCapacity);
      if (units > 0) {
        schedule.push({ kind: 'changeover', title: 'Approved service-kit changeover', orderId, startHour: rounded(clock), endHour: rounded(clock + kit.changeoverHours), quantity: 0 });
        clock += kit.changeoverHours;
        setupCost += kit.changeoverCost;
        setupHours += kit.changeoverHours;
        const duration = units / kit.unitsPerHour;
        shipment.onTime = Math.min(units, wholeCapacity(Math.min(duration, order.dueHour - clock), kit.unitsPerHour));
        shipment.produced = units;
        shipment.shipped = units;
        kitsBuilt += units;
        for (const input of kit.bom) kitRemaining[input.partId] -= units * input.unitsPerKit;
        schedule.push({ kind: 'production', title: 'Build service kits', orderId, startHour: rounded(clock), endHour: rounded(clock + duration), quantity: units });
        clock += duration;
        productiveHours += duration;
        shipment.lastShipmentHour = rounded(clock);
      }
    }
    shipment.unfilled = order.quantity - shipment.shipped;
    shipment.late = order.quantity - shipment.onTime;
    shipment.completionHour = shipment.unfilled === 0 ? shipment.lastShipmentHour ?? 0 : null;
    if (shipment.unfilled > 0) {
      if (bypassBlockedModule && order.product === 'powertrain') {
        schedule.push({ kind: 'defer', title: `Park the unfilled ${order.label.toLowerCase()}; release the independent next job`, orderId, startHour: rounded(clock), endHour: rounded(clock), quantity: shipment.unfilled });
      } else {
        blockedReason = `The ${order.label.toLowerCase()} still lacks ${shipment.unfilled} units. The strict queue holds the next job until this job is complete.`;
        break;
      }
    }
  }
  const lateFees = rounded(shipments.reduce((sum, shipment) => sum + shipment.late * shipment.lateFeePerUnit, 0));
  const priority = shipments.find(item => item.orderId === 'priority');
  return {
    id, title, description, feasible: true, blockedReason,
    metrics: {
      modeledCost: rounded(lateFees + setupCost), lateFees, setupCost, setupHours: rounded(setupHours),
      productiveHours: rounded(productiveHours), elapsedHours: rounded(clock), horizonHours: mes.horizonHours,
      idleHours: rounded(mes.horizonHours - clock), costReduction: 0, productiveHoursRecovered: 0,
      priorityOnTime: priority.onTime, priorityDemand: priority.quantity,
      standardLate: shipments.find(item => item.orderId === 'standard').late,
      kitsOnTime: shipments.find(item => item.orderId === 'kits').onTime,
    },
    shipments, schedule,
    inventory: {
      releasedSensors: released(wms.sensorArrays), sensorsUsed: released(wms.sensorArrays) - sensorRemaining,
      sensorsRemaining: sensorRemaining, heldSensors: wms.sensorArrays.qualityHoldUnits, heldSensorsUsed: 0,
      releasedFinishedModules: released(wms.finishedPowertrain), finishedModulesUsed: released(wms.finishedPowertrain) - finishedRemaining,
      finishedModulesRemaining: finishedRemaining, kitsBuilt,
      kitInputs: kit.bom.map(input => ({ partId: input.partId, releasedUnits: released(wms.kitInputs.find(item => item.partId === input.partId)), usedUnits: kitsBuilt * input.unitsPerKit, remainingUnits: kitRemaining[input.partId], heldUnitsUsed: 0 })),
    },
    refs: [...REFS],
    metricRefs: { modeledCost: ['E6', 'E7'], productiveHours: ['E5', 'E6'], priorityOnTime: ['E5', 'E6', 'E7'], qualityHolds: ['E5', 'E8'] },
  };
}

function sourcesFor(records) {
  const { wms, mes, orders, qualityAlternate } = records;
  const qualificationHours = qualityAlternate.alternateQualificationWorkingDays * qualityAlternate.scheduledHoursPerWorkingDay;
  return [
    { id: 'E5', platform: 'Warehouse inventory', kind: 'Simulated WMS snapshot', time: 'Planning hour 0 · simulated', title: 'Released stock and protected quality holds', fact: `${released(wms.sensorArrays)} released sensor arrays + ${released(wms.finishedPowertrain)} unallocated finished modules`, icon: 'network', text: `SIMULATED. Sensor arrays: ${wms.sensorArrays.physicalUnits} physical − ${wms.sensorArrays.qualityHoldUnits} on quality hold − ${wms.sensorArrays.allocatedUnits} already allocated = ${released(wms.sensorArrays)} available. Finished powertrain modules: ${released(wms.finishedPowertrain)} released and unallocated. Kit inventory: ${wms.kitInputs.map(input => `${released(input)} released ${input.partId}`).join('; ')}. No incoming sensor receipts are committed.`, recordIds: [wms.recordId], simulated: true },
    { id: 'E6', platform: 'Factory schedule & BOM', kind: 'Simulated MES release plan', time: 'Planning hour 0 · simulated', title: 'A blocked job parks otherwise usable capacity', fact: `${mes.horizonHours} scheduled hours · strict job queue · ${kitReleaseBlock(records) ? 'kit release needs review' : 'approved independent kit BOM'}`, icon: 'info', text: `SIMULATED. Current order: ${mes.currentSequence.join(' → ')}. ${mes.releasePolicyDescription} Powertrain rate: ${mes.powertrainUnitsPerHour} modules/hour, using ${mes.sensorsPerPowertrain} sensor array per module. The resequence option requires approval to park unfilled module work and release the independent service-kit job. Kit rate: ${mes.serviceKits.unitsPerHour}/hour; changeover: ${mes.serviceKits.changeoverHours} hours and ${money(mes.serviceKits.changeoverCost)}. BOM: ${mes.serviceKits.bom.map(item => `${item.unitsPerKit} × ${item.partId}`).join(', ')}. Engineering approval: ${mes.serviceKits.bomApproved ? 'recorded in this simulation' : 'not available'}. Qualified crew: ${mes.serviceKits.qualifiedCrewAvailable ? 'available in this simulation' : 'not available'}.`, recordIds: [mes.recordId], simulated: true },
    { id: 'E7', platform: 'Customer commitments', kind: 'Simulated order and fee records', time: 'Planning hour 0 · simulated', title: 'Protect the highest-impact commitment first', fact: orders.items.map(order => `${order.id}: ${order.quantity} due h${hours(order.dueHour)}`).join(' · '), icon: 'copy', text: `SIMULATED. ${orders.items.map(order => `${order.label}: ${order.quantity} units due at hour ${hours(order.dueHour)}; ${money(order.lateFeePerUnit)} per unit late.`).join(' ')} ${orders.feeRule}`, recordIds: [orders.recordId], simulated: true },
    { id: 'E8', platform: 'Quality & alternate sourcing', kind: 'Simulated quality and qualification record', time: 'Planning hour 0 · simulated', title: 'Do not consume held stock or assume an alternate arrives', fact: `${wms.sensorArrays.qualityHoldUnits} sensors remain held · alternate qualification ${qualificationHours} hours`, icon: 'shield', text: `SIMULATED. ${wms.sensorArrays.qualityHoldUnits} sensor arrays are on quality hold and are excluded from every option. Alternate qualification requires ${qualityAlternate.alternateQualificationWorkingDays} working days × ${qualityAlternate.scheduledHoursPerWorkingDay} scheduled hours/day = ${qualificationHours} hours, compared with this ${mes.horizonHours}-hour horizon. Alternate qualified: ${qualityAlternate.alternateQualified ? 'yes' : 'no'}. Receipt committed: ${qualityAlternate.alternateReceiptCommitted ? 'yes' : 'no'}. ${qualityAlternate.alternateNote}`, recordIds: [qualityAlternate.recordId], simulated: true },
  ];
}

function recommendationActions(records, recommended) {
  const priority = recommended.shipments.find(item => item.orderId === 'priority');
  const standard = recommended.shipments.find(item => item.orderId === 'standard');
  const kit = recommended.shipments.find(item => item.orderId === 'kits');
  const priorityRun = recommended.schedule.find(item => item.kind === 'production' && item.orderId === 'priority');
  const standardRun = recommended.schedule.find(item => item.kind === 'production' && item.orderId === 'standard');
  const standardDeferral = recommended.schedule.find(item => item.kind === 'defer' && item.orderId === 'standard');
  const changeover = recommended.schedule.find(item => item.kind === 'changeover');
  const releaseAt = standardRun?.endHour ?? standardDeferral?.startHour ?? changeover?.startHour ?? priorityRun?.endHour ?? 0;
  const late = recommended.shipments.filter(item => item.late > 0);
  return [
    { title: 'Approve the released-stock allocation', owner: 'Production planner + warehouse lead', atHour: 0, refs: ['E5', 'E7', 'E8'], text: `Before releasing work, approve the proposed stock allocation. Reserve ${priority.fromFinishedGoods} released finished modules and ${priority.produced * records.mes.sensorsPerPowertrain} released sensor arrays for the priority order; ${priority.onTime}/${priority.quantity} priority modules are modeled on time by hour ${hours(priority.dueHour)}.${priorityRun ? ` Build ${priority.produced} during hours ${hours(priorityRun.startHour)}–${hours(priorityRun.endHour)}.` : ''} Do not consume any of the ${records.wms.sensorArrays.qualityHoldUnits} quality-held sensors.` },
    { title: recommended.id === 'resequence' ? 'Park the blocked remainder and release independent work' : 'Release the approved module sequence', owner: 'MES scheduler', atHour: recommended.id === 'resequence' ? releaseAt : 0, refs: ['E5', 'E6', 'E7'], text: recommended.id === 'resequence' ? `${standardRun ? `Build the allocated ${standard.produced} standard modules during hours ${hours(standardRun.startHour)}–${hours(standardRun.endHour)}. ` : ''}${standard.unfilled ? `At hour ${hours(releaseAt)}, park the ${standard.unfilled} unfilled standard modules instead of letting them hold the next job.` : `At hour ${hours(releaseAt)}, release the independent kit job after allocated module work is complete.`}${priority.unfilled ? ` Also retain ${priority.unfilled} unfilled priority modules as an unresolved exception.` : ''} This changes the job-release decision; it does not repair the supplier disruption or create sensor stock.` : `Run ${(recommended.id === 'baseline' ? records.mes.currentSequence : records.mes.prioritySequence).join(' → ')}. Keep unmet module quantities as explicit exceptions. Release later work only under the approved MES policy.` },
    { title: changeover ? 'Authorize the approved kit changeover' : 'Confirm whether a kit changeover is justified', owner: 'Shift supervisor + quality lead', atHour: changeover?.startHour ?? 0, refs: ['E5', 'E6', 'E8'], text: changeover ? `At hour ${hours(changeover.startHour)}, authorize the ${records.mes.serviceKits.changeoverHours}-hour, ${money(records.mes.serviceKits.changeoverCost)} changeover. Verify the approved independent BOM, released kit inputs, and qualified crew. Build ${kit.produced} service kits; ${kit.onTime} are modeled on time, with planned work ending at hour ${hours(kit.lastShipmentHour)}. Do not substitute a disrupted material into the kit BOM.` : `No kit changeover is included in this lowest-cost feasible option. Keep the independent kit route under review if stock, capacity, customer fees, or approval changes.` },
    { title: 'Agree revised commitments before promising recovery', owner: 'Customer account owner', atHour: 0, refs: ['E6', 'E7'], text: `${late.length ? `Request customer review for ${late.map(item => `${item.late} late units on the ${item.label.toLowerCase()}`).join('; ')}.` : 'Confirm the proposed delivery sequence with each order owner.'} Modeled late fees are ${money(recommended.metrics.lateFees)}, plus ${money(recommended.metrics.setupCost)} setup. These simulated terms are not a confirmed charge, waived fee, or a promise that an unfilled order will recover.` },
    { title: 'Keep the root-cause exception open', owner: 'Procurement lead', atHour: 0, refs: ['E1', 'E5', 'E8'], text: 'Continue checking the supplier restriction, qualification status, and committed receipts. Request a revised supplier ETA; rerun this comparison when a receipt is actually committed. No alternate purchase, expedite, or shipment reroute has been executed.' },
  ];
}

export function getOperationalPlan(eventId, optionalRecords) {
  if (eventId !== 'evt_004') return null;
  const records = structuredClone(optionalRecords ?? defaultRecords);
  validate(records);
  const descriptions = [
    { id: 'baseline', title: 'Keep the current sequence', description: 'Standard modules first, then priority modules; the strict queue holds kits behind an unfilled module job.', sequence: records.mes.currentSequence, bypassBlockedModule: false },
    { id: 'priority', title: 'Prioritize the critical order', description: 'Reserve released stock for the priority order first, while retaining the strict job-release queue.', sequence: records.mes.prioritySequence, bypassBlockedModule: false },
    { id: 'resequence', title: 'Prioritize and resequence independent kits', description: 'Protect the priority allocation, explicitly park unfilled module work, and release the approved independent kit job.', sequence: records.mes.prioritySequence, bypassBlockedModule: true },
  ];
  const options = descriptions.map(description => simulate(records, description));
  const kitBlock = kitReleaseBlock(records);
  if (kitBlock) { options[2].feasible = false; options[2].blockedReason = kitBlock; }
  const baseline = options[0];
  for (const option of options) {
    option.metrics.costReduction = rounded(baseline.metrics.modeledCost - option.metrics.modeledCost);
    option.metrics.productiveHoursRecovered = rounded(option.metrics.productiveHours - baseline.metrics.productiveHours);
  }
  // On equal modeled cost keep the earlier, less disruptive policy: current
  // sequence, then priority allocation, then changing the queue release rule.
  const recommended = options.filter(option => option.feasible).reduce((best, option) => option.metrics.modeledCost < best.metrics.modeledCost - EPSILON ? option : best);
  const qualificationHours = records.qualityAlternate.alternateQualificationWorkingDays * records.qualityAlternate.scheduledHoursPerWorkingDay;
  options.push({ id: 'alternate', title: 'Wait for an alternate supplier', description: 'Qualification and a committed delivery would be needed before this becomes a schedulable receipt.', feasible: false, blockedReason: `Qualification requires ${qualificationHours} scheduled hours (${records.qualityAlternate.alternateQualificationWorkingDays} working days), ${qualificationHours > records.mes.horizonHours ? 'beyond' : 'within'} the ${records.mes.horizonHours}-hour horizon. No qualified, committed receipt with an arrival time is modeled, so this is excluded from the comparison.`, metrics: null, shipments: [], schedule: [], inventory: null, refs: ['E5', 'E8'] });
  const sources = sourcesFor(records).map(source => ({ ...source, sourcePath: 'frontend/src/fixtures/operations-scenario.json' }));
  const actions = recommendationActions(records, recommended);
  const late = recommended.shipments.filter(item => item.late > 0);
  const riskSummary = `The export-licence disruption remains unresolved. In this explicitly simulated ${records.mes.horizonHours}-scheduled-hour operational comparison, ${recommended.title.toLowerCase()} reduces modeled late fees plus setup from ${money(baseline.metrics.modeledCost)} to ${money(recommended.metrics.modeledCost)} (${money(recommended.metrics.costReduction)} reduction). It delivers ${recommended.metrics.priorityOnTime}/${recommended.metrics.priorityDemand} priority modules on time and recovers ${hours(recommended.metrics.productiveHoursRecovered)} productive line hours; ${late.length ? late.map(item => `${item.late} ${item.orderId} units remain late`).join(', ') : 'all modeled order units are on time'}. No held stock, uncommitted receipt, or physical action is assumed.`;
  const assumptions = [
    `SIMULATED WMS, MES, customer, and quality records; this is a transparent planning comparison, not a connected-system result or a model-generated plan. Horizon: ${records.mes.horizonHours} scheduled hours from planning hour zero.`,
    `Only ${released(records.wms.sensorArrays)} released, unallocated sensor arrays and ${released(records.wms.finishedPowertrain)} released, unallocated finished modules are available. ${records.wms.sensorArrays.qualityHoldUnits} held sensor arrays stay excluded; no incoming sensor receipts are committed.`,
    `The current MES strict queue parks the line behind an unfilled module job. The resequence option requires a human to authorize bypassing that job; it does not fix the component shortage.`,
    `Powertrain output is ${records.mes.powertrainUnitsPerHour}/hour. The kit route uses ${records.mes.serviceKits.unitsPerHour}/hour, a ${records.mes.serviceKits.changeoverHours}-hour changeover and ${money(records.mes.serviceKits.changeoverCost)} setup. It is eligible only with an approved BOM independent of affected materials, released inputs, and the stated qualified crew.`,
    'The stated per-unit late fees are illustrative one-time charges. Setup is the only added operating cost modeled; freight, energy, revenue, margin, overtime, downstream commitments, and fee negotiations are not quantified.',
    'An on-time unit must be available by its order deadline within the horizon. This comparison assumes local dispatch has no extra transit delay; account owners must verify the actual delivery terms before approval.',
  ];
  const reviewTriggers = [
    { title: 'Inventory or quality status changes', text: 'Recalculate after any receipt, reservation, count correction, or quality disposition. Held material needs a separate quality release; this plan never releases it.', refs: ['E5', 'E8'] },
    { title: 'Rates, crew, or BOM assumptions change', text: 'Stop and reassess if measured output, setup duration/cost, released kit stock, crew availability, or the approved BOM differs. Kits must stay independent of disrupted materials.', refs: ['E5', 'E6', 'E8'] },
    { title: 'Customer timing or terms change', text: 'Reassess if due times, local dispatch assumptions, order priorities, or fee terms differ. Escalate remaining late quantities instead of promising an unverified recovery date.', refs: ['E7'] },
    { title: 'A qualified receipt becomes committed', text: 'Replace the no-receipt assumption with a dated receipt before evaluating an alternate. Qualification duration alone is not material availability.', refs: ['E5', 'E8'] },
  ];
  const findings = [
    { title: 'Protect released stock; quarantine is not capacity', text: `${records.wms.sensorArrays.physicalUnits} physical sensors less ${records.wms.sensorArrays.qualityHoldUnits} held and ${records.wms.sensorArrays.allocatedUnits} allocated leaves ${released(records.wms.sensorArrays)} usable sensors. Combine them with ${released(records.wms.finishedPowertrain)} unallocated finished modules when reserving customer output.`, refs: ['E5', 'E8'] },
    { title: 'Check whether the release queue creates idle time', text: `The baseline produces for ${hours(baseline.metrics.productiveHours)} hours ${baseline.blockedReason ? 'before the release queue blocks' : 'within the horizon'}. Independent kit work requires an approved BOM and crew; when a module job is unfilled, a scheduler must explicitly park that remainder to release the kit job.`, refs: ['E5', 'E6'] },
    { title: 'Compare commitments before choosing the response', text: `The current sequence models ${money(baseline.metrics.modeledCost)} in late fees plus setup. Priority allocation models ${money(options[1].metrics.modeledCost)}; priority plus independent kits models ${money(options[2].metrics.modeledCost)}. These are simulated fees and setup, not revenue or probability estimates.`, refs: ['E6', 'E7'] },
    { title: 'Mitigate consequences while the cause stays open', text: `Alternate qualification takes ${qualificationHours} scheduled hours against a ${records.mes.horizonHours}-hour horizon, with no committed receipt. The recommendation uses released stock and approved capacity; ${recommended.metrics.standardLate} standard modules remain late in this comparison. The supplier restriction remains unresolved.`, refs: ['E5', 'E6', 'E7', 'E8'] },
  ];
  const draft = [
    'To: Production Planner; Warehouse Lead; MES Scheduler; Shift Supervisor; Quality Lead; Customer Account Owner; Procurement Lead',
    'Subject: Approval requested — mitigate Altiplano disruption with released stock and an executable production plan',
    '',
    `Planning basis: SIMULATED operational records E5–E8 for seeded event evt_004. This proposal covers the next ${records.mes.horizonHours} scheduled hours. The supplier restriction remains unresolved.`,
    '',
    `Recommend: ${recommended.title}. Request human approval at planning hour 0 before stock is reserved or MES jobs are released.`,
    '',
    ...actions.flatMap((action, index) => [`${index + 1}. ${action.owner} — hour ${hours(action.atHour)}: ${action.text} [${action.refs.join(', ')}]`, '']),
    'Modeled result:',
    ...recommended.shipments.map(item => `  - ${item.label}: ${item.onTime}/${item.quantity} units on time by hour ${hours(item.dueHour)}; ${item.late} late, including ${item.unfilled} unfilled within the horizon.`),
    `  - ${hours(recommended.metrics.productiveHours)} productive hours; ${hours(recommended.metrics.setupHours)} changeover hours; scheduled work ends at hour ${hours(recommended.metrics.elapsedHours)}.`,
    `  - Late fees ${money(recommended.metrics.lateFees)} + setup ${money(recommended.metrics.setupCost)} = ${money(recommended.metrics.modeledCost)}; baseline ${money(baseline.metrics.modeledCost)}. Modeled reduction: ${money(recommended.metrics.costReduction)}; productive hours recovered: ${hours(recommended.metrics.productiveHoursRecovered)}.`,
    '',
    `Remaining exceptions: ${late.length ? late.map(item => `${item.late} late ${item.orderId} units`).join('; ') : 'no late units under these assumptions'}. Do not promise a recovery date for unfilled work. Do not consume quality-held sensors or assume an alternate receipt.`,
    '',
    'Reassess if stock, quality disposition, customer deadlines, output rates, kit inputs/BOM, crew, setup cost, or a committed receipt changes. Customer owners must verify fee and dispatch terms.',
    '',
    'SIMULATED DEMO PROPOSAL — based on illustrative operational records. Prepared for human approval; nothing has been sent, reserved, purchased, or rescheduled.',
  ].join('\n');
  return {
    eventId, simulated: true, sources, findings, options, baseline, recommended, actions, draft, riskSummary, assumptions, reviewTriggers,
    comparisonBreakdown: {
      priorityAllocationSavings: rounded(baseline.metrics.lateFees - options[1].metrics.lateFees),
      kitLateFeesAvoided: rounded(options[1].metrics.lateFees - options[2].metrics.lateFees),
      additionalSetupCost: rounded(options[2].metrics.setupCost - options[1].metrics.setupCost),
      resequenceReduction: options[2].metrics.costReduction,
    },
  };
}
