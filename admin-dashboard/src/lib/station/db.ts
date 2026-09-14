import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { QueuedOp, OpResult } from './types';
import type { BookCondition, CopyStatus, StudentVerification } from '../../types';

/**
 * The counter station's local store.
 *
 * Two quite different things live here, and the difference matters:
 *
 *   - The cached roster and copy index. Convenience. It can be thrown away and
 *     re-downloaded, and it IS thrown away on sign-out, because it is other
 *     people's data sitting on a shared library computer.
 *
 *   - The outbound queue. The only record of scans that have not reached the
 *     school yet. It survives sign-out, because losing it loses books.
 */

export interface CachedStudent {
  id: string;
  name: string;
  studentNumber: string | null;
  formClass: string | null;
  yearGroup: number | null;
  verification: StudentVerification;
  loanCap: number | null;
  activeLoanCount: number;
  outstandingTotal: number;
}

export interface CachedBook {
  id: string;
  title: string;
  subject: string;
  replacementCost: number;
  rentalFee: number;
  isActive: boolean;
}

export interface CachedCopy {
  id: string;
  bookId: string;
  barcode: string;
  status: CopyStatus;
  condition: BookCondition;
  withdrawnReason: string | null;
  currentLoanId: string | null;
  currentStudentId: string | null;
  dueAt: string | null;
}

export interface StationMeta {
  key: string;
  value: unknown;
}

interface StationDB extends DBSchema {
  meta: { key: string; value: StationMeta };
  students: { key: string; value: CachedStudent; indexes: { 'by-number': string; 'by-name': string } };
  books: { key: string; value: CachedBook };
  copies: { key: string; value: CachedCopy; indexes: { 'by-barcode': string; 'by-student': string } };
  opQueue: { key: string; value: QueuedOp; indexes: { 'by-state': string; 'by-seq': number } };
  opResults: { key: string; value: { opId: string; op: QueuedOp; result: OpResult; at: string } };
}

const DB_NAME = 'ychs-library-station';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<StationDB>> | null = null;

export const db = () => {
  if (!dbPromise) {
    dbPromise = openDB<StationDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        database.createObjectStore('meta', { keyPath: 'key' });

        const students = database.createObjectStore('students', { keyPath: 'id' });
        // Not unique: a student number can legitimately be blank on more than
        // one record until the office fills them in.
        students.createIndex('by-number', 'studentNumber');
        students.createIndex('by-name', 'name');

        database.createObjectStore('books', { keyPath: 'id' });

        const copies = database.createObjectStore('copies', { keyPath: 'id' });
        copies.createIndex('by-barcode', 'barcode', { unique: true });
        copies.createIndex('by-student', 'currentStudentId');

        const queue = database.createObjectStore('opQueue', { keyPath: 'opId' });
        queue.createIndex('by-state', 'state');
        queue.createIndex('by-seq', 'seq');

        database.createObjectStore('opResults', { keyPath: 'opId' });
      },
    });
  }
  return dbPromise;
};

/** Is IndexedDB usable at all? Private windows and locked-down browsers say no. */
export const isAvailable = async (): Promise<boolean> => {
  try {
    await db();
    return true;
  } catch {
    return false;
  }
};

export const getMeta = async <T>(key: string, fallback: T): Promise<T> => {
  try {
    const row = await (await db()).get('meta', key);
    return row === undefined ? fallback : (row.value as T);
  } catch {
    return fallback;
  }
};

export const setMeta = async (key: string, value: unknown): Promise<void> => {
  try {
    await (await db()).put('meta', { key, value });
  } catch {
    // Nothing sensible to do; the caller carries on with an in-memory value.
  }
};

/**
 * A stable name for this computer, so two counters can be told apart when their
 * records disagree about who has a book. It identifies the machine, not the
 * person signed in, so it survives sign-out.
 */
export const stationIdValue = async (): Promise<string> => {
  const existing = await getMeta<string | null>('stationId', null);
  if (existing) return existing;
  const id = `desk-${Math.random().toString(36).slice(2, 8)}`;
  await setMeta('stationId', id);
  return id;
};

/**
 * Allocate the next sequence number for this station.
 *
 * Read and write in one transaction so two scans in quick succession cannot be
 * handed the same number. This is what orders the queue - never the clock, so
 * that fixing the laptop's date mid-shift cannot reorder anything.
 */
export const nextSeq = async (): Promise<number> => {
  const database = await db();
  const tx = database.transaction('meta', 'readwrite');
  const store = tx.objectStore('meta');
  const current = ((await store.get('seq'))?.value as number) ?? 0;
  const next = current + 1;
  await store.put({ key: 'seq', value: next });
  await tx.done;
  return next;
};

// --- the cached snapshot ----------------------------------------------------

export const copyByBarcode = async (barcode: string): Promise<CachedCopy | undefined> => {
  const database = await db();
  return database.getFromIndex('copies', 'by-barcode', barcode);
};

export const studentById = (id: string) => db().then((d) => d.get('students', id));

export const copiesForStudent = async (studentId: string): Promise<CachedCopy[]> => {
  const database = await db();
  return database.getAllFromIndex('copies', 'by-student', studentId);
};

/** Find students by student number, or by a loose match on their name. */
export const findStudents = async (query: string): Promise<CachedStudent[]> => {
  const database = await db();
  const term = query.trim().toLowerCase();
  if (!term) return [];

  const exact = await database.getAllFromIndex('students', 'by-number', query.trim());
  if (exact.length) return exact;

  const all = await database.getAll('students');
  return all.filter((s) => s.name.toLowerCase().includes(term)).slice(0, 10);
};

// --- the queue --------------------------------------------------------------

export const putOp = async (op: QueuedOp) => (await db()).put('opQueue', op);
export const deleteOp = async (opId: string) => (await db()).delete('opQueue', opId);
export const getOp = async (opId: string) => (await db()).get('opQueue', opId);

/** Everything still waiting to reach the school, oldest first. */
export const pendingOps = async (): Promise<QueuedOp[]> => {
  const database = await db();
  const all = await database.getAllFromIndex('opQueue', 'by-seq');
  return all.filter((op) => op.state === 'pending' || op.state === 'sending' || op.state === 'error');
};

export const countPending = async (): Promise<number> => (await pendingOps()).length;

export const putResult = async (op: QueuedOp, result: OpResult) => {
  const database = await db();
  await database.put('opResults', { opId: op.opId, op, result, at: new Date().toISOString() });
};

export const allResults = async () => {
  const database = await db();
  const rows = await database.getAll('opResults');
  return rows.sort((a, b) => b.at.localeCompare(a.at));
};

export const deleteResult = async (opId: string) => (await db()).delete('opResults', opId);

/** Verdicts are the librarian's working list, not an archive. */
export const pruneResults = async (keepDays = 30) => {
  const cutoff = new Date(Date.now() - keepDays * 86400000).toISOString();
  const database = await db();
  for (const row of await database.getAll('opResults')) {
    if (row.at < cutoff && row.result.status !== 'rejected') {
      await database.delete('opResults', row.opId);
    }
  }
};

// --- clearing ---------------------------------------------------------------

/**
 * Drop the cached roster, keeping the queue.
 *
 * Run on sign-out. Other people's names and classes should not sit on a shared
 * library computer once whoever was using it has finished, but unsent scans
 * must never be lost to a sign-out.
 */
export const clearCachedData = async () => {
  const database = await db();
  await Promise.all([
    database.clear('students'),
    database.clear('books'),
    database.clear('copies'),
  ]);
  await setMeta('snapshotAt', null);
};

/** Everything, including unsent scans. Only from an explicit, warned action. */
export const clearEverything = async () => {
  const database = await db();
  await Promise.all([
    database.clear('students'),
    database.clear('books'),
    database.clear('copies'),
    database.clear('opQueue'),
    database.clear('opResults'),
    database.clear('meta'),
  ]);
};
