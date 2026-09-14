import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';

const isVercel = typeof window !== 'undefined' && window.location.hostname !== 'localhost';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import LibraryLayout from './components/LibraryLayout';

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
import LibraryBooks from './pages/LibraryBooks';
import Students from './pages/Students';
import LibraryDesk from './pages/LibraryDesk';
import LibraryLoans from './pages/LibraryLoans';
import LibraryCharges from './pages/LibraryCharges';
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
          {/*
            The book rental system, in its own shell. A sibling of the admin
            portal rather than a section inside it: the person at the counter
            has no use for Applications, Blog Posts or Sixth Form, and burying
            the scanning screen among them is how it gets lost. Same app and
            same sign-in, so there is nothing to maintain twice.

            The desk keeps its own address so a counter machine can be pointed
            straight at it - that is also what the offline install opens.
          */}
          <Route
            path="/library"
            element={
              <PrivateRoute>
                <RoleRoute roles={['ADMIN', 'STAFF', 'TEACHER']}>
                  <LibraryLayout />
                </RoleRoute>
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/library/desk" replace />} />
            <Route path="desk" element={<RoleRoute roles={['ADMIN', 'STAFF']}><LibraryDesk /></RoleRoute>} />
            <Route path="books" element={<RoleRoute roles={['ADMIN', 'STAFF', 'TEACHER']}><LibraryBooks /></RoleRoute>} />
            <Route path="loans" element={<RoleRoute roles={['ADMIN', 'STAFF', 'TEACHER']}><LibraryLoans /></RoleRoute>} />
            <Route path="charges" element={<RoleRoute roles={['ADMIN', 'STAFF']}><LibraryCharges /></RoleRoute>} />
            <Route path="students" element={<RoleRoute roles={['ADMIN', 'STAFF']}><Students /></RoleRoute>} />
          </Route>

          {/* Where the old in-portal addresses used to live, so a bookmark or a
              link someone saved still lands in the right place. */}
          <Route path="/students" element={<Navigate to="/library/students" replace />} />

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

