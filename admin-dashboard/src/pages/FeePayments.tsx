import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import type { FeePaymentRow, FeePaymentMethod } from '../types';
import { useAuth } from '../contexts/AuthContext';
import Toast from '../components/Toast';
import PageHelp from '../components/PageHelp';
import FeeSubnav from '../components/FeeSubnav';
import { useToast } from '../hooks/useToast';
import './FeePayments.css';

const METHOD_LABELS: Record<FeePaymentMethod, string> = {
  CASH: 'Cash',
  CERTIFIED_CHEQUE: 'Certified cheque',
};

const money = (n: number) =>
  new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD', maximumFractionDigits: 2 }).format(n);

const errorText = (e: unknown, fallback: string) =>
  (e as { error?: string })?.error || (e as Error)?.message || fallback;

const FeePayments = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [payments, setPayments] = useState<FeePaymentRow[]>([]);
  const [summary, setSummary] = useState({ received: 0, count: 0 });
  const [filters, setFilters] = useState({ from: '', to: '', method: '' as '' | FeePaymentMethod, includeReversed: false });
  const [loading, setLoading] = useState(true);

  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => { void fetchPayments(); }, [filters]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const data = await apiService.getFeePayments({
        from: filters.from || undefined,
        to: filters.to || undefined,
        method: filters.method || undefined,
        includeReversed: filters.includeReversed || undefined,
        limit: 500,
      });
      setPayments(data.payments || []);
      setSummary(data.summary);
    } catch (error) {
      showToast(errorText(error, 'Could not load the payments'), 'error');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const reverse = async (p: FeePaymentRow) => {
    const reason = window.prompt(
      `Reverse the ${money(p.amount)} recorded for ${p.assessment?.student?.name}?\n\n`
      + 'The payment stays on the record with your reason, and the student will owe it again. Say why:'
    );
    if (!reason?.trim()) return;
    try {
      const res = await apiService.reverseFeePayment(p.id, reason.trim());
      showToast(res.message, 'success');
      await fetchPayments();
    } catch (error) {
      showToast(errorText(error, 'Could not reverse the payment'), 'error');
    }
  };

  const downloadCsv = async () => {
    try {
      const blob = await apiService.exportFeePaymentsCsv({
        from: filters.from || undefined,
        to: filters.to || undefined,
        method: filters.method || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fee-payments-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast(errorText(error, 'Could not export the payments'), 'error');
    }
  };

  return (
    <div className="fee-page">
      <PageHelp pageKey="fees/payments" />
      <FeeSubnav />

      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
      ))}

      <div className="page-header">
        <h1>Payments</h1>
        <div className="fee-header-actions">
          <button className="btn-secondary" onClick={downloadCsv}>Export CSV</button>
        </div>
      </div>

      <p className="page-intro">
        Every stamped slip that has been recorded, dated by the bank's stamp. This is the list to
        check against the bank statement — export it, and the two should agree.
      </p>

      <div className="fee-summary">
        <div><strong>{money(summary.received)}</strong><span>received in this list</span></div>
        <div><strong>{summary.count}</strong><span>slips recorded</span></div>
      </div>

      <div className="fee-pay-filters">
        <label>
          From
          <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </label>
        <label>
          To
          <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </label>
        <label>
          How
          <select
            value={filters.method}
            onChange={(e) => setFilters({ ...filters, method: e.target.value as '' | FeePaymentMethod })}
          >
            <option value="">Any</option>
            <option value="CASH">Cash</option>
            <option value="CERTIFIED_CHEQUE">Certified cheque</option>
          </select>
        </label>
        <label className="fee-check">
          <input
            type="checkbox" checked={filters.includeReversed}
            onChange={(e) => setFilters({ ...filters, includeReversed: e.target.checked })}
          />
          Show reversed
        </label>
      </div>

      {loading ? (
        <p className="fee-loading">Loading…</p>
      ) : payments.length === 0 ? (
        <div className="empty-state">
          <p>No payments recorded for this period. Record a stamped slip from the Balances page.</p>
        </div>
      ) : (
        <table className="data-table data-table--stack">
          <thead>
            <tr>
              <th>Paid on</th>
              <th>Student</th>
              <th>Fee</th>
              <th className="fee-num">Amount</th>
              <th>How</th>
              <th>Slip</th>
              <th>Recorded</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className={p.reversedAt ? 'fee-row--reversed' : ''}>
                <td data-label="Paid on">{new Date(p.paidOn).toLocaleDateString('en-JM')}</td>
                <td data-label="Student">
                  <strong>{p.assessment?.student?.name ?? '—'}</strong>
                  <span className="fee-sub">
                    {p.assessment?.student?.formClass ?? '—'} · {p.assessment?.student?.studentNumber ?? 'no number'}
                  </span>
                </td>
                <td data-label="Fee">
                  {p.assessment?.kind === 'INCIDENTAL' ? 'Incidental Fees' : 'School Fee'}
                  <span className="fee-sub">{p.assessment?.academicYear}</span>
                </td>
                <td data-label="Amount" className="fee-num"><strong>{money(p.amount)}</strong></td>
                <td data-label="How">{METHOD_LABELS[p.method]}</td>
                <td data-label="Slip">
                  {p.voucherSerial ?? '—'}
                  {p.bankReference && <span className="fee-sub">{p.bankReference}</span>}
                </td>
                <td data-label="Recorded">
                  {new Date(p.recordedAt).toLocaleDateString('en-JM')}
                  {p.paidInBy && <span className="fee-sub">by {p.paidInBy}</span>}
                  {p.reversedAt && (
                    <span className="fee-reversed">Reversed{p.reverseReason ? `: ${p.reverseReason}` : ''}</span>
                  )}
                </td>
                {isAdmin && (
                  <td data-label="Actions" className="col-actions">
                    {!p.reversedAt && (
                      <button className="btn-link btn-danger-link" onClick={() => reverse(p)}>Reverse</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default FeePayments;
