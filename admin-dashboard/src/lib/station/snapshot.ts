import { stationClient, asStationError } from './client';
import { db, setMeta, getMeta, clearCachedData, type CachedCopy, type CachedStudent } from './db';
import { noteServerTime } from './clock';

/**
 * Keeping the station's copy of the roster and the book list up to date.
 *
 * Fetched with a plain request and stored in IndexedDB rather than left to the
 * service worker. The librarian has to be able to see how old this data is, and
 * a cache-first strategy gives you data of unknown age with no way to say so.
 */

/** Must match SNAPSHOT_VERSION in the backend controller. */
const SNAPSHOT_VERSION = 1;

/** Refresh interval while the desk is open and online. */
export const REFRESH_MS = 5 * 60 * 1000;

/** Past this, the data is old enough that the librarian must be warned. */
export const STALE_MS = 24 * 60 * 60 * 1000;

export interface StationTerm {
  academicYear: string;
  term: number | null;
  endsOn: string;
}

export interface StationPolicy {
  defaultLoanCap: number;
  blockOnUnverified: boolean;
  warnOnChargesOver: number;
}

export interface SnapshotState {
  snapshotAt: string | null;
  term: StationTerm | null;
  policy: StationPolicy;
  studentCount: number;
  copyCount: number;
}

const DEFAULT_POLICY: StationPolicy = {
  defaultLoanCap: 8,
  blockOnUnverified: true,
  warnOnChargesOver: 0,
};

export const readState = async (): Promise<SnapshotState> => {
  const database = await db();
  const [snapshotAt, term, policy, studentCount, copyCount] = await Promise.all([
    getMeta<string | null>('snapshotAt', null),
    getMeta<StationTerm | null>('term', null),
    getMeta<StationPolicy>('policy', DEFAULT_POLICY),
    database.count('students'),
    database.count('copies'),
  ]);
  return { snapshotAt, term, policy, studentCount, copyCount };
};

export const isStale = (snapshotAt: string | null): boolean =>
  !snapshotAt || Date.now() - Date.parse(snapshotAt) > STALE_MS;

/**
 * Pull whatever has changed since last time, or everything if the server says
 * a delta will not do.
 */
export const refresh = async (force = false): Promise<SnapshotState> => {
  const since = force ? null : await getMeta<string | null>('snapshotAt', null);

  const response = await stationClient.get('/library/station/snapshot', {
    params: since ? { since, v: SNAPSHOT_VERSION } : {},
  });
  noteServerTime(response.headers['x-server-time']);
  const data = response.data;

  const database = await db();

  // A full snapshot replaces rather than merges. Merging would leave behind
  // rows the server no longer has - including students removed under a
  // data-protection erasure.
  if (data.full) await clearCachedData();

  const tx = database.transaction(['students', 'books', 'copies'], 'readwrite');
  const students = tx.objectStore('students');
  const books = tx.objectStore('books');
  const copies = tx.objectStore('copies');

  for (const s of data.students as CachedStudent[]) await students.put(s);
  for (const b of data.books) await books.put(b);
  for (const c of data.copies as CachedCopy[]) await copies.put(c);

  // Tombstones, so a delta can remove as well as add.
  for (const id of data.removed?.students ?? []) await students.delete(id);
  for (const id of data.removed?.copies ?? []) await copies.delete(id);

  await tx.done;

  await Promise.all([
    setMeta('snapshotAt', data.serverTime),
    setMeta('term', data.term),
    setMeta('policy', data.policy ?? DEFAULT_POLICY),
  ]);

  return readState();
};

/** Refresh, but never let a failure take the desk down - it works from cache. */
export const refreshQuietly = async (force = false): Promise<{ state: SnapshotState; error: string | null }> => {
  try {
    return { state: await refresh(force), error: null };
  } catch (error) {
    return { state: await readState(), error: asStationError(error).message };
  }
};

/**
 * How many books this student currently has, counted from the cached copies.
 *
 * Deliberately not the snapshot's activeLoanCount: issuing a book changes the
 * copy, not the student row, so that figure does not move in a delta. Counting
 * copies is what keeps the loan-limit check honest between full refreshes.
 */
export const liveLoanCount = async (studentId: string): Promise<number> => {
  const database = await db();
  const held = await database.getAllFromIndex('copies', 'by-student', studentId);
  return held.length;
};
