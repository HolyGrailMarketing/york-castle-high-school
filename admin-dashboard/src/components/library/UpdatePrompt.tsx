import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { subscribe } from '../../lib/station/queue';
import './UpdatePrompt.css';

/**
 * Offers a new version of the counter app, and refuses to install it while
 * scans are still waiting to be sent.
 *
 * Reloading the page is safe in itself - the queue is in IndexedDB, not memory -
 * but a reload mid-shift interrupts whoever is at the counter and leaves them
 * unsure whether the book they just scanned went through. Sending first and
 * updating second removes the doubt entirely.
 */
const UpdatePrompt = () => {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();
  const [pending, setPending] = useState(0);

  useEffect(() => subscribe((state) => setPending(state.pending.length)), []);

  if (!needRefresh) return null;

  return (
    <div className="upd" role="status">
      <div>
        <strong>A new version of the desk is ready.</strong>
        {pending > 0 ? (
          <span>
            {pending} scan{pending === 1 ? '' : 's'} still need sending. Send them first, then update.
          </span>
        ) : (
          <span>Updating takes a moment and nothing is lost.</span>
        )}
      </div>
      <div className="upd-actions">
        <button
          className="btn-primary"
          disabled={pending > 0}
          title={pending > 0 ? 'Send the waiting scans first' : undefined}
          onClick={() => void updateServiceWorker(true)}
        >
          Update now
        </button>
        <button className="btn-secondary" onClick={() => setNeedRefresh(false)}>Later</button>
      </div>
    </div>
  );
};

export default UpdatePrompt;
