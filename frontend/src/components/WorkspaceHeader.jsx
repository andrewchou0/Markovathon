import Icon from './Icon.jsx';

export default function WorkspaceHeader({ demoMode, onToggle }) {
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
            <p>{demoMode ? 'Demo mode uses sample data. These service readings are placeholders.' : 'The live workspace is not connected yet.'}</p>
            <dl>
              <div><dt>External calls blocked</dt><dd>{demoMode ? '0 (sample)' : 'Unknown'}</dd></div>
              <div><dt>Model host</dt><dd>Not connected</dd></div>
              <div><dt>Database host</dt><dd>Not connected</dd></div>
            </dl>
            <span className="status-unverified"><Icon name="info" size={14} />Offline enforcement is not yet verified.</span>
          </div>
        </details>
      </div>
    </header>
  );
}
