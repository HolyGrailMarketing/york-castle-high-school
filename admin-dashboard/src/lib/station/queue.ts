import { stationClient, asStationError } from './client';
import type { OpKind, OpResult, QueuedOp } from './types';
import type { BookCondition } from '../../types';

/**
 * The counter station's outbound queue.
 *
 * Every scan goes through here, online or offline. There is deliberately no
 * separate "send it straight away" path: online simply means the queue drains
 * within a second. That way the code that runs during an outage is the same
 * code that runs every day, rather than a rarely-exercised branch that is first
 * tested on the worst possible morning.
 *
 * Right now the queue lives in memory and drains immediately. The offline phase
 * replaces the two storage functions with IndexedDB and adds the retry loop;
 * nothing above this file has to change, because callers only ever see
 * `enqueue()` and the subscription.
 */

const STATION_KEY = 'ychs.station.id';
const SEQ_KEY = 'ychs.station.seq';

/**
 * A stable name for this computer, so two counters can be told apart when
 * their records disagree. Kept in localStorage: it identifies the machine, not
 * the person signed in.
 */
export const stationId = (): string => {
  try {
    let id = localStorage.getItem(STATION_KEY);
    if (!id) {
      id = `desk-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(STATION_KEY, id);
    }
    return id;
  } catch {
    // Private mode. A per-session id is still better than none: operations
    // remain attributable within this sitting.
    return `desk-session-${Math.random().toString(36).slice(2, 8)}`;
  }
};

const nextSeq = (): number => {
  try {
    const next = Number(localStorage.getItem(SEQ_KEY) || '0') + 1;
    localStorage.setItem(SEQ_KEY, String(next));
    return next;
  } catch {
    return Date.now();
  }
};

const newOpId = (): string =>
  (crypto.randomUUID?.() ?? `op-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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
  results: { op: QueuedOp; result: OpResult }[];
  /** Rejected operations a person still has to decide about. */
  needsAttention: { op: QueuedOp; result: OpResult }[];
  lastError: string | null;
}

type Listener = (state: QueueState) => void;

const pending: QueuedOp[] = [];
const results: { op: QueuedOp; result: OpResult }[] = [];
const listeners = new Set<Listener>();
let lastError: string | null = null;

const snapshot = (): QueueState => ({
  pending: [...pending],
  results: [...results],
  needsAttention: results.filter((r) => r.result.status === 'rejected'),
  lastError,
});

const emit = () => { const s = snapshot(); listeners.forEach((l) => l(s)); };

export const subscribe = (listener: Listener): (() => void) => {
  listeners.add(listener);
  listener(snapshot());
  return () => { listeners.delete(listener); };
};

export const getState = snapshot;

/** Forget one verdict - used by the reconciliation view once it is dealt with. */
export const clearResult = (opId: string) => {
  const i = results.findIndex((r) => r.op.opId === opId);
  if (i !== -1) { results.splice(i, 1); emit(); }
};

/**
 * Record a scan and send it.
 *
 * Resolves with the server's verdict. A rejection is a resolved value, not a
 * thrown error: "that copy is already out to someone else" is an answer the
 * desk has to show, not a failure.
 */
export const enqueue = async (input: EnqueueInput): Promise<OpResult> => {
  const op: QueuedOp = {
    opId: newOpId(),
    seq: nextSeq(),
    stationId: stationId(),
    clientAt: new Date().toISOString(),
    state: 'pending',
    attempts: 0,
    ...input,
  };
  pending.push(op);
  emit();

  op.state = 'sending';
  op.attempts += 1;

  try {
    const path = op.kind === 'ISSUE' ? '/loans/issue' : '/loans/return';
    const { data } = await stationClient.post<OpResult>(path, {
      opId: op.opId,
      barcode: op.barcode,
      copyId: op.copyId,
      studentId: op.studentId,
      expectedLoanId: op.expectedLoanId,
      condition: op.condition,
      note: op.note,
      clientAt: op.clientAt,
      stationId: op.stationId,
    });
    op.state = 'applied';
    lastError = null;
    finish(op, data);
    return data;
  } catch (error) {
    // A 409 is the engine's considered verdict, carried on the error because of
    // the status code. It is a result, not a fault.
    const response = (error as { response?: { status?: number; data?: OpResult } }).response;
    if (response?.status === 409 && response.data?.status) {
      op.state = 'rejected';
      lastError = null;
      finish(op, response.data);
      return response.data;
    }

    const failure = asStationError(error);
    op.state = 'error';
    lastError = failure.message;
    const result: OpResult = {
      opId: op.opId,
      status: 'error',
      retryable: true,
      message: failure.message,
      barcode: op.barcode,
    };
    finish(op, result);
    throw failure;
  }
};

const finish = (op: QueuedOp, result: OpResult) => {
  const i = pending.findIndex((p) => p.opId === op.opId);
  if (i !== -1) pending.splice(i, 1);
  results.unshift({ op, result });
  // The recent list is for the librarian's eye, not an archive.
  if (results.length > 50) results.length = 50;
  emit();
};

/**
 * Undo a scan that has already been sent, by sending its opposite.
 *
 * Not a delete: the school's records already show the book moving, so the
 * correction has to be another movement. Once the offline queue exists an
 * unsent operation is simply dropped instead.
 */
export const compensate = async (entry: { op: QueuedOp; result: OpResult }): Promise<OpResult> => {
  if (entry.result.status !== 'applied') {
    clearResult(entry.op.opId);
    return entry.result;
  }
  const undo = await enqueue(
    entry.op.kind === 'ISSUE'
      ? { kind: 'RETURN', barcode: entry.op.barcode, expectedLoanId: entry.result.loanId, note: 'Undone at the desk.' }
      : { kind: 'ISSUE', barcode: entry.op.barcode, studentId: entry.result.student?.id, studentLabel: entry.result.student?.name, note: 'Undone at the desk.' }
  );
  clearResult(entry.op.opId);
  return undo;
};
