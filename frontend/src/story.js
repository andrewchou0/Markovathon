import { getRevealGroups } from './reveal.js';

export const STAGES = ['Problem arises', 'Gather evidence', 'Synthesize', 'Calculate impact', 'Develop response'];

// Supplemental, illustrative demo records. These are not connected platforms or
// additions to the shared AnalysisResult contract.
const stories = {
  evt_001: {
    title: 'A port closes. Can production continue?',
    question: 'Can the supply chain absorb a 48-hour interruption?',
    problem: 'Inbound alloy is held at the Gulf Coast port. Markov opens an incident and gathers the operating context before proposing a response.',
    sources: [
      { id: 'E1', platform: 'Port bulletin', kind: 'Local event feed', time: '10:05', title: 'Inbound alloy shipments held', text: 'Gulf Coast port closed for 48 hours. Inbound alloy cannot be released.', fact: '48-hour closure', icon: 'location' },
      { id: 'E2', platform: 'Slack', kind: 'Sample message export', time: '10:07', title: '#procurement · Operations lead', text: 'The alloy delivery is held at port. Please check the housing buffer at Delta; the next production run depends on it.', fact: 'Delta requests a buffer check', icon: 'info' },
      { id: 'E3', platform: 'Warehouse ERP', kind: 'Sample inventory snapshot', time: '10:08', title: 'Delta · housing inventory', text: '120 usable turbine housings on hand. Planned consumption: 10 housings/hour. No additional receipt assumed during the closure.', fact: '120 on hand / 10 used per hour', icon: 'network' },
      { id: 'E4', platform: 'Supplier registry', kind: 'Local supplier records', time: '10:08', title: 'Gulf Precision Castings', text: 'Gulf Coast supplier of cast turbine housings. Single source. Supplies Delta Assembly Works and Northline Coatings. Delta already has an at-risk compliance status.', fact: 'Single source, two dependencies', icon: 'shield' },
    ],
    findings: [
      { title: 'One incident, across four sources', text: 'The port event and procurement message describe the same alloy delay; the supplier registry connects it to turbine housings.', refs: ['E1', 'E2', 'E4'] },
      { title: 'Inventory becomes the deciding factor', text: 'Delta’s sample warehouse record provides the buffer and hourly demand needed to estimate a gap.', refs: ['E3'] },
      { title: 'Validate before committing', text: 'The reopening estimate and inventory snapshot need confirmation. This estimate assumes constant consumption and no replenishment.', refs: ['E1', 'E3'] },
    ],
    inputs: { closureHours: 48, inventory: 120, hourlyUse: 10 },
    actions: [
      { title: 'Confirm the inventory buffer', owner: 'Operations', text: 'Ask Delta to validate the 120-housing snapshot and next receipts before acting on the estimate.', refs: ['E2', 'E3'] },
      { title: 'Prepare a continuity response', owner: 'Procurement', text: 'Request the latest port ETA and review alternate casting qualification. No reroute or purchase is executed.', refs: ['E1', 'E4'] },
      { title: 'Include the compliance exposure', owner: 'Compliance', text: 'Flag Delta’s existing at-risk status and assemble the supplier-impact email for review.', refs: ['E4'] },
    ],
  },
  evt_002: {
    title: 'A missing filing puts delivery at risk.',
    question: 'What is missing, who depends on it, and who should respond?',
    problem: 'An audit flags incomplete conflict-minerals documentation at Delta Assembly Works. Markov gathers the filing checklist and downstream context.',
    sources: [
      { id: 'E1', platform: 'Audit feed', kind: 'Local event feed', time: '09:30', title: 'Incomplete conflict-minerals filing', text: 'An audit flags Delta Assembly Works in Memphis. Confirm the missing documentation before applying restrictions.', fact: 'Documentation finding', icon: 'shield' },
      { id: 'E2', platform: 'Slack', kind: 'Sample message export', time: '09:32', title: '#compliance · Account owner', text: 'Please identify the missing file and downstream owner. We have not placed any shipment on hold.', fact: 'No shipment hold applied', icon: 'info' },
      { id: 'E3', platform: 'Document store', kind: 'Sample checklist', time: '09:33', title: 'Delta · filing package', text: 'Required: signed declaration, smelter list, supplier attestation. Received: declaration and smelter list. Supplier attestation is missing.', fact: '2 of 3 required records present', icon: 'copy' },
      { id: 'E4', platform: 'Supplier registry', kind: 'Local supplier records', time: '09:33', title: 'Delta Assembly Works', text: 'At-risk compliance status. Turbocharger subassemblies supply Cascade Final Assembly, a single-source finished-module supplier.', fact: 'Cascade depends on Delta', icon: 'network' },
    ],
    findings: [
      { title: 'The missing record is identified', text: 'The audit finding and document checklist point to a missing supplier attestation, not a confirmed production stoppage.', refs: ['E1', 'E3'] },
      { title: 'A downstream owner needs visibility', text: 'Cascade Final Assembly depends on Delta’s subassembly. Its owner should be included in the review.', refs: ['E4'] },
      { title: 'Keep the response proportional', text: 'No shipment hold is recorded. Request the filing and validate customer deadlines before changing operations.', refs: ['E2'] },
    ],
    inputs: { required: 3, received: 2 },
    actions: [
      { title: 'Request the supplier attestation', owner: 'Compliance', text: 'Prepare a request for the single missing record, with the completed checklist attached as context.', refs: ['E1', 'E3'] },
      { title: 'Include the downstream owner', owner: 'Operations', text: 'Ask Cascade to confirm any customer documentation deadlines that depend on Delta’s package.', refs: ['E4'] },
      { title: 'Prepare the review email', owner: 'Account owner', text: 'Summarize the finding and next steps. Keep shipment restrictions unchanged pending review.', refs: ['E2', 'E3'] },
    ],
  },
};

export function calculateImpact(eventId, inputs) {
  if (eventId === 'evt_001') {
    const { closureHours, inventory, hourlyUse } = inputs;
    if (![closureHours, inventory, hourlyUse].every(Number.isFinite) || closureHours < 0 || inventory < 0 || hourlyUse <= 0) throw new Error('Invalid inventory calculation inputs.');
    const coverage = inventory / hourlyUse;
    const gap = Math.max(0, closureHours - coverage);
    return { coverage, gap, exposedUnits: gap * hourlyUse };
  }
  const { required, received } = inputs;
  if (!Number.isInteger(required) || !Number.isInteger(received) || required <= 0 || received < 0 || received > required) throw new Error('Invalid document checklist inputs.');
  return { missing: required - received, completion: Math.round(received / required * 100) };
}

export function createStory(analysis, suppliers) {
  const data = stories[analysis.event.id];
  if (!data) throw new Error('No walkthrough exists for this event.');
  const frames = [];
  const add = (stage, duration, label, extra = {}) => frames.push({ stage, duration, label, sourceCount: 0, findingCount: 0, impactIds: [], actionCount: 0, ...extra });
  add(0, 3500, 'Disruption detected');
  data.sources.forEach((source, index) => add(1, 2200, `${source.platform} evidence gathered`, { sourceCount: index + 1 }));
  data.findings.forEach((finding, index) => add(2, 2500, finding.title, { sourceCount: 4, findingCount: index + 1 }));
  let ids = [];
  const groups = getRevealGroups(analysis, suppliers);
  groups.forEach((group, index) => {
    ids = [...ids, ...group];
    add(3, index === groups.length - 1 ? 2400 : 550, index === 0 ? 'Direct exposure identified' : 'Downstream exposure identified', { sourceCount: 4, findingCount: 3, impactIds: [...ids] });
  });
  add(3, 4000, 'Impact calculation complete', { sourceCount: 4, findingCount: 3, impactIds: ids, calculated: true });
  data.actions.forEach((action, index) => add(4, 2300, action.title, { sourceCount: 4, findingCount: 3, impactIds: ids, calculated: true, actionCount: index + 1 }));
  add(4, 0, 'Response ready for review', { sourceCount: 4, findingCount: 3, impactIds: ids, calculated: true, actionCount: 3, complete: true });
  return { ...data, frames, calculation: calculateImpact(analysis.event.id, data.inputs) };
}
