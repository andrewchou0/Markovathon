import { useEffect, useState } from 'react';
import { readDemoMode, demoModeUrl } from './demo-mode.js';
import Icon from './components/Icon.jsx';
import WorkspaceHeader from './components/WorkspaceHeader.jsx';
import IncidentWalkthrough from './components/IncidentWalkthrough.jsx';

export default function App() {
  const [demoMode, setDemoMode] = useState(() => readDemoMode(window.location.search));
  const [eventId, setEventId] = useState('evt_001');
  const [session, setSession] = useState(0);
  useEffect(() => {
    function followHistory() { setDemoMode(readDemoMode(window.location.search)); setEventId('evt_001'); setSession(value => value + 1); }
    window.addEventListener('popstate', followHistory);
    return () => window.removeEventListener('popstate', followHistory);
  }, []);
  function setMode(enabled) {
    setDemoMode(enabled); setEventId('evt_001'); setSession(value => value + 1);
    window.history.pushState(null, '', demoModeUrl(window.location.href, enabled));
  }
  return <>
    <a className="skip-link" href="#main-content">Skip to workspace</a>
    <WorkspaceHeader demoMode={demoMode} onToggle={() => setMode(!demoMode)} />
    <main id="main-content" tabIndex={-1}>
      <div className="page-heading"><div><h1>From disruption to response</h1><p>Follow the evidence. Understand the impact. Know what to do next.</p></div><span className={`environment-label ${demoMode ? 'is-demo' : ''}`}><i />{demoMode ? 'Interactive demo' : 'Live workspace'}</span></div>
      <div className={`mode-banner ${demoMode ? '' : 'mode-off'}`} id="demo-mode-description"><Icon name={demoMode ? 'play' : 'plug'} size={17} /><p>{demoMode ? <><strong>Demo mode is on.</strong> A guided simulation with sample sources and estimates. No live systems are affected.</> : <><strong>Demo mode is off.</strong> Local services are not connected. Sample data has been cleared.</>}</p></div>
      {demoMode ? <IncidentWalkthrough key={`${session}-${eventId}`} eventId={eventId} onEventChange={setEventId} /> : <section className="disconnected-panel panel" aria-labelledby="disconnected-title"><span className="connection-icon"><Icon name="plug" size={30} /></span><h2 id="disconnected-title">Connect your local services to get started</h2><p>The live workspace will show your supplier network and incoming events once the local backend is integrated.</p><div className="connection-list"><div><span>Supplier data & events</span><strong>Not connected</strong></div><div><span>Local model</span><strong>Not connected</strong></div><div><span>Offline enforcement</span><strong>Not verified</strong></div></div><button className="primary-button" onClick={() => setMode(true)}><Icon name="play" size={16} />Try demo mode</button><small>Demo mode is available without the backend.</small></section>}
      <footer><span><Icon name="shield" size={14} />Built for local operations</span><span>{demoMode ? 'Sample playback · No external runtime requests' : 'Awaiting local service integration'}</span></footer>
    </main>
  </>;
}
