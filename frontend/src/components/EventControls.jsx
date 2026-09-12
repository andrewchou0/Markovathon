import Icon from './Icon.jsx';
import { describeEvent } from '../api-client.js';

// The local database supplies the available disruptions.
export default function EventControls({ events, selectedId, onSelect, busy, regenerating, completed, onRun, onReset, canReset, labelFor, live }) {
  const selected = events.find((event) => event.id === selectedId);
  return (
    <section className="event-panel panel" aria-label={live ? 'Event selection' : undefined} aria-labelledby={live ? undefined : 'demo-title'}>
      {!live && <div className="section-heading"><div><h2 id="demo-title">Run a disruption demo</h2><p>Choose an event. Watch the impact unfold.</p></div><span className="demo-pill">Sample data</span></div>}
      <label htmlFor="event-select">Event</label>
      <select id="event-select" name="event" value={selectedId} disabled={busy || regenerating} onChange={(event) => onSelect(event.target.value)} aria-describedby="event-description">
        {events.map((event) => <option key={event.id} value={event.id}>{(labelFor ?? describeEvent)(event)}</option>)}
      </select>
      {selected && <div className="event-meta"><span className={`severity severity-${selected.severity}`}>{selected.severity} severity</span><span>{selected.id}</span></div>}
      <p id="event-description" className="event-description">{selected?.description ?? 'Choose an available disruption.'}</p>
      <div className="event-actions">
        <button className="primary-button fire-button" onClick={onRun} disabled={busy || regenerating || !selected}>
          {busy ? <><span className="spinner" />{live ? 'Analysing…' : 'Running demo…'}</> : <><Icon name="play" size={16} />{completed ? (live ? 'Run again' : 'Replay demo') : (live ? 'Run analysis' : 'Run demo')}</>}
        </button>
        <button className="reset-button" onClick={onReset} disabled={!canReset}><Icon name="refresh" size={16} /><span>Reset</span></button>
      </div>
    </section>
  );
}
