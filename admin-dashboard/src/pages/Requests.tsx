import { useEffect, useState, useCallback, useRef } from 'react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import type { Request, User } from '../types';
import './Requests.css';

const Requests = () => {
  const { user } = useAuth();
  const canAssign = user?.role === 'ADMIN'; // only admins can assign requests
  const canViewAssignees = user?.role === 'ADMIN' || user?.role === 'STAFF'; // staff can still filter by assignee
  const [requests, setRequests] = useState<Request[]>([]);
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState(''); // '', 'me', 'unassigned', or a staff user id
  const [searchInput, setSearchInput] = useState(''); // What user types
  const [searchQuery, setSearchQuery] = useState(''); // Debounced value for API
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [responseText, setResponseText] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(50); // Show 50 per page instead of 20
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  });
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input - wait 500ms after user stops typing
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchInput]);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter, assignedFilter, searchQuery]);

  // Load the list of staff users once - used for the assignee dropdowns/filter.
  useEffect(() => {
    if (!canViewAssignees) return;
    (async () => {
      try {
        const data = await apiService.getUsers({ role: 'STAFF', limit: 100 });
        setStaffUsers(data.users);
      } catch (error) {
        console.error('Failed to fetch staff users:', error);
      }
    })();
  }, [canViewAssignees]);

  // Fetch requests function
  const fetchRequests = useCallback(async () => {
    if (!initialLoading) {
      setSearching(true);
    }
    try {
      const params: any = {
        page,
        limit,
      };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      if (assignedFilter) params.assignedTo = assignedFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const data = await apiService.getRequests(params);
      setRequests(data.requests);
      if (data.pagination) {
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setInitialLoading(false);
      setSearching(false);
    }
  }, [statusFilter, typeFilter, assignedFilter, searchQuery, page, limit, initialLoading]);

  // Fetch requests when filters or page changes
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Deep-link support: open a specific request when arriving via ?view=<id>
  // (used by the "View Request" link in new-request notification emails).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewId = params.get('view');
    if (!viewId) return;

    let cancelled = false;
    (async () => {
      try {
        const data = await apiService.getRequest(viewId);
        if (!cancelled && data.request) {
          handleViewRequest(data.request);
        }
      } catch (error) {
        console.error('Failed to load requested request:', error);
      } finally {
        // Clean the query param so a refresh doesn't reopen the modal
        const url = new URL(window.location.href);
        url.searchParams.delete('view');
        window.history.replaceState({}, '', url.toString());
      }
    })();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleViewRequest = (request: Request) => {
    setSelectedRequest(request);
    setNewStatus(request.status);
    setResponseText(request.response || '');
    setAssigneeId(request.assignedToId || '');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRequest(null);
    setNewStatus('');
    setResponseText('');
    setAssigneeId('');
  };

  const handleAssign = async () => {
    if (!selectedRequest) return;

    setAssigning(true);
    try {
      const { request } = await apiService.assignRequest(
        selectedRequest.id,
        assigneeId || null
      );
      // Keep the open modal and the list in sync with the new assignee.
      setSelectedRequest(request);
      setRequests((prev) => prev.map((r) => (r.id === request.id ? request : r)));
    } catch (error) {
      console.error('Failed to assign request:', error);
      alert('Failed to assign request');
    } finally {
      setAssigning(false);
    }
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

  // Get the actual document type from metadata
  const getDocumentType = (req: Request) => {
    // If it's a document request, get the specific document type from metadata
    if (req.type === 'DOCUMENT' && req.metadata?.requestType) {
      return req.metadata.requestType;
    }
    // Fallback to title if requestType not available but title contains document type
    if (req.type === 'DOCUMENT' && req.title) {
      // Extract document type from title (e.g., "Transcript Request - John Doe" -> "Transcript")
      const match = req.title.match(/^([^-]+)\s+Request/i);
      if (match) {
        return match[1].trim();
      }
    }
    // Return the generic type for non-document requests
    return req.type;
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
    if (metadata.visaApplicationType) {
      sections.push({ label: 'Visa Application Type', value: metadata.visaApplicationType });
    }
    if (metadata.lastFormTeacher) {
      sections.push({ label: 'Last Form Teacher', value: metadata.lastFormTeacher });
    }
    if (metadata.gradeElevenClass) {
      sections.push({ label: 'Grade 11 Class', value: metadata.gradeElevenClass });
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
      if (s.phoneNumber) sections.push({ label: 'Student Phone', value: s.phoneNumber });
      if (s.dateOfBirth) sections.push({ label: 'Date of Birth', value: new Date(s.dateOfBirth).toLocaleDateString() });
      if (s.dateOfGraduation) {
        const gradDate = new Date(s.dateOfGraduation);
        sections.push({ label: 'Year of Graduation', value: gradDate.getFullYear().toString() });
      }
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

  if (initialLoading) {
    return <div className="loading">Loading requests...</div>;
  }

  return (
    <div className="requests-page">
      <div className="page-header">
        <h1>Manage Requests</h1>
        <div className="filters">
          <input
            type="text"
            placeholder="Search by name, email, title..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="search-input"
          />
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
          {canViewAssignees && (
            <select
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              className="filter-select"
            >
              <option value="">All Assignees</option>
              <option value="me">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
              {staffUsers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="requests-stats">
        <span className="stat-item">
          <strong>{pagination.total || requests.length}</strong> total requests
        </span>
        <span className="stat-divider">|</span>
        <span className="stat-item">
          Showing {requests.length} of {pagination.total || requests.length}
        </span>
        <span className="stat-divider">|</span>
        <span className="stat-item pending">
          {requests.filter(r => r.status === 'PENDING').length} pending
        </span>
        <span className="stat-item in-progress">
          {requests.filter(r => r.status === 'IN_PROGRESS').length} in progress
        </span>
        <span className="stat-item completed">
          {requests.filter(r => r.status === 'COMPLETED').length} completed
        </span>
      </div>

      {requests.length === 0 && !searching ? (
        <div className="empty-state">
          <span className="empty-icon">📭</span>
          <h3>No requests found</h3>
          <p>There are no requests matching your filters.</p>
        </div>
      ) : (
        <div className={`requests-list-container ${searching ? 'is-searching' : ''}`}>
          <table className="requests-table">
            <thead>
              <tr>
                <th className="col-type">Type</th>
                <th className="col-requester">Requester</th>
                <th className="col-email">Email</th>
                <th className="col-date">Date</th>
                <th className="col-status">Status</th>
                <th className="col-assignee">Assigned To</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className="request-row" onClick={() => handleViewRequest(req)}>
                  <td className="col-type">
                    <span className="type-badge">
                      <span className="type-icon">{getTypeIcon(req.type)}</span>
                      <span className="type-label">{getDocumentType(req)}</span>
                    </span>
                  </td>
                  <td className="col-requester">
                    <span className="requester-name">{getRequesterName(req)}</span>
                  </td>
                  <td className="col-email">
                    <span className="email-text">
                      {req.user?.email || req.metadata?.studentInfo?.email || '—'}
                    </span>
                  </td>
                  <td className="col-date">
                    <span className="date-text">{new Date(req.createdAt).toLocaleDateString()}</span>
                    <span className="time-text">{new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td className="col-status">
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(req.status) }}
                    >
                      {req.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="col-assignee">
                    {req.assignedTo ? (
                      <span className="assignee-name">{req.assignedTo.name}</span>
                    ) : (
                      <span className="assignee-unassigned">Unassigned</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {pagination.pages > 1 && (
        <div className="pagination-controls">
          <button
            className="pagination-btn"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || searching}
          >
            ← Previous
          </button>
          <div className="pagination-info">
            Page {pagination.page} of {pagination.pages}
          </div>
          <button
            className="pagination-btn"
            onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages || searching}
          >
            Next →
          </button>
        </div>
      )}

      {/* Request Detail Modal */}
      <Modal isOpen={showModal} onClose={handleCloseModal} title="Request Details">
        {selectedRequest && (
          <div className="request-detail-modal">
            <div className="detail-header">
              <span className="detail-type-badge">
                {getTypeIcon(selectedRequest.type)} {getDocumentType(selectedRequest)}
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

            {/* Assignment Section */}
            {canAssign && (
              <div className="assign-section">
                <h4>Assign Request</h4>
                <p className="assign-current">
                  {selectedRequest.assignedTo
                    ? <>Currently assigned to <strong>{selectedRequest.assignedTo.name}</strong></>
                    : 'This request is not assigned to anyone.'}
                </p>
                <div className="assign-controls">
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="status-select"
                    disabled={assigning}
                  >
                    <option value="">Unassigned</option>
                    {staffUsers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                    ))}
                  </select>
                  <button
                    className="btn-primary"
                    onClick={handleAssign}
                    disabled={assigning || (assigneeId || '') === (selectedRequest.assignedToId || '')}
                  >
                    {assigning ? 'Saving...' : 'Save Assignment'}
                  </button>
                </div>
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
