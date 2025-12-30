import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import './Analytics.css';

const Analytics = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const data = await apiService.getDashboardStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading analytics...</div>;
  }

  return (
    <div className="analytics-page">
      <h1>Analytics & Reports</h1>
      {stats && (
        <div className="analytics-content">
          <div className="stats-section">
            <h2>Overview Statistics</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Users</h3>
                <p className="stat-value">{stats.stats.totalUsers}</p>
              </div>
              <div className="stat-card">
                <h3>Total Applications</h3>
                <p className="stat-value">{stats.stats.totalApplications}</p>
              </div>
              <div className="stat-card">
                <h3>Pending Reviews</h3>
                <p className="stat-value">{stats.stats.pendingApplications}</p>
              </div>
              <div className="stat-card">
                <h3>Approved</h3>
                <p className="stat-value">{stats.stats.approvedApplications}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;





