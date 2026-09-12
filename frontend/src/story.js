import { getRevealGroups } from './reveal.js';
import { getOperationalPlan } from './operations-demo.js';
import impacts from './fixtures/impact-results.json' with { type: 'json' };
import propagation from './fixtures/propagation-results.json' with { type: 'json' };

export const STAGES = ['Problem arises', 'Gather evidence', 'Synthesize', 'Calculate impact', 'Develop response'];

const scenarios = {
  evt_001: {
    title: 'A port closes. Which suppliers are exposed?',
    question: 'Where does a 48-hour alloy delay travel through the network?',
    signal: 'Gulf Coast port closure',
    problem: 'Inbound alloy shipments are held at the Gulf Coast port. The recorded dependency chain connects Gulf Precision Castings to assembly, coatings, and the finished powertrain module.',
  },
  evt_002: {
    title: 'A compliance finding reaches beyond one supplier.',
    question: 'Who depends on the supplier with the incomplete filing?',
    signal: 'Incomplete conflict-minerals filing',
    problem: 'A seeded audit event flags an incomplete conflict-minerals filing in Memphis. Delta Assembly Works supplies the turbocharger subassembly used by Cascade Final Assembly. The records do not identify a particular missing document or confirm a shipment hold.',
  },
  evt_003: {
    title: 'A credit downgrade exposes a critical component.',
    question: 'Which production dependency relies on this supplier?',
    signal: 'Supplier credit downgrade',
    problem: 'A seeded credit event places the Greensboro supplier on negative watch after a missed covenant. Piedmont Circuit Labs supplies the ECU control board used by Cascade Final Assembly. This is recorded exposure, not a confirmed production stoppage.',
  },
  evt_004: {
    title: 'A supplier stops. Keep the factory moving.',
    question: 'Which orders can we protect, and what can the line build instead?',
    signal: 'Rare-earth export licence suspended',
    problem: 'Altiplano’s export licence is suspended indefinitely. The disruption reaches Cascade Final Assembly through its sensor supply. We cannot reopen the export route, but we can use warehouse stock, order priorities and an approved production change to limit the damage over the next 40 scheduled hours.',
  },
  evt_005: {
    title: 'A typhoon disrupts the bearing supply.',
    question: 'Which assembly steps depend on the delayed bearings?',
    signal: 'Typhoon halts outbound freight',
    problem: 'A seeded typhoon event halts outbound freight from Nagoya for 72 hours. Kanto Precision Bearings supplies a single-source bearing set to Delta Assembly Works and Cascade Final Assembly. Inventory and recovery time still need confirmation.',
  },
};

const complianceLabel = value => ({ compliant: 'Compliant', at_risk: 'At risk', non_compliant: 'Non-compliant' }[value] ?? value);
const joinNames = records => records.map(record => record.name).join(', ');

// These are snapshots of Python output, not frontend estimates. Regeneration and
// parity checking live in fixtures/generate-fixtures.py. Counts are recorded at
// fixture generation time and the browser never recalculates business risk.
export function calculateImpact(eventId, inputs = impacts[eventId]) {
  if (!impacts[eventId] || inputs?.eventId !== eventId) throw new Error('No recorded impact calculation exists for this event.');
  const expected = impacts[eventId];
  for (const [key, value] of Object.entries(expected)) {
    if (inputs[key] !== value) throw new Error('Impact inputs differ from the recorded backend calculation.');
  }
  return structuredClone(expected);
}

export function createStory(analysis, suppliers) {
  const scenario = scenarios[analysis.event.id];
  if (!scenario) throw new Error('No walkthrough exists for this event.');
  const byId = new Map(suppliers.map(supplier => [supplier.id, supplier]));
  const resolve = ids => ids.map(id => {
    if (!byId.has(id)) throw new Error(`The supplier snapshot is missing ${id}.`);
    return byId.get(id);
  });
  const direct = resolve(analysis.directly_affected);
  const affected = resolve([...analysis.directly_affected, ...analysis.cascading_affected]);
  const downstream = resolve(analysis.cascading_affected);
  const groups = getRevealGroups(analysis, suppliers);
  const calculation = calculateImpact(analysis.event.id);
  const recorded = propagation[analysis.event.id];
  if (JSON.stringify(analysis.directly_affected) !== JSON.stringify(recorded.directly_affected) || JSON.stringify(analysis.cascading_affected) !== JSON.stringify(recorded.cascading_affected)) throw new Error('The analysis differs from the recorded demo scenario.');
  const singleSource = affected.filter(supplier => supplier.single_source);
  const flagged = affected.filter(supplier => supplier.compliance_status !== 'compliant');
  const timestamp = analysis.event.timestamp.replace('T', ' ').replace('Z', ' UTC');
  const operationalPlan = getOperationalPlan(analysis.event.id);
  const sources = [
    { id: 'E1', platform: 'Disruption feed', kind: 'Local seeded event', time: timestamp, title: scenario.signal, text: `${analysis.event.description}. Location: ${analysis.event.affected_location}. Severity: ${analysis.event.severity}. Recorded timestamp: ${timestamp}.`, fact: `${analysis.event.severity} severity · ${analysis.event.affected_location}`, icon: 'location', sourcePath: 'backend/data/seed/events.json', recordIds: [analysis.event.id] },
    { id: 'E2', platform: 'Supplier records', kind: 'Local part and location fields', time: 'Seed snapshot', title: joinNames(direct), text: direct.map(supplier => `${supplier.name} (${supplier.id}) supplies ${supplier.part_supplied}. Location: ${supplier.location}.`).join('\n'), fact: direct.map(supplier => supplier.part_supplied).join(' · '), icon: 'network', sourcePath: 'backend/data/seed/suppliers.json', recordIds: analysis.directly_affected },
    { id: 'E3', platform: 'Compliance & sourcing', kind: 'Local supplier status fields', time: 'Seed snapshot', title: 'Existing supplier constraints', text: affected.map(supplier => `${supplier.name}: ${complianceLabel(supplier.compliance_status)}; single source: ${supplier.single_source ? 'yes' : 'no'}; recorded financial risk score: ${supplier.financial_risk_score}.`).join('\n'), fact: `${singleSource.length} single-source dependencies · ${flagged.length} compliance flags`, icon: 'shield', sourcePath: 'backend/data/seed/suppliers.json', recordIds: affected.map(supplier => supplier.id) },
    { id: 'E4', platform: 'Dependency register', kind: 'Local downstream relationship fields', time: 'Seed snapshot', title: 'The recorded path to production', text: affected.map(supplier => `${supplier.name} → ${supplier.downstream_dependents.length ? joinNames(resolve(supplier.downstream_dependents)) : 'no recorded downstream dependents'}.`).join('\n'), fact: `${downstream.length} downstream suppliers · ${calculation.tierCount} ${calculation.tierCount === 1 ? 'tier' : 'tiers'}`, icon: 'network', sourcePath: 'backend/data/seed/suppliers.json', recordIds: affected.map(supplier => supplier.id) },
  ];
  if (operationalPlan) sources.push(...operationalPlan.sources);
  const findings = operationalPlan ? [
    { title: 'Connect the supply shock to the factory', text: `${joinNames(direct)} feeds a ${calculation.tierCount}-tier dependency path to Cascade Final Assembly. Supplier risk tells us where to look; operating records determine what we can still deliver.`, refs: ['E1', 'E2', 'E4'] },
    ...operationalPlan.findings,
  ] : [
    { title: 'Match the disruption to the supplied part', text: `The event location matches ${joinNames(direct)}. Its part and location come from the supplier record, so the incident has a traceable starting point.`, refs: ['E1', 'E2'] },
    { title: 'Connect the downstream dependencies', text: `${downstream.length} downstream suppliers are included in the recorded impact result across ${calculation.tierCount} ${calculation.tierCount === 1 ? 'tier' : 'tiers'}. ${groups.slice(1).map((ids, index) => `Tier ${index + 1}: ${joinNames(resolve(ids))}.`).join(' ')}`, refs: ['E2', 'E4'] },
    { title: 'Separate exposure from confirmed loss', text: `The affected path includes ${singleSource.length} single-source dependencies and ${flagged.length} suppliers already flagged on compliance. Inventory, committed orders and replacement availability are not in these records; downtime and financial loss remain unquantified.`, refs: ['E1', 'E3', 'E4'] },
  ];
  const actions = operationalPlan?.actions ?? [
    { title: 'Confirm inventory and committed orders', owner: 'Operations', text: 'Request current inventory and order commitments for the affected parts. The seed records do not establish a stock buffer or confirmed lost production.', refs: ['E1', 'E2', 'E4'] },
    { title: 'Review sourcing and compliance exposure', owner: 'Procurement / Compliance', text: `Review alternatives for the ${singleSource.length} single-source dependencies and confirm the ${flagged.length} existing compliance flags before making operational changes.`, refs: ['E3', 'E4'] },
    { title: 'Prepare the response for human review', owner: 'Incident owner', text: 'Bring the event, affected suppliers and proposed next steps into the backend template draft. The demo does not send a message, place an order, or reroute a shipment.', refs: ['E1', 'E2', 'E3', 'E4'] },
  ];
  const frames = [];
  const add = (stage, duration, label, extra = {}) => frames.push({ stage, duration, label, sourceCount: 0, findingCount: 0, impactIds: [], actionCount: 0, ...extra });
  const collected = { sourceCount: sources.length, findingCount: findings.length };
  add(0, 3500, 'Disruption detected');
  sources.forEach((source, index) => add(1, 2200, `${source.platform} evidence gathered`, { sourceCount: index + 1 }));
  findings.forEach((finding, index) => add(2, operationalPlan ? 3500 : 2500, finding.title, { sourceCount: sources.length, findingCount: index + 1 }));
  let ids = [];
  groups.forEach((group, index) => {
    ids = [...ids, ...group];
    add(3, index === groups.length - 1 ? 2400 : 550, index === 0 ? 'Direct exposure identified' : `Tier ${index} exposure identified`, { ...collected, impactIds: [...ids] });
  });
  add(3, operationalPlan ? 8000 : 4000, operationalPlan ? 'Feasible operating plans compared' : 'Recorded impact calculation complete', { ...collected, impactIds: ids, calculated: true });
  actions.forEach((action, index) => add(4, operationalPlan ? 3200 : 2300, action.title, { ...collected, impactIds: ids, calculated: true, actionCount: index + 1 }));
  add(4, 0, 'Response ready for review', { ...collected, impactIds: ids, calculated: true, actionCount: actions.length, complete: true });
  const response = operationalPlan ? { ...analysis, risk_summary: operationalPlan.riskSummary, draft_report: operationalPlan.draft } : analysis;
  const stages = operationalPlan ? ['Problem arises', 'Gather evidence', 'Find constraints', 'Compare options', 'Recommend a plan'] : STAGES;
  return { ...scenario, stages, operationalPlan, response, sources, findings, inputs: structuredClone(calculation), actions, frames, calculation, revealGroups: groups };
}
