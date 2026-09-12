import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';

export default function WorkspaceHeader({ demoMode, onToggle, client }) {
  // In live mode these readings come from the backend's own enforcement hook,
  // not from this component's assumptions.
  const [local, setLocal] = useState(null);
  useEffect(() => {
    if (demoMode || !client) { setLocal(null); return; }
    let live = true;
    const read = () => client.offlineStatus().then((value) => { if (live) setLocal(value); }).catch(() => { if (live) setLocal(null); });
    read();
    const handle = setInterval(read, 5000);
    return () => { live = false; clearInterval(handle); };
  }, [demoMode, client]);
  return (
    <header className="topbar">
      <a className="brand" href="#main-content" aria-label="Markov overview">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
        Markov
      </a>
      <span className="product-label">Operations workspace</span>
      <div className="header-controls">
        <button className="demo-toggle" role="switch" aria-checked={demoMode} aria-label="Demo mode" aria-describedby="demo-mode-description" onClick={onToggle}>
          <span>Demo mode</span>
          <span className="switch-track" aria-hidden="true"><span /></span>
          <span className="switch-value" aria-hidden="true">{demoMode ? 'On' : 'Off'}</span>
        </button>
        <details className="offline-status">
          <summary aria-label="Local status"><Icon name="shield" size={17} /><span>Local status</span></summary>
          <div className="status-popover">
            <strong>Local services</strong>
            <p>{demoMode ? 'Demo mode uses sample data. These service readings are placeholders.' : local ? 'Reported by the backend\u2019s own outbound-request hook.' : 'Waiting for the local API.'}</p>
            <dl>
              <div><dt>External calls blocked</dt><dd>{demoMode ? '0 (sample)' : local ? String(local.external_calls_blocked) : 'Unknown'}</dd></div>
              <div><dt>Model host</dt><dd>{local?.llm?.host ?? 'Not connected'}</dd></div>
              <div><dt>Database host</dt><dd>{local?.db?.host ?? 'Not connected'}</dd></div>
            </dl>
            <span className={local?.enforced ? 'status-verified' : 'status-unverified'}><Icon name={local?.enforced ? 'shield' : 'info'} size={14} />{local?.enforced ? 'Outbound requests to non-local hosts are refused.' : 'Offline enforcement is not yet verified.'}</span>
          </div>
        </details>
      </div>
    </header>
  );
}
