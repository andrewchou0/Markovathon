import { useEffect, useMemo, useState } from 'react';
import { readDemoMode, demoModeUrl } from './demo-mode.js';
import { createApiClient } from './api-client.js';
import LiveWorkspace from './components/LiveWorkspace.jsx';
import Icon from './components/Icon.jsx';
import WorkspaceHeader from './components/WorkspaceHeader.jsx';
import IncidentWalkthrough from './components/IncidentWalkthrough.jsx';
import { demoClient } from './demo-client.js';

export default function App() {
  const [demoMode, setDemoMode] = useState(() => readDemoMode(window.location.search));
  const [eventId, setEventId] = useState(demoClient.defaultEventId);
  const [session, setSession] = useState(0);
  const client = useMemo(() => createApiClient(), []);
  useEffect(() => {
    function followHistory() {
      const nextMode = readDemoMode(window.location.search);
      if (nextMode === demoMode) return;
      setDemoMode(nextMode); setEventId(demoClient.defaultEventId); setSession(value => value + 1);
    }
    window.addEventListener('popstate', followHistory);
    return () => window.removeEventListener('popstate', followHistory);
  }, [demoMode]);
  function setMode(enabled) {
    setDemoMode(enabled); setEventId(demoClient.defaultEventId); setSession(value => value + 1);
    window.history.pushState(null, '', demoModeUrl(window.location.href, enabled));
  }
  function focusWorkspace(event) {
    event.preventDefault();
    const workspace = document.getElementById('main-content');
    workspace?.focus({ preventScroll: true });
    workspace?.scrollIntoView({ block: 'start' });
  }
  return <>
    <a className="skip-link" href="#main-content" onClick={focusWorkspace}>Skip to workspace</a>
    <WorkspaceHeader demoMode={demoMode} onToggle={() => setMode(!demoMode)} onOverview={focusWorkspace} client={client} />
    <main id="main-content" tabIndex={-1}>
      <div className="page-heading"><div><h1>{demoMode ? 'Turn disruption into a workable plan' : 'From disruption to response'}</h1><p>{demoMode ? 'Connect supply, stock, production and orders. Choose the best feasible response.' : 'Follow the evidence. Understand the impact. Know what to do next.'}</p></div><span className={`environment-label ${demoMode ? 'is-demo' : ''}`}><i />{demoMode ? 'Interactive demo' : 'Live workspace'}</span></div>
      <div className={`mode-banner ${demoMode ? '' : 'mode-off'}`} id="demo-mode-description"><Icon name={demoMode ? 'play' : 'plug'} size={17} /><p>{demoMode ? <><strong>Demo mode is on.</strong> {eventId === demoClient.defaultEventId ? 'Supplier records plus simulated warehouse, production, order and quality data. The proposal is calculated locally for this example.' : 'Saved supplier analysis. Select the export-licence scenario to explore factory mitigation.'} No live systems are affected.</> : <><strong>Live workspace.</strong> Connect to the local services to monitor events, trace supplier exposure, and prepare a response.</>}</p></div>
      {demoMode
        ? <IncidentWalkthrough key={`${session}-${eventId}`} eventId={eventId} onEventChange={setEventId} />
        : <LiveWorkspace key={`live-${session}`} client={client} onUseDemo={() => setMode(true)} />}
      <footer><span><Icon name="shield" size={14} />Built for local operations</span><span>{demoMode ? 'Demo records · Human review before action' : 'Local service status is available in the header'}</span></footer>
    </main>
  </>;
}
