import { useEffect, useState, useRef } from 'react';
import { apiService } from '../services/api';
import Modal from '../components/Modal';
import type { User, UserRole } from '../types';
import './Users.css';

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone: string;
  authMethod: 'EMAIL' | 'GOOGLE';
  notifyGeneralRequests: boolean;
  notifySixthFormApps: boolean;
  notifyAdmissions: boolean;
  notifyOverdueRequests: boolean;
}

const initialFormData: UserFormData = {
  name: '',
  email: '',
  password: '',
  role: 'STUDENT',
  phone: '',
  authMethod: 'GOOGLE',
  notifyGeneralRequests: false,
  notifySixthFormApps: false,
  notifyAdmissions: false,
  notifyOverdueRequests: false,
};

// Roles eligible to be submission-notification recipients.
const NOTIFY_ELIGIBLE_ROLES: UserRole[] = ['ADMIN', 'STAFF', 'TEACHER'];

const ALLOWED_DOMAINS = ['moeschools.edu.jm', 'yorkcastlehighschool.org'];

const isValidDomain = (email: string): boolean => {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? ALLOWED_DOMAINS.includes(domain) : false;
};

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState(''); // What the user types
  const [searchQuery, setSearchQuery] = useState(''); // Debounced value sent to the API
  const [page, setPage] = useState(1);
  const limit = 20;
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Debounce the search box - wait 400ms after the user stops typing.
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => setSearchQuery(searchTerm), 400);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchTerm]);

  // Reset to the first page whenever the filters change.
  useEffect(() => {
    setPage(1);
  }, [roleFilter, searchQuery]);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, searchQuery, page]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (roleFilter) params.role = roleFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const data = await apiService.getUsers(params);
      setUsers(data.users);
      if (data.pagination) setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
    setError('');
  };

  const handleAddUser = () => {
    setFormData({ ...initialFormData, authMethod: 'GOOGLE' });
    setError('');
    setShowAddModal(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      phone: user.phone || '',
      authMethod: user.provider || 'EMAIL',
      notifyGeneralRequests: user.notifyGeneralRequests ?? false,
      notifySixthFormApps: user.notifySixthFormApps ?? false,
      notifyAdmissions: user.notifyAdmissions ?? false,
      notifyOverdueRequests: user.notifyOverdueRequests ?? false,
    });
    setError('');
    setShowEditModal(true);
  };

  const handleDeleteClick = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email) {
      setError('Name and email are required');
      return;
    }

    // Validate email domain for OAuth users
    if (formData.authMethod === 'GOOGLE' && !isValidDomain(formData.email)) {
      setError(`Email must be from one of these domains: ${ALLOWED_DOMAINS.join(', ')}`);
      return;
    }

    // Password required for EMAIL auth method
    if (formData.authMethod === 'EMAIL') {
      if (!formData.password) {
        setError('Password is required for email authentication');
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    }

    setSubmitting(true);
    try {
      const notifyEligible = NOTIFY_ELIGIBLE_ROLES.includes(formData.role);
      await apiService.createUser({
        name: formData.name,
        email: formData.email,
        password: formData.authMethod === 'EMAIL' ? formData.password : undefined,
        role: formData.role,
        phone: formData.phone || undefined,
        authMethod: formData.authMethod,
        notifyGeneralRequests: notifyEligible && formData.notifyGeneralRequests,
        notifySixthFormApps: notifyEligible && formData.notifySixthFormApps,
        notifyAdmissions: notifyEligible && formData.notifyAdmissions,
        notifyOverdueRequests: notifyEligible && formData.notifyOverdueRequests,
      });
      setShowAddModal(false);
      await fetchUsers();
    } catch (err: any) {
      setError(err.error || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (!formData.name) {
      setError('Name is required');
      return;
    }

    setSubmitting(true);
    try {
      // Update basic info
      const notifyEligible = NOTIFY_ELIGIBLE_ROLES.includes(formData.role);
      await apiService.updateUser(selectedUser.id, {
        name: formData.name,
        phone: formData.phone || undefined,
        notifyGeneralRequests: notifyEligible && formData.notifyGeneralRequests,
        notifySixthFormApps: notifyEligible && formData.notifySixthFormApps,
        notifyAdmissions: notifyEligible && formData.notifyAdmissions,
        notifyOverdueRequests: notifyEligible && formData.notifyOverdueRequests,
      });

      // Update role if changed
      if (formData.role !== selectedUser.role) {
        await apiService.updateUserRole(selectedUser.id, formData.role);
      }

      setShowEditModal(false);
      await fetchUsers();
    } catch (err: any) {
      setError(err.error || 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setSubmitting(true);
    try {
      await apiService.deleteUser(selectedUser.id);
      setShowDeleteModal(false);
      await fetchUsers();
    } catch (err: any) {
      setError(err.error || 'Failed to delete user');
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return '#dc2626';
      case 'STAFF': return '#0891b2';
      case 'TEACHER': return '#7c3aed';
      case 'STUDENT': return '#16a34a';
      case 'PARENT': return '#ca8a04';
      default: return '#6b7280';
    }
  };

  if (loading && users.length === 0) {
    return <div className="loading">Loading users...</div>;
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <div className="header-left">
          <h1>Users</h1>
          <span className="user-count">{pagination.total || users.length} total</span>
        </div>
        <div className="header-actions">
          <div className="search-box">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="STAFF">Staff</option>
            <option value="TEACHER">Teacher</option>
            <option value="STUDENT">Student</option>
            <option value="PARENT">Parent</option>
          </select>
          <button className="add-user-btn" onClick={handleAddUser}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <line x1="19" y1="8" x2="19" y2="14"></line>
              <line x1="22" y1="11" x2="16" y2="11"></line>
            </svg>
            Add User
          </button>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">👥</span>
          <h3>No users found</h3>
          <p>No users match your search criteria.</p>
        </div>
      ) : (
        <div className={`users-list-container ${loading ? 'is-loading' : ''}`}>
          <table className="users-table data-table--stack">
            <thead>
              <tr>
                <th className="col-user">User</th>
                <th className="col-email">Email</th>
                <th className="col-role">Role</th>
                <th className="col-auth">Auth</th>
                <th className="col-phone">Phone</th>
                <th className="col-joined">Joined</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td data-label="User" className="col-user">
                    <div className="user-cell">
                      <div className="user-avatar" style={{ background: getRoleColor(user.role) }}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="user-name">{user.name}</span>
                    </div>
                  </td>
                  <td data-label="Email" className="col-email">
                    <span className="email-text">{user.email}</span>
                  </td>
                  <td data-label="Role" className="col-role">
                    <span
                      className="role-badge"
                      style={{ backgroundColor: getRoleColor(user.role) }}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td data-label="Auth" className="col-auth">
                    {user.provider === 'GOOGLE' ? (
                      <span className="provider-badge" title="Google OAuth User">
                        🔐 Google
                      </span>
                    ) : (
                      <span className="auth-email">Email</span>
                    )}
                  </td>
                  <td data-label="Phone" className="col-phone">
                    {user.phone ? (
                      <span className="user-phone">{user.phone}</span>
                    ) : (
                      <span className="cell-empty">—</span>
                    )}
                  </td>
                  <td data-label="Joined" className="col-joined">
                    <span className="date-text">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td data-label="Actions" className="col-actions">
                    <div className="row-actions">
                      <button
                        className="action-btn edit"
                        title="Edit user"
                        onClick={() => handleEditUser(user)}
                      >
                        ✏️
                      </button>
                      <button
                        className="action-btn delete"
                        title="Delete user"
                        onClick={() => handleDeleteClick(user)}
                      >
                        🗑️
                      </button>
                    </div>
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
            disabled={page === 1 || loading}
          >
            ← Previous
          </button>
          <div className="pagination-info">
            Page {pagination.page} of {pagination.pages}
          </div>
          <button
            className="pagination-btn"
            onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages || loading}
          >
            Next →
          </button>
        </div>
      )}

      {/* Add User Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New User">
        <form onSubmit={handleCreateUser} className="user-form">
          {error && <div className="form-error">{error}</div>}
          
          <div className="form-group">
            <label>Full Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter full name"
              required
            />
          </div>

          <div className="form-group">
            <label>Email Address *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter email address"
              required
            />
          </div>

          <div className="form-group">
            <label>Authentication Method *</label>
            <input
              type="text"
              value="Google OAuth"
              disabled
              className="disabled-input"
            />
            <span className="field-hint">
              All new users sign in with Google. Email must be from: @moeschools.edu.jm or @yorkcastlehighschool.org
            </span>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Role *</label>
              <select name="role" value={formData.role} onChange={handleInputChange}>
                <option value="STUDENT">Student</option>
                <option value="PARENT">Parent</option>
                <option value="TEACHER">Teacher</option>
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            <div className="form-group">
              <label>Phone (Optional)</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="Enter phone number"
              />
            </div>
          </div>

          {NOTIFY_ELIGIBLE_ROLES.includes(formData.role) && (
            <div className="form-group">
              <label>Submission Notifications</label>
              <span className="field-hint">Email this user when these are submitted through the website.</span>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input type="checkbox" name="notifyGeneralRequests" checked={formData.notifyGeneralRequests} onChange={handleCheckboxChange} />
                  General requests
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" name="notifySixthFormApps" checked={formData.notifySixthFormApps} onChange={handleCheckboxChange} />
                  Sixth-form applications
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" name="notifyAdmissions" checked={formData.notifyAdmissions} onChange={handleCheckboxChange} />
                  General admission applications
                </label>
              </div>
            </div>
          )}

          {NOTIFY_ELIGIBLE_ROLES.includes(formData.role) && (
            <div className="form-group">
              <label>Escalations</label>
              <span className="field-hint">Email this user when work runs past what the website promised. Intended for the principal.</span>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input type="checkbox" name="notifyOverdueRequests" checked={formData.notifyOverdueRequests} onChange={handleCheckboxChange} />
                  Overdue document requests
                </label>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit User">
        <form onSubmit={handleUpdateUser} className="user-form">
          {error && <div className="form-error">{error}</div>}
          
          <div className="form-group">
            <label>Full Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter full name"
              required
            />
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              disabled
              className="disabled-input"
            />
            <span className="field-hint">Email cannot be changed</span>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Role *</label>
              <select name="role" value={formData.role} onChange={handleInputChange}>
                <option value="STUDENT">Student</option>
                <option value="PARENT">Parent</option>
                <option value="TEACHER">Teacher</option>
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            <div className="form-group">
              <label>Phone (Optional)</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="Enter phone number"
              />
            </div>
          </div>

          {NOTIFY_ELIGIBLE_ROLES.includes(formData.role) && (
            <div className="form-group">
              <label>Submission Notifications</label>
              <span className="field-hint">Email this user when these are submitted through the website.</span>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input type="checkbox" name="notifyGeneralRequests" checked={formData.notifyGeneralRequests} onChange={handleCheckboxChange} />
                  General requests
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" name="notifySixthFormApps" checked={formData.notifySixthFormApps} onChange={handleCheckboxChange} />
                  Sixth-form applications
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" name="notifyAdmissions" checked={formData.notifyAdmissions} onChange={handleCheckboxChange} />
                  General admission applications
                </label>
              </div>
            </div>
          )}

          {NOTIFY_ELIGIBLE_ROLES.includes(formData.role) && (
            <div className="form-group">
              <label>Escalations</label>
              <span className="field-hint">Email this user when work runs past what the website promised. Intended for the principal.</span>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input type="checkbox" name="notifyOverdueRequests" checked={formData.notifyOverdueRequests} onChange={handleCheckboxChange} />
                  Overdue document requests
                </label>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete User">
        <div className="delete-confirmation">
          <div className="delete-icon">⚠️</div>
          <h3>Are you sure?</h3>
          <p>
            You are about to delete <strong>{selectedUser?.name}</strong>. 
            This action cannot be undone.
          </p>
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </button>
            <button className="btn-danger" onClick={handleDeleteUser} disabled={submitting}>
              {submitting ? 'Deleting...' : 'Delete User'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Users;
