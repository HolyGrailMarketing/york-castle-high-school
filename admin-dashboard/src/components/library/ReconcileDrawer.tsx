import { useState } from 'react';
import { stationClient, asStationError } from '../../lib/station/client';
import { dismissResult } from '../../lib/station/queue';
import type { OpResult, QueuedOp } from '../../lib/station/types';
import './ReconcileDrawer.css';

/**
 * Sorting out scans the school's records would not accept.
 *
 * Almost always this is the same book recorded as going to two different
 * students by two counters that could not see each other. Exactly one of them
 * is holding it, and the system does not know which - only the person who can
 * look at the book and the students does. So nothing is decided automatically:
 * the two accounts are put side by side in plain language and a human picks.
 *
 * Choosing wrongly moves who owes the replacement cost of a book, so the
 * wording avoids implying the school's records are the correct one.
 */

interface Entry {
  op: QueuedOp;
  result: OpResult;
  at: string;
}

interface Props {
  open: boolean;
  entries: Entry[];
  onClose: () => void;
  onResolved: () => void;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-JM', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const ReconcileDrawer = ({ open, entries, onClose, onResolved }: Props) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  /** Keep what this station scanned: close the other loan, open this one. */
  const force = async (entry: Entry) => {
    const reason = window.prompt(
      `You are saying ${entry.op.studentLabel ?? 'this student'} really has ${entry.op.barcode}.\n\n` +
      `The loan the records currently show will be closed and a new one opened. Both are flagged for the office to look at.\n\n` +
      `Who did you check with, or how do you know?`
    );
    if (reason === null) return;

    setBusy(entry.op.opId);
    setError(null);
    try {
      await stationClient.post('/loans/sync/resolve', {
        action: 'FORCE',
        opId: entry.op.opId,
        barcode: entry.op.barcode,
        copyId: entry.op.copyId,
        studentId: entry.op.studentId,
        condition: entry.op.condition,
        reason: reason.trim() || undefined,
      });
      await dismissResult(entry.op.opId);
      onResolved();
    } catch (e) {
      setError(asStationError(e).message);
    } finally {
      setBusy(null);
    }
  };

  /** Keep the school's record and drop this scan. Never silently. */
  const discard = async (entry: Entry) => {
    setBusy(entry.op.opId);
    setError(null);
    try {
      await stationClient.post('/loans/sync/resolve', {
        action: 'DISCARD',
        opId: entry.op.opId,
        reason: 'Kept the existing record at the desk.',
      }).catch(() => {
        // Only an audit record; losing it must not stop the librarian
        // clearing the item in front of them.
      });
      await dismissResult(entry.op.opId);
      onResolved();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="desk-drawer" role="dialog" aria-modal="true" aria-label="Scans that need attention">
      <div className="desk-drawer-panel">
        <header>
          <h2>Needs attention</h2>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </header>

        {error && <p className="rec-error">{error}</p>}

        {entries.length === 0 ? (
          <p className="rec-empty">Nothing to sort out. Everything scanned here has been saved.</p>
        ) : (
          <ul className="rec-list">
            {entries.map((entry, index) => {
              const d = entry.result.detail ?? {};
              const clash = entry.result.reason === 'COPY_ALREADY_ON_LOAN' || entry.result.reason === 'LATE_ARRIVAL';
              return (
                <li key={entry.op.opId} className="rec-item">
                  <p className="rec-count">{index + 1} of {entries.length}</p>
                  <h3>
                    <code>{entry.op.barcode}</code> {d.title ?? entry.result.title ?? ''}
                  </h3>

                  {clash ? (
                    <>
                      <p>
                        You scanned this out to <strong>{entry.op.studentLabel ?? 'a student'}</strong> at{' '}
                        <strong>{when(entry.op.clientAt)}</strong>.
                      </p>
                      <p className="rec-conflict">
                        The school&rsquo;s records say it is already out to{' '}
                        <strong>{d.heldBy ?? 'someone else'}{d.formClass ? `, ${d.formClass}` : ''}</strong>
                        {d.since ? <> since <strong>{when(d.since)}</strong></> : null}.
                      </p>
                      <p className="rec-ask">
                        Only one of these can be right, and only someone who can see the actual book
                        knows which. Find out who has it, then choose.
                      </p>
                      <div className="rec-actions">
                        <button
                          className="btn-primary"
                          disabled={busy === entry.op.opId}
                          onClick={() => void force(entry)}
                        >
                          {entry.op.studentLabel ? `${entry.op.studentLabel.split(',')[0]} has it` : 'My scan is right'}
                        </button>
                        <button
                          className="btn-secondary"
                          disabled={busy === entry.op.opId}
                          onClick={() => void discard(entry)}
                        >
                          {d.heldBy ? `${d.heldBy.split(' ')[0]} has it` : 'Keep the existing record'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p>{entry.result.message}</p>
                      <p className="rec-ask">
                        Scanned at {when(entry.op.clientAt)}
                        {entry.op.studentLabel ? ` for ${entry.op.studentLabel}` : ''}. Nothing was
                        changed in the school&rsquo;s records.
                      </p>
                      <div className="rec-actions">
                        <button
                          className="btn-secondary"
                          disabled={busy === entry.op.opId}
                          onClick={() => void discard(entry)}
                        >
                          I have dealt with it
                        </button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ReconcileDrawer;
