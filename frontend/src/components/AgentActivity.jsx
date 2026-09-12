import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';

const ACTION_LABEL = {
  alert_dispatched: 'Delivered for human review',
  alert_undelivered: 'Flagged · delivery unavailable',
  assessed_no_alert: 'Assessed · below alert threshold',
  monitor_started: 'Monitoring started',
  monitor_stopped: 'Monitoring stopped',
  tick_error: 'Scan error',
  error: 'Assessment error',
};
const count = (value) => Number.isFinite(value) ? value : '—';
const timestamp = (value) => { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? '' : ` · ${parsed.toISOString().slice(11, 19)} UTC`; };

export default function AgentActivity({ client, pollMs = 3000 }) {
  const [status, setStatus] = useState(null);
  const [entries, setEntries] = useState([]);
  const [unavailable, setUnavailable] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let live = true;
    let timer;
    let activeController;
    setStatus(null); setEntries([]); setUnavailable('');
    async function poll() {
      const controller = new AbortController();
      activeController = controller;
      try {
        const [next, activity] = await Promise.all([
          client.monitorStatus({ signal: controller.signal }),
          client.monitorActivity(12, { signal: controller.signal }),
        ]);
        if (!live) return;
        if (!next || typeof next.running !== 'boolean' || !Array.isArray(activity)) throw new Error('The backend returned an invalid monitor reading.');
        setStatus(next);
        setEntries(activity.filter((entry) => entry && typeof entry.action === 'string'));
        setUnavailable('');
      } catch (error) {
        controller.abort();
        if (!live || error.name === 'AbortError') return;
        setStatus(null); setEntries([]);
        setUnavailable(error.status === 404
          ? 'The backend does not expose monitor activity.'
          : error.message || 'Monitor status is unavailable.');
      } finally {
        // Start the next read only after this one settles. Slow endpoints cannot
        // overlap and let an older running status overwrite a newer failure.
        if (live) timer = setTimeout(poll, Math.max(1000, pollMs));
      }
    }
    poll();
    return () => { live = false; activeController?.abort(); clearTimeout(timer); };
  }, [client, pollMs, retry]);

  const running = !unavailable && status?.running === true;
  const stateDescription = unavailable ? 'Monitoring status unknown · connection unavailable.'
    : !status ? 'Checking the backend monitor…'
      : running ? `Running unattended${Number.isFinite(status.interval_s) ? ` · scanning every ${status.interval_s}s` : ''}`
        : 'The monitoring loop is stopped.';

  return (
    <section className="activity-section panel" aria-labelledby="activity-title">
      <div className="section-heading">
        <div><h2 id="activity-title">Agent activity</h2><p>{stateDescription}</p></div>
        <span className={`playback-dot ${running ? 'playing' : ''}`} aria-hidden="true" />
      </div>
      {unavailable && <><p className="stage-caption" role="status">{unavailable}</p><button className="secondary-button" onClick={() => setRetry((value) => value + 1)}><Icon name="refresh" size={15} />Retry status</button></>}
      {status && <div className="assessment-counts">
        <span><strong>{count(status.events_assessed)}</strong> assessed</span>
        <span><strong>{count(status.alerts_dispatched)}</strong> delivered</span>
        <span><strong>{count(status.below_threshold)}</strong> below threshold</span>
      </div>}
      {status && typeof status.min_severity === 'string' && Number.isFinite(status.min_risk) && <p className="stage-caption">
        Flags events at or above <strong>{status.min_severity}</strong> severity and <strong>{status.min_risk}</strong> network risk.
        A flagged event is delivered only when a response channel is connected.
      </p>}
      {status?.last_error && <p className="error" role="status">Last monitor error: {String(status.last_error)}</p>}
      <ol className="activity-log">
        {entries.map((entry, index) => {
          const flagged = ['alert_dispatched', 'alert_undelivered'].includes(entry.action);
          const failed = ['tick_error', 'error'].includes(entry.action);
          const reason = typeof entry.reason === 'string' ? entry.reason : '';
          return <li key={`${entry.at}-${entry.event_id ?? index}-${index}`}>
            <Icon name={flagged ? 'bolt' : failed ? 'info' : 'check'} size={15} />
            <div>
              <strong className={flagged || failed ? 'risk-text' : undefined}>{entry.event_id ? `${entry.event_id} · ` : ''}{ACTION_LABEL[entry.action] ?? entry.action}</strong>
              <p>{reason}{Number.isFinite(entry.network_risk_score) && !/risk/i.test(reason) && ` · risk ${entry.network_risk_score}`}{entry.at && timestamp(entry.at)}</p>
              {entry.action === 'alert_undelivered' && <small>Nothing was delivered for this event.</small>}
            </div>
          </li>;
        })}
      </ol>
      {!entries.length && !unavailable && status && <p className="stage-caption">{running ? 'No activity recorded yet. Waiting for the next monitor pass.' : 'No scans recorded. Start the backend monitor to watch for new disruptions.'}</p>}
    </section>
  );
}
