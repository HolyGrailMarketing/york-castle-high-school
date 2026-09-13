import { useCallback, useEffect, useRef, useState } from 'react';
import { asStationError } from '../lib/station/client';
import {
  enqueue, subscribe, dismissResult, undo as undoOp, syncNow,
  startWatching, printableLog, stationIdValue, type QueueState,
} from '../lib/station/queue';
import { copyByBarcode, findStudents, copiesForStudent, type CachedCopy, type CachedStudent } from '../lib/station/db';
import { readState, refreshQuietly, isStale, liveLoanCount, REFRESH_MS, type SnapshotState } from '../lib/station/snapshot';
import { loadOffset, skewWarning } from '../lib/station/clock';
import StationStatusBar from '../components/library/StationStatusBar';
import ReconcileDrawer from '../components/library/ReconcileDrawer';
import UpdatePrompt from '../components/library/UpdatePrompt';
import type { OpResult, QueuedOp } from '../lib/station/types';
import type { BookCondition } from '../types';
import PageHelp from '../components/PageHelp';
import Hint from '../components/Hint';
import './LibraryDesk.css';

const CONDITIONS: { value: BookCondition; key: string }[] = [
  { value: 'GOOD', key: 'G' },
  { value: 'FAIR', key: 'F' },
  { value: 'POOR', key: 'P' },
  { value: 'DAMAGED', key: 'D' },
];

/** A wedge scanner double-fires; ignore the same code twice in quick succession. */
const DUPLICATE_SCAN_MS = 2000;
/** How long the Undo button stays on a scan. */
const UNDO_MS = 10000;

const money = (n: number) =>
  new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD', maximumFractionDigits: 0 }).format(n);

/**
 * Distinct tones for success and failure.
 *
 * The librarian is looking at the student and the book, not at the screen, so
 * the first thing they learn about a scan has to be something they can hear.
 */
const beep = (ok: boolean, muted: boolean) => {
  if (muted) return;
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (ok ? 0.12 : 0.42));
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.12 : 0.42));
    osc.onended = () => ctx.close();
  } catch {
    // No audio available. The screen still says what happened.
  }
};

/** What the desk shows for the student currently on screen. */
interface DeskStudent extends CachedStudent {
  held: CachedCopy[];
}

const LibraryDesk = () => {
  const [scan, setScan] = useState('');
  const [student, setStudent] = useState<DeskStudent | null>(null);
  const [candidates, setCandidates] = useState<CachedStudent[]>([]);
  const [condition, setCondition] = useState<BookCondition>('GOOD');
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueState | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotState | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [skew, setSkew] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const titlesRef = useRef<Map<string, string>>(new Map());

  // Subscribe to the queue, start the connection watcher, and pull the roster.
  useEffect(() => {
    const unsubscribe = subscribe(setQueue);
    const stopWatching = startWatching();
    void (async () => {
      await loadOffset();
      setSkew(skewWarning());
      const current = await readState();
      setSnapshot(current);
      // A first visit has nothing cached, so fetch before the librarian starts.
      if (!current.snapshotAt) await doRefresh(true);
    })();
    return () => { unsubscribe(); stopWatching(); };
  }, []);

  // Keep the cache fresh while the desk is open.
  useEffect(() => {
    const timer = window.setInterval(() => { void doRefresh(false); }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const doRefresh = async (force: boolean) => {
    setRefreshing(true);
    const { state, error } = await refreshQuietly(force);
    setSnapshot(state);
    setSkew(skewWarning());
    setRefreshing(false);
    if (error && force) setBlocked(`Could not refresh the station data: ${error}`);
    await cacheTitles();
  };

  /** Book titles, so the feed can name a book without a round trip. */
  const cacheTitles = async () => {
    const { db } = await import('../lib/station/db');
    const database = await db();
    const books = await database.getAll('books');
    titlesRef.current = new Map(books.map((b) => [b.id, b.title]));
  };

  /**
   * Keep the scan box focused. A wedge scanner types into whatever has focus,
   * so a box that has quietly lost it means the barcode lands nowhere and the
   * librarian scans the same book three times wondering why.
   */
  const refocus = useCallback(() => {
    if (document.querySelector('.desk-drawer')) return;
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    refocus();
    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('button, a, select, input, textarea')) return;
      refocus();
    };
    window.addEventListener('focus', refocus);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('focus', refocus);
      document.removeEventListener('click', onClick);
    };
  }, [refocus]);

  // Esc clears the student; G/F/P/D set the condition for the next return.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setStudent(null); setCandidates([]); setBlocked(null); refocus(); return; }
      if (e.target !== inputRef.current || scan !== '') return;
      const match = CONDITIONS.find((c) => c.key === e.key.toUpperCase());
      if (match) { setCondition(match.value); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scan, refocus]);

  /** Build the card from the cache, so it works with no connection. */
  const pinStudent = async (cached: CachedStudent) => {
    const held = await copiesForStudent(cached.id);
    const pinned: DeskStudent = { ...cached, held };
    setStudent(pinned);
    setCandidates([]);
    await checkPolicy(pinned);
  };

  const repinStudent = async (id: string) => {
    const { studentById } = await import('../lib/station/db');
    const cached = await studentById(id);
    if (cached) await pinStudent(cached);
  };

  /**
   * Policy is decided here, at the counter, against the cached snapshot.
   *
   * This is the one moment it can be enforced: the book is still on this side
   * of the desk. Once a scan reaches the server the book has gone, and the
   * server records it regardless rather than losing the only trace of it.
   */
  const checkPolicy = async (s: DeskStudent) => {
    const policy = snapshot?.policy;
    if ((policy?.blockOnUnverified ?? true) && s.verification !== 'VERIFIED') {
      setBlocked(`${s.name} has not been confirmed by the office. Send them to the office to confirm their year and class before giving them any books.`);
      return;
    }
    const cap = s.loanCap ?? policy?.defaultLoanCap ?? 8;
    const out = await liveLoanCount(s.id);
    if (out >= cap) {
      setBlocked(`${s.name} already has ${out} books out, which is the limit. Take some back first.`);
      return;
    }
    const threshold = policy?.warnOnChargesOver ?? 0;
    if (threshold > 0 && s.outstandingTotal > threshold) {
      setBlocked(`${s.name} owes ${money(s.outstandingTotal)}. You can still lend to them, but tell them to settle it at the bursary.`);
      return;
    }
    setBlocked(null);
  };

  const handleScan = async (raw: string) => {
    const code = raw.trim();
    if (!code) return;

    // Wedges fire twice. Two identical codes inside two seconds is one book.
    const now = Date.now();
    if (lastScanRef.current.code === code && now - lastScanRef.current.at < DUPLICATE_SCAN_MS) {
      setScan('');
      return;
    }
    lastScanRef.current = { code, at: now };
    setScan('');

    try {
      // Everything is resolved from the cache on this computer, so a scan works
      // exactly the same with or without a connection.
      const copy = await copyByBarcode(code);

      if (!copy) {
        const matches = await findStudents(code);
        if (matches.length === 0) {
          beep(false, muted);
          setBlocked(`Nothing found for "${code}". Try their student number, or their name. If they are new, the station data may need refreshing.`);
          return;
        }
        if (matches.length === 1) { await pinStudent(matches[0]); beep(true, muted); return; }
        setCandidates(matches);
        return;
      }

      if (copy.status === 'WITHDRAWN') {
        beep(false, muted);
        setBlocked(`${copy.barcode} was withdrawn and cannot be lent again.${copy.withdrawnReason ? ` Reason: ${copy.withdrawnReason}` : ''}`);
        return;
      }

      // Out to someone? Then this is a book coming back, and no student needs
      // to be on screen - that is how a returns pile is actually worked through.
      if (copy.currentLoanId) {
        await enqueue({
          kind: 'RETURN',
          barcode: copy.barcode,
          copyId: copy.id,
          expectedLoanId: copy.currentLoanId,
          condition,
        });
        beep(true, muted);
        if (student && copy.currentStudentId === student.id) await repinStudent(student.id);
        return;
      }

      if (!student) {
        beep(false, muted);
        setBlocked(`${titlesRef.current.get(copy.bookId) ?? copy.barcode} is not out to anyone. To give it to a student, scan the student first.`);
        return;
      }
      if (blocked) { beep(false, muted); return; }

      await enqueue({
        kind: 'ISSUE',
        barcode: copy.barcode,
        copyId: copy.id,
        studentId: student.id,
        studentLabel: `${student.name}${student.formClass ? `, ${student.formClass}` : ''}`,
        condition,
      });
      beep(true, muted);
      await repinStudent(student.id);
    } catch (error) {
      beep(false, muted);
      setBlocked(asStationError(error).message);
    } finally {
      setTimeout(refocus, 0);
    }
  };

  const handleUndo = async (entry: { op: QueuedOp; result?: OpResult }) => {
    await undoOp(entry);
    if (student) await repinStudent(student.id);
    refocus();
  };

  const printLog = async () => {
    const text = await printableLog();
    const w = window.open('', '_blank');
    if (!w) { setBlocked('Your browser blocked the print window. Allow pop-ups for this page.'); return; }
    w.document.write(`<pre style="font:12px/1.4 ui-monospace,monospace">${text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))}</pre>`);
    w.document.close();
    w.print();
  };

  const canUndo = (op: QueuedOp) => Date.now() - new Date(op.clientAt).getTime() < UNDO_MS;

  // Waiting scans first - they are the ones the librarian has to care about.
  const feed = [
    ...(queue?.pending ?? []).map((op) => ({ op, result: undefined as OpResult | undefined, waiting: true })),
    ...(queue?.results ?? []).map((r) => ({ op: r.op, result: r.result, waiting: false })),
  ];

  return (
    <div className="desk-page">
      <PageHelp pageKey="library/desk" />

      <UpdatePrompt />

      <StationStatusBar
        queue={queue}
        snapshot={snapshot}
        refreshing={refreshing}
        skew={skew}
        onSync={() => void syncNow()}
        onRefresh={() => void doRefresh(true)}
        onReview={() => setReconcileOpen(true)}
        onPrintLog={() => void printLog()}
      />

      <div className="page-header">
        <h1>Issue &amp; Return</h1>
        <div className="desk-header-actions">
          <button className="btn-secondary" onClick={() => setMuted(!muted)} aria-pressed={muted}>
            {muted ? 'Sound off' : 'Sound on'}
          </button>
        </div>
      </div>

      {/* The scan box. Always focused, always obviously armed. */}
      <form
        className="desk-scan"
        onSubmit={(e) => { e.preventDefault(); void handleScan(scan); }}
      >
        <input
          ref={inputRef}
          className="desk-scan-input"
          value={scan}
          onChange={(e) => setScan(e.target.value)}
          placeholder="Scan a book or a student card"
          aria-label="Scan a book barcode or a student number"
          autoComplete="off"
          spellCheck={false}
        />
        <span className="desk-ready">Ready to scan</span>
      </form>

      <div className="desk-condition">
        <span>Condition for the next book back:</span>
        {CONDITIONS.map((c) => (
          <button
            key={c.value}
            type="button"
            className={`desk-cond ${condition === c.value ? 'is-on' : ''} ${c.value === 'DAMAGED' ? 'is-damage' : ''}`}
            onClick={() => { setCondition(c.value); refocus(); }}
          >
            {c.value[0] + c.value.slice(1).toLowerCase()} <kbd>{c.key}</kbd>
          </button>
        ))}
        {condition === 'DAMAGED' && (
          <span className="desk-cond-warning">
            The next book scanned back will be charged for and sent for repair.
          </span>
        )}
      </div>

      {blocked && (
        <div className="desk-banner desk-banner--block" role="alert">
          <strong>{blocked}</strong>
          <button className="btn-secondary" onClick={() => { setBlocked(null); refocus(); }}>Dismiss</button>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="desk-candidates">
          <p>More than one student matches. Which one?</p>
          <ul>
            {candidates.map((c) => (
              <li key={c.id}>
                <button onClick={() => { void pinStudent(c); refocus(); }}>
                  <strong>{c.name}</strong> · {c.formClass ?? 'no class'} · {c.studentNumber ?? 'no number'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {student && (
        <div className={`desk-student ${student.verification !== 'VERIFIED' ? 'is-unverified' : ''}`}>
          <div className="desk-student-main">
            <h2>{student.name}</h2>
            <p>
              {student.formClass ?? 'No class'} · {student.studentNumber ?? 'No student number'} ·{' '}
              {student.held.length} book{student.held.length === 1 ? '' : 's'} out ·{' '}
              {student.outstandingTotal > 0 ? `owes ${money(student.outstandingTotal)}` : 'owes nothing'}
            </p>
            <span className={`desk-verify desk-verify--${student.verification.toLowerCase()}`}>
              {student.verification === 'VERIFIED' ? 'Confirmed' : 'Not confirmed'}
            </span>
          </div>
          <button className="btn-secondary" onClick={() => { setStudent(null); setBlocked(null); refocus(); }}>
            Done (Esc)
          </button>
          {student.held.length > 0 && (
            <ul className="desk-student-loans">
              {student.held.map((c) => {
                const late = c.dueAt ? new Date(c.dueAt) < new Date() : false;
                return (
                  <li key={c.id} className={late ? 'is-overdue' : ''}>
                    <code>{c.barcode}</code> {titlesRef.current.get(c.bookId) ?? ''}
                    {late && <span className="desk-overdue">overdue</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <h2 className="desk-feed-heading">Recent scans</h2>
      {feed.length === 0 ? (
        <p className="desk-empty">Nothing scanned yet. Scan a student, then their books.</p>
      ) : (
        <ul className="desk-feed">
          {feed.slice(0, 40).map(({ op, result, waiting }) => (
            <li
              key={op.opId}
              className={`desk-feed-item desk-feed-item--${waiting ? 'waiting' : result?.status ?? 'applied'}`}
            >
              <div className="desk-feed-main">
                <strong>
                  {waiting
                    ? op.kind === 'ISSUE' ? 'Giving out' : 'Taking back'
                    : result?.status === 'applied'
                      ? op.kind === 'ISSUE' ? 'Given out' : 'Taken back'
                      : 'Could not be saved'}
                </strong>
                <span className="desk-feed-what">
                  <code>{op.barcode}</code> {result?.title || ''}
                </span>
                {(result?.student?.name || op.studentLabel) && (
                  <span className="desk-feed-who">{result?.student?.name ?? op.studentLabel}</span>
                )}
                {waiting && <span className="desk-feed-note">saved on this computer, waiting to be sent</span>}
                {result?.duplicate && <span className="desk-feed-note">already recorded — not counted twice</span>}
                {result?.dueAt && op.kind === 'ISSUE' && (
                  <span className="desk-feed-due">due {new Date(result.dueAt).toLocaleDateString()}</span>
                )}
                {result?.overdueDays ? <span className="desk-feed-late">{result.overdueDays} days late</span> : null}
                {result?.charge && <span className="desk-feed-charge">charged {money(result.charge.amount)}</span>}
                {result && result.status !== 'applied' && <span className="desk-feed-why">{result.message}</span>}
                {result?.detail?.heldBy && (
                  <span className="desk-feed-why">
                    The records say {result.detail.heldBy}{result.detail.formClass ? `, ${result.detail.formClass}` : ''} has it
                    {result.detail.since ? ` since ${new Date(result.detail.since).toLocaleDateString()}` : ''}.
                  </span>
                )}
                {result?.needsReview && result.reviewReason && (
                  <span className="desk-feed-why">Saved, but flagged: {result.reviewReason}</span>
                )}
              </div>
              <div className="desk-feed-actions">
                {canUndo(op) && (
                  <button className="btn-secondary" onClick={() => void handleUndo({ op, result })}>Undo</button>
                )}
                {result?.status === 'rejected' && (
                  <button className="btn-secondary" onClick={() => setReconcileOpen(true)}>Review</button>
                )}
                {result && result.status === 'applied' && !canUndo(op) && (
                  <button className="btn-secondary" onClick={() => void dismissResult(op.opId)}>Clear</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ReconcileDrawer
        open={reconcileOpen}
        entries={queue?.needsAttention ?? []}
        onClose={() => { setReconcileOpen(false); refocus(); }}
        onResolved={() => void syncNow()}
      />
    </div>
  );
};

export default LibraryDesk;
