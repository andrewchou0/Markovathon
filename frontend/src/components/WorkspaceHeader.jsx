import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';

export default function WorkspaceHeader({ demoMode, onToggle, onOverview, client }) {
  const [local, setLocal] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    setLocal(null); setUnavailable(false);
    if (demoMode || !client) return;
    let live = true;
    let timer;
    const controller = new AbortController();
    async function read() {
      try {
        const value = await client.offlineStatus({ signal: controller.signal });
        if (!live) return;
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid local status');
        setLocal(value); setUnavailable(false);
      } catch (error) {
        if (live && error.name !== 'AbortError') { setLocal(null); setUnavailable(true); }
      } finally {
        if (live) timer = setTimeout(read, 5000);
      }
    }
    read();
    return () => { live = false; controller.abort(); clearTimeout(timer); };
  }, [demoMode, client]);
  const enforced = !demoMode && local?.enforced === true;
  const blocked = enforced && Number.isFinite(local?.external_calls_blocked) ? String(local.external_calls_blocked) : 'Not verified';
  return (
    <header className="topbar">
      <a className="brand" href="#main-content" aria-label="Markov overview" onClick={onOverview}><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>Markov</a>
      <span className="product-label">Operations workspace</span>
      <div className="header-controls">
        <button className="demo-toggle" role="switch" aria-checked={demoMode} aria-label="Demo mode" aria-describedby="demo-mode-description" onClick={onToggle}>
          <span>Demo mode</span><span className="switch-track" aria-hidden="true"><span /></span><span className="switch-value" aria-hidden="true">{demoMode ? 'On' : 'Off'}</span>
        </button>
        <details className="offline-status">
          <summary aria-label="Local status"><Icon name="shield" size={17} /><span>Local status</span></summary>
          <div className="status-popover">
            <strong>Local services</strong>
            <p>{demoMode ? 'Demo playback uses bundled sample records. Live services are not contacted.' : unavailable ? 'The local API is unavailable. These readings could not be verified.' : local ? 'Configuration reported by the backend. A configured host does not confirm that its service is running.' : 'Checking the local API…'}</p>
            <dl>
              <div><dt>External calls blocked</dt><dd>{demoMode ? 'Not measured in demo' : blocked}</dd></div>
              <div><dt>Model host</dt><dd>{!demoMode && typeof local?.llm?.host === 'string' ? local.llm.host : 'Not verified'}</dd></div>
              <div><dt>Database host</dt><dd>{!demoMode && typeof local?.db?.host === 'string' ? local.db.host : 'Not verified'}</dd></div>
            </dl>
            <span className={enforced ? 'status-verified' : 'status-unverified'}><Icon name={enforced ? 'shield' : 'info'} size={14} />{enforced ? 'The backend reports an active outbound HTTP guard.' : demoMode ? 'Demo playback does not verify live enforcement.' : 'Outbound HTTP enforcement is not verified.'}</span>
          </div>
        </details>
      </div>
    </header>
  );
}
