import {
  nextSeq, putOp, deleteOp, putResult, deleteResult, pendingOps, allResults,
  stationIdValue, copyByBarcode, isAvailable,
} from './db';
import { drain, isReachable } from './sync';
import { correctedNow } from './clock';
import type { OpKind, OpResult, QueuedOp } from './types';
import type { BookCondition } from '../../types';

/**
 * The counter station's outbound queue.
 *
 * Every scan goes through here whether the internet is up or not. There is no
 * separate "send it now" path: online just means the queue empties within a
 * second. The code that runs during an outage is therefore the same code that
 * runs every day, rather than a branch first exercised on the worst morning of
 * the year.
 *
 * A scan is written to IndexedDB before anything is sent, so closing the laptop,
 * losing the tab or signing out cannot lose it.
 */

export interface EnqueueInput {
  kind: OpKind;
  barcode: string;
  copyId?: string;
  studentId?: string;
  studentLabel?: string;
  expectedLoanId?: string | null;
  condition?: BookCondition;
  note?: string;
}

export interface QueueState {
  pending: QueuedOp[];
  results: { op: QueuedOp; result: OpResult; at: string }[];
  needsAttention: { op: QueuedOp; result: OpResult; at: string }[];
  online: boolean;
  syncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  sessionExpired: boolean;
}

type Listener = (state: QueueState) => void;

const listeners = new Set<Listener>();
let state: QueueState = {
  pending: [], results: [], needsAttention: [],
  online: navigator.onLine, syncing: false,
  lastSyncAt: null, lastError: null, sessionExpired: false,
};

const emit = () => { const s = state; listeners.forEach((l) => l(s)); };

const reload = async () => {
  const [pending, results] = await Promise.all([pendingOps(), allResults()]);
  state = {
    ...state,
    pending,
    results,
    needsAttention: results.filter((r) => r.result.status === 'rejected'),
  };
  emit();
};

export const subscribe = (listener: Listener): (() => void) => {
  listeners.add(listener);
  listener(state);
  return () => { listeners.delete(listener); };
};

export const getState = () => state;

const newOpId = (): string =>
  crypto.randomUUID?.() ?? `op-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Record a scan.
 *
 * Returns as soon as it is safely on disk, NOT when the server has seen it -
 * the librarian must never be left waiting on a network that may not be there.
 * The verdict arrives later through the subscription.
 */
export const enqueue = async (input: EnqueueInput): Promise<QueuedOp> => {
  const op: QueuedOp = {
    opId: newOpId(),
    seq: await nextSeq(),
    stationId: await stationIdValue(),
    // Corrected for how wrong this computer's clock is. Ordering never depends
    // on it; that is what seq is for.
    clientAt: correctedNow().toISOString(),
    state: 'pending',
    attempts: 0,
    ...input,
  };

  await putOp(op);
  await reload();

  // Try immediately. If it fails the operation simply stays queued.
  void syncNow();
  return op;
};

/** Drain the queue, updating the shared state as it goes. */
export const syncNow = async (): Promise<void> => {
  if (state.syncing) return;
  state = { ...state, syncing: true };
  emit();

  try {
    const outcome = await drain();
    state = {
      ...state,
      syncing: false,
      lastSyncAt: outcome.attempted > 0 || outcome.error === null ? new Date().toISOString() : state.lastSyncAt,
      lastError: outcome.error,
      sessionExpired: outcome.sessionExpired,
      online: outcome.error === null,
    };
  } catch (error) {
    state = { ...state, syncing: false, lastError: (error as Error).message };
  }
  await reload();
};

/** Forget a verdict once the librarian has dealt with it. */
export const dismissResult = async (opId: string) => {
  await deleteResult(opId);
  await reload();
};

/**
 * Undo a scan.
 *
 * If it has not been sent yet it is simply removed - nothing ever knew about
 * it. If the school has already recorded it, the correction has to be another
 * movement, because the records already show the book moving.
 */
export const undo = async (entry: { op: QueuedOp; result?: OpResult }): Promise<void> => {
  const stillQueued = state.pending.find((p) => p.opId === entry.op.opId);
  if (stillQueued) {
    await deleteOp(entry.op.opId);
    await reload();
    return;
  }

  if (!entry.result || entry.result.status !== 'applied') {
    await dismissResult(entry.op.opId);
    return;
  }

  const copy = await copyByBarcode(entry.op.barcode);
  await enqueue(
    entry.op.kind === 'ISSUE'
      ? {
          kind: 'RETURN',
          barcode: entry.op.barcode,
          copyId: entry.op.copyId ?? copy?.id,
          expectedLoanId: entry.result.loanId,
          note: 'Undone at the desk.',
        }
      : {
          kind: 'ISSUE',
          barcode: entry.op.barcode,
          copyId: entry.op.copyId ?? copy?.id,
          studentId: entry.result.student?.id,
          studentLabel: entry.result.student?.name,
          note: 'Undone at the desk.',
        }
  );
  await dismissResult(entry.op.opId);
};

/**
 * A plain-paper log of today's scans.
 *
 * A laptop that is stolen, dropped or simply will not boot should not cost the
 * school a day's records. This is the cheapest possible insurance and the first
 * thing a librarian who has lived through an outage asks for.
 */
export const printableLog = async (): Promise<string> => {
  const [pending, results] = await Promise.all([pendingOps(), allResults()]);
  const lines = [
    `York Castle High School - counter log`,
    `Station ${await stationIdValue()}`,
    `Printed ${new Date().toLocaleString('en-JM')}`,
    '',
    `WAITING TO BE SAVED (${pending.length})`,
    ...pending.map((op) =>
      `  ${new Date(op.clientAt).toLocaleTimeString('en-JM')}  ${op.kind === 'ISSUE' ? 'OUT' : 'IN '}  ${op.barcode}  ${op.studentLabel ?? ''}`),
    '',
    `ALREADY SAVED (${results.length})`,
    ...results.map((r) =>
      `  ${new Date(r.op.clientAt).toLocaleTimeString('en-JM')}  ${r.op.kind === 'ISSUE' ? 'OUT' : 'IN '}  ${r.op.barcode}  ${r.result.status}  ${r.op.studentLabel ?? ''}`),
  ];
  return lines.join('\n');
};

/**
 * Start watching the connection.
 *
 * Three triggers: the browser saying it is back online, a heartbeat that
 * catches the captive-portal case the browser gets wrong, and a timer while
 * anything is waiting.
 */
export const startWatching = (): (() => void) => {
  let timer: number | undefined;
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    const waiting = state.pending.length;
    if (waiting > 0) {
      const reachable = await isReachable();
      state = { ...state, online: reachable };
      emit();
      if (reachable) await syncNow();
    } else {
      state = { ...state, online: navigator.onLine };
      emit();
    }
    if (!stopped) timer = window.setTimeout(tick, 30000);
  };

  const onOnline = () => { state = { ...state, online: true }; emit(); void syncNow(); };
  const onOffline = () => { state = { ...state, online: false }; emit(); };

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  // Warn before closing a tab that is still holding scans.
  const onUnload = (e: BeforeUnloadEvent) => {
    if (state.pending.length > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', onUnload);

  void (async () => {
    if (!(await isAvailable())) {
      state = {
        ...state,
        lastError: 'This browser will not let the page save anything on this computer, so scans cannot be kept if the internet drops. Use a normal window rather than a private one.',
      };
      emit();
      return;
    }
    await reload();
    void syncNow();
    timer = window.setTimeout(tick, 30000);
  })();

  return () => {
    stopped = true;
    if (timer) window.clearTimeout(timer);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    window.removeEventListener('beforeunload', onUnload);
  };
};

export { stationIdValue };
