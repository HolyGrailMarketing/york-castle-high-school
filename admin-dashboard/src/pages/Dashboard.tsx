import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

interface DashboardStats {
  stats: {
    totalUsers: number;
    totalApplications: number;
    totalSixthFormApplications: number;
    pendingApplications: number;
    approvedApplications: number;
    totalBlogPosts: number;
    totalEvents: number;
    totalDocuments: number;
  };
  recentApplications: any[];
}

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchStats();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchStats = async () => {
    try {
      const data = await apiService.getDashboardStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatDate = () => {
    return currentTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="dashboard-error">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h2>Unable to Load Dashboard</h2>
        <p>There was a problem loading your dashboard data.</p>
        <button onClick={fetchStats} className="retry-btn">Try Again</button>
      </div>
    );
  }

  const quickActions = [
    { icon: '📝', label: 'Review Applications', path: '/applications', count: stats.stats.pendingApplications },
    { icon: '🎓', label: 'Sixth Form Apps', path: '/sixth-form' },
    { icon: '📰', label: 'Manage Blog', path: '/blog' },
    { icon: '📅', label: 'Manage Events', path: '/events' },
  ];

  return (
    <div className="dashboard">
      {/* Welcome Section */}
      <section className="welcome-section">
        <div className="welcome-content">
          <div className="welcome-text">
            <h1>{getGreeting()}, {user?.name?.split(' ')[0] || 'Admin'}!</h1>
            <p className="welcome-date">{formatDate()}</p>
          </div>
          <div className="welcome-summary">
            {stats.stats.pendingApplications > 0 && (
              <div className="alert-badge">
                <span className="alert-count">{stats.stats.pendingApplications}</span>
                <span>pending review{stats.stats.pendingApplications !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="quick-actions">
        <h2 className="section-title">Quick Actions</h2>
        <div className="actions-grid">
          {quickActions.map((action, index) => (
            <Link to={action.path} key={index} className="action-card">
              <span className="action-icon">{action.icon}</span>
              <span className="action-label">{action.label}</span>
              {action.count !== undefined && action.count > 0 && (
                <span className="action-badge">{action.count}</span>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* Stats Overview */}
      <section className="stats-section">
        <h2 className="section-title">Overview</h2>
        <div className="stats-grid">
          <div className="stat-card stat-users">
            <div className="stat-icon">👥</div>
            <div className="stat-info">
              <span className="stat-value">{stats.stats.totalUsers}</span>
              <span className="stat-label">Total Users</span>
            </div>
          </div>
          <div className="stat-card stat-applications">
            <div className="stat-icon">📋</div>
            <div className="stat-info">
              <span className="stat-value">{stats.stats.totalApplications}</span>
              <span className="stat-label">Applications</span>
            </div>
            <div className="stat-breakdown">
              <span className="stat-approved">✓ {stats.stats.approvedApplications} approved</span>
              <span className="stat-pending">◐ {stats.stats.pendingApplications} pending</span>
            </div>
          </div>
          <div className="stat-card stat-sixth">
            <div className="stat-icon">🎓</div>
            <div className="stat-info">
              <span className="stat-value">{stats.stats.totalSixthFormApplications}</span>
              <span className="stat-label">Sixth Form Apps</span>
            </div>
          </div>
          <div className="stat-card stat-content">
            <div className="stat-icon">📰</div>
            <div className="stat-info">
              <span className="stat-value">{stats.stats.totalBlogPosts}</span>
              <span className="stat-label">Blog Posts</span>
            </div>
          </div>
          <div className="stat-card stat-events">
            <div className="stat-icon">📅</div>
            <div className="stat-info">
              <span className="stat-value">{stats.stats.totalEvents}</span>
              <span className="stat-label">Events</span>
            </div>
          </div>
          <div className="stat-card stat-docs">
            <div className="stat-icon">📄</div>
            <div className="stat-info">
              <span className="stat-value">{stats.stats.totalDocuments}</span>
              <span className="stat-label">Documents</span>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Applications */}
      {stats.recentApplications && stats.recentApplications.length > 0 && (
        <section className="recent-section">
          <div className="section-header">
            <h2 className="section-title">Recent Applications</h2>
            <Link to="/applications" className="view-all-link">
              View All
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
          </div>
          <div className="recent-table-wrapper">
            <table className="recent-table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Email</th>
                  <th>Grade</th>
                  <th>Status</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentApplications.map((app: any) => (
                  <tr key={app.id}>
                    <td className="applicant-cell">
                      <div className="applicant-avatar">
                        {app.firstName[0]}{app.lastName[0]}
                      </div>
                      <span>{app.firstName} {app.lastName}</span>
                    </td>
                    <td className="email-cell">{app.email}</td>
                    <td>Grade {app.gradeApplying}</td>
                    <td>
                      <span className={`status-pill status-${app.status.toLowerCase().replace('_', '-')}`}>
                        {app.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="date-cell">
                      {new Date(app.submittedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default Dashboard;
