import Icon from './Icon.jsx';

export default function EventControls({ events, selectedId, onSelect, busy, regenerating, completed, onRun, onReset, canReset }) {
  const selected = events.find((event) => event.id === selectedId);
  return (
    <section className="event-panel panel" aria-labelledby="demo-title">
      <div className="section-heading"><div><h2 id="demo-title">Run a disruption demo</h2><p>Choose an event. Watch the impact unfold.</p></div><span className="demo-pill">Sample data</span></div>
      <label htmlFor="event-select">Event</label>
      <select id="event-select" name="event" value={selectedId} disabled={busy || regenerating} onChange={(event) => onSelect(event.target.value)} aria-describedby="event-description">
        {events.map((event) => <option key={event.id} value={event.id}>{event.type === 'weather' ? 'Port closure — Gulf Coast' : 'Compliance finding — Memphis'}</option>)}
      </select>
      <div className="event-meta"><span className={`severity severity-${selected.severity}`}>{selected.severity} severity</span><span>{selected.id}</span></div>
      <p id="event-description" className="event-description">{selected.description}</p>
      <div className="event-actions">
        <button className="primary-button fire-button" onClick={onRun} disabled={busy || regenerating}>
          {busy ? <><span className="spinner" />Running demo…</> : <><Icon name="play" size={16} />{completed ? 'Replay demo' : 'Run demo'}</>}
        </button>
        <button className="reset-button" onClick={onReset} disabled={!canReset}><Icon name="refresh" size={16} /><span>Reset</span></button>
      </div>
    </section>
  );
}
