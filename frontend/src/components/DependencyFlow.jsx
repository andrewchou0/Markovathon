import { getRevealGroups } from '../reveal.js';
import Icon from './Icon.jsx';

// Visual layout only: the backend result remains authoritative for membership.
export default function DependencyFlow({ result, suppliers, visibleIds, onSelect }) {
  const groups = getRevealGroups(result, suppliers);
  const byId = new Map(suppliers.map(supplier => [supplier.id, supplier]));
  const visible = new Set(visibleIds ?? groups.flat());
  const positions = new Map();
  groups.forEach((group, column) => group.forEach((id, row) => {
    positions.set(id, { x: (column + .5) * 1000 / groups.length, y: (row + .5) * 280 / group.length });
  }));
  if (!groups.length) return <p className="stage-caption">No supplier exposure was identified for this event.</p>;
  return <div className="dependency-flow" style={{ '--tier-count': groups.length }} aria-label="Supplier exposure by dependency tier">
    <svg className="dependency-lines" viewBox="0 0 1000 280" preserveAspectRatio="none" aria-hidden="true">
      {[...positions].flatMap(([id, point]) => (byId.get(id)?.downstream_dependents ?? []).filter(child => positions.has(child)).map(child => {
        const next = positions.get(child);
        const offset = 360 / groups.length;
        return <path key={`${id}-${child}`} className={visible.has(id) && visible.has(child) ? 'traced' : ''} d={`M ${point.x + offset} ${point.y} C ${(point.x + next.x) / 2} ${point.y}, ${(point.x + next.x) / 2} ${next.y}, ${next.x - offset} ${next.y}`} />;
      }))}
    </svg>
    {groups.map((group, index) => <div className="dependency-tier" key={index}>
      <h3>{index === 0 ? 'Direct disruption' : `Downstream · tier ${index}`}</h3>
      <div className="tier-nodes">{group.map(id => {
        const supplier = byId.get(id);
        const revealed = visible.has(id);
        return <button key={id} className={`flow-node ${index === 0 ? 'direct' : 'cascade'} ${revealed ? 'revealed' : ''}`} onClick={() => onSelect?.(id)} disabled={!onSelect} aria-label={`${supplier?.name ?? id}, ${revealed ? index === 0 ? 'direct disruption' : 'downstream exposure' : 'awaiting trace'}`}>
          <span><Icon name={index === 0 ? 'bolt' : 'network'} size={14} />{revealed ? index === 0 ? 'Direct impact' : 'Exposed' : 'Awaiting trace'}</span>
          <strong>{supplier?.name ?? id}</strong><small>{supplier?.part_supplied ?? 'Supplier record unavailable'}</small>
        </button>;
      })}</div>
    </div>)}
  </div>;
}
