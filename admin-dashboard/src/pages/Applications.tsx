import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import type { Application } from '../types';
import { exportApplications } from '../utils/export';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';
import './Applications.css';

const Applications = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    fetchApplications();
  }, [statusFilter, searchTerm]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;
      const data = await apiService.getApplications(params);
      setApplications(data.applications);
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

  const handleExport = () => {
    if (applications.length === 0) {
      showToast('No applications to export', 'warning');
      return;
    }
    exportApplications(applications);
    showToast('Applications exported successfully!', 'success');
  };

  if (loading) {
    return <div className="loading">Loading applications...</div>;
  }

  return (
    <div className="applications-page">
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
          <button onClick={handleExport} className="btn-export">Export CSV</button>
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
        <table className="data-table">
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
                <td>{app.firstName} {app.middleName} {app.lastName}</td>
                <td>{app.email}</td>
                <td>{app.phone}</td>
                <td>Grade {app.gradeApplying}</td>
                <td>
                  <span className={`status-badge status-${app.status.toLowerCase().replace('_', '-')}`}>
                    {app.status.replace('_', ' ')}
                  </span>
                </td>
                <td>{new Date(app.submittedAt).toLocaleDateString()}</td>
                <td>
                  <button onClick={() => setSelectedApp(app)} className="btn-view">View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
            <button onClick={() => setSelectedApp(null)} className="btn-close">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Applications;

