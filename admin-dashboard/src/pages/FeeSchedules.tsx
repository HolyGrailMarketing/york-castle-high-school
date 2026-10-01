import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import type { FeeSchedule, FeeScheduleItem, FeeKind } from '../types';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import PageHelp from '../components/PageHelp';
import Hint from '../components/Hint';
import FeeSubnav from '../components/FeeSubnav';
import { useToast } from '../hooks/useToast';
import './FeeSchedules.css';

const TERMS = [
  { value: 1, label: 'Christmas' },
  { value: 2, label: 'Easter' },
  { value: 3, label: 'Summer' },
];

const money = (n: number) =>
  new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD', maximumFractionDigits: 2 }).format(n);

const errorText = (e: unknown, fallback: string) =>
  (e as { error?: string })?.error || (e as Error)?.message || fallback;

type FormState = {
  kind: FeeKind;
  academicYear: string;
  yearGroup: string;
  term: string;
  label: string;
  items: FeeScheduleItem[];
};

const blankForm = (academicYear: string): FormState => ({
  kind: 'INCIDENTAL',
  academicYear,
  yearGroup: '12',
  term: '1',
  label: '',
  items: [{ label: '', amount: 0, sortOrder: 0 }],
});

const FeeSchedules = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [schedules, setSchedules] = useState<FeeSchedule[]>([]);
  const [currentYear, setCurrentYear] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [modal, setModal] = useState<{ open: boolean; editing: FeeSchedule | null }>({ open: false, editing: null });
  const [form, setForm] = useState<FormState>(blankForm(''));

  const [serial, setSerial] = useState<number | null>(null);
  const [serialOpen, setSerialOpen] = useState(false);
  const [serialValue, setSerialValue] = useState('');

  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => { void fetchSchedules(); void fetchSerial(); }, []);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const data = await apiService.getFeeSchedules();
      setSchedules(data.schedules || []);
      setCurrentYear(data.currentAcademicYear);
    } catch (error) {
      showToast(errorText(error, 'Could not load the fees'), 'error');
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSerial = async () => {
    try {
      const d = await apiService.getFeeSerial();
      setSerial(d.counter.nextValue);
    } catch { /* the counter is informational here */ }
  };

  const openNew = () => {
    setForm(blankForm(currentYear || ''));
    setModal({ open: true, editing: null });
  };

  const openEdit = (s: FeeSchedule) => {
    setForm({
      kind: s.kind,
      academicYear: s.academicYear,
      yearGroup: String(s.yearGroup ?? 12),
      term: String(s.term ?? 1),
      label: s.label,
      items: s.items.length ? s.items.map((i) => ({ ...i })) : [{ label: '', amount: 0 }],
    });
    setModal({ open: true, editing: s });
  };

  /** The live total, so the office can check it against the printed slip. */
  const formTotal = form.items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  const setItem = (index: number, patch: Partial<FeeScheduleItem>) => {
    setForm({ ...form, items: form.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { label: '', amount: 0 }] });
  const removeItem = (index: number) =>
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      kind: form.kind,
      academicYear: form.academicYear,
      yearGroup: form.kind === 'INCIDENTAL' ? Number(form.yearGroup) : null,
      term: form.kind === 'SCHOOL_FEE' ? Number(form.term) : null,
      label: form.label,
      items: form.items
        .filter((i) => i.label.trim())
        .map((i, index) => ({ label: i.label.trim(), amount: Number(i.amount), sortOrder: index })),
    };
    try {
      if (modal.editing) {
        const res = await apiService.updateFeeSchedule(modal.editing.id, payload);
        showToast(res.message, 'success');
      } else {
        const res = await apiService.createFeeSchedule(payload);
        showToast(res.message, 'success');
      }
      setModal({ open: false, editing: null });
      await fetchSchedules();
    } catch (error) {
      showToast(errorText(error, 'Could not save the fee'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const togglePublished = async (s: FeeSchedule) => {
    try {
      const res = await apiService.setFeeSchedulePublished(s.id, !s.isPublished);
      showToast(res.message, 'success');
      await fetchSchedules();
    } catch (error) {
      showToast(errorText(error, 'Could not change the fee'), 'error');
    }
  };

  const remove = async (s: FeeSchedule) => {
    if (!window.confirm(`Delete ${s.label}? This cannot be undone.`)) return;
    try {
      const res = await apiService.deleteFeeSchedule(s.id);
      showToast(res.message, 'success');
      await fetchSchedules();
    } catch (error) {
      showToast(errorText(error, 'Could not delete the fee'), 'error');
    }
  };

  const saveSerial = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiService.updateFeeSerial(Number(serialValue));
      showToast(res.message, 'success');
      setSerial(res.counter.nextValue);
      setSerialOpen(false);
    } catch (error) {
      showToast(errorText(error, 'Could not change the voucher numbering'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fee-page">
      <PageHelp pageKey="fees/schedules" />
      <FeeSubnav />

      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
      ))}

      <div className="page-header">
        <h1>What We Charge</h1>
        <div className="fee-header-actions">
          {isAdmin && (
            <button className="btn-secondary" onClick={() => { setSerialValue(String(serial ?? '')); setSerialOpen(true); }}>
              Voucher numbering…
            </button>
          )}
          {isAdmin && <button className="btn-primary" onClick={openNew}>Add a fee</button>}
        </div>
      </div>

      <p className="page-intro">
        The fees as they appear on the printed slip. <Hint term="incidental-fees" /> are charged once
        a year and differ by grade; the <Hint term="school-fee" /> is charged every term. Enter this
        year's figures — the total is worked out from the lines, and that total is what a parent
        takes to the bank.
      </p>

      {serial !== null && (
        <p className="fee-serial-note">
          The next slip printed will be numbered <strong>{serial}</strong>.{' '}
          Keep this clear of the school's pre-printed paper books, or two slips will share a number.
        </p>
      )}

      {loading ? (
        <p className="fee-loading">Loading…</p>
      ) : schedules.length === 0 ? (
        <div className="empty-state">
          <p>No fees set up yet. Add one, enter its lines, then publish it so students can be charged.</p>
        </div>
      ) : (
        <div className="fee-sched-list">
          {schedules.map((s) => (
            <article key={s.id} className={`fee-sched ${s.isPublished ? '' : 'is-draft'}`}>
              <header className="fee-sched-head">
                <div>
                  <h2>{s.label}</h2>
                  <p className="fee-sched-meta">
                    {s.kind === 'INCIDENTAL' ? `Grade ${s.yearGroup} · once a year` : `${TERMS.find((t) => t.value === s.term)?.label ?? `Term ${s.term}`} term · every term`}
                    {' · '}{s.academicYear}
                    {s.assessmentCount ? ` · ${s.assessmentCount} student${s.assessmentCount === 1 ? '' : 's'} charged` : ''}
                  </p>
                </div>
                <div className="fee-sched-right">
                  <span className="fee-sched-total">{money(s.totalAmount)}</span>
                  <span className={`fee-chip ${s.isPublished ? 'is-live' : 'is-draft'}`}>
                    {s.isPublished ? 'Published' : 'Draft'}
                  </span>
                </div>
              </header>

              <table className="fee-sched-lines">
                <tbody>
                  {s.items.map((i) => (
                    <tr key={i.id ?? i.label}>
                      <td>{i.label}</td>
                      <td className="fee-num">{money(i.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {isAdmin && (
                <div className="fee-sched-actions">
                  <button className="btn-link" onClick={() => openEdit(s)}>Edit</button>
                  <button className="btn-link" onClick={() => togglePublished(s)}>
                    {s.isPublished ? 'Back to draft' : 'Publish'}
                  </button>
                  {!s.assessmentCount && (
                    <button className="btn-link btn-danger-link" onClick={() => remove(s)}>Delete</button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <Modal
        isOpen={modal.open}
        onClose={() => setModal({ open: false, editing: null })}
        title={modal.editing ? `Edit ${modal.editing.label}` : 'Add a fee'}
        size="large"
      >
        <form className="fee-form" onSubmit={save}>
          {modal.editing && (modal.editing.assessmentCount ?? 0) > 0 && (
            <p className="fee-warning">
              {modal.editing.assessmentCount} student{modal.editing.assessmentCount === 1 ? ' has' : 's have'}{' '}
              already been charged this fee. They keep the amount they were told — changing it here
              applies to anyone charged from now on.
            </p>
          )}

          <div className="fee-form-row">
            <div className="form-group">
              <label htmlFor="fee-kind">Kind</label>
              <select
                id="fee-kind" value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as FeeKind })}
              >
                <option value="INCIDENTAL">Incidental fees — once a year, per grade</option>
                <option value="SCHOOL_FEE">School fee — every term</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="fee-year">Academic year</label>
              <input
                id="fee-year" type="text" required placeholder="2026-2027"
                value={form.academicYear}
                onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
              />
              <span className="field-hint">As it should print on the slip.</span>
            </div>
          </div>

          <div className="fee-form-row">
            {form.kind === 'INCIDENTAL' ? (
              <div className="form-group">
                <label htmlFor="fee-grade">Grade</label>
                <select
                  id="fee-grade" value={form.yearGroup}
                  onChange={(e) => setForm({ ...form, yearGroup: e.target.value })}
                >
                  {[7, 8, 9, 10, 11, 12, 13].map((g) => <option key={g} value={g}>Grade {g}</option>)}
                </select>
                <span className="field-hint">Incidental fees differ by grade.</span>
              </div>
            ) : (
              <div className="form-group">
                <label htmlFor="fee-term">Term</label>
                <select id="fee-term" value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })}>
                  {TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <span className="field-hint">The school fee is charged once each term.</span>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="fee-label">Name on the slip</label>
              <input
                id="fee-label" type="text" required
                placeholder={form.kind === 'INCIDENTAL' ? 'Incidental Fees' : 'Parent Contribution'}
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
          </div>

          <div className="fee-items">
            <div className="fee-items-head">
              <span>What it is made up of</span>
              <span className="fee-num">Amount</span>
              <span />
            </div>
            {form.items.map((item, index) => (
              <div className="fee-items-row" key={index}>
                <input
                  type="text" placeholder="e.g. ONLINE LIBRARY" value={item.label}
                  onChange={(e) => setItem(index, { label: e.target.value })}
                  aria-label={`Line ${index + 1} name`}
                />
                <input
                  type="number" step="0.01" min="0" value={item.amount}
                  onChange={(e) => setItem(index, { amount: Number(e.target.value) })}
                  aria-label={`Line ${index + 1} amount`}
                />
                <button
                  type="button" className="btn-link btn-danger-link"
                  onClick={() => removeItem(index)}
                  disabled={form.items.length === 1}
                >
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="btn-link" onClick={addItem}>+ Add a line</button>
            <div className="fee-items-total">
              <span>Total</span>
              <strong>{money(formTotal)}</strong>
            </div>
            <span className="field-hint">
              Check this against the printed slip before publishing. This is the figure a parent
              takes to the bank.
            </span>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setModal({ open: false, editing: null })}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : modal.editing ? 'Save' : 'Add fee'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={serialOpen} onClose={() => setSerialOpen(false)} title="Voucher numbering">
        <form className="fee-form" onSubmit={saveSerial}>
          <div className="form-group">
            <label htmlFor="fee-serial">Next voucher number</label>
            <input
              id="fee-serial" type="number" min="1" required
              value={serialValue} onChange={(e) => setSerialValue(e.target.value)}
            />
            <span className="field-hint">
              Every slip printed carries a number, and no two slips may ever share one. Set this
              clear of the range used by the school's pre-printed paper books. It cannot be set
              below a number already issued.
            </span>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setSerialOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default FeeSchedules;
