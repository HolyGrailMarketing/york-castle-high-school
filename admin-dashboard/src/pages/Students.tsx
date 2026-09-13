import { useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api';
import type { StudentProfile, StudentVerification, YearGroupOption } from '../types';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import PageHelp from '../components/PageHelp';
import Hint from '../components/Hint';
import { useToast } from '../hooks/useToast';
import './Students.css';

type Tab = 'UNVERIFIED' | 'ALL' | 'OWES';

const TABS: { key: Tab; label: string }[] = [
  { key: 'UNVERIFIED', label: 'Not confirmed' },
  { key: 'ALL', label: 'All students' },
  { key: 'OWES', label: 'Owes money' },
];

const errorText = (error: unknown, fallback: string) =>
  (error as { error?: string })?.error || (error as Error)?.message || fallback;

const Students = () => {
  const [tab, setTab] = useState<Tab>('UNVERIFIED');
  const [query, setQuery] = useState('');
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [unverifiedCount, setUnverifiedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<YearGroupOption[]>([]);

  const [confirming, setConfirming] = useState<StudentProfile | null>(null);
  const [confirmForm, setConfirmForm] = useState({ formClass: '', studentNumber: '', note: '' });
  const [deskOpen, setDeskOpen] = useState(false);
  const [deskForm, setDeskForm] = useState({ name: '', email: '', formClass: '', studentNumber: '', guardianName: '', guardianPhone: '' });
  const [submitting, setSubmitting] = useState(false);

  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => { void fetchStudents(); }, [tab]);
  useEffect(() => {
    void apiService.getSchoolClasses()
      .then((d) => setClasses(d.yearGroups))
      .catch(() => setClasses([]));
  }, []);

  const allFormClasses = useMemo(() => classes.flatMap((y) => y.formClasses), [classes]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const data = await apiService.getStudents({
        q: query || undefined,
        verification: tab === 'UNVERIFIED' ? 'UNVERIFIED' : undefined,
        owes: tab === 'OWES' ? true : undefined,
        limit: 200,
      });
      setStudents(data.students || []);
      setUnverifiedCount(data.unverifiedCount ?? 0);
    } catch (error) {
      showToast(errorText(error, 'Could not load the student list'), 'error');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const openConfirm = (student: StudentProfile) => {
    setConfirmForm({
      // Default to what the student said, so the common case - they told the
      // truth - is one click. The office still has to look at the register.
      formClass: student.formClass || student.claimedFormClass || '',
      studentNumber: student.studentNumber || '',
      note: '',
    });
    setConfirming(student);
  };

  const submitConfirm = async (verification: StudentVerification) => {
    if (!confirming) return;
    setSubmitting(true);
    try {
      const result = await apiService.verifyStudent(confirming.id, {
        verification,
        formClass: verification === 'VERIFIED' ? confirmForm.formClass : undefined,
        studentNumber: confirmForm.studentNumber || undefined,
        note: confirmForm.note || undefined,
      });
      showToast(result.message, 'success');
      setConfirming(null);
      await fetchStudents();
    } catch (error) {
      showToast(errorText(error, 'Could not save'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const submitDesk = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await apiService.deskRegisterStudent({
        name: deskForm.name,
        email: deskForm.email || undefined,
        formClass: deskForm.formClass,
        studentNumber: deskForm.studentNumber || undefined,
        guardianName: deskForm.guardianName || undefined,
        guardianPhone: deskForm.guardianPhone || undefined,
      });
      showToast(result.message, 'success');
      setDeskOpen(false);
      setDeskForm({ name: '', email: '', formClass: '', studentNumber: '', guardianName: '', guardianPhone: '' });
      await fetchStudents();
    } catch (error) {
      showToast(errorText(error, 'Could not register the student'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  /** True when the office's confirmed class differs from what the student typed. */
  const classDisputed = (s: StudentProfile) =>
    s.claimedFormClass && s.formClass && s.claimedFormClass !== s.formClass;

  return (
    <div className="stu-page">
      <PageHelp pageKey="students" />

      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
      ))}

      <div className="page-header">
        <h1>Students</h1>
        <button className="btn-primary" onClick={() => setDeskOpen(true)}>
          Register at Desk
        </button>
      </div>

      <p className="page-intro">
        Students make their own account on the website and type their own year and class, so it has
        to be checked against the class register before they can borrow anything. Only a
        confirmed student<Hint term="verified-student" /> can be given books.
      </p>

      <div className="stu-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`stu-tab ${tab === t.key ? 'is-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === 'UNVERIFIED' && unverifiedCount > 0 && (
              <span className="stu-tab-count">{unverifiedCount}</span>
            )}
          </button>
        ))}
        <form
          className="stu-search"
          onSubmit={(e) => { e.preventDefault(); void fetchStudents(); }}
        >
          <input
            type="search"
            placeholder="Name, student number or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search students"
          />
          <button type="submit" className="btn-secondary">Search</button>
        </form>
      </div>

      {loading ? (
        <p className="stu-loading">Loading students...</p>
      ) : students.length === 0 ? (
        <div className="empty-state">
          <p>
            {tab === 'UNVERIFIED'
              ? 'Nobody is waiting to be confirmed. When a student signs up on the website they appear here.'
              : 'No students match.'}
          </p>
        </div>
      ) : (
        <table className="data-table data-table--stack">
          <thead>
            <tr>
              <th>Student</th>
              <th>Student number</th>
              <th>Year and class</th>
              <th>Status</th>
              <th>Books out</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td data-label="Student">
                  <strong>{s.name}</strong>
                  <span className="stu-email">{s.email.endsWith('@no-email.invalid') ? 'No email address' : s.email}</span>
                  {s.registeredAtDesk && <span className="stu-flag">Registered at the desk</span>}
                </td>
                <td data-label="Student number">{s.studentNumber || <span className="stu-muted">not set</span>}</td>
                <td data-label="Year and class">
                  {s.formClass ? <strong>{s.formClass}</strong> : <span className="stu-muted">not set</span>}
                  {classDisputed(s) && (
                    <span className="stu-claimed">student said {s.claimedFormClass}</span>
                  )}
                </td>
                <td data-label="Status">
                  <span className={`stu-status stu-status--${s.verification.toLowerCase()}`}>
                    {s.verification === 'VERIFIED' ? 'Confirmed'
                      : s.verification === 'REJECTED' ? 'Rejected'
                      : 'Not confirmed'}
                  </span>
                </td>
                <td data-label="Books out">{s.activeLoans}</td>
                <td data-label="Actions" className="col-actions">
                  <button className="btn-download" onClick={() => openConfirm(s)}>
                    {s.verification === 'VERIFIED' ? 'Change' : 'Confirm'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Confirm a student */}
      <Modal isOpen={confirming !== null} onClose={() => setConfirming(null)} title={`Confirm ${confirming?.name ?? ''}`}>
        <p className="stu-modal-intro">
          Check against the class register.{' '}
          {confirming?.claimedFormClass
            ? <>The student said they are in <strong>{confirming.claimedFormClass}</strong>.</>
            : 'The student did not say which class they are in.'}
        </p>
        <div className="form-group">
          <label>Form class</label>
          <select
            value={confirmForm.formClass}
            onChange={(e) => setConfirmForm({ ...confirmForm, formClass: e.target.value })}
          >
            <option value="">Choose a class</option>
            {classes.map((year) => (
              <optgroup key={year.yearGroup} label={year.label}>
                {year.formClasses.map((c) => <option key={c} value={c}>{c}</option>)}
              </optgroup>
            ))}
          </select>
          <span className="field-hint">Correct it here if the student got it wrong. Years 11 to 13 are one class each.</span>
        </div>
        <div className="form-group">
          <label>Student number</label>
          <input
            value={confirmForm.studentNumber}
            onChange={(e) => setConfirmForm({ ...confirmForm, studentNumber: e.target.value })}
            placeholder="Leave blank if you do not have it"
          />
        </div>
        <div className="form-group">
          <label>Note</label>
          <input
            value={confirmForm.note}
            onChange={(e) => setConfirmForm({ ...confirmForm, note: e.target.value })}
            placeholder="Optional"
          />
        </div>
        <div className="form-actions stu-confirm-actions">
          <button type="button" className="btn-secondary" onClick={() => setConfirming(null)}>Cancel</button>
          <button
            type="button"
            className="btn-delete"
            disabled={submitting}
            onClick={() => submitConfirm('REJECTED')}
          >
            Not a student here
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={submitting || !confirmForm.formClass}
            onClick={() => submitConfirm('VERIFIED')}
          >
            {submitting ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      </Modal>

      {/* Register at the desk */}
      <Modal isOpen={deskOpen} onClose={() => setDeskOpen(false)} title="Register a student at the desk">
        <form onSubmit={submitDesk}>
          <p className="stu-modal-intro">
            For a student standing in front of you without an account. This creates it and confirms
            them in one step, so the queue does not stop. <Hint term="desk-registration" />
          </p>
          <div className="form-group">
            <label>Full name</label>
            <input value={deskForm.name} onChange={(e) => setDeskForm({ ...deskForm, name: e.target.value })} required autoFocus />
          </div>
          <div className="stu-form-row">
            <div className="form-group">
              <label>Form class</label>
              <select value={deskForm.formClass} onChange={(e) => setDeskForm({ ...deskForm, formClass: e.target.value })} required>
                <option value="">Choose a class</option>
                {classes.map((year) => (
                  <optgroup key={year.yearGroup} label={year.label}>
                    {year.formClasses.map((c) => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Student number</label>
              <input value={deskForm.studentNumber} onChange={(e) => setDeskForm({ ...deskForm, studentNumber: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Email address</label>
            <input type="email" value={deskForm.email} onChange={(e) => setDeskForm({ ...deskForm, email: e.target.value })} />
            <span className="field-hint">
              Optional, but without one the student cannot sign in to see their books. They set their
              own password afterwards using "Forgot password" — never type a password for them.
            </span>
          </div>
          <div className="stu-form-row">
            <div className="form-group">
              <label>Parent or guardian</label>
              <input value={deskForm.guardianName} onChange={(e) => setDeskForm({ ...deskForm, guardianName: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Their phone number</label>
              <input value={deskForm.guardianPhone} onChange={(e) => setDeskForm({ ...deskForm, guardianPhone: e.target.value })} />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setDeskOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting || !deskForm.name || !deskForm.formClass}>
              {submitting ? 'Registering...' : 'Register and confirm'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Students;
