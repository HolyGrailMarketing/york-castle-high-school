import { useEffect, useRef, useState } from 'react';
import { apiService } from '../services/api';
import type {
  SixthFormApplication,
  SixthFormInterview,
  SixthFormNotificationType,
  SixthFormReadiness,
  SixthFormReadinessFilter,
} from '../types';
import { exportSixthFormApplicationToPDF } from '../utils/export';
import { streamLabel, programmeLabel, needsStreamSelection, csecReadiness } from '../utils/sixthForm';
import Modal from '../components/Modal';
import './Applications.css';

const NOTIFICATION_TYPES: { value: SixthFormNotificationType; label: string }[] = [
  { value: 'INTERVIEW_INVITATION', label: 'Interview Invitation' },
  { value: 'CXC_RESULTS_RELEASED', label: 'CXC Results Released' },
  { value: 'CUSTOM', label: 'Custom Announcement…' },
];
const NOTIFICATION_TYPE_LABELS: Record<SixthFormNotificationType, string> = {
  INTERVIEW_INVITATION: 'Interview Invitation',
  CXC_RESULTS_RELEASED: 'CXC Results Released',
  CUSTOM: 'Custom Announcement',
};

const RATINGS = [
  { value: 1, label: '1 – Poor' },
  { value: 2, label: '2 – Fair' },
  { value: 3, label: '3 – Good' },
  { value: 4, label: '4 – Very Good' },
  { value: 5, label: '5 – Excellent' },
];

const RATING_LABELS: Record<number, string> = {
  1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very Good', 5: 'Excellent',
};

const DECISION_LABELS: Record<string, string> = {
  RECOMMEND: 'Recommend for Admission',
  DO_NOT_RECOMMEND: 'Do Not Recommend',
  DEFER: 'Defer Decision',
};

// Every application stays PENDING until interview day, so what staff filter on
// is how ready each applicant is: real CXC grades on file, and Section D done.
const READINESS_OPTIONS: { value: SixthFormReadinessFilter; label: string }[] = [
  { value: '', label: 'All applicants' },
  { value: 'results-outstanding', label: 'CXC results outstanding' },
  { value: 'section-d-outstanding', label: 'Section D outstanding' },
  { value: 'either-outstanding', label: 'Either outstanding' },
  { value: 'ready', label: 'Ready for interview' },
];
const READINESS_LABELS: Record<string, string> = Object.fromEntries(
  READINESS_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label.toLowerCase()])
);

const emptyForm = {
  studentName: '',
  fullyMatriculated: false,
  awarenessMotivation: '' as any,
  knowledgeOfSchool: '' as any,
  appearance: '' as any,
  generalSuitability: '' as any,
  comments: '',
  decision: '',
};

const SixthFormApplications = () => {
  const PAGE_SIZE = 20;
  const [applications, setApplications] = useState<SixthFormApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<SixthFormApplication | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [readinessFilter, setReadinessFilter] = useState<SixthFormReadinessFilter>('');
  const [readiness, setReadiness] = useState<SixthFormReadiness | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'application' | 'interview'>('application');
  const [statusError, setStatusError] = useState('');

  // Bulk notification state
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [notifyType, setNotifyType] = useState<SixthFormNotificationType | ''>('');
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [notifySending, setNotifySending] = useState(false);
  const [notifyError, setNotifyError] = useState('');
  const [notifyResult, setNotifyResult] = useState<{
    message: string;
    notifiedCount: number;
    failed: { id: string; email: string | null; reason: string }[];
  } | null>(null);
  const [customSubject, setCustomSubject] = useState('');
  const [customMessage, setCustomMessage] = useState('');

  // "Select all matching the current filter" — reaches beyond the loaded page
  const [blastMode, setBlastMode] = useState(false);
  const [blastRecipients, setBlastRecipients] = useState<SixthFormApplication[] | null>(null);
  const [blastLoading, setBlastLoading] = useState(false);

  // Interview state
  const [interview, setInterview] = useState<SixthFormInterview | null>(null);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewForm, setInterviewForm] = useState(emptyForm);
  const [interviewEditing, setInterviewEditing] = useState(false);
  const [interviewSaving, setInterviewSaving] = useState(false);
  const [interviewError, setInterviewError] = useState('');

  // Reset to first page whenever a filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter, readinessFilter]);

  useEffect(() => {
    fetchApplications();
  }, [statusFilter, readinessFilter, page]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: PAGE_SIZE };
      if (statusFilter) params.status = statusFilter;
      if (readinessFilter) params.readiness = readinessFilter;
      const data = await apiService.getSixthFormApplications(params);
      setApplications(data.applications);
      setReadiness(data.readiness || null);
      setSelectedIds(new Set());
      setBlastMode(false);
      setBlastRecipients(null);
      if (data.pagination) {
        setTotalPages(data.pagination.pages || 1);
        setTotalCount(data.pagination.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = async (app: SixthFormApplication) => {
    setSelectedApp(app);
    setActiveTab('application');
    setStatusError('');
    setInterview(null);
    setInterviewEditing(false);
    setInterviewError('');

    setInterviewLoading(true);
    try {
      const data = await apiService.getInterview(app.id);
      setInterview(data.interview);
      if (data.interview) {
        setInterviewForm({
          studentName: data.interview.studentName,
          fullyMatriculated: data.interview.fullyMatriculated,
          awarenessMotivation: data.interview.awarenessMotivation ?? '',
          knowledgeOfSchool: data.interview.knowledgeOfSchool ?? '',
          appearance: data.interview.appearance ?? '',
          generalSuitability: data.interview.generalSuitability ?? '',
          comments: data.interview.comments ?? '',
          decision: data.interview.decision,
        });
      } else {
        const name = [app.firstName, app.middleName, app.lastName].filter(Boolean).join(' ');
        setInterviewForm({ ...emptyForm, studentName: name });
        setInterviewEditing(true);
      }
    } catch {
      const name = [app.firstName, app.middleName, app.lastName].filter(Boolean).join(' ');
      setInterviewForm({ ...emptyForm, studentName: name });
      setInterviewEditing(true);
    } finally {
      setInterviewLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedApp(null);
    setInterview(null);
    setInterviewEditing(false);
    setStatusError('');
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    setStatusError('');
    try {
      await apiService.updateSixthFormStatus(id, status);
      fetchApplications();
      closeModal();
    } catch (error: any) {
      const msg = error?.error || error?.message || 'Failed to update application status';
      setStatusError(msg);
    }
  };

  const handleInterviewSave = async () => {
    if (!selectedApp) return;
    if (!interviewForm.decision) {
      setInterviewError('Please select a decision.');
      return;
    }
    setInterviewError('');
    setInterviewSaving(true);
    try {
      const data = await apiService.saveInterview(selectedApp.id, interviewForm as any);
      setInterview(data.interview);
      setInterviewEditing(false);
    } catch (error: any) {
      setInterviewError(error?.error || error?.message || 'Failed to save interview.');
    } finally {
      setInterviewSaving(false);
    }
  };

  const f = (field: string) => (e: any) =>
    setInterviewForm((prev) => ({ ...prev, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  // Keep the header checkbox's indeterminate visual in sync with a partial selection
  useEffect(() => {
    if (selectAllRef.current) {
      const allSelected = applications.length > 0 && selectedIds.size === applications.length;
      selectAllRef.current.indeterminate = selectedIds.size > 0 && !allSelected;
    }
  }, [selectedIds, applications]);

  const toggleSelectAll = () => {
    const allSelected = applications.length > 0 && selectedIds.size === applications.length;
    setBlastMode(false);
    setBlastRecipients(null);
    setSelectedIds(allSelected ? new Set() : new Set(applications.map((a) => a.id)));
  };

  const toggleSelectOne = (id: string) => {
    setBlastMode(false);
    setBlastRecipients(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Reach beyond the loaded page: select every applicant matching the current
  // filters, not just the ones currently on screen. This is what turns the
  // readiness filter into a chase-up: filter to "CXC results outstanding",
  // select all matching, send.
  const selectAllMatching = async () => {
    setBlastLoading(true);
    try {
      const params: any = { page: 1, limit: totalCount };
      if (statusFilter) params.status = statusFilter;
      if (readinessFilter) params.readiness = readinessFilter;
      const data = await apiService.getSixthFormApplications(params);
      setBlastRecipients(data.applications);
      setBlastMode(true);
      setSelectedIds(new Set(data.applications.map((a) => a.id)));
    } catch (error) {
      console.error('Failed to select all matching applicants:', error);
    } finally {
      setBlastLoading(false);
    }
  };

  const handleSendNotifications = async () => {
    if (!notifyType) return;
    setNotifyError('');
    setNotifySending(true);
    try {
      const result = await apiService.sendSixthFormNotifications(
        Array.from(selectedIds),
        notifyType,
        notifyType === 'CUSTOM' ? customSubject : undefined,
        notifyType === 'CUSTOM' ? customMessage : undefined
      );
      setNotifyResult(result);
      fetchApplications();
    } catch (error: any) {
      setNotifyError(error?.error || error?.message || 'Failed to send notification.');
    } finally {
      setNotifySending(false);
    }
  };

  // Names whatever the list is currently narrowed to, for the bulk-select bar.
  const filterDescription = () => {
    const parts = [
      readinessFilter ? READINESS_LABELS[readinessFilter] : '',
      statusFilter ? statusFilter.replace('_', ' ').toLowerCase() : '',
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : 'all applicants';
  };

  if (loading) {
    return <div className="loading">Loading applications...</div>;
  }

  return (
    <div className="applications-page">
      <div className="page-header">
        <h1>Sixth Form Applications</h1>
        <div className="filters">
          <select
            value={readinessFilter}
            onChange={(e) => setReadinessFilter(e.target.value as SixthFormReadinessFilter)}
            className="filter-select"
            aria-label="Filter by interview readiness"
          >
            {READINESS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Counted across every page, so this is the whole cohort's progress —
          not just what is on screen. Each figure jumps to its own bucket. */}
      {readiness && readiness.total > 0 && (
        <div className="readiness-summary">
          <button
            type="button"
            className={`readiness-stat readiness-stat--outstanding${readinessFilter === 'results-outstanding' ? ' is-active' : ''}`}
            onClick={() => setReadinessFilter(readinessFilter === 'results-outstanding' ? '' : 'results-outstanding')}
          >
            <strong>{readiness.resultsOutstanding}</strong> of {readiness.total} still to update CXC results
          </button>
          <button
            type="button"
            className={`readiness-stat readiness-stat--outstanding${readinessFilter === 'section-d-outstanding' ? ' is-active' : ''}`}
            onClick={() => setReadinessFilter(readinessFilter === 'section-d-outstanding' ? '' : 'section-d-outstanding')}
          >
            <strong>{readiness.sectionDOutstanding}</strong> still to complete Section D
          </button>
          <button
            type="button"
            className={`readiness-stat readiness-stat--done${readinessFilter === 'ready' ? ' is-active' : ''}`}
            onClick={() => setReadinessFilter(readinessFilter === 'ready' ? '' : 'ready')}
          >
            <strong>{readiness.ready}</strong> ready for interview
          </button>
        </div>
      )}

      <div className="bulk-actions-bar">
        <span className="bulk-actions-count">
          {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select applicants to send a notification'}
        </span>
        <select
          className="filter-select"
          value={notifyType}
          onChange={(e) => setNotifyType(e.target.value as SixthFormNotificationType | '')}
          aria-label="Notification type"
        >
          <option value="">Send notification…</option>
          {NOTIFICATION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button
          className="btn-invite"
          disabled={selectedIds.size === 0 || !notifyType}
          onClick={() => { setNotifyResult(null); setNotifyError(''); setCustomSubject(''); setCustomMessage(''); setNotifyModalOpen(true); }}
        >
          Send
        </button>
      </div>

      {!blastMode && applications.length > 0 && selectedIds.size === applications.length && totalCount > applications.length && (
        <div className="bulk-actions-bar" style={{ marginTop: -8 }}>
          <span className="bulk-actions-count">
            All {applications.length} on this page are selected.
          </span>
          <button className="btn-invite" onClick={selectAllMatching} disabled={blastLoading}>
            {blastLoading ? 'Selecting…' : `Select all ${totalCount} matching ${filterDescription()}`}
          </button>
        </div>
      )}
      {blastMode && (
        <div className="bulk-actions-bar" style={{ marginTop: -8 }}>
          <span className="bulk-actions-count">
            All {selectedIds.size} applicants matching {filterDescription()} are selected.
          </span>
          <button className="pagination-btn" onClick={() => { setBlastMode(false); setBlastRecipients(null); setSelectedIds(new Set()); }}>
            Clear
          </button>
        </div>
      )}

      <div className="applications-list">
        <div className="table-scroll">
          <table className="data-table data-table--stack">
            <thead>
              <tr>
                <th className="col-select">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={applications.length > 0 && selectedIds.size === applications.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all applicants on this page"
                  />
                </th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>CXC Results</th>
                <th>Section D</th>
                <th>Notifications</th>
                <th>Submitted</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} className={selectedIds.has(app.id) ? 'row-selected' : ''}>
                  <td className="col-select" data-label="Select">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(app.id)}
                      onChange={() => toggleSelectOne(app.id)}
                      aria-label={`Select ${app.firstName} ${app.lastName}`}
                    />
                  </td>
                  <td data-label="Name" className="col-name">{[app.firstName, app.middleName, app.lastName].filter(Boolean).join(' ')}</td>
                  <td data-label="Email" className="col-email">{app.email}</td>
                  <td data-label="Phone" className="col-nowrap">{app.phone}</td>
                  {/* Status is deliberately not a column: nothing moves off
                      PENDING until interview day, so it would be an identical
                      badge on every row. It stays in the View modal, where it
                      is also the place it gets changed. */}
                  <td data-label="CXC Results" className="col-nowrap">
                    {(() => {
                      const r = csecReadiness(app.csecResults);
                      if (r.updated) {
                        return (
                          <span className="readiness-badge readiness-badge--done" title={`${r.total} subject(s) graded`}>
                            Updated
                          </span>
                        );
                      }
                      if (r.graded > 0) {
                        return (
                          <span
                            className="readiness-badge readiness-badge--partial"
                            title={`${r.graded} of ${r.total} subject(s) graded`}
                          >
                            {r.pending} sitting
                          </span>
                        );
                      }
                      return <span className="readiness-badge readiness-badge--outstanding">Not updated</span>;
                    })()}
                  </td>
                  <td data-label="Section D" className="col-nowrap">
                    {needsStreamSelection(app.subjectChoices) ? (
                      <span className="readiness-badge readiness-badge--outstanding">Outstanding</span>
                    ) : (
                      <span
                        className="readiness-badge readiness-badge--done"
                        title={streamLabel(app.subjectChoices?.stream)}
                      >
                        {streamLabel(app.subjectChoices?.stream)}
                      </span>
                    )}
                  </td>
                  <td data-label="Notifications" className="col-nowrap">
                    {app.notifications && app.notifications.length > 0 ? (
                      <span className="invited-badge" title={new Date(app.notifications[0].sentAt).toLocaleString()}>
                        {NOTIFICATION_TYPE_LABELS[app.notifications[0].type]} {new Date(app.notifications[0].sentAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="invited-badge invited-badge--none">None sent</span>
                    )}
                  </td>
                  <td data-label="Submitted" className="col-nowrap">{new Date(app.submittedAt).toLocaleDateString()}</td>
                  <td data-label="Actions" className="col-actions">
                    <button onClick={() => openModal(app)} className="btn-view">View</button>
                    <button onClick={() => exportSixthFormApplicationToPDF(app)} className="btn-pdf">PDF</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {applications.length === 0 && (
          <div className="no-results">No applications found.</div>
        )}
      </div>

      {totalCount > 0 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Previous
          </button>
          <span className="pagination-info">
            Page {page} of {totalPages} ({totalCount} total)
          </span>
          <button
            className="pagination-btn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      )}

      {selectedApp && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Sixth Form Application Details</h2>

            {/* Tabs */}
            <div className="modal-tabs">
              <button
                className={`modal-tab ${activeTab === 'application' ? 'active' : ''}`}
                onClick={() => setActiveTab('application')}
              >
                Application
              </button>
              <button
                className={`modal-tab ${activeTab === 'interview' ? 'active' : ''}`}
                onClick={() => setActiveTab('interview')}
              >
                Interview
                {interview && <span className="tab-badge tab-badge--done">&#10003;</span>}
                {!interview && !interviewLoading && <span className="tab-badge tab-badge--pending">!</span>}
              </button>
            </div>

            {/* Application Details Tab */}
            {activeTab === 'application' && (
              <div className="app-details">
                <h4 className="detail-section-heading">Personal Information</h4>
                <div><strong>Name:</strong> {[selectedApp.firstName, selectedApp.middleName, selectedApp.lastName].filter(Boolean).join(' ')}</div>
                <div><strong>Email:</strong> {selectedApp.email}</div>
                <div><strong>Phone:</strong> {selectedApp.phone}</div>
                <div><strong>Date of Birth:</strong> {new Date(selectedApp.dateOfBirth).toLocaleDateString()}</div>
                {selectedApp.gender && <div><strong>Gender:</strong> {selectedApp.gender}</div>}
                {selectedApp.religion && <div><strong>Religion:</strong> {selectedApp.religion}</div>}
                {selectedApp.nationality && <div><strong>Nationality:</strong> {selectedApp.nationality}</div>}
                {selectedApp.yearsOfResidence != null && <div><strong>Years of Residence:</strong> {selectedApp.yearsOfResidence}</div>}
                {selectedApp.address && <div><strong>Address:</strong> {selectedApp.address}</div>}

                {selectedApp.guardianInfo && (
                  <>
                    <h4 className="detail-section-heading">Parent / Guardian</h4>
                    {(selectedApp.guardianInfo.firstName || selectedApp.guardianInfo.lastName) && (
                      <div><strong>Name:</strong> {[selectedApp.guardianInfo.firstName, selectedApp.guardianInfo.lastName].filter(Boolean).join(' ')}</div>
                    )}
                    {selectedApp.guardianInfo.relationship && <div><strong>Relationship:</strong> {selectedApp.guardianInfo.relationship}</div>}
                    {selectedApp.guardianInfo.cellPhone && <div><strong>Cell Phone:</strong> {selectedApp.guardianInfo.cellPhone}</div>}
                    {selectedApp.guardianInfo.homePhone && <div><strong>Home Phone:</strong> {selectedApp.guardianInfo.homePhone}</div>}
                    {selectedApp.guardianInfo.workPhone && <div><strong>Work Phone:</strong> {selectedApp.guardianInfo.workPhone}</div>}
                    {(selectedApp.guardianInfo.address || selectedApp.guardianInfo.town || selectedApp.guardianInfo.parish) && (
                      <div><strong>Address:</strong> {[selectedApp.guardianInfo.address, selectedApp.guardianInfo.town, selectedApp.guardianInfo.parish].filter(Boolean).join(', ')}</div>
                    )}
                  </>
                )}

                <h4 className="detail-section-heading">Academic Background</h4>
                <div><strong>Previous School:</strong> {selectedApp.previousSchool || 'N/A'}</div>
                {selectedApp.positionsHeld && <div><strong>Positions Held:</strong> {selectedApp.positionsHeld}</div>}

                {selectedApp.csecResults && Array.isArray(selectedApp.csecResults) && selectedApp.csecResults.length > 0 && (
                  <div>
                    <strong>CSEC Results:</strong>
                    <div className="csec-table-wrapper">
                      <table className="csec-table">
                        <thead>
                          <tr><th>Subject</th><th>Grade</th></tr>
                        </thead>
                        <tbody>
                          {selectedApp.csecResults.map((result: any, i: number) => (
                            <tr key={i}>
                              <td>{result.subject}</td>
                              <td>{result.grade}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {csecReadiness(selectedApp.csecResults).pending > 0 && (
                      <p className="detail-warning-note">
                        {csecReadiness(selectedApp.csecResults).pending} subject(s) still marked
                        &ldquo;Sitting&rdquo; — the applicant has not entered those grades yet.
                      </p>
                    )}
                  </div>
                )}

                <h4 className="detail-section-heading">CAPE Subject Stream Selection</h4>
                <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
                  {selectedApp.subjectChoices?.coreSubject && <li>Core Subject: {selectedApp.subjectChoices.coreSubject}</li>}
                  {selectedApp.subjectChoices?.stream && <li>Stream: {streamLabel(selectedApp.subjectChoices.stream)}</li>}
                  {selectedApp.subjectChoices?.streamSubjects?.length > 0 && (
                    <li>Subjects: {selectedApp.subjectChoices.streamSubjects.join(', ')}</li>
                  )}
                  {selectedApp.subjectChoices?.preferredStream && <li>Preferred Stream: {selectedApp.subjectChoices.preferredStream}</li>}
                  {selectedApp.subjectChoices?.alternativeStream && <li>Alternative Stream: {selectedApp.subjectChoices.alternativeStream}</li>}

                  {/* Applications submitted before the stream section existed kept a
                      first/second programme choice — still the only subject preference
                      on file for those applicants, so show it rather than nothing. */}
                  {selectedApp.subjectChoices?.firstChoice && (
                    <li>Programme choice (submitted before subject streams): {programmeLabel(selectedApp.subjectChoices.firstChoice)}
                      {selectedApp.subjectChoices.secondChoice && `, then ${programmeLabel(selectedApp.subjectChoices.secondChoice)}`}
                    </li>
                  )}
                </ul>
                {needsStreamSelection(selectedApp.subjectChoices) && (
                  <p className="detail-warning-note">
                    Subject stream selection not yet completed — collect Section D at the interview.
                  </p>
                )}

                {(selectedApp.reasonForAttending || selectedApp.careerGoals || selectedApp.strengthsWeaknesses) && (
                  <>
                    <h4 className="detail-section-heading">Personal Statement</h4>
                    {selectedApp.reasonForAttending && (
                      <div><strong>Reason for Attending:</strong><p style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap' }}>{selectedApp.reasonForAttending}</p></div>
                    )}
                    {selectedApp.careerGoals && (
                      <div><strong>Career Goals:</strong><p style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap' }}>{selectedApp.careerGoals}</p></div>
                    )}
                    {selectedApp.strengthsWeaknesses && (
                      <div><strong>Strengths & Weaknesses:</strong><p style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap' }}>{selectedApp.strengthsWeaknesses}</p></div>
                    )}
                  </>
                )}

                <h4 className="detail-section-heading">Status</h4>
                <div><strong>Status:</strong> {selectedApp.status}</div>
                {selectedApp.notes && <div><strong>Notes:</strong> {selectedApp.notes}</div>}
              </div>
            )}

            {/* Interview Tab */}
            {activeTab === 'interview' && (
              <div className="interview-section">
                {interviewLoading ? (
                  <div className="loading" style={{ padding: '20px 0' }}>Loading interview...</div>
                ) : interview && !interviewEditing ? (
                  // View saved interview
                  <div className="app-details">
                    <h4 className="detail-section-heading">Interview Record</h4>
                    <div><strong>Student Name:</strong> {interview.studentName}</div>
                    <div><strong>Applicant Fully Matriculated:</strong> {interview.fullyMatriculated ? 'Yes' : 'No'}</div>
                    {interview.awarenessMotivation != null && (
                      <div><strong>Awareness, Motivation & Verbal Expression:</strong> {RATING_LABELS[interview.awarenessMotivation]} ({interview.awarenessMotivation}/5)</div>
                    )}
                    {interview.knowledgeOfSchool != null && (
                      <div><strong>Knowledge of School:</strong> {RATING_LABELS[interview.knowledgeOfSchool]} ({interview.knowledgeOfSchool}/5)</div>
                    )}
                    {interview.appearance != null && (
                      <div><strong>Appearance:</strong> {RATING_LABELS[interview.appearance]} ({interview.appearance}/5)</div>
                    )}
                    {interview.generalSuitability != null && (
                      <div><strong>General Suitability:</strong> {RATING_LABELS[interview.generalSuitability]} ({interview.generalSuitability}/5)</div>
                    )}
                    {interview.comments && <div><strong>Comments:</strong><p style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap' }}>{interview.comments}</p></div>}
                    <div><strong>Decision:</strong> <span className={`decision-badge decision-${interview.decision.toLowerCase().replace('_', '-')}`}>{DECISION_LABELS[interview.decision]}</span></div>
                    <div><strong>Created By:</strong> {interview.createdByName}</div>
                    <div><strong>Created On:</strong> {new Date(interview.createdAt).toLocaleString()}</div>
                    <button className="btn-edit-interview" onClick={() => setInterviewEditing(true)}>Edit Interview</button>
                  </div>
                ) : (
                  // Interview form
                  <div className="interview-form">
                    <h4 className="detail-section-heading">{interview ? 'Edit Interview' : 'Record Interview'}</h4>

                    <div className="form-field">
                      <label>Student Name</label>
                      <input className="form-input" value={interviewForm.studentName} onChange={f('studentName')} />
                    </div>

                    <div className="form-field form-field--checkbox">
                      <label>
                        <input type="checkbox" checked={interviewForm.fullyMatriculated} onChange={f('fullyMatriculated')} />
                        Applicant Fully Matriculated
                      </label>
                    </div>

                    <div className="form-field">
                      <label>Awareness, Motivation & Verbal Expression</label>
                      <select className="form-input" value={interviewForm.awarenessMotivation} onChange={f('awarenessMotivation')}>
                        <option value="">— Select rating —</option>
                        {RATINGS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Knowledge of School</label>
                      <select className="form-input" value={interviewForm.knowledgeOfSchool} onChange={f('knowledgeOfSchool')}>
                        <option value="">— Select rating —</option>
                        {RATINGS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Appearance</label>
                      <select className="form-input" value={interviewForm.appearance} onChange={f('appearance')}>
                        <option value="">— Select rating —</option>
                        {RATINGS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>General Suitability</label>
                      <select className="form-input" value={interviewForm.generalSuitability} onChange={f('generalSuitability')}>
                        <option value="">— Select rating —</option>
                        {RATINGS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Comments</label>
                      <textarea className="form-input" rows={4} value={interviewForm.comments} onChange={f('comments')} placeholder="Additional notes…" />
                    </div>

                    <div className="form-field">
                      <label>Decision <span style={{ color: '#dc3545' }}>*</span></label>
                      <select className="form-input" value={interviewForm.decision} onChange={f('decision')}>
                        <option value="">— Select decision —</option>
                        <option value="RECOMMEND">Recommend for Admission</option>
                        <option value="DO_NOT_RECOMMEND">Do Not Recommend</option>
                        <option value="DEFER">Defer Decision</option>
                      </select>
                    </div>

                    {interviewError && <div className="interview-error">{interviewError}</div>}

                    <div className="interview-actions">
                      <button className="btn-approve" onClick={handleInterviewSave} disabled={interviewSaving}>
                        {interviewSaving ? 'Saving…' : 'Save Interview'}
                      </button>
                      {interview && (
                        <button className="btn-close-inline" onClick={() => setInterviewEditing(false)}>Cancel</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Status actions */}
            <div className="status-actions">
              <h3>Update Status</h3>
              {statusError && <div className="interview-error">{statusError}</div>}
              {!interview && (
                <div className="interview-warning">
                  Complete the <button className="link-btn" onClick={() => setActiveTab('interview')}>Interview</button> before approving.
                </div>
              )}
              <div className="status-buttons">
                <button
                  onClick={() => handleStatusUpdate(selectedApp.id, 'APPROVED')}
                  className="btn-approve"
                  disabled={!interview}
                  title={!interview ? 'Complete the interview first' : ''}
                >
                  Approve
                </button>
                <button onClick={() => handleStatusUpdate(selectedApp.id, 'REJECTED')} className="btn-reject">Reject</button>
                <button onClick={() => handleStatusUpdate(selectedApp.id, 'UNDER_REVIEW')} className="btn-review">Under Review</button>
              </div>
            </div>

            <div className="modal-footer-actions">
              <button
                onClick={() => exportSixthFormApplicationToPDF(selectedApp, interview)}
                className="btn-pdf-lg"
              >
                Export as PDF{interview ? ' (with interview)' : ''}
              </button>
              <button onClick={closeModal} className="btn-close">Close</button>
            </div>
          </div>
        </div>
      )}

      {notifyModalOpen && notifyType && (() => {
        const pool = blastMode && blastRecipients ? blastRecipients : applications;
        const selectedApps = pool.filter((a) => selectedIds.has(a.id));
        const alreadyNotified = selectedApps.filter((a) => a.notifications?.some((n) => n.type === notifyType));
        const title = NOTIFICATION_TYPE_LABELS[notifyType];
        const customValid = notifyType !== 'CUSTOM' || (customSubject.trim().length > 0 && customMessage.trim().length > 0);
        return (
          <Modal
            isOpen={notifyModalOpen}
            onClose={() => !notifySending && setNotifyModalOpen(false)}
            title={`Send ${title}`}
            size="medium"
          >
            {!notifyResult ? (
              <>
                {notifyType === 'INTERVIEW_INVITATION' && (
                  <div className="invite-session-details">
                    <h4 className="detail-section-heading">Fixed Interview Session</h4>
                    <div><strong>Date:</strong> Tuesday, August 25, 2026</div>
                    <div><strong>Time:</strong> 8:30 a.m.</div>
                    <div><strong>Location:</strong> York Castle High School, Brown's Town, St. Ann</div>
                    <div><strong>Processing Fee:</strong> J$2,000 (non-refundable, payable on the day)</div>
                    <div style={{ marginTop: 8 }}>
                      <strong>Documents to bring:</strong>
                      <ul>
                        <li>Copy of birth certificate</li>
                        <li>Copy of TRN</li>
                        <li>Copy of SRN</li>
                        <li>Copy of CSEC results</li>
                        <li>Two passport-sized photographs</li>
                        <li>Last two school reports</li>
                        <li>Two recommendation letters (Principal, Teacher, JP, or Minister of Religion)</li>
                      </ul>
                    </div>
                  </div>
                )}

                {notifyType === 'CXC_RESULTS_RELEASED' && (
                  <div className="invite-session-details">
                    <h4 className="detail-section-heading">Preview</h4>
                    <p>
                      Tells each applicant CXC/CSEC results are out and to sign in
                      (with their application password, Forgot Password, or
                      Continue with Google) and use the "Update CXC Results"
                      button on their application status page.
                    </p>
                  </div>
                )}

                {notifyType === 'CUSTOM' && (
                  <div className="invite-session-details">
                    <h4 className="detail-section-heading">Compose Announcement</h4>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Subject</label>
                      <input
                        type="text"
                        value={customSubject}
                        onChange={(e) => setCustomSubject(e.target.value)}
                        maxLength={200}
                        placeholder="e.g. Important update about your application"
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Message</label>
                      <textarea
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        maxLength={5000}
                        rows={6}
                        placeholder="Write your announcement. Separate paragraphs with a blank line."
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, resize: 'vertical' }}
                      />
                    </div>
                    <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                      This will be wrapped in the standard York Castle branded email template.
                    </p>
                  </div>
                )}

                <h4 className="detail-section-heading">Recipients ({selectedApps.length})</h4>
                <ul className="invite-recipient-list">
                  {selectedApps.map((a) => {
                    const lastForType = a.notifications?.find((n) => n.type === notifyType);
                    return (
                      <li key={a.id}>
                        <span>{a.firstName} {a.lastName} — {a.email}</span>
                        {lastForType && (
                          <span className="invited-badge">Already sent {new Date(lastForType.sentAt).toLocaleDateString()}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {alreadyNotified.length > 0 && notifyType !== 'CUSTOM' && (
                  <div className="interview-warning">
                    {alreadyNotified.length} of these applicants already received "{title}". Sending again will re-send it.
                  </div>
                )}
                {notifyError && <div className="interview-error">{notifyError}</div>}

                <div className="modal-footer-actions">
                  <button className="btn-close" onClick={() => setNotifyModalOpen(false)} disabled={notifySending}>Cancel</button>
                  <button className="btn-approve" onClick={handleSendNotifications} disabled={notifySending || !customValid}>
                    {notifySending ? 'Sending…' : `Send to ${selectedApps.length}`}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="invite-result-summary">
                  {notifyResult.message}
                </div>
                {notifyResult.failed.length > 0 && (
                  <>
                    <h4 className="detail-section-heading">Failed ({notifyResult.failed.length})</h4>
                    <ul className="invite-recipient-list">
                      {notifyResult.failed.map((fail) => (
                        <li key={fail.id}>
                          <span>{fail.email || fail.id}</span>
                          <span>{fail.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <div className="modal-footer-actions">
                  <button className="btn-close" onClick={() => setNotifyModalOpen(false)}>Close</button>
                </div>
              </>
            )}
          </Modal>
        );
      })()}
    </div>
  );
};

export default SixthFormApplications;
