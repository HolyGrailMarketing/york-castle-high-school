import { useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api';
import type { BookLoanRow, LoanSummary, YearGroupOption } from '../types';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import PageHelp from '../components/PageHelp';
import Hint from '../components/Hint';
import { useToast } from '../hooks/useToast';
import './LibraryLoans.css';

type Filter = 'ACTIVE' | 'OVERDUE' | 'REVIEW' | 'ALL';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ACTIVE', label: 'Out now' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'REVIEW', label: 'Needs review' },
  { key: 'ALL', label: 'Everything' },
];

const money = (n: number) =>
  new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD', maximumFractionDigits: 0 }).format(n);

const errorText = (e: unknown, fallback: string) =>
  (e as { error?: string })?.error || (e as Error)?.message || fallback;

const LibraryLoans = () => {
  const [filter, setFilter] = useState<Filter>('ACTIVE');
  const [loans, setLoans] = useState<BookLoanRow[]>([]);
  const [summary, setSummary] = useState<LoanSummary>({ active: 0, overdue: 0, needsReview: 0 });
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<YearGroupOption[]>([]);

  const [sweep, setSweep] = useState<{ open: boolean; formClass: string; preview: any[] | null }>({
    open: false, formClass: '', preview: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => { void fetchLoans(); }, [filter]);
  useEffect(() => { void apiService.getSchoolClasses().then((d) => setClasses(d.yearGroups)).catch(() => {}); }, []);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const data = await apiService.getLoans({
        status: filter === 'ACTIVE' ? 'ACTIVE' : undefined,
        overdue: filter === 'OVERDUE' ? true : undefined,
        needsReview: filter === 'REVIEW' ? true : undefined,
        limit: 200,
      });
      setLoans(data.loans || []);
      setSummary(data.summary);
    } catch (error) {
      showToast(errorText(error, 'Could not load the loans'), 'error');
      setLoans([]);
    } finally {
      setLoading(false);
    }
  };

  const allClasses = useMemo(() => classes.flatMap((y) => y.formClasses), [classes]);

  const markLost = async (loan: BookLoanRow) => {
    const note = window.prompt(
      `Record "${loan.title}" (${loan.barcode}) as lost?\n\n` +
      `${loan.student.name} will be charged ${money(loan.replacementCost)} to replace it.\n\nWhy is it lost?`
    );
    if (note === null) return;
    try {
      const result = await apiService.markLoanLost(loan.id, note || undefined);
      showToast(result.message, 'success');
      await fetchLoans();
    } catch (error) {
      showToast(errorText(error, 'Could not mark the book lost'), 'error');
    }
  };

  /** Preview first: this changes a lot of records at once and cannot be undone in bulk. */
  const previewSweep = async () => {
    setSubmitting(true);
    try {
      const result = await apiService.bulkReturn({ formClass: sweep.formClass, dryRun: true });
      setSweep((s) => ({ ...s, preview: result.loans || [] }));
    } catch (error) {
      showToast(errorText(error, 'Could not work out what would be returned'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmSweep = async () => {
    setSubmitting(true);
    try {
      const result = await apiService.bulkReturn({ formClass: sweep.formClass });
      showToast(result.message || 'Done', 'success');
      setSweep({ open: false, formClass: '', preview: null });
      await fetchLoans();
    } catch (error) {
      showToast(errorText(error, 'Could not take the books back'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="loans-page">
      <PageHelp pageKey="library/loans" />

      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
      ))}

      <div className="page-header">
        <h1>Book Loans</h1>
        <button className="btn-primary" onClick={() => setSweep({ open: true, formClass: '', preview: null })}>
          End of Term Return
        </button>
      </div>

      <p className="page-intro">
        Every book currently with a student, and everything lent this year.
      </p>

      <div className="loans-summary">
        <div><strong>{summary.active}</strong><span>out now</span></div>
        <div className={summary.overdue > 0 ? 'is-warning' : ''}><strong>{summary.overdue}</strong><span>overdue</span></div>
        <div className={summary.needsReview > 0 ? 'is-warning' : ''}>
          <strong>{summary.needsReview}</strong><span>need review</span>
        </div>
      </div>

      <div className="loans-tabs" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            className={`loans-tab ${filter === f.key ? 'is-active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {f.key === 'OVERDUE' && summary.overdue > 0 && <span className="loans-tab-count">{summary.overdue}</span>}
            {f.key === 'REVIEW' && summary.needsReview > 0 && <span className="loans-tab-count">{summary.needsReview}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="loans-loading">Loading...</p>
      ) : loans.length === 0 ? (
        <div className="empty-state">
          <p>
            {filter === 'OVERDUE' ? 'Nothing is overdue.'
              : filter === 'REVIEW' ? 'Nothing needs review.'
              : 'No loans to show.'}
          </p>
        </div>
      ) : (
        <table className="data-table data-table--stack">
          <thead>
            <tr>
              <th>Book</th>
              <th>Student</th>
              <th>Given out</th>
              <th>Due</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((l) => (
              <tr key={l.id} className={l.overdue ? 'loans-row--overdue' : ''}>
                <td data-label="Book">
                  <strong>{l.title}</strong>
                  <span className="loans-sub"><code>{l.barcode}</code> · {l.subject}</span>
                </td>
                <td data-label="Student">
                  {l.student.name}
                  <span className="loans-sub">{l.student.formClass ?? '—'}</span>
                </td>
                <td data-label="Given out">{new Date(l.issuedAt).toLocaleDateString()}</td>
                <td data-label="Due">{new Date(l.dueAt).toLocaleDateString()}</td>
                <td data-label="Status">
                  <span className={`loans-status loans-status--${l.status.toLowerCase()}`}>
                    {l.status === 'ACTIVE' ? (l.overdue ? 'Overdue' : 'Out') : l.status.toLowerCase()}
                  </span>
                  {l.needsReview && (
                    <span className="loans-review" title={l.reviewReason ?? ''}>needs review</span>
                  )}
                  {l.needsReview && l.reviewReason && (
                    <span className="loans-sub">{l.reviewReason}</span>
                  )}
                </td>
                <td data-label="Actions" className="col-actions">
                  {l.status === 'ACTIVE' && (
                    <button className="btn-delete" onClick={() => markLost(l)}>Mark Lost</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal
        isOpen={sweep.open}
        onClose={() => setSweep({ open: false, formClass: '', preview: null })}
        title="End of term return"
      >
        <p className="loans-modal-intro">
          Takes back every book a form class still has, in one go.{' '}
          <Hint term="end-of-term-return" /> Check the list before confirming — this affects a lot of
          records at once and cannot be undone in bulk.
        </p>
        <div className="form-group">
          <label>Form class</label>
          <select
            value={sweep.formClass}
            onChange={(e) => setSweep({ ...sweep, formClass: e.target.value, preview: null })}
          >
            <option value="">Choose a class</option>
            {allClasses.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {sweep.preview && (
          <div className="loans-preview">
            <p><strong>{sweep.preview.length}</strong> book{sweep.preview.length === 1 ? '' : 's'} would be taken back:</p>
            <ul>
              {sweep.preview.slice(0, 40).map((p: any) => (
                <li key={p.id}><code>{p.barcode}</code> {p.title} — {p.student}</li>
              ))}
            </ul>
            {sweep.preview.length > 40 && <p className="loans-sub">…and {sweep.preview.length - 40} more.</p>}
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => setSweep({ open: false, formClass: '', preview: null })}>
            Cancel
          </button>
          {sweep.preview === null ? (
            <button type="button" className="btn-primary" disabled={!sweep.formClass || submitting} onClick={previewSweep}>
              {submitting ? 'Checking...' : 'Show me what this would do'}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              disabled={submitting || sweep.preview.length === 0}
              onClick={confirmSweep}
            >
              {submitting ? 'Taking back...' : `Take back ${sweep.preview.length} books`}
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default LibraryLoans;
