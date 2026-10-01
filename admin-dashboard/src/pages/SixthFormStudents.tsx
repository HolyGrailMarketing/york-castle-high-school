import { useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api';
import type {
  SixthFormStudentRow, SixthFormCohortSummary, SixthFormStudentDetail, VoucherPayload,
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import PageHelp from '../components/PageHelp';
import Hint from '../components/Hint';
import SixthFormSubnav from '../components/SixthFormSubnav';
import { useToast } from '../hooks/useToast';
import { printVouchers } from '../utils/voucher';
import './SixthFormStudents.css';

type Tab = 'record' | 'fees' | 'books' | 'application';

const TABS: { key: Tab; label: string }[] = [
  { key: 'record', label: 'Record' },
  { key: 'fees', label: 'Fees' },
  { key: 'books', label: 'Textbooks' },
  { key: 'application', label: 'Application & interview' },
];

const DECISION_LABELS: Record<string, string> = {
  RECOMMEND: 'Recommended',
  DO_NOT_RECOMMEND: 'Not recommended',
  DEFER: 'Deferred',
};

const money = (n: number) =>
  new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD', maximumFractionDigits: 2 }).format(n);

const date = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-JM', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const errorText = (e: unknown, fallback: string) =>
  (e as { error?: string })?.error || (e as Error)?.message || fallback;

const SixthFormStudents = () => {
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'STAFF';

  const [students, setStudents] = useState<SixthFormStudentRow[]>([]);
  const [summary, setSummary] = useState<SixthFormCohortSummary | null>(null);
  const [faculties, setFaculties] = useState<string[]>([]);
  const [filters, setFilters] = useState({ yearGroup: '', faculty: '', owing: false });
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SixthFormStudentDetail | null>(null);
  const [tab, setTab] = useState<Tab>('record');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    formClass: '', studentNumber: '', faculty: '',
    guardianName: '', guardianPhone: '', guardianEmail: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => { void fetchStudents(); }, [filters]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const data = await apiService.getSixthFormStudents({
        yearGroup: filters.yearGroup ? Number(filters.yearGroup) : undefined,
        faculty: filters.faculty || undefined,
        owing: filters.owing || undefined,
        q: query || undefined,
      });
      setStudents(data.students || []);
      setSummary(data.summary);
      setFaculties(data.faculties || []);
    } catch (error) {
      showToast(errorText(error, 'Could not load the sixth form cohort'), 'error');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const openStudent = async (id: string) => {
    setOpenId(id); setDetail(null); setTab('record'); setEditing(false);
    try {
      const d = await apiService.getSixthFormStudent(id);
      setDetail(d);
      setForm({
        formClass: d.student.profile?.formClass ?? '',
        studentNumber: d.student.profile?.studentNumber ?? '',
        faculty: d.student.faculty ?? '',
        guardianName: d.student.profile?.guardianName ?? '',
        guardianPhone: d.student.profile?.guardianPhone ?? '',
        guardianEmail: d.student.profile?.guardianEmail ?? '',
        notes: d.student.profile?.notes ?? '',
      });
    } catch (error) {
      showToast(errorText(error, 'Could not load the student'), 'error');
      setOpenId(null);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openId) return;
    setSaving(true);
    try {
      const res = await apiService.updateSixthFormStudent(openId, {
        formClass: form.formClass || undefined,
        studentNumber: form.studentNumber,
        faculty: form.faculty,
        guardianName: form.guardianName,
        guardianPhone: form.guardianPhone,
        guardianEmail: form.guardianEmail,
        notes: form.notes,
      });
      showToast(res.message, 'success');
      setEditing(false);
      await openStudent(openId);
      await fetchStudents();
    } catch (error) {
      showToast(errorText(error, 'Could not save the record'), 'error');
    } finally {
      setSaving(false);
    }
  };

  /** Print a slip for a fee straight from the student's record. */
  const printSlip = async (assessmentId: string) => {
    try {
      const res = await apiService.issueFeeVoucher(assessmentId);
      printVouchers([res.voucher as VoucherPayload]);
      void apiService.markFeeVoucherPrinted(res.voucher.id).catch(() => {});
      showToast(res.message, 'success');
      if (openId) await openStudent(openId);
    } catch (error) {
      showToast(errorText(error, 'Could not create the slip'), 'error');
    }
  };

  const downloadCsv = async () => {
    try {
      const blob = await apiService.exportSixthFormStudentsCsv({
        yearGroup: filters.yearGroup ? Number(filters.yearGroup) : undefined,
        faculty: filters.faculty || undefined,
        owing: filters.owing || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sixth-form-students-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast(errorText(error, 'Could not export the cohort'), 'error');
    }
  };

  /** What is still owed, and anything paid over the top, kept apart. */
  const owedNow = useMemo(
    () => (detail?.fees.assessments ?? [])
      .filter((a) => a.status !== 'CANCELLED')
      .reduce((sum, a) => sum + Math.max(0, a.balance), 0),
    [detail]
  );
  const overpaidNow = useMemo(
    () => (detail?.fees.assessments ?? [])
      .filter((a) => a.status !== 'CANCELLED')
      .reduce((sum, a) => sum + Math.max(0, -a.balance), 0),
    [detail]
  );

  const csecRows = useMemo(() => {
    const r = detail?.application?.csecResults;
    if (!r) return [];
    if (Array.isArray(r)) return r;
    if (Array.isArray(r.subjects)) return r.subjects;
    return Object.entries(r).map(([subject, grade]) => ({ subject, grade }));
  }, [detail]);

  return (
    <div className="sf-page">
      <PageHelp pageKey="sixth-form/students" />
      <SixthFormSubnav />

      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
      ))}

      <div className="page-header">
        <h1>Sixth Form Students</h1>
        <div className="sf-header-actions">
          <button className="btn-secondary" onClick={downloadCsv}>Export CSV</button>
        </div>
      </div>

      <p className="page-intro">
        Everyone enrolled in Grades 12 and 13, with what they owe and what they are holding.
        Open a student for their full record — the fees they have been charged, the textbooks they
        have out, and the application and interview they were admitted on.
      </p>

      {summary && (
        <div className="sf-summary">
          <div><strong>{summary.students}</strong><span>in sixth form</span></div>
          <div><strong>{summary.owing}</strong><span>owing fees</span></div>
          <div><strong>{money(summary.outstanding)}</strong><span>outstanding</span></div>
          <div><strong>{summary.booksOut}</strong><span>textbooks out</span></div>
          {summary.overdue > 0 && (
            <div className="is-warning"><strong>{summary.overdue}</strong><span>overdue</span></div>
          )}
          {/* A sixth former with no faculty was never placed. Once term has
              started that is a loose end, not a normal state. */}
          {summary.unplaced > 0 && (
            <div className="is-warning">
              <strong>{summary.unplaced}</strong>
              <span>not placed<Hint term="faculty" /></span>
            </div>
          )}
        </div>
      )}

      <div className="sf-filters">
        <select
          value={filters.yearGroup}
          onChange={(e) => setFilters({ ...filters, yearGroup: e.target.value })}
          aria-label="Grade"
        >
          <option value="">Grades 12 and 13</option>
          <option value="12">Grade 12</option>
          <option value="13">Grade 13</option>
        </select>
        <select
          value={filters.faculty}
          onChange={(e) => setFilters({ ...filters, faculty: e.target.value })}
          aria-label="Faculty"
        >
          <option value="">All faculties</option>
          {faculties.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <label className="sf-check">
          <input
            type="checkbox"
            checked={filters.owing}
            onChange={(e) => setFilters({ ...filters, owing: e.target.checked })}
          />
          Only those who owe
        </label>
        <form className="sf-search" onSubmit={(e) => { e.preventDefault(); void fetchStudents(); }}>
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
        <p className="sf-loading">Loading…</p>
      ) : students.length === 0 ? (
        <div className="empty-state">
          <p>
            Nobody matches. Approved applicants become students on the{' '}
            <strong>Applicants</strong> tab — select them and choose “Enrol as students”.
          </p>
        </div>
      ) : (
        <table className="data-table data-table--stack">
          <thead>
            <tr>
              <th>Student</th>
              <th>Grade</th>
              <th>Faculty<Hint term="faculty" /></th>
              <th>Guardian</th>
              <th className="sf-num">Fees owing</th>
              <th className="sf-num">Books</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td data-label="Student">
                  <strong>{s.name}</strong>
                  <span className="sf-sub">{s.studentNumber ?? 'no student number'}</span>
                  {!s.email && <span className="sf-flag">No email address</span>}
                </td>
                <td data-label="Grade">{s.yearGroup ?? '—'}</td>
                <td data-label="Faculty">
                  {s.faculty
                    ? <span className="faculty-badge">{s.faculty}</span>
                    : <span className="faculty-badge faculty-badge--none">Not placed</span>}
                </td>
                <td data-label="Guardian">
                  {s.guardianName ?? '—'}
                  {s.guardianPhone && <span className="sf-sub">{s.guardianPhone}</span>}
                </td>
                <td data-label="Fees owing" className="sf-num">
                  {s.fees.balance > 0
                    ? <strong className="sf-owing">{money(s.fees.balance)}</strong>
                    : <span className="sf-clear">Clear</span>}
                </td>
                <td data-label="Books" className="sf-num">
                  {s.books.out > 0 ? `${s.books.out} out` : '—'}
                  {s.books.overdue > 0 && <span className="sf-flag">{s.books.overdue} overdue</span>}
                  {s.books.owes > 0 && <span className="sf-sub">{money(s.books.owes)} owed</span>}
                </td>
                <td data-label="Actions" className="col-actions">
                  <button className="btn-link" onClick={() => openStudent(s.id)}>Open</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal
        isOpen={!!openId}
        onClose={() => { setOpenId(null); setDetail(null); }}
        title={detail ? detail.student.name : 'Student'}
        size="large"
      >
        {!detail ? (
          <p className="sf-loading">Loading…</p>
        ) : (
          <div className="sf-detail">
            <div className="sf-detail-head">
              <div>
                <span className="sf-sub">
                  Grade {detail.student.profile?.yearGroup ?? '—'}
                  {' · '}{detail.student.profile?.studentNumber ?? 'no student number'}
                  {detail.student.faculty ? ` · ${detail.student.faculty}` : ' · not placed'}
                </span>
                <span className="sf-sub">
                  {detail.student.email ?? 'No email address on file'}
                  {detail.student.phone ? ` · ${detail.student.phone}` : ''}
                </span>
              </div>
              <div className="sf-detail-totals">
                <span className={owedNow > 0 ? 'sf-owing' : 'sf-clear'}>
                  {owedNow > 0 ? `${money(owedNow)} owing` : 'Fees clear'}
                </span>
              </div>
            </div>

            <div className="sf-tabs">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  className={`sf-tab ${tab === t.key ? 'is-active' : ''}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'record' && (
              editing ? (
                <form className="sf-form" onSubmit={save}>
                  <div className="sf-form-row">
                    <div className="form-group">
                      <label htmlFor="sf-grade">Grade</label>
                      <select
                        id="sf-grade" value={form.formClass}
                        onChange={(e) => setForm({ ...form, formClass: e.target.value })}
                      >
                        <option value="12">Grade 12</option>
                        <option value="13">Grade 13</option>
                      </select>
                      <span className="field-hint">Sixth form only. Moving a student out of 12 or 13 is done on the student register.</span>
                    </div>
                    <div className="form-group">
                      <label htmlFor="sf-faculty">Faculty</label>
                      <select
                        id="sf-faculty" value={form.faculty}
                        onChange={(e) => setForm({ ...form, faculty: e.target.value })}
                      >
                        <option value="">Not placed</option>
                        {faculties.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                      <span className="field-hint">
                        The school's decision, which is not always what the student asked for.
                      </span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="sf-number">Student number</label>
                    <input
                      id="sf-number" type="text" value={form.studentNumber}
                      onChange={(e) => setForm({ ...form, studentNumber: e.target.value })}
                    />
                    <span className="field-hint">Must be unique across the school.</span>
                  </div>
                  <div className="sf-form-row">
                    <div className="form-group">
                      <label htmlFor="sf-gname">Guardian</label>
                      <input
                        id="sf-gname" type="text" value={form.guardianName}
                        onChange={(e) => setForm({ ...form, guardianName: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="sf-gphone">Guardian phone</label>
                      <input
                        id="sf-gphone" type="text" value={form.guardianPhone}
                        onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })}
                      />
                      <span className="field-hint">Who the office rings about fees.</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="sf-gemail">Guardian email</label>
                    <input
                      id="sf-gemail" type="email" value={form.guardianEmail}
                      onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="sf-notes">Notes</label>
                    <textarea
                      id="sf-notes" rows={3} value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                    <span className="field-hint">Anything the next person at the desk should know.</span>
                  </div>
                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                    <button type="submit" className="btn-primary" disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <table className="sf-kv">
                    <tbody>
                      <tr><td>Grade</td><td>{detail.student.profile?.yearGroup ?? '—'}</td></tr>
                      <tr><td>Faculty</td><td>{detail.student.faculty ?? 'Not placed'}</td></tr>
                      <tr><td>Student number</td><td>{detail.student.profile?.studentNumber ?? '—'}</td></tr>
                      <tr><td>Confirmed</td><td>{detail.student.profile?.verification === 'VERIFIED' ? `Yes, ${date(detail.student.profile?.verifiedAt)}` : 'No'}</td></tr>
                      <tr><td>Guardian</td><td>{detail.student.profile?.guardianName ?? '—'}</td></tr>
                      <tr><td>Guardian phone</td><td>{detail.student.profile?.guardianPhone ?? '—'}</td></tr>
                      <tr><td>Guardian email</td><td>{detail.student.profile?.guardianEmail ?? '—'}</td></tr>
                      <tr><td>Enrolled</td><td>{date(detail.application?.enrolledAt)}</td></tr>
                      <tr><td>Previous school</td><td>{detail.application?.previousSchool ?? '—'}</td></tr>
                      {detail.student.profile?.notes && (
                        <tr><td>Notes</td><td>{detail.student.profile.notes}</td></tr>
                      )}
                    </tbody>
                  </table>
                  {canEdit && (
                    <div className="form-actions">
                      <button className="btn-primary" onClick={() => setEditing(true)}>Edit record</button>
                    </div>
                  )}
                </>
              )
            )}

            {tab === 'fees' && (
              detail.fees.assessments.length === 0 ? (
                <div className="empty-state">
                  <p>Nothing charged yet. Fees are raised from the School Fees screen.</p>
                </div>
              ) : (
                <>
                  <div className="sf-summary sf-summary--inline">
                    <div><strong>{money(detail.fees.totals.charged)}</strong><span>charged</span></div>
                    <div><strong>{money(detail.fees.totals.paid)}</strong><span>paid</span></div>
                    <div><strong>{money(detail.fees.totals.waived)}</strong><span>written off</span></div>
                    {/* Summed from the fees that are actually owed. Netting an
                        overpayment on one fee against another that is unpaid
                        would show a smaller number than the student owes. */}
                    <div><strong>{money(owedNow)}</strong><span>outstanding</span></div>
                    {overpaidNow > 0 && (
                      <div className="is-warning">
                        <strong>{money(overpaidNow)}</strong><span>overpaid</span>
                      </div>
                    )}
                  </div>
                  {detail.fees.assessments.map((a) => (
                    <div key={a.id} className="sf-fee">
                      <div className="sf-fee-head">
                        <strong>{a.label}</strong>
                        <span>
                          {a.academicYear}{a.termLabel ? ` · ${a.termLabel}` : ''} · {a.status === 'SETTLED' ? 'Paid' : a.status === 'OUTSTANDING' ? 'Owing' : a.status === 'WAIVED' ? 'Written off' : 'Cancelled'}
                        </span>
                        {/* A bare negative figure reads as a mistake. An
                            overpayment is money the school never held and
                            cannot refund, so it is named. */}
                        <span className={`sf-fee-amt ${a.balance < 0 ? 'is-over' : ''}`}>
                          {a.balance > 0
                            ? `${money(a.balance)} owing`
                            : a.balance < 0
                              ? `${money(Math.abs(a.balance))} overpaid`
                              : 'Paid'}
                        </span>
                      </div>
                      <table className="sf-fee-lines">
                        <tbody>
                          {a.lines.map((l, i) => (
                            <tr key={i}><td>{l.label}</td><td className="sf-num">{money(l.amount)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                      {a.payments.length > 0 && (
                        <ul className="sf-payments">
                          {a.payments.map((p) => (
                            <li key={p.id} className={p.reversedAt ? 'is-reversed' : ''}>
                              {date(p.paidOn)} · {money(p.amount)} ·{' '}
                              {p.method === 'CASH' ? 'Cash' : 'Certified cheque'}
                              {p.voucherSerial ? ` · slip ${p.voucherSerial}` : ''}
                              {p.reversedAt && <em> — reversed</em>}
                            </li>
                          ))}
                        </ul>
                      )}
                      {canEdit && a.status === 'OUTSTANDING' && (
                        <button className="btn-link" onClick={() => printSlip(a.id)}>
                          Print a paying-in slip<Hint term="paying-in-voucher" />
                        </button>
                      )}
                    </div>
                  ))}
                </>
              )
            )}

            {tab === 'books' && (
              detail.books.loans.length === 0 && detail.books.charges.length === 0 ? (
                <div className="empty-state"><p>No textbooks have been issued to this student.</p></div>
              ) : (
                <>
                  {detail.books.owed > 0 && (
                    <p className="sf-warning">
                      {money(detail.books.owed)} owed for textbooks. This is separate from school
                      fees and is settled at the library counter.
                    </p>
                  )}
                  <table className="sf-kv sf-books">
                    <thead>
                      <tr><th>Book</th><th>Issued</th><th>Due</th><th>State</th></tr>
                    </thead>
                    <tbody>
                      {detail.books.loans.map((l) => (
                        <tr key={l.id} className={l.overdue ? 'is-overdue' : ''}>
                          <td>
                            {l.title}
                            <span className="sf-sub">{l.subject} · {l.barcode}</span>
                          </td>
                          <td>{date(l.issuedAt)}</td>
                          <td>{date(l.dueAt)}</td>
                          <td>
                            {l.returnedAt ? `Returned ${date(l.returnedAt)}`
                              : l.overdue ? <span className="sf-flag">Overdue</span> : 'Out'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )
            )}

            {tab === 'application' && (
              !detail.application ? (
                <div className="empty-state">
                  <p>
                    No sixth form application on file. This student was added to the register
                    directly rather than through the admissions process.
                  </p>
                </div>
              ) : (
                <>
                  <table className="sf-kv">
                    <tbody>
                      <tr><td>Applied</td><td>{date(detail.application.submittedAt)}</td></tr>
                      <tr><td>Decision</td><td>{detail.application.status.replace('_', ' ')}</td></tr>
                      <tr><td>Placed in</td><td>{detail.application.faculty ?? 'Not placed'}</td></tr>
                      {detail.application.careerGoals && (
                        <tr><td>Career goals</td><td>{detail.application.careerGoals}</td></tr>
                      )}
                    </tbody>
                  </table>

                  {csecRows.length > 0 && (
                    <>
                      <h4 className="sf-heading">CSEC results</h4>
                      <table className="sf-kv sf-csec">
                        <tbody>
                          {csecRows.map((r: any, i: number) => (
                            <tr key={i}>
                              <td>{r.subject}</td>
                              <td>{r.grade ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {detail.interview && (
                    <>
                      <h4 className="sf-heading">Interview</h4>
                      <table className="sf-kv">
                        <tbody>
                          <tr><td>Decision</td><td>{DECISION_LABELS[detail.interview.decision] ?? detail.interview.decision}</td></tr>
                          <tr><td>Fully matriculated</td><td>{detail.interview.fullyMatriculated ? 'Yes' : 'No'}</td></tr>
                          <tr><td>Seen by</td><td>{detail.interview.createdByName}</td></tr>
                          {detail.interview.comments && (
                            <tr><td>Comments</td><td>{detail.interview.comments}</td></tr>
                          )}
                        </tbody>
                      </table>
                    </>
                  )}

                  {detail.application.notifications && detail.application.notifications.length > 0 && (
                    <>
                      <h4 className="sf-heading">Letters sent</h4>
                      <ul className="sf-letters">
                        {detail.application.notifications.map((n, i) => (
                          <li key={i}>{date(n.sentAt)} — {n.subject}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SixthFormStudents;
