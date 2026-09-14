import { stationClient, asStationError, SessionExpiredError } from './client';
import { noteServerTime } from './clock';
import {
  pendingOps, putOp, deleteOp, putResult, countPending, stationIdValue,
} from './db';
import type { OpResult, QueuedOp } from './types';

/**
 * Getting what is on this computer into the school's records.
 *
 * Runs whenever there is anything waiting and the connection looks usable. Every
 * operation carries the id it was given when it was scanned, so sending the
 * same thing twice is harmless - the server recognises it and returns the loan
 * it already made.
 */

/** The server refuses more than this in one request. */
const CHUNK = 200;

/** Backoff between failed attempts, capped so a long outage still retries often. */
const BACKOFF_MS = [1000, 2000, 5000, 10000, 20000, 30000, 60000];

export interface SyncOutcome {
  attempted: number;
  applied: number;
  rejected: number;
  failed: number;
  error: string | null;
  sessionExpired: boolean;
}

let running = false;

/**
 * Is the connection actually usable?
 *
 * navigator.onLine only says whether the machine thinks it has a network. On a
 * school wifi with a captive portal it reports true while every request dies,
 * so the queue would sit there looking healthy. A cheap request to /health is
 * what actually answers the question.
 */
export const isReachable = async (): Promise<boolean> => {
  if (!navigator.onLine) return false;
  try {
    const response = await stationClient.get('/../health', { timeout: 5000 });
    noteServerTime(response.headers['x-server-time']);
    return true;
  } catch {
    return false;
  }
};

export const drain = async (): Promise<SyncOutcome> => {
  const outcome: SyncOutcome = { attempted: 0, applied: 0, rejected: 0, failed: 0, error: null, sessionExpired: false };
  if (running) return outcome;
  running = true;

  try {
    const waiting = await pendingOps();
    if (waiting.length === 0) return outcome;

    for (let i = 0; i < waiting.length; i += CHUNK) {
      const batch = waiting.slice(i, i + CHUNK);
      outcome.attempted += batch.length;

      for (const op of batch) await putOp({ ...op, state: 'sending' });

      try {
        const response = await stationClient.post('/loans/sync', {
          stationId: await stationIdValue(),
          clientNow: new Date().toISOString(),
          ops: batch.map(forWire),
        });
        noteServerTime(response.headers['x-server-time']);

        const byId = new Map<string, OpResult>(
          (response.data.results as OpResult[]).map((r) => [r.opId, r])
        );

        for (const op of batch) {
          const result = byId.get(op.opId);
          if (!result) {
            // The server did not mention it. Leave it queued and try again
            // rather than assuming either outcome.
            await putOp({ ...op, state: 'pending', attempts: op.attempts + 1 });
            outcome.failed += 1;
            continue;
          }
          if (result.status === 'error') {
            await putOp({ ...op, state: 'error', attempts: op.attempts + 1, lastError: result.message });
            outcome.failed += 1;
            continue;
          }
          // Applied or rejected: either way it is settled, so it leaves the
          // queue and becomes a verdict the librarian can see.
          await putResult({ ...op, state: result.status }, result);
          await deleteOp(op.opId);
          if (result.status === 'applied') outcome.applied += 1;
          else outcome.rejected += 1;
        }
      } catch (error) {
        const failure = asStationError(error);
        // Put the whole batch back. Nothing here is lost, and a session that
        // expired mid-shift must not cost the librarian their scans.
        for (const op of batch) {
          await putOp({ ...op, state: 'pending', attempts: op.attempts + 1, lastError: failure.message });
        }
        outcome.failed += batch.length;
        outcome.error = failure.message;
        outcome.sessionExpired = failure instanceof SessionExpiredError;
        break;
      }
    }
    return outcome;
  } finally {
    running = false;
  }
};

const forWire = (op: QueuedOp) => ({
  opId: op.opId,
  seq: op.seq,
  kind: op.kind,
  barcode: op.barcode,
  copyId: op.copyId,
  studentId: op.studentId,
  expectedLoanId: op.expectedLoanId,
  condition: op.condition,
  note: op.note,
  clientAt: op.clientAt,
  stationId: op.stationId,
});

export const backoffFor = (attempts: number) =>
  BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)];

export { countPending };
