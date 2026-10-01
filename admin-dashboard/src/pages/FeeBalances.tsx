import { Fragment, useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api';
import type {
  FeeAssessmentRow, FeeSchedule, FeeSummary, FeePaymentMethod, VoucherPayload, YearGroupOption,
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import PageHelp from '../components/PageHelp';
import Hint from '../components/Hint';
import FeeSubnav from '../components/FeeSubnav';
import { useToast } from '../hooks/useToast';
import { printVouchers } from '../utils/voucher';
import './FeeBalances.css';

const TERM_LABELS: Record<number, string> = { 1: 'Christmas', 2: 'Easter', 3: 'Summer' };

const STATUS_LABELS: Record<string, string> = {
  OUTSTANDING: 'Owing',
  SETTLED: 'Paid',
  WAIVED: 'Written off',
  CANCELLED: 'Cancelled',
};

const METHODS: { value: FeePaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CERTIFIED_CHEQUE', label: 'Certified cheque' },
];

const money = (n: number) =>
  new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD', maximumFractionDigits: 2 }).format(n);

const errorText = (e: unknown, fallback: string) =>
  (e as { error?: string })?.error || (e as Error)?.message || fallback;

const today = () => new Date().toISOString().slice(0, 10);

const FeeBalances = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [status, setStatus] = useState('OUTSTANDING');
  const [formClass, setFormClass] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<FeeAssessmentRow[]>([]);
  const [summary, setSummary] = useState<FeeSummary>({ charged: 0, paid: 0, waived: 0, outstanding: 0, studentsOwing: 0 });
  const [schedules, setSchedules] = useState<FeeSchedule[]>([]);
  const [classes, setClasses] = useState<YearGroupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Charge a year group: preview, then confirm. Same two-step as the library's
  // term rental run, for the same reason - it is a lot of money at once.
  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargeForm, setChargeForm] = useState({ scheduleId: '', formClass: '' });
  const [chargePreview, setChargePreview] = useState<Awaited<ReturnType<typeof apiService.runFeeAssessments>> | null>(null);

  const [printOpen, setPrintOpen] = useState(false);
  const [printForm, setPrintForm] = useState({ scheduleId: '', formClass: '' });
  const [printPreview, setPrintPreview] = useState<Awaited<ReturnType<typeof apiService.bulkIssueFeeVouchers>> | null>(null);

  const [payFor, setPayFor] = useState<FeeAssessmentRow | null>(null);
  const [payForm, setPayForm] = useState({
    amount: '', paidOn: today(), method: 'CASH' as FeePaymentMethod, bankReference: '', paidInBy: '',
  });

  const [ledgerFor, setLedgerFor] = useState<string | null>(null);
  const [ledger, setLedger] = useState<Awaited<ReturnType<typeof apiService.getStudentFeeLedger>> | null>(null);

  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => { void fetchRows(); }, [status, formClass]);
  useEffect(() => {
    void apiService.getFeeSchedules({ published: true }).then((d) => setSchedules(d.schedules)).catch(() => {});
    void apiService.getSchoolClasses().then((d) => setClasses(d.yearGroups)).catch(() => {});
  }, []);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const data = await apiService.getFeeAssessments({
        status: status === 'ALL' ? undefined : status,
        formClass: formClass || undefined,
        q: query || undefined,
        limit: 500,
      });
      setRows(data.assessments || []);
      setSummary(data.summary);
    } catch (error) {
      showToast(errorText(error, 'Could not load the fee balances'), 'error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const allClasses = useMemo(() => classes.flatMap((y) => y.formClasses), [classes]);

  /** What the list in front of you adds up to, which is rarely the school total. */
  const shownOutstanding = useMemo(
    () => rows.filter((r) => r.status === 'OUTSTANDING').reduce((s, r) => s + r.balance, 0),
    [rows]
  );

  const scheduleLabel = (s: FeeSchedule) =>
    `${s.label} — ${s.kind === 'INCIDENTAL' ? `Grade ${s.yearGroup}` : TERM_LABELS[s.term ?? 0] ?? `Term ${s.term}`} ${s.academicYear} (${money(s.totalAmount)})`;

  // --- charging -------------------------------------------------------------
  const previewCharge = async () => {
    if (!chargeForm.scheduleId) return showToast('Choose which fee to charge', 'error');
    setSubmitting(true);
    try {
      setChargePreview(await apiService.runFeeAssessments({ ...chargeForm, formClass: chargeForm.formClass || undefined, dryRun: true }));
    } catch (error) {
      showToast(errorText(error, 'Could not work out who would be charged'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmCharge = async () => {
    setSubmitting(true);
    try {
      const res = await apiService.runFeeAssessments({ ...chargeForm, formClass: chargeForm.formClass || undefined });
      showToast(res.message || 'Charged.', 'success');
      setChargeOpen(false); setChargePreview(null);
      await fetchRows();
    } catch (error) {
      showToast(errorText(error, 'Could not charge the students'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // --- vouchers -------------------------------------------------------------
  const printOne = async (row: FeeAssessmentRow) => {
    try {
      const res = await apiService.issueFeeVoucher(row.id);
      printVouchers([res.voucher]);
      void apiService.markFeeVoucherPrinted(res.voucher.id).catch(() => {});
      showToast(res.message, 'success');
    } catch (error) {
      showToast(errorText(error, 'Could not create the voucher'), 'error');
    }
  };

  const previewPrintRun = async () => {
    if (!printForm.scheduleId) return showToast('Choose which fee to print slips for', 'error');
    setSubmitting(true);
    try {
      setPrintPreview(await apiService.bulkIssueFeeVouchers({ ...printForm, formClass: printForm.formClass || undefined, dryRun: true }));
    } catch (error) {
      showToast(errorText(error, 'Could not work out which slips to print'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmPrintRun = async () => {
    setSubmitting(true);
    try {
      const res = await apiService.bulkIssueFeeVouchers({ ...printForm, formClass: printForm.formClass || undefined });
      const vouchers = (res.vouchers || []) as VoucherPayload[];
      if (vouchers.length) {
        printVouchers(vouchers);
        vouchers.forEach((v) => void apiService.markFeeVoucherPrinted(v.id).catch(() => {}));
      }
      showToast(res.message || `${vouchers.length} vouchers ready.`, 'success');
      setPrintOpen(false); setPrintPreview(null);
    } catch (error) {
      showToast(errorText(error, 'Could not create the vouchers'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // --- payments -------------------------------------------------------------
  const openPayment = (row: FeeAssessmentRow) => {
    setPayFor(row);
    setPayForm({ amount: String(row.balance > 0 ? row.balance : ''), paidOn: today(), method: 'CASH', bankReference: '', paidInBy: '' });
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payFor) return;
    setSubmitting(true);
    try {
      const res = await apiService.recordFeePayment({
        assessmentId: payFor.id,
        amount: Number(payForm.amount),
        paidOn: payForm.paidOn,
        method: payForm.method,
        bankReference: payForm.bankReference || undefined,
        paidInBy: payForm.paidInBy || undefined,
      });
      showToast(res.message, res.overpaid ? 'error' : 'success');
      setPayFor(null);
      await fetchRows();
    } catch (error) {
      showToast(errorText(error, 'Could not record the payment'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const waive = async (row: FeeAssessmentRow) => {
    const reason = window.prompt(
      `Write off the ${money(row.balance)} still owed by ${row.student?.name}?\n\nThis is recorded against your name and cannot be undone here. Say why:`
    );
    if (!reason?.trim()) return;
    try {
      const res = await apiService.waiveFeeAssessment(row.id, reason.trim());
      showToast(res.message, 'success');
      await fetchRows();
    } catch (error) {
      showToast(errorText(error, 'Could not write the charge off'), 'error');
    }
  };

  const openLedger = async (studentId: string) => {
    setLedgerFor(studentId); setLedger(null);
    try {
      setLedger(await apiService.getStudentFeeLedger(studentId));
    } catch (error) {
      showToast(errorText(error, 'Could not load the student'), 'error');
      setLedgerFor(null);
    }
  };

  const downloadCsv = async () => {
    try {
      const blob = await apiService.exportFeeAssessmentsCsv({
        status: status === 'ALL' ? undefined : status,
        formClass: formClass || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `school-fees-${today()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast(errorText(error, 'Could not export the list'), 'error');
    }
  };

  const chosenSchedule = schedules.find((s) => s.id === chargeForm.scheduleId);

  return (
    <div className="fee-page">
      <PageHelp pageKey="fees/balances" />
      <FeeSubnav />

      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
      ))}

      <div className="page-header">
        <h1>School Fees</h1>
        <div className="fee-header-actions">
          <button className="btn-secondary" onClick={downloadCsv}>Export CSV</button>
          <button className="btn-secondary" onClick={() => { setPrintPreview(null); setPrintOpen(true); }}>
            Print slips…
          </button>
          {isAdmin && (
            <button className="btn-primary" onClick={() => { setChargePreview(null); setChargeOpen(true); }}>
              Charge a class…
            </button>
          )}
        </div>
      </div>

      <p className="page-intro">
        What each student has been charged, and what they have paid. The school does not take this
        money — it is paid at <strong>Bank of Nova Scotia, Brown's Town, account 39-13</strong> against a{' '}
        <Hint term="paying-in-voucher" />, and the stamped{' '}
        <Hint term="schools-copy" /> comes back here to be recorded.
      </p>

      <div className="fee-summary">
        <div><strong>{money(summary.outstanding)}</strong><span>still owed, school-wide</span></div>
        <div><strong>{summary.studentsOwing}</strong><span>students owing</span></div>
        <div><strong>{money(summary.paid)}</strong><span>received</span></div>
        {/* Written off is deliberately its own figure. Folded into "received",
            it reads as money that came in and someone goes looking for it. */}
        <div><strong>{money(summary.waived)}</strong><span>written off</span></div>
        {(formClass || status !== 'OUTSTANDING') && (
          <div className="is-filtered"><strong>{money(shownOutstanding)}</strong><span>owed in this list</span></div>
        )}
      </div>

      <div className="fee-filters">
        {['OUTSTANDING', 'SETTLED', 'WAIVED', 'ALL'].map((s) => (
          <button key={s} className={`fee-tab ${status === s ? 'is-active' : ''}`} onClick={() => setStatus(s)}>
            {s === 'ALL' ? 'Everything' : STATUS_LABELS[s]}
          </button>
        ))}
        <select value={formClass} onChange={(e) => setFormClass(e.target.value)} aria-label="Form class">
          <option value="">All classes</option>
          {allClasses.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <form
          className="fee-search"
          onSubmit={(e) => { e.preventDefault(); void fetchRows(); }}
        >
          <input
            type="search"
            placeholder="Name or student number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn-secondary">Search</button>
        </form>
      </div>

      {loading ? (
        <p className="fee-loading">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <p>
            {status === 'OUTSTANDING'
              ? 'Nobody in this list owes anything. Charge a class to raise this term’s fees.'
              : 'Nothing to show.'}
          </p>
        </div>
      ) : (
        <table className="data-table data-table--stack">
          <thead>
            <tr>
              <th>Student</th>
              <th>Fee</th>
              <th className="fee-num">Charged</th>
              <th className="fee-num">Paid</th>
              <th className="fee-num">Written off</th>
              <th className="fee-num">Balance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.status === 'CANCELLED' ? 'fee-row--cancelled' : ''}>
                <td data-label="Student">
                  <strong>{r.student?.name ?? '—'}</strong>
                  <span className="fee-sub">{r.student?.formClass ?? '—'} · {r.student?.studentNumber ?? 'no number'}</span>
                </td>
                <td data-label="Fee">
                  {r.label ?? (r.kind === 'INCIDENTAL' ? 'Incidental Fees' : 'School Fee')}
                  <span className="fee-sub">
                    {r.academicYear}{r.term ? ` · ${TERM_LABELS[r.term] ?? `Term ${r.term}`}` : ''}
                  </span>
                  {r.status === 'WAIVED' && r.waiveReason && (
                    <span className="fee-waived">Written off: {r.waiveReason}</span>
                  )}
                </td>
                <td data-label="Charged" className="fee-num">{money(r.totalAmount)}</td>
                <td data-label="Paid" className="fee-num">{r.paidAmount ? money(r.paidAmount) : '—'}</td>
                <td data-label="Written off" className="fee-num">{r.waivedAmount ? money(r.waivedAmount) : '—'}</td>
                <td data-label="Balance" className="fee-num">
                  <strong className={r.overpaid ? 'fee-over' : r.balance > 0 ? 'fee-owing' : 'fee-clear'}>
                    {money(r.balance)}
                  </strong>
                  {r.overpaid && <span className="fee-sub">overpaid</span>}
                </td>
                <td data-label="Actions" className="col-actions">
                  <button className="btn-link" onClick={() => printOne(r)}>Print slip</button>
                  <button className="btn-link" onClick={() => openPayment(r)}>Record payment</button>
                  <button className="btn-link" onClick={() => openLedger(r.student!.id)}>Ledger</button>
                  {isAdmin && r.status === 'OUTSTANDING' && (
                    <button className="btn-link btn-danger-link" onClick={() => waive(r)}>Write off</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* --- charge a class ------------------------------------------------- */}
      <Modal isOpen={chargeOpen} onClose={() => setChargeOpen(false)} title="Charge a class">
        {!chargePreview ? (
          <div className="fee-form">
            <div className="form-group">
              <label htmlFor="fee-charge-schedule">Which fee</label>
              <select
                id="fee-charge-schedule"
                value={chargeForm.scheduleId}
                onChange={(e) => setChargeForm({ ...chargeForm, scheduleId: e.target.value })}
              >
                <option value="">Choose…</option>
                {schedules.map((s) => <option key={s.id} value={s.id}>{scheduleLabel(s)}</option>)}
              </select>
              <span className="field-hint">
                Only published fees appear here. A school fee is charged once per term, so charging
                the Christmas term twice would ask every parent for it twice.
              </span>
            </div>
            <div className="form-group">
              <label htmlFor="fee-charge-class">Which class</label>
              <select
                id="fee-charge-class"
                value={chargeForm.formClass}
                onChange={(e) => setChargeForm({ ...chargeForm, formClass: e.target.value })}
              >
                <option value="">
                  {chosenSchedule?.yearGroup ? `Everyone in Grade ${chosenSchedule.yearGroup}` : 'Everyone the fee applies to'}
                </option>
                {allClasses.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="field-hint">
                Only students the office has confirmed are charged. Anyone already charged this fee
                is skipped, so running it again is safe.
              </span>
            </div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setChargeOpen(false)}>Cancel</button>
              <button type="button" className="btn-primary" disabled={submitting} onClick={previewCharge}>
                {submitting ? 'Checking…' : 'Show me who'}
              </button>
            </div>
          </div>
        ) : (
          <div className="fee-preview">
            {/* The term is named in words. A dropdown alone is how a school
                assesses Christmas twice. */}
            <p className="fee-preview-headline">
              Charge <strong>{chargePreview.students}</strong> student{chargePreview.students === 1 ? '' : 's'}{' '}
              {money(chargePreview.each ?? 0)} each for{' '}
              <strong>
                {chargePreview.schedule?.termLabel ? `the ${chargePreview.schedule.termLabel} term ` : ''}
                {chargePreview.schedule?.label}
              </strong>{' '}
              — <strong>{money(chargePreview.total ?? 0)}</strong> in total.
            </p>
            {chargePreview.students === 0 ? (
              <p className="fee-preview-none">Everyone in that group has already been charged this fee.</p>
            ) : (
              <ul className="fee-preview-list">
                {chargePreview.sample?.map((s, i) => (
                  <li key={i}>{s.name} <span>{s.formClass ?? ''} {s.studentNumber ?? ''}</span></li>
                ))}
                {(chargePreview.students ?? 0) > (chargePreview.sample?.length ?? 0) && (
                  <li className="fee-preview-more">
                    …and {(chargePreview.students ?? 0) - (chargePreview.sample?.length ?? 0)} more
                  </li>
                )}
              </ul>
            )}
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setChargePreview(null)}>Back</button>
              <button
                type="button"
                className="btn-primary"
                disabled={submitting || chargePreview.students === 0}
                onClick={confirmCharge}
              >
                {submitting ? 'Charging…' : `Charge ${chargePreview.students}`}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* --- print a run of slips ------------------------------------------- */}
      <Modal isOpen={printOpen} onClose={() => setPrintOpen(false)} title="Print paying-in slips">
        {!printPreview ? (
          <div className="fee-form">
            <div className="form-group">
              <label htmlFor="fee-print-schedule">Which fee</label>
              <select
                id="fee-print-schedule"
                value={printForm.scheduleId}
                onChange={(e) => setPrintForm({ ...printForm, scheduleId: e.target.value })}
              >
                <option value="">Choose…</option>
                {schedules.map((s) => <option key={s.id} value={s.id}>{scheduleLabel(s)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="fee-print-class">Which class</label>
              <select
                id="fee-print-class"
                value={printForm.formClass}
                onChange={(e) => setPrintForm({ ...printForm, formClass: e.target.value })}
              >
                <option value="">Everyone who still owes</option>
                {allClasses.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="field-hint">
                A slip is only printed for a student who still owes something. Each sheet is one
                voucher in three parts, to be cut along the dashed lines.
              </span>
            </div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setPrintOpen(false)}>Cancel</button>
              <button type="button" className="btn-primary" disabled={submitting} onClick={previewPrintRun}>
                {submitting ? 'Checking…' : 'Show me'}
              </button>
            </div>
          </div>
        ) : (
          <div className="fee-preview">
            <p className="fee-preview-headline">
              Print <strong>{printPreview.willPrint}</strong> slip{printPreview.willPrint === 1 ? '' : 's'}.
            </p>
            <p className="field-hint">
              Set <strong>Layout: Landscape</strong> in the print dialog. A portrait print runs the
              three copies off the edge of the page.
            </p>
            <ul className="fee-preview-list">
              {printPreview.sample?.map((s, i) => (
                <li key={i}>{s.name} <span>{s.formClass ?? ''} · {money(s.balance)}</span></li>
              ))}
            </ul>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setPrintPreview(null)}>Back</button>
              <button
                type="button"
                className="btn-primary"
                disabled={submitting || printPreview.willPrint === 0}
                onClick={confirmPrintRun}
              >
                {submitting ? 'Preparing…' : `Print ${printPreview.willPrint}`}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* --- record a stamped slip ------------------------------------------ */}
      <Modal isOpen={!!payFor} onClose={() => setPayFor(null)} title="Record a payment">
        {payFor && (
          <form className="fee-form" onSubmit={submitPayment}>
            <p className="fee-modal-sub">
              {payFor.student?.name} · {payFor.label} · {money(payFor.balance)} outstanding
            </p>
            <div className="form-group">
              <label htmlFor="fee-pay-amount">Amount on the slip</label>
              <input
                id="fee-pay-amount" type="number" step="0.01" min="0.01" required
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
              />
              <span className="field-hint">
                Whatever the bank stamped, even if it is less than the full amount. Part-payments are
                normal.
              </span>
            </div>
            <div className="fee-form-row">
              <div className="form-group">
                <label htmlFor="fee-pay-date">Date on the bank's stamp</label>
                <input
                  id="fee-pay-date" type="date" required max={today()}
                  value={payForm.paidOn}
                  onChange={(e) => setPayForm({ ...payForm, paidOn: e.target.value })}
                />
                <span className="field-hint">Not today's date — the date the bank stamped it.</span>
              </div>
              <div className="form-group">
                <label htmlFor="fee-pay-method">How</label>
                <select
                  id="fee-pay-method" value={payForm.method}
                  onChange={(e) => setPayForm({ ...payForm, method: e.target.value as FeePaymentMethod })}
                >
                  {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div className="fee-form-row">
              <div className="form-group">
                <label htmlFor="fee-pay-ref">Bank reference</label>
                <input
                  id="fee-pay-ref" type="text" value={payForm.bankReference}
                  onChange={(e) => setPayForm({ ...payForm, bankReference: e.target.value })}
                />
                <span className="field-hint">Optional. Helps match it to the bank statement.</span>
              </div>
              <div className="form-group">
                <label htmlFor="fee-pay-by">Paid in by</label>
                <input
                  id="fee-pay-by" type="text" value={payForm.paidInBy}
                  onChange={(e) => setPayForm({ ...payForm, paidInBy: e.target.value })}
                />
                <span className="field-hint">As written on the slip — usually a parent.</span>
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setPayFor(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Recording…' : 'Record payment'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* --- one student's history ------------------------------------------ */}
      <Modal isOpen={!!ledgerFor} onClose={() => { setLedgerFor(null); setLedger(null); }} title="Student fee history" size="large">
        {!ledger ? (
          <p className="fee-loading">Loading…</p>
        ) : (
          <div className="fee-ledger">
            <p className="fee-modal-sub">
              <strong>{ledger.student.name}</strong> · {ledger.student.formClass ?? '—'} ·{' '}
              {ledger.student.studentNumber ?? 'no student number'}
            </p>
            <div className="fee-summary fee-summary--inline">
              <div><strong>{money(ledger.totals.charged)}</strong><span>charged</span></div>
              <div><strong>{money(ledger.totals.paid)}</strong><span>paid</span></div>
              <div><strong>{money(ledger.totals.waived)}</strong><span>written off</span></div>
              <div><strong>{money(ledger.totals.balance)}</strong><span>outstanding</span></div>
            </div>
            {ledger.assessments.map((a) => (
              <div key={a.id} className="fee-ledger-item">
                <div className="fee-ledger-head">
                  <strong>{a.label}</strong>
                  <span>
                    {a.academicYear}{a.term ? ` · ${TERM_LABELS[a.term] ?? `Term ${a.term}`}` : ''} ·{' '}
                    {STATUS_LABELS[a.status]}
                  </span>
                  <span className="fee-ledger-amt">{money(a.totalAmount)}</span>
                </div>
                <table className="fee-ledger-lines">
                  <tbody>
                    {a.lines.map((l, i) => (
                      <tr key={i}><td>{l.label}</td><td className="fee-num">{money(l.amount)}</td></tr>
                    ))}
                  </tbody>
                </table>
                {a.payments && a.payments.length > 0 && (
                  <ul className="fee-ledger-payments">
                    {a.payments.map((p) => (
                      <li key={p.id} className={p.reversedAt ? 'is-reversed' : ''}>
                        {new Date(p.paidOn).toLocaleDateString('en-JM')} · {money(p.amount)} ·{' '}
                        {p.method === 'CASH' ? 'Cash' : 'Certified cheque'}
                        {p.voucherSerial ? ` · slip ${p.voucherSerial}` : ''}
                        {p.reversedAt && <em> — reversed{p.reverseReason ? `: ${p.reverseReason}` : ''}</em>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FeeBalances;
