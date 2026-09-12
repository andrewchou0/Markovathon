import { useCallback, useEffect, useRef, useState } from 'react';
import { describeEvent } from '../api-client.js';
import { getRevealGroups } from '../reveal.js';
import AgentActivity from './AgentActivity.jsx';
import DependencyFlow from './DependencyFlow.jsx';
import ProcessingRail from './ProcessingRail.jsx';
import EventControls from './EventControls.jsx';
import Icon from './Icon.jsx';
import ResponsePanel from './ResponsePanel.jsx';
import SupplierBoard from './SupplierBoard.jsx';

// Live mode: real suppliers and events from MongoDB, real propagation and
// narration from backend/agent. Unlike demo mode this carries no scripted
// narrative, so it works with the events currently stored in the database.

const HOP_MS = 550; // the staggered reveal; one beat per cascade tier

export default function LiveWorkspace({ client, onUseDemo }) {
  const [network, setNetwork] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [eventId, setEventId] = useState('');
  const [result, setResult] = useState(null);
  const [exposure, setExposure] = useState(null);
  const [impacts, setImpacts] = useState({});
  const [hops, setHops] = useState(0);
  const [tiers, setTiers] = useState(0);
  const [stage, setStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('summary');
  const [filter, setFilter] = useState('all');
  const [supplierId, setSupplierId] = useState(null);
  const [regenerating, setRegenerating] = useState(false);

  const timers = useRef([]);
  const run = useRef(0);
  const activeRequest = useRef(null);
  const draftRun = useRef(0);
  const startedAt = useRef(0);
  const busy = stage > 0 && stage < 4;

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => () => {
    clearTimers(); run.current++; draftRun.current++;
    activeRequest.current?.abort();
  }, [clearTimers]);

  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    setLoadError(''); setNetwork(null);
    (async () => {
      try {
        const [suppliers, events] = await Promise.all([
          client.getSuppliers({ signal: controller.signal }),
          client.getEvents({ signal: controller.signal }),
        ]);
        if (!live) return;
        setNetwork({ suppliers, events });
        setSupplierId((current) => suppliers.some((supplier) => supplier.id === current) ? current : suppliers[0]?.id ?? null);
        setEventId((current) => events.some((event) => event.id === current) ? current : events.find((event) => event.id === 'evt_004')?.id ?? events[0]?.id ?? '');
      } catch (cause) {
        if (live && cause.name !== 'AbortError') setLoadError(cause.message || 'The local API could not load the workspace.');
        controller.abort();
      }
    })();
    return () => { live = false; controller.abort(); };
  }, [client, reload]);

  useEffect(() => {
    if (!busy && !regenerating) return;
    const update = () => setElapsed(Math.round((Date.now() - startedAt.current) / 1000));
    update();
    const handle = setInterval(update, 250);
    return () => clearInterval(handle);
  }, [busy, regenerating]);

  function reset() {
    clearTimers();
    run.current++; draftRun.current++;
    activeRequest.current?.abort(); activeRequest.current = null;
    setResult(null); setExposure(null); setImpacts({}); setHops(0); setTiers(0); setStage(0);
    setElapsed(0); setError(''); setNotice(''); setTab('summary'); setRegenerating(false);
  }

  function refreshRecords() {
    if (busy || regenerating) return;
    reset(); setFilter('all'); setReload((value) => value + 1);
  }

  async function analyze() {
    if (!network?.events.some((event) => event.id === eventId)) { setError('Choose an available disruption first.'); return; }
    reset();
    const attempt = ++run.current;
    const controller = new AbortController();
    activeRequest.current = controller;
    startedAt.current = Date.now();
    setStage(1);

    let analysis;
    try {
      analysis = await client.analyze(eventId, { signal: controller.signal });
    } catch (cause) {
      if (attempt === run.current && cause.name !== 'AbortError') { setError(cause.message || 'Analysis failed. Please retry.'); setStage(0); }
      return;
    }
    if (attempt !== run.current) return;

    // The backend owns which suppliers are affected; this only orders the reveal.
    const groups = getRevealGroups(analysis, network.suppliers);
    const direct = new Set(analysis.directly_affected);
    setTiers(Math.max(0, groups.length - 1));
    setExposure(analysis);
    if (analysis.directly_affected.length) setSupplierId(analysis.directly_affected[0]);
    setStage(2);

    const hopMs = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : HOP_MS;
    groups.forEach((group, index) => {
      const timer = setTimeout(() => {
        if (attempt !== run.current) return;
        setImpacts((current) => ({
          ...current,
          ...Object.fromEntries(group.map((id) => [id, direct.has(id) ? 'direct' : 'cascade'])),
        }));
        setHops(index);
        if (index === groups.length - 1) {
          setResult(analysis);
          setStage(4);
        }
      }, index * hopMs);
      timers.current.push(timer);
    });

    if (!groups.length) { setResult(analysis); setStage(4); }
  }

  async function regenerate() {
    if (!result) return;
    const generation = run.current;
    const attempt = ++draftRun.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    startedAt.current = Date.now();
    setRegenerating(true); setNotice(''); setElapsed(0);
    try {
      const { draft_report } = await client.regenerateDraft(result, { signal: controller.signal });
      if (generation === run.current && attempt === draftRun.current) {
        setResult((current) => current ? ({ ...current, draft_report }) : current);
        setNotice('Draft regenerated by the backend. Model wording or template fallback may be used. Exposure was not recomputed.');
      }
    } catch (cause) {
      if (generation === run.current && attempt === draftRun.current && cause.name !== 'AbortError') setNotice(cause.message || 'Draft regeneration failed. Please retry.');
    } finally {
      if (generation === run.current && attempt === draftRun.current) setRegenerating(false);
    }
  }

  async function copyDraft() {
    if (!result) return;
    const attempt = run.current;
    try {
      await navigator.clipboard.writeText(result.draft_report);
      if (attempt === run.current) setNotice('Draft copied to clipboard.');
    } catch {
      if (attempt === run.current) setNotice('Clipboard unavailable. Select and copy the draft text.');
    }
  }

  if (loadError) {
    return (
      <section className="disconnected-panel panel" aria-labelledby="live-error-title">
        <span className="connection-icon"><Icon name="plug" size={30} /></span>
        <h2 id="live-error-title">The live workspace could not load</h2>
        <p>{loadError}</p>
        <div className="connection-list">
          <div><span>MongoDB</span><strong>docker start markovathon-mongo</strong></div>
          <div><span>Seed data</span><strong>python -m backend.data.seed</strong></div>
          <div><span>API</span><strong>uvicorn backend.api.main:app --port 8000</strong></div>
        </div>
        <div className="event-actions"><button className="primary-button" onClick={() => { reset(); setLoadError(''); setReload((value) => value + 1); }}><Icon name="refresh" size={16} />Retry connection</button><button className="secondary-button" onClick={onUseDemo}><Icon name="play" size={16} />Use demo mode</button></div>
        <small>Demo mode needs no backend.</small>
      </section>
    );
  }

  if (!network) {
    return <section className="result-panel panel" role="status"><div className="loading-title"><span className="spinner" /><strong>Connecting to local services…</strong></div></section>;
  }

  if (!network.events.length || !network.suppliers.length) {
    return <section className="disconnected-panel panel" aria-labelledby="empty-workspace-title">
      <h2 id="empty-workspace-title">No {!network.suppliers.length ? 'supplier records' : 'disruptions'} available</h2>
      <p>The API is connected. Load supplier and event records to run an analysis.</p>
      <div className="connection-list"><div><span>Seed local records</span><strong>python -m backend.data.seed</strong></div></div>
      <div className="event-actions"><button className="primary-button" onClick={() => setReload((value) => value + 1)}><Icon name="refresh" size={16} />Reload records</button><button className="secondary-button" onClick={onUseDemo}>Use demo mode</button></div>
    </section>;
  }

  return <div className="live-workspace">
    <section className="walkthrough panel" aria-label="Live incident">
      <div className="journey-body">
        <div className="stage-canvas" data-stage={stage}>
          <div className="stage-heading">
            <h2>Analyze a disruption</h2>
            <p>Read supplier records, trace the disruption, and prepare a response for review. The backend uses model wording or a template fallback.</p>
          </div>
          <EventControls
            events={network.events}
            selectedId={eventId}
            onSelect={(id) => { reset(); setEventId(id); }}
            labelFor={describeEvent}
            busy={busy}
            regenerating={regenerating}
            completed={stage === 4}
            onRun={analyze}
            onReset={reset}
            canReset={stage !== 0 || Boolean(result)}
            live
          />
          <button className="secondary-button refresh-records" onClick={refreshRecords} disabled={busy || regenerating}><Icon name="refresh" size={16} />Refresh records</button>
          {error && <p role="alert" className="error">{error}</p>}
          {stage >= 2 && <p className="stage-caption">
            Tier {hops} of {tiers} revealed
            {stage === 4 && result && ` · ${result.directly_affected.length} direct, ${result.cascading_affected.length} downstream`}
          </p>}
        </div>
        <aside className="evidence-ledger" aria-label="Pipeline">
          <div className="ledger-heading"><h3>Pipeline</h3></div>
          <p>Where each part of this answer comes from.</p>
          <div className="ledger-list">
            {[
              ['Supplier records', 'Loaded from the local API', true],
              ['Impact calculation', 'Deterministic dependency analysis', stage >= 2],
              ['Response wording', 'Local model or template fallback', stage === 4],
              ['Human review', 'Draft remains unsent', false],
            ].map(([name, note, done]) => (
              <button key={name} disabled className={done ? 'selected' : ''}>
                <span className="ledger-id"><Icon name={done ? 'check' : 'info'} size={14} /></span>
                <span><strong>{name}</strong><small>{note}</small></span>
              </button>
            ))}
          </div>
          <div className="ledger-note"><Icon name="shield" size={16} /><p>The API supplies the result. This workspace does not send the draft.</p></div>
        </aside>
      </div>
    </section>
    <ProcessingRail demoMode={false} stage={stage} />
    {exposure && <section className="panel disruption-path" aria-labelledby="live-disruption-path"><h2 id="live-disruption-path">Disruption path</h2><DependencyFlow result={exposure} suppliers={network.suppliers} visibleIds={Object.keys(impacts)} onSelect={id => { setSupplierId(id); setFilter('all'); document.getElementById('supplier-network')?.scrollIntoView({ block: 'start' }); }} /></section>}
    <ResponsePanel
      result={result} stage={stage} regenerating={regenerating} elapsed={elapsed}
      tab={tab} onTab={(value) => { setTab(value); setNotice(''); }}
      notice={notice} onCopy={copyDraft} onRegenerate={regenerate} live
    />
    <div className="supporting-network">
      <AgentActivity client={client} />
      <SupplierBoard suppliers={network.suppliers} selectedId={supplierId} onSelect={setSupplierId} impacts={impacts} filter={filter} onFilter={setFilter} />
    </div>
  </div>;
}
