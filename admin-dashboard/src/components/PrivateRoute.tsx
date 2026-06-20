import { Navigate } from 'react-router-dom';
import { useAuth, isAdminRole } from '../contexts/AuthContext';

interface PrivateRouteProps {
  children: React.ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  // Require an authenticated user with an admin-portal role. Students/parents
  // are blocked even if they somehow hold a valid token.
  if (!user || !isAdminRole(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default PrivateRoute;





