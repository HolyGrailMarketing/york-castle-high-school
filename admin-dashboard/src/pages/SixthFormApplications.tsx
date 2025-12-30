import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import type { SixthFormApplication } from '../types';
import './Applications.css';

const SixthFormApplications = () => {
  const [applications, setApplications] = useState<SixthFormApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<SixthFormApplication | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchApplications();
  }, [statusFilter]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      const data = await apiService.getSixthFormApplications(params);
      setApplications(data.applications);
    } catch (error) {
      console.error('Failed to fetch applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await apiService.updateSixthFormStatus(id, status);
      fetchApplications();
      setSelectedApp(null);
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update application status');
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
          </select>
        </div>
      </div>

      <div className="applications-list">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
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
            <h2>Sixth Form Application Details</h2>
            <div className="app-details">
              <div><strong>Name:</strong> {selectedApp.firstName} {selectedApp.middleName} {selectedApp.lastName}</div>
              <div><strong>Email:</strong> {selectedApp.email}</div>
              <div><strong>Phone:</strong> {selectedApp.phone}</div>
              <div><strong>Date of Birth:</strong> {new Date(selectedApp.dateOfBirth).toLocaleDateString()}</div>
              <div><strong>Previous School:</strong> {selectedApp.previousSchool || 'N/A'}</div>
              <div><strong>Subject Choices:</strong> <pre>{JSON.stringify(selectedApp.subjectChoices, null, 2)}</pre></div>
              {selectedApp.csecResults && (
                <div><strong>CSEC Results:</strong> <pre>{JSON.stringify(selectedApp.csecResults, null, 2)}</pre></div>
              )}
              <div><strong>Status:</strong> {selectedApp.status}</div>
            </div>
            <div className="status-actions">
              <h3>Update Status</h3>
              <div className="status-buttons">
                <button onClick={() => handleStatusUpdate(selectedApp.id, 'APPROVED')} className="btn-approve">Approve</button>
                <button onClick={() => handleStatusUpdate(selectedApp.id, 'REJECTED')} className="btn-reject">Reject</button>
                <button onClick={() => handleStatusUpdate(selectedApp.id, 'UNDER_REVIEW')} className="btn-review">Under Review</button>
              </div>
            </div>
            <button onClick={() => setSelectedApp(null)} className="btn-close">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SixthFormApplications;





