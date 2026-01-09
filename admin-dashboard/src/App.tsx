import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Applications from './pages/Applications';
import SixthFormApplications from './pages/SixthFormApplications';
import Users from './pages/Users';
import BlogPosts from './pages/BlogPosts';
import Events from './pages/Events';
import Courses from './pages/Courses';
import Documents from './pages/Documents';
import Requests from './pages/Requests';
import Analytics from './pages/Analytics';

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
            <Route path="users" element={<Users />} />
            <Route path="blog" element={<BlogPosts />} />
            <Route path="events" element={<Events />} />
            <Route path="courses" element={<Courses />} />
            <Route path="documents" element={<Documents />} />
            <Route path="requests" element={<Requests />} />
            <Route path="analytics" element={<Analytics />} />
          </Route>
          
          {/* Catch-all route for unmatched paths */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

