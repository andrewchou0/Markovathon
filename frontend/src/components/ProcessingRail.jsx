import Icon from './Icon.jsx';

export default function ProcessingRail({ demoMode, stage = -1, operational = false }) {
  const steps = operational ? [
    ['network', 'Business context', 'Supply + factory records', 1],
    ['bolt', 'Compare responses', 'Demo calculations', 3],
    ['copy', 'Mitigation plan', 'Owners and deadlines', 4],
    ['shield', 'Human approval', 'Proposed, not executed', 4],
  ] : [
    ['network', 'Supplier records', demoMode ? 'Local seed records' : 'Local database', 1],
    ['bolt', 'Impact analysis', 'Deterministic Python', 3],
    ['copy', 'Response wording', demoMode ? 'Template preview' : 'Local model / fallback', 4],
    ['shield', 'Human approval', 'Draft remains unsent', 4],
  ];
  return <div className="processing-rail" aria-label="How this workspace processes an incident">
    {steps.map(([icon, title, detail, activeAt]) => <div key={title} className={stage >= activeAt ? 'processed' : ''}>
      <Icon name={icon} size={18} /><span><strong>{title}</strong><small>{detail}</small></span>
    </div>)}
  </div>;
}
