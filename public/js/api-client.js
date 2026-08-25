/**
 * API Client for York Castle High School
 * Handles form submissions to the backend API
 */

// Same origin as the page: the backend serves these pages and the API together,
// so a relative path is correct on localhost (whatever port) and in production
// alike. Set window.API_BASE_URL before this script to point somewhere else.
window.API_BASE_URL = window.API_BASE_URL || '/api';

class ApiClient {
  async request(method, endpoint, data = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Add token if available
    const token = localStorage.getItem('token');
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(`${window.API_BASE_URL}${endpoint}`, options);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Request failed');
      }

      return result;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async submitApplication(formData) {
    return this.request('POST', '/applications', formData);
  }

  async submitSixthFormApplication(formData) {
    return this.request('POST', '/sixth-form', formData);
  }

  async submitRequest(type, title, description, metadata = {}) {
    return this.request('POST', '/requests', {
      type,
      title,
      description,
      metadata,
    });
  }

  async submitPublicRequest(type, title, description, metadata = {}) {
    return this.request('POST', '/requests/public', {
      type,
      title,
      description,
      metadata,
    });
  }
}

const apiClient = new ApiClient();

// Helper function to show success/error messages
function showMessage(message, type = 'success') {
  const messageDiv = document.createElement('div');
  messageDiv.className = `api-message api-message-${type}`;
  messageDiv.textContent = message;
  messageDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 5px;
    color: white;
    z-index: 10000;
    font-weight: 500;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    ${type === 'success' ? 'background-color: #28a745;' : 'background-color: #dc3545;'}
  `;
  document.body.appendChild(messageDiv);

  setTimeout(() => {
    messageDiv.remove();
  }, 5000);
}

// Export for use in forms
window.apiClient = apiClient;
window.showMessage = showMessage;

