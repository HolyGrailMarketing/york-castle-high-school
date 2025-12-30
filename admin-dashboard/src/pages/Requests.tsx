import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import Modal from '../components/Modal';
import type { Request } from '../types';
import './Requests.css';

const Requests = () => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [responseText, setResponseText] = useState('');

  useEffect(() => {
    fetchRequests();
  }, [statusFilter, typeFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      const data = await apiService.getRequests(params);
      setRequests(data.requests);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewRequest = (request: Request) => {
    setSelectedRequest(request);
    setNewStatus(request.status);
    setResponseText(request.response || '');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRequest(null);
    setNewStatus('');
    setResponseText('');
  };

  const handleUpdateStatus = async () => {
    if (!selectedRequest) return;
    
    setUpdating(true);
    try {
      await apiService.updateRequestStatus(selectedRequest.id, newStatus, responseText);
      await fetchRequests();
      handleCloseModal();
    } catch (error) {
      console.error('Failed to update request:', error);
      alert('Failed to update request status');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return '#f59e0b';
      case 'IN_PROGRESS': return '#3b82f6';
      case 'COMPLETED': return '#10b981';
      case 'REJECTED': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'DOCUMENT': return '📄';
      case 'DEVICE': return '💻';
      case 'LAB': return '🔬';
      case 'GENERAL': return '📋';
      default: return '📝';
    }
  };

  // Get requester name from user or metadata
  const getRequesterName = (req: Request) => {
    if (req.user?.name) {
      return req.user.name;
    }
    if (req.metadata?.studentInfo) {
      const s = req.metadata.studentInfo;
      const name = [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ');
      if (name) return name;
    }
    return 'Unknown';
  };

  const formatMetadata = (metadata: any) => {
    if (!metadata) return null;
    
    const sections = [];
    
    if (metadata.requestType) {
      sections.push({ label: 'Request Type', value: metadata.requestType });
    }
    if (metadata.deliveryMethod) {
      sections.push({ label: 'Delivery Method', value: metadata.deliveryMethod });
    }
    if (metadata.numberOfCopies) {
      sections.push({ label: 'Number of Copies', value: metadata.numberOfCopies });
    }
    
    if (metadata.studentInfo) {
      const s = metadata.studentInfo;
      sections.push({ 
        label: 'Student Name', 
        value: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ')
      });
      if (s.email) sections.push({ label: 'Student Email', value: s.email });
      if (s.phone) sections.push({ label: 'Student Phone', value: s.phone });
      if (s.dateOfBirth) sections.push({ label: 'Date of Birth', value: new Date(s.dateOfBirth).toLocaleDateString() });
      if (s.address) {
        const addr = [s.address.street, s.address.town, s.address.parish].filter(Boolean).join(', ');
        if (addr) sections.push({ label: 'Address', value: addr });
      }
    }
    
    if (metadata.recipientInfo) {
      const r = metadata.recipientInfo;
      if (r.name) sections.push({ label: 'Recipient Name', value: r.name });
      if (r.email) sections.push({ label: 'Recipient Email', value: r.email });
      if (r.phone) sections.push({ label: 'Recipient Phone', value: r.phone });
      if (r.address) sections.push({ label: 'Recipient Address', value: r.address });
      if (r.fax) sections.push({ label: 'Fax Number', value: r.fax });
    }
    
    return sections;
  };

  if (loading) {
    return <div className="loading">Loading requests...</div>;
  }

  return (
    <div className="requests-page">
      <div className="page-header">
        <h1>Manage Requests</h1>
        <div className="filters">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Types</option>
            <option value="DOCUMENT">Document</option>
            <option value="DEVICE">Device</option>
            <option value="LAB">Lab</option>
            <option value="GENERAL">General</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📭</span>
          <h3>No requests found</h3>
          <p>There are no requests matching your filters.</p>
        </div>
      ) : (
        <div className="requests-grid">
          {requests.map((req) => (
            <div key={req.id} className="request-card" onClick={() => handleViewRequest(req)}>
              <div className="request-card-header">
                <span className="request-type-icon">{getTypeIcon(req.type)}</span>
                <span 
                  className="request-status-badge"
                  style={{ backgroundColor: getStatusColor(req.status) }}
                >
                  {req.status.replace('_', ' ')}
                </span>
              </div>
              <h3 className="request-title">{req.title}</h3>
              <p className="request-description">{req.description || 'No description'}</p>
              <div className="request-meta">
                <span className="request-user">
                  👤 {getRequesterName(req)}
                </span>
                <span className="request-date">
                  📅 {new Date(req.createdAt).toLocaleDateString()}
                </span>
              </div>
              <button className="view-details-btn">View Details →</button>
            </div>
          ))}
        </div>
      )}

      {/* Request Detail Modal */}
      <Modal isOpen={showModal} onClose={handleCloseModal} title="Request Details">
        {selectedRequest && (
          <div className="request-detail-modal">
            <div className="detail-header">
              <span className="detail-type-badge">
                {getTypeIcon(selectedRequest.type)} {selectedRequest.type}
              </span>
              <span 
                className="detail-status-badge"
                style={{ backgroundColor: getStatusColor(selectedRequest.status) }}
              >
                {selectedRequest.status.replace('_', ' ')}
              </span>
            </div>

            <h2 className="detail-title">{selectedRequest.title}</h2>
            
            {selectedRequest.description && (
              <p className="detail-description">{selectedRequest.description}</p>
            )}

            <div className="detail-info-grid">
              <div className="detail-info-item">
                <label>Submitted By</label>
                <span>{getRequesterName(selectedRequest)}</span>
              </div>
              <div className="detail-info-item">
                <label>Email</label>
                <span>{selectedRequest.user?.email || selectedRequest.metadata?.studentInfo?.email || 'N/A'}</span>
              </div>
              <div className="detail-info-item">
                <label>Submitted On</label>
                <span>{new Date(selectedRequest.createdAt).toLocaleString()}</span>
              </div>
              {selectedRequest.respondedAt && (
                <div className="detail-info-item">
                  <label>Last Updated</label>
                  <span>{new Date(selectedRequest.respondedAt).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Metadata Section */}
            {selectedRequest.metadata && (
              <div className="metadata-section">
                <h4>Request Details</h4>
                <div className="metadata-grid">
                  {formatMetadata(selectedRequest.metadata)?.map((item, index) => (
                    <div key={index} className="metadata-item">
                      <label>{item.label}</label>
                      <span>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Previous Response */}
            {selectedRequest.response && (
              <div className="previous-response">
                <h4>Previous Response</h4>
                <p>{selectedRequest.response}</p>
              </div>
            )}

            {/* Update Form */}
            <div className="update-section">
              <h4>Update Request</h4>
              
              <div className="form-group">
                <label>Status</label>
                <select 
                  value={newStatus} 
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="status-select"
                >
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>

              <div className="form-group">
                <label>Response / Notes</label>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Add a response or internal notes about this request..."
                  rows={4}
                  className="response-textarea"
                />
              </div>

              <div className="modal-actions">
                <button 
                  className="btn-secondary" 
                  onClick={handleCloseModal}
                  disabled={updating}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleUpdateStatus}
                  disabled={updating}
                >
                  {updating ? 'Updating...' : 'Update Request'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Requests;
