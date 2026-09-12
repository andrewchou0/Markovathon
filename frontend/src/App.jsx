import { useEffect, useMemo, useState } from 'react';
import { readDemoMode, demoModeUrl } from './demo-mode.js';
import { createApiClient } from './api-client.js';
import LiveWorkspace from './components/LiveWorkspace.jsx';
import Icon from './components/Icon.jsx';
import WorkspaceHeader from './components/WorkspaceHeader.jsx';
import IncidentWalkthrough from './components/IncidentWalkthrough.jsx';

export default function App() {
  const [demoMode, setDemoMode] = useState(() => readDemoMode(window.location.search));
  const [eventId, setEventId] = useState('evt_001');
  const [session, setSession] = useState(0);
  const client = useMemo(() => createApiClient(), []);
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
    <WorkspaceHeader demoMode={demoMode} onToggle={() => setMode(!demoMode)} client={client} />
    <main id="main-content" tabIndex={-1}>
      <div className="page-heading"><div><h1>From disruption to response</h1><p>Follow the evidence. Understand the impact. Know what to do next.</p></div><span className={`environment-label ${demoMode ? 'is-demo' : ''}`}><i />{demoMode ? 'Interactive demo' : 'Live workspace'}</span></div>
      <div className={`mode-banner ${demoMode ? '' : 'mode-off'}`} id="demo-mode-description"><Icon name={demoMode ? 'play' : 'plug'} size={17} /><p>{demoMode ? <><strong>Demo mode is on.</strong> A guided simulation with sample sources and estimates. No live systems are affected.</> : <><strong>Live mode.</strong> Suppliers, events, exposure and wording all come from services on this machine.</>}</p></div>
      {demoMode
        ? <IncidentWalkthrough key={`${session}-${eventId}`} eventId={eventId} onEventChange={setEventId} />
        : <LiveWorkspace key={`live-${session}`} client={client} onUseDemo={() => setMode(true)} />}
      <footer><span><Icon name="shield" size={14} />Built for local operations</span><span>{demoMode ? 'Sample playback · No external runtime requests' : 'Live · all processing on this machine'}</span></footer>
    </main>
  </>;
}
