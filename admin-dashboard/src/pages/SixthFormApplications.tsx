import { useEffect, useRef, useState } from 'react';
import { apiService } from '../services/api';
import type { SixthFormApplication, SixthFormInterview } from '../types';
import { exportSixthFormApplicationToPDF } from '../utils/export';
import Modal from '../components/Modal';
import './Applications.css';

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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'application' | 'interview'>('application');
  const [statusError, setStatusError] = useState('');

  // Bulk interview-invitation state
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteResult, setInviteResult] = useState<{
    message: string;
    invitedCount: number;
    failed: { id: string; email: string | null; reason: string }[];
  } | null>(null);

  // Interview state
  const [interview, setInterview] = useState<SixthFormInterview | null>(null);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewForm, setInterviewForm] = useState(emptyForm);
  const [interviewEditing, setInterviewEditing] = useState(false);
  const [interviewSaving, setInterviewSaving] = useState(false);
  const [interviewError, setInterviewError] = useState('');

  // Reset to first page whenever the filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    fetchApplications();
  }, [statusFilter, page]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: PAGE_SIZE };
      if (statusFilter) params.status = statusFilter;
      const data = await apiService.getSixthFormApplications(params);
      setApplications(data.applications);
      setSelectedIds(new Set());
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
    setSelectedIds(allSelected ? new Set() : new Set(applications.map((a) => a.id)));
  };

  const toggleSelectOne = (id: string) => {
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

  const handleSendInvitations = async () => {
    setInviteError('');
    setInviteSending(true);
    try {
      const result = await apiService.sendInterviewInvitations(Array.from(selectedIds));
      setInviteResult(result);
      fetchApplications();
    } catch (error: any) {
      setInviteError(error?.error || error?.message || 'Failed to send interview invitations.');
    } finally {
      setInviteSending(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading applications...</div>;
  }

  return (
    <div className="applications-page">
      <div className="page-header">
        <h1>Sixth Form Applications</h1>
        <div className="filters">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      <div className="bulk-actions-bar">
        <span className="bulk-actions-count">
          {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select applicants to send a bulk interview invitation'}
        </span>
        <button
          className="btn-invite"
          disabled={selectedIds.size === 0}
          onClick={() => { setInviteResult(null); setInviteError(''); setInviteModalOpen(true); }}
        >
          Send Interview Invitation{selectedIds.size > 1 ? 's' : ''}
        </button>
      </div>

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
                <th>Status</th>
                <th>Invitation</th>
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
                  <td data-label="Status" className="col-nowrap">
                    <span className={`status-badge status-${app.status.toLowerCase().replace('_', '-')}`}>
                      {app.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td data-label="Invitation" className="col-nowrap">
                    {app.interviewInvitedAt ? (
                      <span className="invited-badge" title={new Date(app.interviewInvitedAt).toLocaleString()}>
                        Invited {new Date(app.interviewInvitedAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="invited-badge invited-badge--none">Not invited</span>
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
                  </div>
                )}

                <h4 className="detail-section-heading">Programme Choice</h4>
                <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
                  {selectedApp.subjectChoices?.firstChoice && <li>1st Choice: {selectedApp.subjectChoices.firstChoice}</li>}
                  {selectedApp.subjectChoices?.secondChoice && <li>2nd Choice: {selectedApp.subjectChoices.secondChoice}</li>}
                </ul>

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

      {inviteModalOpen && (() => {
        const selectedApps = applications.filter((a) => selectedIds.has(a.id));
        const alreadyInvited = selectedApps.filter((a) => a.interviewInvitedAt);
        return (
          <Modal
            isOpen={inviteModalOpen}
            onClose={() => !inviteSending && setInviteModalOpen(false)}
            title="Send Interview Invitation"
            size="medium"
          >
            {!inviteResult ? (
              <>
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

                <h4 className="detail-section-heading">Recipients ({selectedApps.length})</h4>
                <ul className="invite-recipient-list">
                  {selectedApps.map((a) => (
                    <li key={a.id}>
                      <span>{a.firstName} {a.lastName} — {a.email}</span>
                      {a.interviewInvitedAt && (
                        <span className="invited-badge">Already invited {new Date(a.interviewInvitedAt).toLocaleDateString()}</span>
                      )}
                    </li>
                  ))}
                </ul>
                {alreadyInvited.length > 0 && (
                  <div className="interview-warning">
                    {alreadyInvited.length} of these applicants were already invited. Sending again will re-send the invitation email.
                  </div>
                )}
                {inviteError && <div className="interview-error">{inviteError}</div>}

                <div className="modal-footer-actions">
                  <button className="btn-close" onClick={() => setInviteModalOpen(false)} disabled={inviteSending}>Cancel</button>
                  <button className="btn-approve" onClick={handleSendInvitations} disabled={inviteSending}>
                    {inviteSending ? 'Sending…' : `Send to ${selectedApps.length}`}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="invite-result-summary">
                  {inviteResult.message}
                </div>
                {inviteResult.failed.length > 0 && (
                  <>
                    <h4 className="detail-section-heading">Failed ({inviteResult.failed.length})</h4>
                    <ul className="invite-recipient-list">
                      {inviteResult.failed.map((fail) => (
                        <li key={fail.id}>
                          <span>{fail.email || fail.id}</span>
                          <span>{fail.reason}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <div className="modal-footer-actions">
                  <button className="btn-close" onClick={() => setInviteModalOpen(false)}>Close</button>
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
