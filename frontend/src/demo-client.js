import suppliers from './fixtures/suppliers.json' with { type: 'json' };
import events from './fixtures/events.json' with { type: 'json' };
import analyses from './fixtures/analysis-results.json' with { type: 'json' };
import propagation from './fixtures/propagation-results.json' with { type: 'json' };
import provenance from './fixtures/provenance.json' with { type: 'json' };

// Stored outputs of the backend's deterministic functions. The original
// AnalysisResult contract stays unchanged; score/hop evidence is kept separate.
export const demoClient = {
  suppliers,
  events,
  defaultEventId: provenance.default_event_id,
  provenance,
  getAnalysis(eventId) {
    const result = Object.hasOwn(analyses, eventId) ? analyses[eventId] : null;
    if (!result) throw new Error('This event has no demo analysis. Choose another event.');
    return structuredClone(result);
  },
  getPropagation(eventId) {
    const result = Object.hasOwn(propagation, eventId) ? propagation[eventId] : null;
    if (!result) throw new Error('This event has no recorded propagation result.');
    return structuredClone(result);
  },
};
