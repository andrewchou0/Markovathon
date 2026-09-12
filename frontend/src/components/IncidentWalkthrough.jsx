import { useEffect, useMemo, useRef, useState } from 'react';
import { demoClient } from '../demo-client.js';
import { createStory, STAGES } from '../story.js';
import usePlayback from '../use-playback.js';
import Icon from './Icon.jsx';
import ResponsePanel from './ResponsePanel.jsx';
import SupplierBoard from './SupplierBoard.jsx';

function References({ ids, onOpen }) {
  return <span className="evidence-refs">{ids.map(id => <button key={id} onClick={() => onOpen(id)} aria-label={`View evidence ${id}`}>{id}</button>)}</span>;
}

export default function IncidentWalkthrough({ eventId, onEventChange }) {
  const analysis = useMemo(() => demoClient.getAnalysis(eventId), [eventId]);
  const story = useMemo(() => createStory(analysis, demoClient.suppliers), [analysis]);
  const playback = usePlayback(story.frames);
  const { cursor, playing, complete } = playback;
  const current = story.frames[cursor];
  const [reviewStage, setReviewStage] = useState(null);
  const [evidenceId, setEvidenceId] = useState(null);
  const [supplierId, setSupplierId] = useState(demoClient.suppliers[0].id);
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState('summary');
  const [notice, setNotice] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const draftTimer = useRef(null);
  const version = useRef(0);
  useEffect(() => () => { clearTimeout(draftTimer.current); version.current++; }, []);
  const stage = reviewStage ?? current?.stage ?? 0;
  const frame = reviewStage === null ? current : story.frames.slice(0, cursor + 1).findLast(item => item.stage === reviewStage);
  const direct = new Set(analysis.directly_affected);
  const impacts = Object.fromEntries((current?.impactIds ?? []).map(id => [id, direct.has(id) ? 'direct' : 'cascade']));
  const visibleSources = story.sources.slice(0, current?.sourceCount ?? 0);
  const opened = visibleSources.find(source => source.id === evidenceId);
  function reset() {
    playback.reset(); setReviewStage(null); setEvidenceId(null); setNotice(''); setTab('summary'); setFilter('all');
    clearTimeout(draftTimer.current); version.current++; setRegenerating(false);
  }
  function start() { reset(); playback.start(); }
  function openEvidence(id) { playback.pause(); setEvidenceId(id); }
  useEffect(() => { if (evidenceId) document.getElementById('source-detail')?.focus(); }, [evidenceId]);
  function review(index) { playback.pause(); setReviewStage(index); setEvidenceId(null); }
  async function copyDraft() {
    const attempt = version.current;
    try { await navigator.clipboard.writeText(analysis.draft_report); if (attempt === version.current) setNotice('Draft copied to clipboard.'); }
    catch { if (attempt === version.current) setNotice('Clipboard unavailable. Select and copy the draft text.'); }
  }
  function regenerate() {
    setRegenerating(true); setNotice('');
    draftTimer.current = setTimeout(() => { setRegenerating(false); setNotice('Sample draft reloaded. Local model generation awaits backend integration.'); }, 1600);
  }
  const stageDescriptions = [story.question, 'Pull the relevant record from each platform.', 'Turn separate records into one incident brief.', 'Trace dependencies, then show the arithmetic.', 'Build the response before presenting the draft.'];

  return <>
    <section className="walkthrough panel" aria-label="Incident walkthrough">
      <div className="scenario-bar">
        <div className="scenario-field"><label htmlFor="event-select">Demo scenario</label><select id="event-select" value={eventId} onChange={event => onEventChange(event.target.value)}><option value="evt_001">Port closure — Gulf Coast</option><option value="evt_002">Compliance finding — Memphis</option></select></div>
        <div className="scenario-run"><span>About 40 seconds · pause at any point</span><button className="primary-button" onClick={() => { if (cursor >= 0 && !complete) { setReviewStage(null); playback.toggle(); } else start(); }}><Icon name={complete ? 'refresh' : playing ? 'pause' : 'play'} size={16} />{complete ? 'Replay demo' : cursor >= 0 ? playing ? 'Pause demo' : 'Resume demo' : 'Run demo'}</button></div>
      </div>
      <nav className="journey-nav" aria-label="Incident stages"><ol>{STAGES.map((label, index) => <li key={label} className={`${stage === index ? 'active' : ''} ${current && (current.stage > index || complete) ? 'done' : ''}`}><button onClick={() => review(index)} disabled={!current || current.stage < index} aria-current={stage === index ? 'step' : undefined}><span className="journey-number">{current && (current.stage > index || complete) ? <Icon name="check" size={15} /> : index + 1}</span><span>{label}</span></button></li>)}</ol></nav>
      <div className="journey-body">
        <div className="stage-canvas" data-stage={stage}>
          <div className="stage-heading"><h2>{cursor < 0 ? story.title : STAGES[stage]}</h2><p>{stageDescriptions[stage]}</p></div>
          {cursor < 0 ? <div className="incident-intro"><span className={`severity severity-${analysis.event.severity}`}>{analysis.event.severity} severity scenario</span><p>{story.problem}</p><div className="intro-route"><Icon name="bolt" size={22} /><span>Detect</span><Icon name="chevron" size={16} /><span>Understand</span><Icon name="chevron" size={16} /><span>Respond</span></div><p className="subtle">Run the demo to follow the incident, evidence, calculation, and proposed response.</p></div> : <>
            {stage === 0 && <div className="incident-signal"><div className="signal-title"><Icon name="bolt" size={24} /><strong>{analysis.event.type === 'weather' ? 'Gulf Coast port closure' : 'Incomplete supplier filing'}</strong><span className={`severity severity-${analysis.event.severity}`}>{analysis.event.severity} severity</span></div><p>{story.problem}</p><dl><div><dt>Location</dt><dd>{analysis.event.affected_location}</dd></div><div><dt>Event</dt><dd>{analysis.event.id}</dd></div><div><dt>Next action</dt><dd>Gather evidence from four local records</dd></div></dl><div className="stage-outcome"><Icon name="check" size={16} />Incident opened in the demo workspace.</div></div>}
            {stage === 1 && <div className="source-feed">{story.sources.map((source, index) => {
              const received = index < frame.sourceCount;
              return <div key={source.id} className={`source-row ${received ? 'received' : 'pending'}`}><span className="source-icon"><Icon name={source.icon} size={20} /></span><div><div className="source-row-title"><strong>{source.platform}</strong><span>{received ? 'Collected' : 'Waiting'}</span></div><p>{received ? source.fact : source.kind}</p>{received && <button className="text-button" onClick={() => openEvidence(source.id)}>Read source record <span>{source.id}</span></button>}</div><Icon name={received ? 'check' : 'chevron'} size={17} /></div>;
            })}<p className="stage-caption">{frame.sourceCount} of 4 records collected. The original records stay available in the evidence ledger.</p></div>}
            {stage === 2 && <div className="finding-list">{story.findings.slice(0, frame.findingCount).map((finding, index) => <article key={finding.title}><span className="finding-number">{index + 1}</span><div><h3>{finding.title}</h3><p>{finding.text}</p><References ids={finding.refs} onOpen={openEvidence} /></div></article>)}<p className="stage-caption">Structured findings from sample records. This is an incident brief, not a model reasoning trace.</p></div>}
            {stage === 3 && <div className="impact-work"><div className="exposure-chain"><div className="chain-group"><h3>Direct disruption</h3>{analysis.directly_affected.map(id => <div key={id} className={`chain-supplier direct ${(frame.impactIds ?? []).includes(id) ? 'revealed' : ''}`}><Icon name="bolt" size={16} /><span>{demoClient.suppliers.find(s => s.id === id)?.name}</span></div>)}</div><Icon className="chain-arrow" name="arrow" size={22} /><div className="chain-group"><h3>Downstream exposure</h3>{analysis.cascading_affected.map(id => <div key={id} className={`chain-supplier cascade ${(frame.impactIds ?? []).includes(id) ? 'revealed' : ''}`}><Icon name="network" size={16} /><span>{(frame.impactIds ?? []).includes(id) ? demoClient.suppliers.find(s => s.id === id)?.name : 'Tracing dependency…'}</span></div>)}</div></div>
              {frame.calculated ? <div className="calculation"><div className="calculation-heading"><h3>{eventId === 'evt_001' ? 'How long does the buffer last?' : 'What is missing from the filing?'}</h3><span>Illustrative estimate</span></div>{eventId === 'evt_001' ? <><div className="equation"><span>120 housings <b>÷</b> 10 / hour</span><strong>{story.calculation.coverage} hours covered</strong></div><div className="coverage-bar" aria-label="12 hours covered, 36 hours potentially uncovered"><span style={{flex:story.calculation.coverage}}>12h covered</span><span style={{flex:story.calculation.gap}}>36h gap</span></div><div className="equation"><span>48-hour closure <b>−</b> 12-hour buffer</span><strong className="risk-text">{story.calculation.gap} hours at risk</strong></div><p>{story.calculation.exposedUnits} housings of demand potentially uncovered at 10/hour. This is exposure, not confirmed lost production.</p><References ids={['E1', 'E3']} onOpen={openEvidence} /></> : <><div className="equation"><span>3 required <b>−</b> 2 received</span><strong>{story.calculation.missing} missing record</strong></div><div className="document-checklist"><span><Icon name="check" size={16} />Signed declaration</span><span><Icon name="check" size={16} />Smelter list</span><span className="risk-text"><Icon name="info" size={16} />Supplier attestation missing</span></div><p>{story.calculation.completion}% of the sample checklist is present. Production and financial impact remain unquantified.</p><References ids={['E3']} onOpen={openEvidence} /></>}<small>{eventId === 'evt_001' ? 'Assumes constant consumption, no replenishment, and a 48-hour closure. Confirm the snapshot before acting.' : 'A missing document does not by itself establish a shipment hold.'}</small></div> : <p className="stage-caption">Matching the supplied impact result to the network. Calculation follows the dependency reveal.</p>}
            </div>}
            {stage === 4 && <div className="response-work"><ol className="response-actions">{story.actions.slice(0, frame.actionCount).map((action, index) => <li key={action.title}><span className="action-number">{index + 1}</span><div><h3>{action.title}<span>{action.owner}</span></h3><p>{action.text}</p><References ids={action.refs} onOpen={openEvidence} /></div></li>)}</ol>{frame.complete ? <ResponsePanel result={analysis} stage={4} regenerating={regenerating} elapsed={0} tab={tab} onTab={value => {setTab(value);setNotice('');}} notice={notice} onCopy={copyDraft} onRegenerate={regenerate} /> : <p className="stage-caption">Formulating the response from the incident brief. The reviewable sample email appears after the action plan.</p>}</div>}
          </>}
        </div>
        <aside className="evidence-ledger" aria-label="Evidence ledger"><div className="ledger-heading"><h3>Evidence ledger</h3><span>{visibleSources.length}/4</span></div><p>Source records stay with the incident.</p><div className="ledger-list">{story.sources.map(source => {
          const available = visibleSources.some(item => item.id === source.id);
          return <button key={source.id} disabled={!available} className={evidenceId === source.id ? 'selected' : ''} onClick={() => openEvidence(source.id)} aria-expanded={evidenceId === source.id} aria-controls="source-detail"><span className="ledger-id">{source.id}</span><span><strong>{source.platform}</strong><small>{available ? source.fact : 'Awaiting evidence'}</small></span>{available && <Icon name="check" size={14} />}</button>;
        })}</div>{opened && <article id="source-detail" className="source-detail" tabIndex={-1} aria-label="Source record"><div><strong>{opened.id} · {opened.time} sample time</strong><button onClick={() => setEvidenceId(null)} className="text-button">Close record</button></div><h4>{opened.title}</h4><p>{opened.text}</p><small>{opened.kind}</small></article>}<div className="ledger-note"><Icon name="shield" size={16} /><p>Local sample records.<br />No platform is connected.</p></div></aside>
      </div>
      <div className="playback-bar"><div role="status" className="playback-status"><span className={`playback-dot ${playing ? 'playing' : ''}`} /><span>{reviewStage !== null ? `Reviewing: ${STAGES[reviewStage]}` : cursor < 0 ? 'Ready to run' : complete ? 'Complete · ready for human review' : `${playing ? 'Playing' : 'Paused'} · ${current.label}`}</span></div><div className="playback-actions">{cursor >= 0 && !complete && <><button className="secondary-button" onClick={() => {setReviewStage(null); playback.toggle();}}><Icon name={playing ? 'pause' : 'play'} size={15} />{playing ? 'Pause' : 'Resume'}</button><button className="secondary-button" onClick={() => {setReviewStage(null);playback.next();}}>Next step<Icon name="arrow" size={15} /></button></>}<button className="reset-button" disabled={cursor < 0} onClick={reset}><Icon name="refresh" size={15} />Reset</button></div></div>
    </section>
    <div className="supporting-network"><SupplierBoard suppliers={demoClient.suppliers} selectedId={supplierId} onSelect={setSupplierId} impacts={impacts} filter={filter} onFilter={setFilter} /><details className="playback-history"><summary>Incident activity <span>{cursor + 1} recorded steps</span></summary><ol>{story.frames.slice(0, cursor + 1).map((item, index) => <li key={index}><Icon name="check" size={14} /><span>{item.label}</span></li>)}</ol>{cursor < 0 && <p>Run the demo to build the incident timeline.</p>}</details></div>
  </>;
}
