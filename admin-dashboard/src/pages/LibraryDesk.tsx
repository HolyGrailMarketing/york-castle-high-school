import { useCallback, useEffect, useRef, useState } from 'react';
import { stationClient, asStationError } from '../lib/station/client';
import { enqueue, compensate, subscribe, clearResult, stationId } from '../lib/station/queue';
import type { DeskStudent, OpResult, QueuedOp } from '../lib/station/types';
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

const LibraryDesk = () => {
  const [scan, setScan] = useState('');
  const [student, setStudent] = useState<DeskStudent | null>(null);
  const [candidates, setCandidates] = useState<DeskStudent[]>([]);
  const [condition, setCondition] = useState<BookCondition>('GOOD');
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [feed, setFeed] = useState<{ op: QueuedOp; result: OpResult }[]>([]);
  const [needsAttention, setNeedsAttention] = useState<{ op: QueuedOp; result: OpResult }[]>([]);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  useEffect(() => subscribe((state) => {
    setFeed(state.results);
    setNeedsAttention(state.needsAttention);
  }), []);

  /**
   * Keep the scan box focused. A wedge scanner types into whatever has focus,
   * so a box that has quietly lost it means the barcode lands nowhere and the
   * librarian scans the same book three times wondering why.
   */
  const refocus = useCallback(() => {
    if (document.querySelector('.desk-modal')) return;
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

  // Esc clears the student, so the next person can be served without reaching
  // for the mouse. G/F/P/D set the condition for the next return.
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

  /** Everything a student's card needs, refreshed after every scan. */
  const loadStudent = async (query: string): Promise<boolean> => {
    const { data } = await stationClient.get<{ students: DeskStudent[] }>('/loans/student-lookup', {
      params: { q: query },
    });
    if (data.students.length === 0) return false;
    if (data.students.length === 1) {
      setStudent(data.students[0]);
      setCandidates([]);
      checkPolicy(data.students[0]);
      return true;
    }
    setCandidates(data.students);
    return true;
  };

  const refreshStudent = async (id: string) => {
    try {
      const { data } = await stationClient.get<{ students: DeskStudent[] }>('/loans/student-lookup', { params: { q: id } });
      const found = data.students.find((s) => s.id === id);
      if (found) { setStudent(found); checkPolicy(found); }
    } catch {
      // The card is stale but the scan already succeeded; not worth interrupting.
    }
  };

  /**
   * Policy is decided here, at the counter, against what the desk can see.
   *
   * This is the one moment it can be enforced: the book is still on this side
   * of the desk. Once a scan reaches the server the book has gone, and the
   * server records it regardless rather than losing the only trace of it.
   */
  const checkPolicy = (s: DeskStudent) => {
    if (s.verification !== 'VERIFIED') {
      setBlocked(`${s.name} has not been confirmed by the office. Send them to the office to confirm their year and class before giving them any books.`);
      return;
    }
    const cap = s.loanCap ?? 8;
    if (s.activeLoans.length >= cap) {
      setBlocked(`${s.name} already has ${s.activeLoans.length} books out, which is the limit. Take some back first.`);
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
    setBusy(true);
    setSessionError(null);
    try {
      // What was scanned decides what happens - there is no mode to forget to
      // switch. A copy barcode is a book; anything else is a person.
      const looksLikeBarcode = /^YCHS-\d+$/i.test(code);
      if (!looksLikeBarcode) {
        const found = await loadStudent(code);
        if (!found) {
          beep(false, muted);
          setBlocked(`Nothing found for "${code}". Try their student number, or their name.`);
        }
        return;
      }

      const { data: lookup } = await stationClient.get('/loans/lookup', { params: { barcode: code } });

      if (lookup.currentLoan) {
        // The copy is out, so this is a return. No student needs to be
        // selected: that is how a returns pile actually gets processed.
        const result = await enqueue({
          kind: 'RETURN',
          barcode: code,
          copyId: lookup.copy.id,
          expectedLoanId: lookup.currentLoan.id,
          condition,
        });
        beep(result.status === 'applied', muted);
        // Only worth refreshing the card if the book that came back was one of
        // the pinned student's.
        const shown = student;
        if (result.status === 'applied' && shown && shown.id === lookup.currentLoan.student.id) {
          await refreshStudent(shown.id);
        }
        return;
      }

      if (!student) {
        beep(false, muted);
        setBlocked(`${lookup.book.title} is not out to anyone. To give it to a student, scan the student first.`);
        return;
      }
      if (blocked) { beep(false, muted); return; }

      const result = await enqueue({
        kind: 'ISSUE',
        barcode: code,
        copyId: lookup.copy.id,
        studentId: student.id,
        studentLabel: `${student.name}${student.formClass ? `, ${student.formClass}` : ''}`,
        condition,
      });
      beep(result.status === 'applied', muted);
      if (result.status === 'applied') await refreshStudent(student.id);
    } catch (error) {
      const failure = asStationError(error);
      beep(false, muted);
      if (failure.name === 'SessionExpiredError') setSessionError(failure.message);
      else setBlocked(failure.message);
    } finally {
      setBusy(false);
      setTimeout(refocus, 0);
    }
  };

  const undo = async (entry: { op: QueuedOp; result: OpResult }) => {
    setBusy(true);
    try {
      await compensate(entry);
      if (student) await refreshStudent(student.id);
    } catch (error) {
      setBlocked(asStationError(error).message);
    } finally {
      setBusy(false);
      refocus();
    }
  };

  const canUndo = (entry: { op: QueuedOp; result: OpResult }) =>
    entry.result.status === 'applied' && Date.now() - new Date(entry.op.clientAt).getTime() < UNDO_MS;

  return (
    <div className="desk-page">
      <PageHelp pageKey="library/desk" />

      {sessionError && (
        <div className="desk-banner desk-banner--error" role="alert">
          <strong>{sessionError}</strong>
          <span>Nothing has been lost. Sign in again in another tab, then carry on scanning here.</span>
        </div>
      )}

      <div className="page-header">
        <h1>Issue &amp; Return</h1>
        <div className="desk-header-actions">
          <span className="desk-station" title="This computer's name, used to tell two counters apart">
            {stationId()}<Hint term="station" />
          </span>
          <button className="btn-secondary" onClick={() => setMuted(!muted)} aria-pressed={muted}>
            {muted ? 'Sound off' : 'Sound on'}
          </button>
        </div>
      </div>

      {/* The scan box. Always focused, always obviously armed. */}
      <form
        className={`desk-scan ${busy ? 'is-busy' : ''}`}
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
        <span className={`desk-ready ${busy ? 'is-busy' : ''}`}>{busy ? 'Working...' : 'Ready to scan'}</span>
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
                <button onClick={() => { setStudent(c); setCandidates([]); checkPolicy(c); refocus(); }}>
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
              {student.activeLoans.length} book{student.activeLoans.length === 1 ? '' : 's'} out ·{' '}
              {student.outstandingTotal > 0 ? `owes ${money(student.outstandingTotal)}` : 'owes nothing'}
            </p>
            <span className={`desk-verify desk-verify--${student.verification.toLowerCase()}`}>
              {student.verification === 'VERIFIED' ? 'Confirmed' : 'Not confirmed'}
            </span>
          </div>
          <button className="btn-secondary" onClick={() => { setStudent(null); setBlocked(null); refocus(); }}>
            Done (Esc)
          </button>
          {student.activeLoans.length > 0 && (
            <ul className="desk-student-loans">
              {student.activeLoans.map((l) => (
                <li key={l.id} className={l.overdue ? 'is-overdue' : ''}>
                  <code>{l.barcode}</code> {l.title}
                  {l.overdue && <span className="desk-overdue">overdue</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {needsAttention.length > 0 && (
        <div className="desk-banner desk-banner--attention" role="alert">
          <strong>
            {needsAttention.length} scan{needsAttention.length === 1 ? '' : 's'} could not be saved
          </strong>
          <span>
            Find out who actually has the book before deciding.<Hint term="needs-attention" />
          </span>
        </div>
      )}

      <h2 className="desk-feed-heading">Recent scans</h2>
      {feed.length === 0 ? (
        <p className="desk-empty">Nothing scanned yet. Scan a student, then their books.</p>
      ) : (
        <ul className="desk-feed">
          {feed.map((entry) => {
            const r = entry.result;
            return (
              <li key={entry.op.opId} className={`desk-feed-item desk-feed-item--${r.status}`}>
                <div className="desk-feed-main">
                  <strong>
                    {r.status === 'applied'
                      ? entry.op.kind === 'ISSUE' ? 'Given out' : 'Taken back'
                      : r.status === 'rejected' ? 'Could not be saved' : 'Not sent'}
                  </strong>
                  <span className="desk-feed-what">
                    <code>{r.barcode || entry.op.barcode}</code> {r.title || ''}
                  </span>
                  {r.student && <span className="desk-feed-who">{r.student.name}{r.student.formClass ? `, ${r.student.formClass}` : ''}</span>}
                  {r.status === 'applied' && entry.op.kind === 'ISSUE' && r.dueAt && (
                    <span className="desk-feed-due">due {new Date(r.dueAt).toLocaleDateString()}</span>
                  )}
                  {r.duplicate && <span className="desk-feed-note">already recorded — not counted twice</span>}
                  {r.overdueDays ? <span className="desk-feed-late">{r.overdueDays} days late</span> : null}
                  {r.charge && <span className="desk-feed-charge">charged {money(r.charge.amount)}</span>}
                  {r.status !== 'applied' && <span className="desk-feed-why">{r.message}</span>}
                  {r.detail?.heldBy && (
                    <span className="desk-feed-why">
                      The records say {r.detail.heldBy}{r.detail.formClass ? `, ${r.detail.formClass}` : ''} has it
                      {r.detail.since ? ` since ${new Date(r.detail.since).toLocaleDateString()}` : ''}.
                    </span>
                  )}
                  {r.needsReview && r.reviewReason && (
                    <span className="desk-feed-why">Saved, but flagged: {r.reviewReason}</span>
                  )}
                </div>
                <div className="desk-feed-actions">
                  {canUndo(entry) && (
                    <button className="btn-secondary" disabled={busy} onClick={() => undo(entry)}>Undo</button>
                  )}
                  {r.status === 'rejected' && (
                    <button className="btn-secondary" onClick={() => clearResult(entry.op.opId)}>Dismiss</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default LibraryDesk;
