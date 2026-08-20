import { useEffect, useState, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import logo from '../assets/logo.png';
import './Layout.css';

interface PendingRequest {
  id: string;
  type: string;
  title: string;
  createdAt: string;
  metadata?: any;
}

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  const canSeeRequests = user?.role === 'ADMIN' || user?.role === 'STAFF';

  // Fetch pending requests — only for roles that have access
  const fetchPendingRequests = async () => {
    if (!canSeeRequests) return;
    try {
      const data = await apiService.getRequests({ status: 'PENDING' });
      setPendingRequests(data.requests || []);
    } catch (error) {
      console.error('Failed to fetch pending requests:', error);
    }
  };

  // Fetch on mount and poll every 30 seconds
  useEffect(() => {
    fetchPendingRequests();
    const interval = setInterval(fetchPendingRequests, 30000);
    return () => clearInterval(interval);
  }, [canSeeRequests]);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleViewAllRequests = () => {
    setShowNotifications(false);
    navigate('/requests?status=PENDING');
  };

  const handleViewRequest = (id: string) => {
    setShowNotifications(false);
    navigate(`/requests?id=${id}`);
  };

  const getRequesterName = (req: PendingRequest) => {
    if (req.metadata?.studentInfo) {
      const s = req.metadata.studentInfo;
      const name = [s.firstName, s.lastName].filter(Boolean).join(' ');
      if (name) return name;
    }
    return 'Unknown';
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

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const role = user?.role;

  const allNavItems = [
    { path: '/dashboard',             label: 'Dashboard',          icon: '📊', roles: ['ADMIN', 'STAFF', 'TEACHER'] },
    { path: '/applications',          label: 'Applications',       icon: '📋', roles: ['ADMIN', 'STAFF', 'TEACHER'] },
    { path: '/sixth-form',            label: 'Sixth Form',         icon: '🎓', roles: ['ADMIN', 'STAFF', 'TEACHER'] },
    { path: '/users',                 label: 'Users',              icon: '👥', roles: ['ADMIN', 'STAFF'] },
    { path: '/blog',                  label: 'Blog Posts',         icon: '📰', roles: ['ADMIN', 'STAFF', 'TEACHER'] },
    { path: '/events',                label: 'Events',             icon: '📅', roles: ['ADMIN', 'STAFF', 'TEACHER'] },
    { path: '/courses',               label: 'Courses',            icon: '📚', roles: ['ADMIN', 'STAFF', 'TEACHER'] },
    { path: '/documents',             label: 'Documents',          icon: '📄', roles: ['ADMIN', 'STAFF', 'TEACHER'] },
    { path: '/booklist',              label: 'Booklist',           icon: '📖', roles: ['ADMIN', 'STAFF'] },
    { path: '/requests',              label: 'Requests',           icon: '📬', roles: ['ADMIN', 'STAFF'] },
    { path: '/data-subject-requests', label: 'Data Subject Rights',icon: '🔒', roles: ['ADMIN'] },
    { path: '/audit-logs',            label: 'Audit Logs',         icon: '📋', roles: ['ADMIN'] },
    { path: '/analytics',             label: 'Analytics',          icon: '📈', roles: ['ADMIN', 'STAFF'] },
    { path: '/help',                  label: 'Help & Guide',       icon: '❓', roles: ['ADMIN', 'STAFF', 'TEACHER'] },
  ];

  const navItems = role ? allNavItems.filter((item) => item.roles.includes(role)) : [];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src={logo} alt="York Castle High School" className="sidebar-logo" />
          <div className="sidebar-brand">
            <h2>York Castle</h2>
            <p>Admin Portal</p>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.path === '/requests' && pendingRequests.length > 0 && (
                <span className="nav-badge">{pendingRequests.length}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user?.name?.charAt(0) || 'A'}
            </div>
            <div className="user-details">
              <span className="user-name">{user?.name || 'Admin'}</span>
              <span className="user-role">{user?.role || 'Administrator'}</span>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-content">
        <header className="header">
          <div className="header-content">
            <div className="header-title">
              <h1>{role === 'TEACHER' ? 'Staff Portal' : 'Admin Dashboard'}</h1>
            </div>
            <div className="header-actions">
              {/* Notification Bell — only for roles with Requests access */}
              {canSeeRequests && <div className="notification-wrapper" ref={notificationRef}>
                <button 
                  className={`notification-btn ${pendingRequests.length > 0 ? 'has-notifications' : ''}`}
                  title="Pending Requests"
                  onClick={() => setShowNotifications(!showNotifications)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  </svg>
                  {pendingRequests.length > 0 && (
                    <span className="notification-badge">{pendingRequests.length > 9 ? '9+' : pendingRequests.length}</span>
                  )}
                </button>

                {/* Notification Dropdown */}
                {showNotifications && (
                  <div className="notification-dropdown">
                    <div className="notification-header">
                      <h4>Pending Requests</h4>
                      <span className="notification-count">{pendingRequests.length} new</span>
                    </div>
                    <div className="notification-list">
                      {pendingRequests.length === 0 ? (
                        <div className="notification-empty">
                          <span>🎉</span>
                          <p>No pending requests</p>
                        </div>
                      ) : (
                        pendingRequests.slice(0, 5).map((req) => (
                          <div 
                            key={req.id} 
                            className="notification-item"
                            onClick={() => handleViewRequest(req.id)}
                          >
                            <span className="notification-icon">{getTypeIcon(req.type)}</span>
                            <div className="notification-content">
                              <p className="notification-title">{req.title}</p>
                              <span className="notification-meta">
                                {getRequesterName(req)} • {formatTimeAgo(req.createdAt)}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {pendingRequests.length > 0 && (
                      <div className="notification-footer">
                        <button onClick={handleViewAllRequests}>
                          View all pending requests →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>}
              <div className="header-divider"></div>
              <span className="user-greeting">Welcome, {user?.name?.split(' ')[0] || 'Admin'}</span>
              <button onClick={handleLogout} className="logout-btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Logout
              </button>
            </div>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
