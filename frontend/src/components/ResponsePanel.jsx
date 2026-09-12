import Icon from './Icon.jsx';

const STAGES = ['Waiting for an event', 'Reading event', 'Tracing exposure', 'Preparing response', 'Ready for review'];

export default function ResponsePanel({ result, stage, regenerating, elapsed, tab, onTab, error, notice, onCopy, onRegenerate, live, operational = false }) {
  const busy = stage > 0 && stage < 4;
  function switchTab(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'summary' : event.key === 'End' ? 'draft' : tab === 'summary' ? 'draft' : 'summary';
    onTab(next);
    document.getElementById(`${next}-tab`)?.focus();
  }
  return (
    <section className="result-panel panel" id="response" aria-busy={busy || regenerating} aria-labelledby="response-title">
      <div className="section-heading"><div><h2 id="response-title">{operational ? 'Review & handoff' : 'Response'}</h2><p className={`response-status ${stage === 4 ? 'ready' : ''}`}>{stage === 4 && <Icon name="check" size={14} />}{STAGES[stage]}</p></div>{stage === 4 && <span className="count-badge">Unsent draft</span>}</div>
      {error && <p role="alert" className="error">{error}</p>}
      {!result && !busy && <div className="empty-result"><span className="empty-icon"><Icon name="network" size={27} /></span><h3>Understand the impact first.</h3><p>{live ? 'Run an analysis' : 'Run a demo'} to see affected suppliers, a risk assessment, and a response draft.</p></div>}
      {busy && <div className="loading-result" role="status"><div className="loading-title"><span className="spinner" /><strong>{STAGES[stage]}…</strong><span>{elapsed}s</span></div><p>{stage === 1 ? 'Reading the disruption and its affected location.' : stage === 2 ? 'Revealing direct impact, then downstream exposure.' : 'Preparing the sample assessment and email draft.'}</p><div className="skeleton" aria-hidden="true"><i /><i /><i /></div><small>{live ? 'Python computes exposure. The local model or a template fallback prepares the wording.' : 'Demo playback uses a sample response.'}</small></div>}
      {result && <>
        <div className="result-tabs" role="tablist" aria-label="Response view">
          {[['summary', operational ? 'Decision summary' : 'Risk assessment'], ['draft', operational ? 'Approval request' : 'Response draft']].map(([id, label]) => <button key={id} id={`${id}-tab`} role="tab" aria-selected={tab === id} aria-controls={`${id}-panel`} tabIndex={tab === id ? 0 : -1} onKeyDown={switchTab} onClick={() => onTab(id)}>{label}</button>)}
        </div>
        <div role="tabpanel" id="summary-panel" aria-labelledby="summary-tab" hidden={tab !== 'summary'} className="assessment">
          {!operational && <div className="assessment-counts"><span><strong>{result.directly_affected.length}</strong> directly affected</span><span><strong>{result.cascading_affected.length}</strong> downstream</span></div>}
          <p>{result.risk_summary}</p>
          <button className="secondary-button review-draft" onClick={() => { onTab('draft'); document.getElementById('draft-tab')?.focus(); }}>{operational ? 'Review approval request' : 'Review response draft'}<Icon name="arrow" size={16} /></button>
        </div>
        <div role="tabpanel" id="draft-panel" aria-labelledby="draft-tab" hidden={tab !== 'draft'} className="draft-panel">
          <div className="draft-toolbar"><span>{operational ? 'Proposed operating plan · ready to review' : 'Email draft · ready to review'}</span><button className="icon-button" onClick={onCopy} aria-label="Copy draft" title="Copy draft"><Icon name="copy" size={17} /></button></div>
          <pre tabIndex={0} aria-label="Draft email">{result.draft_report}</pre>
          <button className="secondary-button" onClick={onRegenerate} disabled={regenerating}>{regenerating ? <span className="spinner" /> : <Icon name="refresh" size={16} />}{regenerating ? live ? 'Preparing draft…' : 'Reloading sample draft…' : live ? 'Regenerate draft' : 'Reload sample draft'}</button>
          <small className="draft-disclaimer">{live ? 'Requests wording from the local backend, with a template fallback if the model is unavailable. Exposure is not recomputed.' : operational ? 'Calculated from simulated operating records. Reload restores this demo proposal; it does not call a model.' : 'Demo mode reloads the sample draft.'}</small>
        </div>
        <div className="review-note"><Icon name="shield" size={16} /><span>For human review. Nothing has been sent or changed.</span></div>
        {notice && <p className="notice" role="status">{notice}</p>}
      </>}
    </section>
  );
}
