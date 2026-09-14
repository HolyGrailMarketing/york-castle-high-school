import type { QueueState } from '../../lib/station/queue';
import type { SnapshotState } from '../../lib/station/snapshot';
import { isStale } from '../../lib/station/snapshot';
import Hint from '../Hint';
import './StationStatusBar.css';

/**
 * The bar at the top of the counter screen.
 *
 * Rendered only on this page. The rest of the admin portal needs a connection,
 * and a permanent offline indicator everywhere would imply otherwise.
 *
 * The state is never signalled by colour alone: each one leads with a word,
 * because this is read at a glance across a counter and some people cannot
 * tell the green from the amber.
 */

const ago = (iso: string | null): string => {
  if (!iso) return 'never';
  const seconds = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${Math.round(hours / 24)} days ago`;
};

interface Props {
  queue: QueueState | null;
  snapshot: SnapshotState | null;
  refreshing: boolean;
  skew: string | null;
  onSync: () => void;
  onRefresh: () => void;
  onReview: () => void;
  onPrintLog: () => void;
}

const StationStatusBar = ({ queue, snapshot, refreshing, skew, onSync, onRefresh, onReview, onPrintLog }: Props) => {
  const pending = queue?.pending.length ?? 0;
  const attention = queue?.needsAttention.length ?? 0;
  const online = queue?.online ?? navigator.onLine;
  const stale = isStale(snapshot?.snapshotAt ?? null);

  // The oldest thing still waiting. Past a few hours this stops being a blip
  // and starts being something the librarian has to act on before going home.
  const oldestWaiting = queue?.pending.reduce<string | null>(
    (oldest, op) => (oldest === null || op.clientAt < oldest ? op.clientAt : oldest),
    null
  );
  const waitingHours = oldestWaiting ? (Date.now() - Date.parse(oldestWaiting)) / 3600000 : 0;

  const tone = attention > 0 ? 'attention' : !online || pending > 0 ? 'offline' : 'online';

  return (
    <div className={`ssb ssb--${tone}`} role="status" aria-live="polite">
      <div className="ssb-main">
        {tone === 'online' && (
          <>
            <strong>Online — every scan saved.</strong>
            <span>Last sent {ago(queue?.lastSyncAt ?? null)}.</span>
          </>
        )}
        {tone === 'offline' && (
          <>
            <strong>
              {online ? 'Sending…' : 'Offline'} — {pending} scan{pending === 1 ? '' : 's'} waiting
              <Hint term="pending-scans" />
            </strong>
            <span>
              They are safe on this computer. Reconnect before you finish for the day.
            </span>
          </>
        )}
        {tone === 'attention' && (
          <>
            <strong>
              {attention} scan{attention === 1 ? ' needs' : 's need'} attention
              <Hint term="needs-attention" />
            </strong>
            <span>The school&rsquo;s records disagree with what was scanned here.</span>
          </>
        )}
      </div>

      <div className="ssb-actions">
        {attention > 0 && <button className="btn-primary" onClick={onReview}>Review</button>}
        {pending > 0 && (
          <>
            <button className="btn-secondary" onClick={onSync} disabled={queue?.syncing}>
              {queue?.syncing ? 'Sending…' : 'Send now'}
            </button>
            <button className="btn-secondary" onClick={onPrintLog}>Print today&rsquo;s scans</button>
          </>
        )}
        <button className="btn-secondary" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh station data'}
        </button>
      </div>

      <div className="ssb-meta">
        <span>
          Class list and book list on this computer: {snapshot?.studentCount ?? 0} students,{' '}
          {snapshot?.copyCount ?? 0} copies, updated {ago(snapshot?.snapshotAt ?? null)}.
        </span>
        {snapshot?.term && <span>Books are due {new Date(snapshot.term.endsOn).toLocaleDateString()}.</span>}
      </div>

      {queue?.sessionExpired && (
        <p className="ssb-alert">
          <strong>Your sign-in has expired.</strong> Nothing has been lost. Sign in again in another
          tab, then press Send now — the {pending} waiting scan{pending === 1 ? '' : 's'} will go through.
        </p>
      )}

      {stale && (
        <p className="ssb-alert">
          <strong>The class list on this computer is more than a day old.</strong> Students who
          signed up since then, and books other counters have taken back, will not show. Press
          Refresh station data before issuing anything.
        </p>
      )}

      {waitingHours > 4 && (
        <p className="ssb-alert">
          <strong>Some scans have been waiting more than {Math.floor(waitingHours)} hours.</strong>{' '}
          They only exist on this computer. Get it back on the internet, or print today&rsquo;s scans
          before shutting down.
        </p>
      )}

      {queue?.lastError && !queue.sessionExpired && <p className="ssb-alert">{queue.lastError}</p>}
      {skew && <p className="ssb-note">{skew}</p>}
    </div>
  );
};

export default StationStatusBar;
