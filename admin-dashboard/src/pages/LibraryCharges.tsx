import { useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api';
import type { BookChargeRow, YearGroupOption } from '../types';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import PageHelp from '../components/PageHelp';
import Hint from '../components/Hint';
import { useToast } from '../hooks/useToast';
import './LibraryCharges.css';

type Filter = 'OUTSTANDING' | 'WAIVED' | 'ALL';

const TYPE_LABELS: Record<string, string> = {
  RENTAL: 'Term rental',
  LOST: 'Replacing a lost book',
  DAMAGE: 'A damaged book',
};

const money = (n: number) =>
  new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD', maximumFractionDigits: 0 }).format(n);

const errorText = (e: unknown, fallback: string) =>
  (e as { error?: string })?.error || (e as Error)?.message || fallback;

const LibraryCharges = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [filter, setFilter] = useState<Filter>('OUTSTANDING');
  const [formClass, setFormClass] = useState('');
  const [charges, setCharges] = useState<BookChargeRow[]>([]);
  const [summary, setSummary] = useState({ outstandingTotal: 0, outstandingCount: 0 });
  const [classes, setClasses] = useState<YearGroupOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [rentalOpen, setRentalOpen] = useState(false);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof apiService.runRentalCharges>> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => { void fetchCharges(); }, [filter, formClass]);
  useEffect(() => { void apiService.getSchoolClasses().then((d) => setClasses(d.yearGroups)).catch(() => {}); }, []);

  const fetchCharges = async () => {
    setLoading(true);
    try {
      const data = await apiService.getCharges({
        status: filter === 'ALL' ? undefined : filter,
        formClass: formClass || undefined,
        limit: 500,
      });
      setCharges(data.charges || []);
      setSummary(data.summary);
    } catch (error) {
      showToast(errorText(error, 'Could not load the charges'), 'error');
      setCharges([]);
    } finally {
      setLoading(false);
    }
  };

  const allClasses = useMemo(() => classes.flatMap((y) => y.formClasses), [classes]);

  /** What the filtered list adds up to, which is rarely the school-wide total. */
  const shownTotal = useMemo(
    () => charges.filter((c) => c.status === 'OUTSTANDING').reduce((sum, c) => sum + c.amount, 0),
    [charges]
  );

  const waive = async (charge: BookChargeRow) => {
    const reason = window.prompt(
      `Cancel the ${money(charge.amount)} charge against ${charge.student?.name ?? 'this student'}?\n\n` +
      `This is recorded against your name and cannot be undone here.\n\nWhy is it being cancelled?`
    );
    if (reason === null) return;
    if (!reason.trim()) { showToast('A reason is needed to cancel a charge', 'error'); return; }
    try {
      const result = await apiService.waiveCharge(charge.id, reason.trim());
      showToast(result.message, 'success');
      await fetchCharges();
    } catch (error) {
      showToast(errorText(error, 'Could not cancel the charge'), 'error');
    }
  };

  /** Always preview first: this touches every student with a book out. */
  const previewRental = async () => {
    setSubmitting(true);
    try {
      setPreview(await apiService.runRentalCharges(true));
    } catch (error) {
      showToast(errorText(error, 'Could not work out the rental charges'), 'error');
      setRentalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmRental = async () => {
    setSubmitting(true);
    try {
      const result = await apiService.runRentalCharges(false);
      showToast(result.message || 'Done', 'success');
      setRentalOpen(false);
      setPreview(null);
      await fetchCharges();
    } catch (error) {
      showToast(errorText(error, 'Could not raise the rental charges'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadCsv = async () => {
    try {
      const blob = await apiService.exportChargesCsv();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `book-charges-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast(errorText(error, 'Could not export the charges'), 'error');
    }
  };

  return (
    <div className="chg-page">
      <PageHelp pageKey="library/charges" />

      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
      ))}

      <div className="page-header">
        <h1>Book Charges</h1>
        <div className="chg-header-actions">
          <button className="btn-secondary" onClick={downloadCsv}>Export CSV</button>
          {isAdmin && (
            <button className="btn-primary" onClick={() => { setPreview(null); setRentalOpen(true); }}>
              Raise Term Rental
            </button>
          )}
        </div>
      </div>

      <p className="page-intro">
        What each student owes for book <Hint term="rental-fee" />, damage or replacement.{' '}
        <strong>This records the amount only — it does not take payment.</strong> Students pay at
        the bursary.
      </p>

      <div className="chg-summary">
        <div><strong>{money(summary.outstandingTotal)}</strong><span>outstanding, school-wide</span></div>
        <div><strong>{summary.outstandingCount}</strong><span>unpaid charges</span></div>
        {(formClass || filter !== 'OUTSTANDING') && (
          <div className="is-filtered"><strong>{money(shownTotal)}</strong><span>outstanding in this list</span></div>
        )}
      </div>

      <div className="chg-filters">
        {(['OUTSTANDING', 'WAIVED', 'ALL'] as Filter[]).map((f) => (
          <button
            key={f}
            className={`chg-tab ${filter === f ? 'is-active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'OUTSTANDING' ? 'Unpaid' : f === 'WAIVED' ? 'Cancelled' : 'Everything'}
          </button>
        ))}
        <select value={formClass} onChange={(e) => setFormClass(e.target.value)} aria-label="Form class">
          <option value="">All classes</option>
          {allClasses.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="chg-loading">Loading charges...</p>
      ) : charges.length === 0 ? (
        <div className="empty-state">
          <p>{filter === 'OUTSTANDING' ? 'Nobody owes anything.' : 'Nothing to show.'}</p>
        </div>
      ) : (
        <table className="data-table data-table--stack">
          <thead>
            <tr>
              <th>Student</th>
              <th>What for</th>
              <th>Book</th>
              <th>Raised</th>
              <th className="chg-amount-col">Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {charges.map((c) => (
              <tr key={c.id} className={c.status === 'WAIVED' ? 'chg-row--waived' : ''}>
                <td data-label="Student">
                  <strong>{c.student?.name ?? '—'}</strong>
                  <span className="chg-sub">{c.student?.formClass ?? '—'} · {c.student?.studentNumber ?? 'no number'}</span>
                </td>
                <td data-label="What for">
                  {TYPE_LABELS[c.type] ?? c.type}
                  {c.reason && <span className="chg-sub">{c.reason}</span>}
                  {c.status === 'WAIVED' && (
                    <span className="chg-waived">Cancelled{c.waiveReason ? `: ${c.waiveReason}` : ''}</span>
                  )}
                </td>
                <td data-label="Book">
                  {c.book?.title ?? '—'}
                  {c.book && <span className="chg-sub"><code>{c.book.barcode}</code></span>}
                </td>
                <td data-label="Raised">{new Date(c.raisedAt).toLocaleDateString()}</td>
                <td data-label="Amount" className="chg-amount-col">
                  <span className={c.status === 'WAIVED' ? 'chg-struck' : ''}>{money(c.amount)}</span>
                </td>
                <td data-label="Actions" className="col-actions">
                  {c.status === 'OUTSTANDING' && isAdmin && (
                    <button className="btn-delete" onClick={() => waive(c)}>Cancel</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal
        isOpen={rentalOpen}
        onClose={() => { setRentalOpen(false); setPreview(null); }}
        title="Raise the term's rental charges"
      >
        <p className="chg-modal-intro">
          Adds the rental fee for every book currently out, for books that have a fee set. Running
          it twice does not charge anyone twice.
        </p>

        {preview === null ? (
          <p className="chg-modal-intro">
            Check first — this affects every student with a book out.
          </p>
        ) : (
          <div className="chg-preview">
            <p>
              <strong>{preview.loans}</strong> charge{preview.loans === 1 ? '' : 's'} across{' '}
              <strong>{preview.students}</strong> student{preview.students === 1 ? '' : 's'},
              totalling <strong>{money(preview.total ?? 0)}</strong>.
            </p>
            {preview.loans === 0 ? (
              <p className="chg-sub">Nothing to charge — either no books are out, or they have all been charged already.</p>
            ) : (
              <>
                <ul>
                  {(preview.sample ?? []).map((r, i) => (
                    <li key={i}>{r.student} ({r.formClass ?? '—'}) — {r.title} — {money(r.amount)}</li>
                  ))}
                </ul>
                {(preview.loans ?? 0) > (preview.sample?.length ?? 0) && (
                  <p className="chg-sub">…and {(preview.loans ?? 0) - (preview.sample?.length ?? 0)} more.</p>
                )}
              </>
            )}
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => { setRentalOpen(false); setPreview(null); }}>
            Cancel
          </button>
          {preview === null ? (
            <button type="button" className="btn-primary" disabled={submitting} onClick={previewRental}>
              {submitting ? 'Checking...' : 'Show me what this would do'}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              disabled={submitting || preview.loans === 0}
              onClick={confirmRental}
            >
              {submitting ? 'Recording...' : `Record ${preview.loans} charges`}
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default LibraryCharges;
