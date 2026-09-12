import Icon from './Icon.jsx';

const STATUS = { compliant: 'Compliant', at_risk: 'At risk', non_compliant: 'Non-compliant' };

function SupplierCard({ supplier, impact, selected, onSelect }) {
  return (
    <button className={`supplier-card ${impact ? `impact-${impact}` : ''} ${selected ? 'selected' : ''}`} onClick={onSelect} aria-pressed={selected} data-supplier-id={supplier.id}>
      <div className="card-top">
        <span className="supplier-id">{supplier.id}</span>
        <span className={`status status-${supplier.compliance_status}`}><i />{STATUS[supplier.compliance_status]}</span>
      </div>
      <h3>{supplier.name}</h3>
      <p className="part">{supplier.part_supplied}</p>
      <p className="location"><Icon name="location" size={14} />{supplier.location}</p>
      <div className="card-bottom">
        <span className={supplier.single_source ? 'source single' : 'source'}>{supplier.single_source ? 'Single source' : 'Alternate sources'}</span>
        <span className="dependency-count"><Icon name="network" size={14} />{supplier.downstream_dependents.length} downstream</span>
      </div>
      <div className={`impact-label ${impact ? 'visible' : ''}`}>
        {impact && <Icon name="bolt" size={13} />}
        {impact === 'direct' ? 'Direct disruption' : impact === 'cascade' ? 'Cascading exposure' : '\u00a0'}
      </div>
    </button>
  );
}

export default function SupplierBoard({ suppliers, selectedId, onSelect, impacts, filter, onFilter }) {
  const selected = suppliers.find((supplier) => supplier.id === selectedId);
  const shown = suppliers.filter((supplier) => filter === 'all' || (filter === 'single' ? supplier.single_source : impacts[supplier.id]));
  return (
    <section className="network-section panel" id="supplier-network" aria-labelledby="suppliers-title">
      <div className="section-heading">
        <div><h2 id="suppliers-title">Supplier network <span className="count-badge">{suppliers.length}</span></h2><p>{suppliers.filter(supplier => supplier.single_source).length} single-source suppliers · select a record to inspect dependencies.</p></div>
        <label><span className="sr-only">Filter suppliers</span><select name="supplier-filter" value={filter} onChange={(event) => onFilter(event.target.value)}><option value="all">All suppliers</option><option value="single">Single source</option><option value="affected">Exposed suppliers</option></select></label>
      </div>
      <div className="supplier-grid">
        {shown.map((supplier) => <SupplierCard key={supplier.id} supplier={supplier} impact={impacts[supplier.id]} selected={supplier.id === selectedId} onSelect={() => onSelect(supplier.id)} />)}
        {!shown.length && <div className="empty-filter"><Icon name="shield" size={24} /><h3>{filter === 'single' ? 'No single-source suppliers' : 'No exposed suppliers yet'}</h3><p>{filter === 'single' ? 'Every supplier in this snapshot has alternate sources.' : 'Analyze an event or run the demo to see supplier exposure.'}</p><button className="text-button" onClick={() => onFilter('all')}>Show all suppliers</button></div>}
      </div>
      <div className="legend"><span><i className="legend-dot direct" />Direct disruption</span><span><i className="legend-dot cascade" />Cascading exposure</span><span className="legend-help">Compliance status stays separate.</span></div>
      {selected && <div className="supplier-details" aria-live="polite">
        <div className="detail-heading"><h3>{selected.name}</h3><span>Financial risk <strong>{selected.financial_risk_score.toFixed(2)}</strong> / 1.00</span></div>
        <div className="dependency-path"><span>Supplies to</span>{selected.downstream_dependents.length ? selected.downstream_dependents.map((id) => <button className="path-node" key={id} onClick={() => { onFilter('all'); onSelect(id); }}><Icon name="arrow" size={13} />{suppliers.find((supplier) => supplier.id === id)?.name ?? id}</button>) : <span className="path-end">End of the supplier chain</span>}</div>
      </div>}
    </section>
  );
}
