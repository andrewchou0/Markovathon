import { useCallback, useEffect, useState } from 'react';
import Icon from './Icon.jsx';

// The unattended loop, made visible. Nothing here is triggered by the operator:
// backend/agent/monitor.py wakes on a timer, assesses events it has not seen,
// and decides which ones warrant a human. This panel just watches it work.

const ACTION_LABEL = {
  alert_dispatched: 'Escalated to a human',
  alert_undelivered: 'Escalated — delivery unavailable',
  assessed_no_alert: 'Assessed, no alert',
  monitor_started: 'Monitoring started',
  monitor_stopped: 'Monitoring stopped',
  tick_error: 'Scan error',
  error: 'Assessment error',
};

const ACTION_TONE = {
  alert_dispatched: 'escalated',
  alert_undelivered: 'escalated',
  assessed_no_alert: 'suppressed',
};

export default function AgentActivity({ client, pollMs = 3000 }) {
  const [status, setStatus] = useState(null);
  const [entries, setEntries] = useState([]);
  const [unavailable, setUnavailable] = useState('');

  const poll = useCallback(async () => {
    try {
      const [next, activity] = await Promise.all([client.monitorStatus(), client.monitorActivity(12)]);
      setStatus(next);
      setEntries(Array.isArray(activity) ? activity : []);
      setUnavailable('');
    } catch (error) {
      setUnavailable(error.status === 404
        ? 'The backend is running without the monitor endpoints.'
        : error.message);
    }
  }, [client]);

  useEffect(() => {
    poll();
    const handle = setInterval(poll, pollMs);
    return () => clearInterval(handle);
  }, [poll, pollMs]);

  const running = Boolean(status?.running);

  return (
    <section className="activity-section panel" aria-labelledby="activity-title">
      <div className="section-heading">
        <div>
          <h2 id="activity-title">Agent activity</h2>
          <p>{running
            ? `Running unattended · scanning every ${status.interval_s}s`
            : 'The monitoring loop is not running.'}</p>
        </div>
        <span className={`playback-dot ${running ? 'playing' : ''}`} aria-hidden="true" />
      </div>

      {unavailable && <p className="stage-caption">{unavailable}</p>}

      {status && <div className="assessment-counts">
        <span><strong>{status.events_assessed}</strong> assessed</span>
        <span><strong>{status.alerts_dispatched}</strong> escalated</span>
        <span><strong>{status.below_threshold}</strong> suppressed</span>
      </div>}

      {status && <p className="stage-caption">
        Escalates at or above <strong>{status.min_severity}</strong> severity and <strong>{status.min_risk}</strong> network risk.
        Everything else is assessed and logged, not sent.
      </p>}

      <ol className="activity-log">
        {entries.map((entry, index) => (
          <li key={`${entry.at}-${entry.event_id ?? index}`}>
            <Icon name={ACTION_TONE[entry.action] === 'escalated' ? 'bolt' : 'check'} size={15} />
            <div>
              <strong className={ACTION_TONE[entry.action] === 'escalated' ? 'risk-text' : undefined}>
                {entry.event_id ? `${entry.event_id} · ` : ''}{ACTION_LABEL[entry.action] ?? entry.action}
              </strong>
              <p>
                {entry.reason}
                {/* Threshold reasons already quote the score; only add it when they don't. */}
                {entry.network_risk_score !== undefined && !/risk/.test(entry.reason ?? '') && ` · risk ${entry.network_risk_score}`}
                {entry.at && ` · ${String(entry.at).slice(11, 19)}`}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {!entries.length && !unavailable && <p className="stage-caption">No scans recorded yet. The first pass runs within one interval.</p>}
    </section>
  );
}
