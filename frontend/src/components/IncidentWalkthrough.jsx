import { useEffect, useMemo, useRef, useState } from 'react';
import { demoClient } from '../demo-client.js';
import { createStory, STAGES } from '../story.js';
import usePlayback from '../use-playback.js';
import Icon from './Icon.jsx';
import ResponsePanel from './ResponsePanel.jsx';
import SupplierBoard from './SupplierBoard.jsx';
import DependencyFlow from './DependencyFlow.jsx';
import ProcessingRail from './ProcessingRail.jsx';
import { describeEvent } from '../api-client.js';
import MitigationDecision, { ImpactComparison } from './MitigationDecision.jsx';

function References({ ids, onOpen }) {
  return <span className="evidence-refs">{ids.map(id => <button key={id} onClick={() => onOpen(id)} aria-label={`View evidence ${id}`}>{id}</button>)}</span>;
}

export default function IncidentWalkthrough({ eventId, onEventChange }) {
  const analysis = useMemo(() => demoClient.getAnalysis(eventId), [eventId]);
  const story = useMemo(() => createStory(analysis, demoClient.suppliers), [analysis]);
  const plan = story.operationalPlan;
  const response = story.response;
  const stageLabels = story.stages ?? STAGES;
  const playback = usePlayback(story.frames);
  const { cursor, playing, complete } = playback;
  const current = story.frames[cursor];
  const [reviewStage, setReviewStage] = useState(null);
  const [evidenceId, setEvidenceId] = useState(null);
  const [supplierId, setSupplierId] = useState(analysis.directly_affected[0] ?? demoClient.suppliers[0]?.id);
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState('summary');
  const [notice, setNotice] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const draftTimer = useRef(null);
  const version = useRef(0);
  useEffect(() => () => { clearTimeout(draftTimer.current); version.current++; }, []);
  const stage = reviewStage ?? current?.stage ?? 0;
  const frame = reviewStage === null ? current : story.frames.slice(0, cursor + 1).findLast(item => item.stage === reviewStage);
  const gatheringOperations = Boolean(plan && frame?.sourceCount > 4);
  const gatheringSources = plan ? story.sources.slice(gatheringOperations ? 4 : 0, gatheringOperations ? 8 : 4) : story.sources;
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
    try { await navigator.clipboard.writeText(response.draft_report); if (attempt === version.current) setNotice('Draft copied to clipboard.'); }
    catch { if (attempt === version.current) setNotice('Clipboard unavailable. Select and copy the draft text.'); }
  }
  function regenerate() {
    setRegenerating(true); setNotice('');
    draftTimer.current = setTimeout(() => { setRegenerating(false); setNotice(plan ? 'Demo operating proposal restored from the same records and calculations.' : 'Sample draft reloaded. Switch off demo mode to request wording from the local backend.'); }, 1600);
  }
  const stageDescriptions = plan ? [story.question, 'Combine supplier context with warehouse, production, customer and quality records.', 'Separate the hard constraints from the changes we can make.', 'Compare approved responses using the same stock, deadlines and capacity.', 'Recommend a specific operating change, with owners, timing and remaining risk.'] : [story.question, 'Read the event, part, compliance, and dependency records.', 'Turn separate records into one incident brief.', 'Follow each dependency tier, then inspect the calculated exposure.', 'Build the response before presenting the draft.'];

  return <>
    <section className={`walkthrough panel ${plan ? 'operational-story' : ''}`}  aria-label="Incident walkthrough">
      <div className="scenario-bar">
        <div className="scenario-field"><label htmlFor="event-select">Demo scenario</label><select id="event-select" value={eventId} onChange={event => onEventChange(event.target.value)}>{demoClient.events.map(event => <option key={event.id} value={event.id}>{event.id === 'evt_004' ? 'Export licence suspension · factory mitigation' : describeEvent(event)}</option>)}</select></div>
        <div className="scenario-run">{plan && <button className="text-button view-example" onClick={() => { reset(); playback.finish(); }}>View plan</button>}<span>{Math.ceil(story.frames.reduce((total, item) => total + item.duration, 0) / 1000)} seconds · pause at any point</span><button className="primary-button" onClick={() => { if (cursor >= 0 && !complete) { setReviewStage(null); playback.toggle(); } else start(); }}><Icon name={complete ? 'refresh' : playing ? 'pause' : 'play'} size={16} />{complete ? 'Replay demo' : cursor >= 0 ? playing ? 'Pause demo' : 'Resume demo' : 'Run demo'}</button></div>
      </div>
      <nav className="journey-nav" aria-label="Incident stages"><ol>{stageLabels.map((label, index) => <li key={label} className={`${stage === index ? 'active' : ''} ${current && (current.stage > index || complete) ? 'done' : ''}`}><button onClick={() => review(index)} disabled={!current || current.stage < index} aria-current={stage === index ? 'step' : undefined}><span className="journey-number">{current && (current.stage > index || complete) ? <Icon name="check" size={15} /> : index + 1}</span><span>{label}</span></button></li>)}</ol></nav>
      <ProcessingRail demoMode operational={Boolean(plan)} stage={cursor < 0 ? -1 : stage} />
      <div className="journey-body">
        <div className="stage-canvas" data-stage={stage} key={stage}>
          <div className="stage-heading"><h2>{cursor < 0 ? story.title : stageLabels[stage]}</h2><p>{stageDescriptions[stage]}</p></div>
          {cursor < 0 ? <div className="incident-intro"><span className={`severity severity-${analysis.event.severity}`}>{analysis.event.severity} severity scenario</span><p>{story.problem}</p><div className="incident-network-preview"><Icon name="network" size={24} /><div><strong>{plan ? 'A 40-hour plan for Cascade Final Assembly' : `${demoClient.suppliers.length} suppliers. One connected network.`}</strong><span>{plan ? 'Warehouse stock + production queue + customer commitments + quality rules' : `${demoClient.suppliers.filter(supplier => supplier.single_source).length} single-source suppliers · dependencies through final assembly`}</span></div></div><p className="subtle">{plan ? 'Compare stock allocation and line resequencing against the current schedule. Operating records are simulated for this example.' : 'Follow one disruption from its source to the teams and parts that depend on it.'}</p></div> : <>
            {stage === 0 && <div className="incident-signal"><div className="signal-title"><Icon name="bolt" size={24} /><strong>{story.signal}</strong><span className={`severity severity-${analysis.event.severity}`}>{analysis.event.severity} severity</span></div><p>{story.problem}</p><dl><div><dt>Location</dt><dd>{analysis.event.affected_location}</dd></div><div><dt>Event</dt><dd>{analysis.event.id}</dd></div><div><dt>Next action</dt><dd>Read {story.sources.length} supporting records</dd></div></dl><div className="stage-outcome"><Icon name="check" size={16} />Incident opened in the demo workspace.</div></div>}
            {stage === 1 && <div className="source-feed" key={gatheringOperations ? 'operations' : 'supply'}>{plan && <div className="source-phase"><strong>{gatheringOperations ? 'Inside the factory' : 'Upstream disruption'}</strong><span>{gatheringOperations ? 'WMS · MES · orders · quality' : 'Event · part · sourcing · dependencies'}</span></div>}{gatheringSources.map(source => {
              const received = story.sources.indexOf(source) < frame.sourceCount;
              return <div key={source.id} className={`source-row ${received ? 'received' : 'pending'}`}><span className="source-icon"><Icon name={source.icon} size={20} /></span><div><div className="source-row-title"><strong>{source.platform}</strong><span>{received ? 'Collected' : 'Waiting'}</span></div><p>{received ? source.fact : source.kind}</p>{received && <button className="text-button" onClick={() => openEvidence(source.id)}>Read source record <span>{source.id}</span></button>}</div><Icon name={received ? 'check' : 'chevron'} size={17} /></div>;
            })}<p className="stage-caption">{frame.sourceCount} of {story.sources.length} records collected. The original records stay available in the evidence ledger.</p></div>}
            {stage === 2 && <div className="finding-list">{story.findings.slice(0, frame.findingCount).map((finding, index) => <article key={finding.title}><span className="finding-number">{index + 1}</span><div><h3>{finding.title}</h3><p>{finding.text}</p><References ids={finding.refs} onOpen={openEvidence} /></div></article>)}<p className="stage-caption">Each finding links back to the local record that supports it.</p></div>}
            {stage === 3 && <div className="impact-work">
              {plan && frame.calculated ? <><ImpactComparison plan={plan} onOpenEvidence={openEvidence} /><details className="upstream-context"><summary>Supplier exposure behind this plan · {story.calculation.affectedCount} suppliers</summary><DependencyFlow result={analysis} suppliers={demoClient.suppliers} /><p>Saved Python risk score: {story.calculation.networkRiskScore.toFixed(3)} · {story.calculation.tierCount} downstream tiers. Operational losses are calculated separately from the demo records.</p><References ids={['E1', 'E4']} onOpen={openEvidence} /></details></> : <>
              <DependencyFlow result={analysis} suppliers={demoClient.suppliers} visibleIds={frame.impactIds} />
              {frame.calculated ? <div className="calculation">
                <div className="calculation-heading"><h3>How far does this disruption travel?</h3><span>Saved Python analysis</span></div>
                <div className="impact-equation"><span><strong>{story.calculation.directCount}</strong> directly affected</span><b>+</b><span><strong>{story.calculation.cascadingCount}</strong> downstream</span><b>=</b><span className="risk-text"><strong>{story.calculation.affectedCount}</strong> exposed suppliers</span></div>
                <dl className="impact-facts"><div><dt>Network risk score</dt><dd>{story.calculation.networkRiskScore.toFixed(3)} <small>/ 1.000</small></dd></div><div><dt>Downstream depth</dt><dd>{story.calculation.tierCount} <small>tiers</small></dd></div><div><dt>Exposed single sources</dt><dd>{story.calculation.singleSourceCount}</dd></div></dl>
                <References ids={['E3', 'E4']} onOpen={openEvidence} />
                <small>The risk score prioritizes review; it is not a probability or a revenue estimate. Financial loss and production downtime need operational data.</small>
              </div> : <p className="stage-caption">Tracing direct exposure through the supplier network. The impact calculation follows the final dependency tier.</p>}
              </>}
            </div>}
            {stage === 4 && <div className="response-work">{plan && <MitigationDecision plan={plan} onOpenEvidence={openEvidence} />}{plan && <h3 className="execution-heading">Proposed execution sequence</h3>}<ol className="response-actions">{story.actions.slice(0, frame.actionCount).map((action, index) => <li key={action.title}><span className="action-number">{index + 1}</span><div><h3>{action.title}<span>{action.owner}</span></h3><p>{action.text}</p><References ids={action.refs} onOpen={openEvidence} /></div></li>)}</ol>{frame.complete ? <>{plan && <details className="review-triggers"><summary>When to reassess this plan</summary>{plan.reviewTriggers.map(trigger => <article key={trigger.title}><h4>{trigger.title}</h4><p>{trigger.text}</p><References ids={trigger.refs} onOpen={openEvidence} /></article>)}</details>}<ResponsePanel operational={Boolean(plan)} result={response} stage={4} regenerating={regenerating} elapsed={0} tab={tab} onTab={value => {setTab(value);setNotice('');}} notice={notice} onCopy={copyDraft} onRegenerate={regenerate} /></> : <p className="stage-caption">Formulating the response from the incident brief. The reviewable sample email appears after the action plan.</p>}</div>}
          </>}
        </div>
        <aside className="evidence-ledger" aria-label="Evidence ledger"><div className="ledger-heading"><h3>Evidence ledger</h3><span>{visibleSources.length}/{story.sources.length}</span></div><p>Source records stay with the incident.</p><div className="ledger-list">{story.sources.map(source => {
          const available = visibleSources.some(item => item.id === source.id);
          return <button key={source.id} disabled={!available} className={evidenceId === source.id ? 'selected' : ''} onClick={() => openEvidence(source.id)} aria-expanded={evidenceId === source.id} aria-controls="source-detail"><span className="ledger-id">{source.id}</span><span><strong>{source.platform}</strong><small>{available ? source.fact : 'Awaiting evidence'}</small></span>{available && <Icon name="check" size={14} />}</button>;
        })}</div>{opened && <article id="source-detail" className="source-detail" tabIndex={-1} aria-label="Source record"><div><strong>{opened.id} · {opened.time}</strong><button onClick={() => setEvidenceId(null)} className="text-button">Close record</button></div><h4>{opened.title}</h4><p>{opened.text}</p><small>{opened.kind}</small></article>}<div className="ledger-note"><Icon name="shield" size={16} /><p>{plan ? 'Seed supplier records + simulated operating records.' : 'Local seed records.'}<br />No external platform is connected.</p></div></aside>
      </div>
      <div className="playback-bar"><div role="status" className="playback-status"><span className={`playback-dot ${playing ? 'playing' : ''}`} /><span>{reviewStage !== null ? `Reviewing: ${stageLabels[reviewStage]}` : cursor < 0 ? 'Ready to run' : complete ? 'Complete · ready for human review' : `${playing ? 'Playing' : 'Paused'} · ${current.label}`}</span></div><div className="playback-actions">{cursor >= 0 && !complete && <><button className="secondary-button" onClick={() => {setReviewStage(null); playback.toggle();}}><Icon name={playing ? 'pause' : 'play'} size={15} />{playing ? 'Pause' : 'Resume'}</button><button className="secondary-button" onClick={() => {setReviewStage(null);playback.next();}}>Next step<Icon name="arrow" size={15} /></button></>}<button className="reset-button" disabled={cursor < 0} onClick={reset}><Icon name="refresh" size={15} />Reset</button></div></div>
    </section>
    <div className="supporting-network"><SupplierBoard suppliers={demoClient.suppliers} selectedId={supplierId} onSelect={setSupplierId} impacts={impacts} filter={filter} onFilter={setFilter} /><details className="playback-history"><summary>Incident activity <span>{cursor + 1} recorded steps</span></summary><ol>{story.frames.slice(0, cursor + 1).map((item, index) => <li key={index}><Icon name="check" size={14} /><span>{item.label}</span></li>)}</ol>{cursor < 0 && <p>Run the demo to build the incident timeline.</p>}</details></div>
  </>;
}
