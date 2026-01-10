/**
 * Authentication utility for public pages
 * Handles authentication with the backend API
 */

const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000/api'
  : '/api'; // Use relative path in production

class Auth {
  constructor() {
    this.tokenKey = 'auth_token';
    this.userKey = 'auth_user';
  }

  // Get stored token
  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  // Get stored user
  getUser() {
    const userStr = localStorage.getItem(this.userKey);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  // Check if user is logged in
  isLoggedIn() {
    return !!this.getToken();
  }

  // Login user
  async login(email, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Login failed');
      }

      // Store token and user
      localStorage.setItem(this.tokenKey, data.token);
      localStorage.setItem(this.userKey, JSON.stringify(data.user));

      return {
        success: true,
        user: data.user,
        token: data.token,
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Register user
  async register(email, password, name, phone) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name, phone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Registration failed');
      }

      // Store token and user
      localStorage.setItem(this.tokenKey, data.token);
      localStorage.setItem(this.userKey, JSON.stringify(data.user));

      return {
        success: true,
        user: data.user,
        token: data.token,
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  // Logout user
  logout() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    window.location.href = '/index.html';
  }

  // Get current user from API (verify token)
  async getCurrentUser() {
    const token = this.getToken();
    if (!token) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Token invalid, clear storage
        this.logout();
        return null;
      }

      const data = await response.json();
      localStorage.setItem(this.userKey, JSON.stringify(data.user));
      return data.user;
    } catch (error) {
      console.error('Get current user error:', error);
      this.logout();
      return null;
    }
  }

  // Update login/logout button state
  updateAuthButton() {
    const authButtons = document.querySelectorAll('.user-log-in-log-out');
    const isLoggedIn = this.isLoggedIn();
    const user = this.getUser();

    authButtons.forEach(button => {
      if (isLoggedIn && user) {
        button.textContent = `Log out (${user.name || user.email})`;
        button.onclick = (e) => {
          e.preventDefault();
          this.logout();
        };
      } else {
        button.textContent = 'Log in';
        button.onclick = (e) => {
          e.preventDefault();
          window.location.href = '/log-in.html';
        };
      }
    });
  }

  // Initialize auth state on page load
  async init() {
    // Check if token exists and is valid
    if (this.isLoggedIn()) {
      try {
        await this.getCurrentUser();
      } catch (error) {
        console.error('Auth init error:', error);
      }
    }

    // Update auth buttons
    this.updateAuthButton();

    // Update button state periodically (every 5 minutes)
    setInterval(() => {
      if (this.isLoggedIn()) {
        this.getCurrentUser().catch(() => {
          // Silently fail - token might be expired
        });
      }
    }, 5 * 60 * 1000);
  }
}

// Create singleton instance
const auth = new Auth();

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => auth.init());
} else {
  auth.init();
}

// Export for use in other scripts
window.auth = auth;
