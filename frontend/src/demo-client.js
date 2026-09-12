import suppliers from './fixtures/suppliers.json';
import events from './fixtures/events.json';
import portAnalysis from './fixtures/analysis-result.json';

// Explicit, handwritten UI fixtures. This is not a second propagation engine.
const auditAnalysis = {
  event: events[1],
  directly_affected: ['sup_002'],
  cascading_affected: ['sup_004'],
  risk_summary: 'The supplied audit scenario flags an incomplete conflict-minerals filing at Delta Assembly Works. Cascade Final Assembly depends on its turbocharger subassembly and is exposed to a potential documentation delay. Confirm the finding and request the missing filing before deciding whether any shipment should be held.',
  draft_report: 'To: Compliance Contact\nSubject: Review required — Delta Assembly filing (evt_002)\n\nThe demo audit event identifies incomplete conflict-minerals documentation at Delta Assembly Works (sup_002). Cascade Final Assembly (sup_004) is a downstream dependent.\n\nPlease confirm the finding, request the missing filing, and assess whether any customer documentation deadlines are affected. No operational restriction has been applied.\n\nThis is a sample draft for human review. It has not been sent.',
};

export const demoClient = {
  suppliers,
  events,
  getAnalysis(eventId) {
    const result = { evt_001: portAnalysis, evt_002: auditAnalysis }[eventId];
    if (!result) throw new Error('This event has no demo analysis. Choose another event.');
    return structuredClone(result);
  },
};
