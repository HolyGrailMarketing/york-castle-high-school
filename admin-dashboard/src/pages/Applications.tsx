import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import type { Application } from '../types';
import { exportApplications, exportApplicationToPDF } from '../utils/export';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';
import './Applications.css';
import PageHelp from '../components/PageHelp';

const Applications = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const { toasts, showToast, removeToast } = useToast();
  const PAGE_SIZE = 20;

  // Reset to first page whenever the filter or search changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    fetchApplications();
  }, [statusFilter, searchTerm, page]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: PAGE_SIZE };
      if (statusFilter) params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;
      const data = await apiService.getApplications(params);
      setApplications(data.applications);
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

  const handleStatusUpdate = async (id: string, status: string, notes?: string) => {
    try {
      await apiService.updateApplicationStatus(id, status, notes);
      showToast(`Application ${status.toLowerCase().replace('_', ' ')} successfully!`, 'success');
      fetchApplications();
      setSelectedApp(null);
    } catch (error) {
      console.error('Failed to update status:', error);
      showToast('Failed to update application status', 'error');
    }
  };

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      // Fetch ALL applications matching the current filters, not just the current page.
      const params: any = { page: 1, limit: 100000 };
      if (statusFilter) params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;
      const data = await apiService.getApplications(params);
      const all = data.applications || [];
      if (all.length === 0) {
        showToast('No applications to export', 'warning');
        return;
      }
      exportApplications(all);
      showToast(`Exported ${all.length} application${all.length === 1 ? '' : 's'}!`, 'success');
    } catch (error) {
      console.error('Failed to export applications:', error);
      showToast('Failed to export applications', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = (app: Application) => {
    const ok = exportApplicationToPDF(app);
    if (!ok) {
      showToast('Please allow pop-ups to export a PDF', 'warning');
    }
  };

  if (loading) {
    return <div className="loading">Loading applications...</div>;
  }

  return (
    <div className="applications-page">
      <PageHelp pageKey="applications" />
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
      <div className="page-header">
        <h1>Applications</h1>
        <div className="header-actions">
          <button onClick={handleExport} className="btn-export" disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>
      <div className="filters">
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-select"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="WAITLISTED">Waitlisted</option>
        </select>
      </div>

      <div className="applications-list">
        <table className="data-table data-table--stack">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Grade</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => (
              <tr key={app.id}>
                <td data-label="Name" className="col-name">{app.firstName} {app.middleName} {app.lastName}</td>
                <td data-label="Email" className="col-email">{app.email}</td>
                <td data-label="Phone">{app.phone}</td>
                <td data-label="Grade">Grade {app.gradeApplying}</td>
                <td data-label="Status">
                  <span className={`status-badge status-${app.status.toLowerCase().replace('_', '-')}`}>
                    {app.status.replace('_', ' ')}
                  </span>
                </td>
                <td data-label="Submitted">{new Date(app.submittedAt).toLocaleDateString()}</td>
                <td data-label="Actions" className="col-actions">
                  <button onClick={() => setSelectedApp(app)} className="btn-view">View</button>
                  <button onClick={() => handleExportPDF(app)} className="btn-pdf">PDF</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
        <div className="modal-overlay" onClick={() => setSelectedApp(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Application Details</h2>
            <div className="app-details">
              <div><strong>Name:</strong> {selectedApp.firstName} {selectedApp.middleName} {selectedApp.lastName}</div>
              <div><strong>Email:</strong> {selectedApp.email}</div>
              <div><strong>Phone:</strong> {selectedApp.phone}</div>
              <div><strong>Date of Birth:</strong> {new Date(selectedApp.dateOfBirth).toLocaleDateString()}</div>
              <div><strong>Address:</strong> {selectedApp.address || 'N/A'}</div>
              <div><strong>Previous School:</strong> {selectedApp.previousSchool || 'N/A'}</div>
              <div><strong>Grade Applying:</strong> {selectedApp.gradeApplying}</div>
              <div><strong>Status:</strong> {selectedApp.status}</div>
              {selectedApp.notes && <div><strong>Notes:</strong> {selectedApp.notes}</div>}
            </div>
            <div className="status-actions">
              <h3>Update Status</h3>
              <div className="status-buttons">
                <button onClick={() => handleStatusUpdate(selectedApp.id, 'APPROVED')} className="btn-approve">Approve</button>
                <button onClick={() => handleStatusUpdate(selectedApp.id, 'REJECTED')} className="btn-reject">Reject</button>
                <button onClick={() => handleStatusUpdate(selectedApp.id, 'UNDER_REVIEW')} className="btn-review">Under Review</button>
                <button onClick={() => handleStatusUpdate(selectedApp.id, 'WAITLISTED')} className="btn-waitlist">Waitlist</button>
              </div>
            </div>
            <div className="modal-footer-actions">
              <button onClick={() => handleExportPDF(selectedApp)} className="btn-pdf-lg">Export as PDF</button>
              <button onClick={() => setSelectedApp(null)} className="btn-close">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Applications;

