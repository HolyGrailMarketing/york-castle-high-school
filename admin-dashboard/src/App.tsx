import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';

const isVercel = typeof window !== 'undefined' && window.location.hostname !== 'localhost';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';

// Redirects to /dashboard if the current user's role isn't in the allowed list
const RoleRoute = ({ children, roles }: { children: React.ReactNode; roles: string[] }) => {
  const { user } = useAuth();
  if (user && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Applications from './pages/Applications';
import SixthFormApplications from './pages/SixthFormApplications';
import Users from './pages/Users';
import BlogPosts from './pages/BlogPosts';
import Events from './pages/Events';
import Courses from './pages/Courses';
import Documents from './pages/Documents';
import Booklist from './pages/Booklist';
import Timetable from './pages/Timetable';
import Requests from './pages/Requests';
import Analytics from './pages/Analytics';
import DataSubjectRequests from './pages/DataSubjectRequests';
import AuditLogs from './pages/AuditLogs';
import Help from './pages/Help';

function App() {
  // Always use /admin as base path since we're served from the backend
  const basename = '/admin';
  
  return (
    <AuthProvider>
      <Router
        basename={basename}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          {/* Redirect /index.html to root */}
          <Route path="/index.html" element={<Navigate to="/" replace />} />
          
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="applications" element={<Applications />} />
            <Route path="sixth-form" element={<SixthFormApplications />} />
            <Route path="users" element={<RoleRoute roles={['ADMIN', 'STAFF']}><Users /></RoleRoute>} />
            <Route path="blog" element={<BlogPosts />} />
            <Route path="events" element={<Events />} />
            <Route path="courses" element={<Courses />} />
            <Route path="documents" element={<Documents />} />
            <Route path="booklist" element={<RoleRoute roles={['ADMIN', 'STAFF']}><Booklist /></RoleRoute>} />
            {/* Wider than Booklist on purpose: teachers look up their own week
                and their lunch duty here. Editing is gated inside the page. */}
            <Route path="timetable" element={<RoleRoute roles={['ADMIN', 'STAFF', 'TEACHER']}><Timetable /></RoleRoute>} />
            <Route path="requests" element={<RoleRoute roles={['ADMIN', 'STAFF']}><Requests /></RoleRoute>} />
            <Route path="data-subject-requests" element={<RoleRoute roles={['ADMIN']}><DataSubjectRequests /></RoleRoute>} />
            <Route path="audit-logs" element={<RoleRoute roles={['ADMIN']}><AuditLogs /></RoleRoute>} />
            <Route path="analytics" element={<RoleRoute roles={['ADMIN', 'STAFF']}><Analytics /></RoleRoute>} />
            <Route path="help" element={<Help />} />
          </Route>
          
          {/* Catch-all route for unmatched paths */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {isVercel && <VercelAnalytics />}
      </Router>
    </AuthProvider>
  );
}

export default App;

