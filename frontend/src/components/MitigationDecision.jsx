import Icon from './Icon.jsx';
import './mitigation.css';

const dollars = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
const number = (value) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);

function EvidenceLinks({ ids = [], onOpenEvidence }) {
  return <span className="mitigation-evidence" aria-label="Supporting evidence">{[...new Set(ids)].map((id) => <button type="button" key={id} disabled={!onOpenEvidence} onClick={() => onOpenEvidence(id)} aria-label={`Read operational evidence ${id}`}>{id}</button>)}</span>;
}

function ModelNote({ hours }) {
  return <p className="mitigation-model-note">Simulated operations · {number(hours)} scheduled hours · fees and production output</p>;
}

export function ImpactComparison({ plan, onOpenEvidence }) {
  if (!plan?.options?.length || !plan.recommended) return null;
  const options = plan.options.filter((option) => option.feasible);
  const excluded = plan.options.filter((option) => !option.feasible);
  return <section className="mitigation-comparison" aria-label="Mitigation option comparison">
    <h3>Compare the operational response</h3>
    <ModelNote hours={plan.recommended.metrics.horizonHours} />
    <div className="mitigation-table-wrap">
      <table className="mitigation-table">
        <caption>Feasible options for the same inventory, orders, and planning window</caption>
        <thead><tr><th scope="col">Plan</th><th scope="col">Priority modules<br />on time</th><th scope="col">Standard modules<br />late</th><th scope="col">Service kits<br />on time</th><th scope="col">Productive<br />line hours</th><th scope="col">Modeled fees<br />+ setup</th></tr></thead>
        <tbody>{options.map((option) => <tr key={option.id} className={option.id === plan.recommended.id ? 'mitigation-selected-row' : undefined}>
          <th scope="row"><span>{option.title}</span>{option.id === plan.recommended.id && <span className="mitigation-choice"><Icon name="check" size={13} />Recommended</span>}<small>{option.description}</small></th>
          <td><span className="mitigation-mobile-label" aria-hidden="true">Priority on time</span><strong>{number(option.metrics.priorityOnTime)} / {number(option.metrics.priorityDemand)}</strong></td>
          <td><span className="mitigation-mobile-label" aria-hidden="true">Standard late</span>{number(option.metrics.standardLate)}</td>
          <td><span className="mitigation-mobile-label" aria-hidden="true">Service kits on time</span>{number(option.metrics.kitsOnTime)}</td>
          <td><span className="mitigation-mobile-label" aria-hidden="true">Productive hours</span>{number(option.metrics.productiveHours)} h</td>
          <td className="mitigation-cost"><span className="mitigation-mobile-label" aria-hidden="true">Fees + setup</span><strong>{dollars(option.metrics.modeledCost)}</strong></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="mitigation-comparison-source"><span>The same constraints apply to every option.</span><EvidenceLinks ids={['E5', 'E6', 'E7', 'E8']} onOpenEvidence={onOpenEvidence} /></div>
    {excluded.map((option) => <div className="mitigation-excluded" key={option.id}><Icon name="info" size={18} /><div><h4>{option.title} <span>Excluded</span></h4><p>{option.blockedReason}</p><EvidenceLinks ids={option.refs} onOpenEvidence={onOpenEvidence} /></div></div>)}
    {plan.assumptions?.length > 0 && <details className="mitigation-assumptions"><summary>Model assumptions</summary><ul>{plan.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></details>}
  </section>;
}

export default function MitigationDecision({ plan, onOpenEvidence }) {
  if (!plan?.recommended || !plan.baseline) return null;
  const selected = plan.recommended;
  const metrics = selected.metrics;
  const inventory = selected.inventory;
  return <section className="mitigation-decision" aria-label="Recommended mitigation">
    <div className="mitigation-decision-heading"><h3>{selected.title}</h3><span className="mitigation-choice"><Icon name="check" size={14} />Recommended</span></div>
    <p className="mitigation-decision-description">{selected.description}</p>
    <div className="mitigation-payoff">
      <div><span>Modeled fees + setup</span><p><span className="mitigation-baseline-cost">{dollars(plan.baseline.metrics.modeledCost)}</span><Icon name="arrow" size={20} /><strong>{dollars(metrics.modeledCost)}</strong></p></div>
      <div className="mitigation-saving"><strong>{dollars(metrics.costReduction)} avoided</strong><span>Within this operational scenario</span></div>
    </div>
    <dl className="mitigation-outcomes">
      <div><dt>Priority modules on time</dt><dd>{number(metrics.priorityOnTime)} / {number(metrics.priorityDemand)}</dd></div>
      <div><dt>Productive line time recovered</dt><dd>+{number(metrics.productiveHoursRecovered)} h</dd></div>
    </dl>
    <div className="mitigation-reasons">
      <div><h4>Available inventory supports the allocation</h4><p>Use {number(inventory.finishedModulesUsed)} finished modules and {number(inventory.sensorsUsed)} released sensors. Keep {number(inventory.heldSensors)} sensors on quality hold.</p><EvidenceLinks ids={['E5', 'E8']} onOpenEvidence={onOpenEvidence} /></div>
      <div><h4>{inventory.kitsBuilt > 0 ? 'The schedule restores productive work' : 'The schedule protects priority commitments'}</h4><p>Complete {number(metrics.priorityOnTime)} priority modules on time.{inventory.kitsBuilt > 0 && ` A ${dollars(metrics.setupCost)} setup recovers ${number(metrics.productiveHoursRecovered)} productive hours for ${number(inventory.kitsBuilt)} sensor-free kits; ${number(metrics.kitsOnTime)} are modeled on time.`}</p><EvidenceLinks ids={['E6', 'E7']} onOpenEvidence={onOpenEvidence} /></div>
    </div>
    <p className="mitigation-tradeoff"><Icon name="info" size={17} /><span><strong>Remaining impact:</strong> {number(metrics.standardLate)} standard modules are still late. This is the remaining delivery exposure within the planning window.</span></p>
    <ModelNote hours={metrics.horizonHours} />
    <p className="mitigation-review-note"><Icon name="shield" size={15} />Proposed for human approval. Inventory allocation and the line schedule remain unchanged.</p>
  </section>;
}
