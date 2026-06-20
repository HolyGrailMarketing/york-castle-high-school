import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, isAdminRole } from '../contexts/AuthContext';
import { authService } from '../services/api';
import GoogleSignIn from '../components/GoogleSignIn';
import logo from '../assets/logo.png';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Handle OAuth callback
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setLoading(true);
      setError('');
      
      // Store token in localStorage and authService immediately
      localStorage.setItem('token', token);
      authService.setToken(token);
      
      // Clear the token from URL to avoid issues on refresh
      window.history.replaceState({}, '', '/admin/auth/callback');
      
      // Verify token by fetching user data
      authService.getMe()
        .then((userData) => {
          // Reject students/parents - the admin portal is for staff only.
          if (!isAdminRole(userData.role)) {
            localStorage.removeItem('token');
            authService.setToken(null);
            setError('This portal is for staff only. Please use the application status portal to view your application.');
            setLoading(false);
            return;
          }
          // User fetched successfully - token is valid
          // Use full page reload to ensure AuthContext re-initializes with the token
          // This ensures the AuthContext picks up the token from localStorage on mount
          window.location.href = '/admin/';
        })
        .catch((err) => {
          console.error('Failed to fetch user after OAuth:', err);
          setError('Authentication failed. Please try again.');
          setLoading(false);
          // Clear invalid token
          localStorage.removeItem('token');
          authService.setToken(null);
        });
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state if processing OAuth callback
  const isProcessingOAuth = loading && searchParams.get('token');

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="bg-shape bg-shape-1"></div>
        <div className="bg-shape bg-shape-2"></div>
        <div className="bg-shape bg-shape-3"></div>
      </div>
      <div className="login-box">
        <div className="login-header">
          <img src={logo} alt="York Castle High School" className="login-logo" />
          <h1>York Castle High School</h1>
          <p className="login-subtitle">Administrative Portal</p>
        </div>
        {isProcessingOAuth && (
          <div className="oauth-loading">
            <span className="spinner"></span>
            <p>Completing Google Sign-In...</p>
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: isProcessingOAuth ? 'none' : 'block' }}>
          {error && (
            <div className="error-message">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{error}</span>
            </div>
          )}
          <div className="form-group">
            <label htmlFor="email">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@yorkcastle.edu.jm"
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              Password
            </label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner"></span>
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </>
            )}
          </button>
        </form>
        
        {!isProcessingOAuth && (
          <>
            <div className="login-divider">
              <span>OR</span>
            </div>

            <GoogleSignIn />
          </>
        )}

        <div className="login-footer">
          <p>Secure access for authorized personnel only</p>
          <p className="login-domain-note">Google Sign-In available for @moeschools.edu.jm and @yorkcastlehighschool.org</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
