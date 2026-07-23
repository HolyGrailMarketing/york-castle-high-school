import axios from 'axios';
import type { User, Application, SixthFormApplication, SixthFormInterview, Course, BlogPost, Event, Document, Request } from '../types';

// Use relative path since everything is served from the same server
// This works in both development and production when served from backend
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }

  private async request<T>(method: string, url: string, data?: any): Promise<T> {
    try {
      const config: any = {
        method,
        url: `${API_BASE_URL}${url}`,
      };
      if (data && method !== 'GET') {
        config.data = data;
      }
      const response = await axios(config);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/admin/login';
      }
      throw error.response?.data || error.message;
    }
  }

  // Auth
  async login(email: string, password: string) {
    const response = await this.request<{ user: User; token: string }>('POST', '/auth/login', { email, password });
    return response;
  }

  async getMe() {
    const response = await this.request<{ user: User }>('GET', '/auth/me');
    return response.user;
  }

  // Users
  async getUsers(params?: any) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{ users: User[]; pagination: any }>('GET', `/users${queryString}`);
  }

  async getUser(id: string) {
    return this.request<{ user: User }>('GET', `/users/${id}`);
  }

  async createUser(data: { email: string; password?: string; name: string; role?: string; phone?: string; authMethod?: 'EMAIL' | 'GOOGLE'; notifyGeneralRequests?: boolean; notifySixthFormApps?: boolean; notifyAdmissions?: boolean }) {
    return this.request<{ user: User }>('POST', '/users', data);
  }

  async updateUser(id: string, data: Partial<User>) {
    return this.request<{ user: User }>('PUT', `/users/${id}`, data);
  }

  async updateUserRole(id: string, role: string) {
    return this.request<{ user: User }>('PUT', `/users/${id}/role`, { role });
  }

  async deleteUser(id: string) {
    return this.request('DELETE', `/users/${id}`);
  }

  // Applications
  async getApplications(params?: any) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{ applications: Application[]; pagination: any }>('GET', `/applications${queryString}`);
  }

  async getApplication(id: string) {
    return this.request<{ application: Application }>('GET', `/applications/${id}`);
  }

  async updateApplicationStatus(id: string, status: string, notes?: string) {
    return this.request<{ application: Application }>('PUT', `/applications/${id}/status`, { status, notes });
  }

  // Sixth Form Applications
  async getSixthFormApplications(params?: any) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{ applications: SixthFormApplication[]; pagination: any }>('GET', `/sixth-form${queryString}`);
  }

  async getSixthFormApplication(id: string) {
    return this.request<{ application: SixthFormApplication }>('GET', `/sixth-form/${id}`);
  }

  async updateSixthFormStatus(id: string, status: string, notes?: string) {
    return this.request<{ application: SixthFormApplication }>('PUT', `/sixth-form/${id}/status`, { status, notes });
  }

  async sendInterviewInvitations(applicationIds: string[]) {
    return this.request<{
      message: string;
      invitedCount: number;
      failed: { id: string; email: string | null; reason: string }[];
    }>('POST', '/sixth-form/interview-invitations', { applicationIds });
  }

  async getInterview(applicationId: string) {
    return this.request<{ interview: SixthFormInterview | null }>('GET', `/sixth-form/${applicationId}/interview`);
  }

  async saveInterview(applicationId: string, data: Partial<SixthFormInterview>) {
    return this.request<{ interview: SixthFormInterview }>('POST', `/sixth-form/${applicationId}/interview`, data);
  }

  // Courses
  async getCourses(params?: any) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{ courses: Course[]; pagination: any }>('GET', `/courses${queryString}`);
  }

  async getCourse(id: string) {
    return this.request<{ course: Course }>('GET', `/courses/${id}`);
  }

  async createCourse(data: Partial<Course>) {
    return this.request<{ course: Course }>('POST', '/courses', data);
  }

  async updateCourse(id: string, data: Partial<Course>) {
    return this.request<{ course: Course }>('PUT', `/courses/${id}`, data);
  }

  async deleteCourse(id: string) {
    return this.request('DELETE', `/courses/${id}`);
  }

  // Blog
  async getBlogPosts(params?: any) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{ posts: BlogPost[]; pagination: any }>('GET', `/blog${queryString}`);
  }

  async getBlogPost(id: string) {
    return this.request<{ post: BlogPost }>('GET', `/blog/${id}`);
  }

  async createBlogPost(data: Partial<BlogPost>) {
    return this.request<{ post: BlogPost }>('POST', '/blog', data);
  }

  async updateBlogPost(id: string, data: Partial<BlogPost>) {
    return this.request<{ post: BlogPost }>('PUT', `/blog/${id}`, data);
  }

  async deleteBlogPost(id: string) {
    return this.request('DELETE', `/blog/${id}`);
  }

  async publishBlogPost(id: string, published: boolean) {
    return this.request<{ post: BlogPost }>('PUT', `/blog/${id}/publish`, { published });
  }

  // Events
  async getEvents(params?: any) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{ events: Event[]; pagination: any }>('GET', `/events${queryString}`);
  }

  async getEvent(id: string) {
    return this.request<{ event: Event }>('GET', `/events/${id}`);
  }

  async createEvent(data: Partial<Event>) {
    return this.request<{ event: Event }>('POST', '/events', data);
  }

  async updateEvent(id: string, data: Partial<Event>) {
    return this.request<{ event: Event }>('PUT', `/events/${id}`, data);
  }

  async deleteEvent(id: string) {
    return this.request('DELETE', `/events/${id}`);
  }

  // Documents
  async getDocuments(params?: any) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{ documents: Document[]; pagination: any }>('GET', `/documents${queryString}`);
  }

  async uploadDocument(formData: FormData) {
    return axios.post(`${API_BASE_URL}/documents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${this.token}`,
      },
    }).then(res => res.data);
  }

  async deleteDocument(id: string) {
    return this.request('DELETE', `/documents/${id}`);
  }

  async downloadDocument(id: string) {
    window.open(`${API_BASE_URL}/documents/${id}/download`, '_blank');
  }

  // Requests
  async getRequests(params?: any) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{ requests: Request[]; pagination: any }>('GET', `/requests${queryString}`);
  }

  async getRequest(id: string) {
    return this.request<{ request: Request }>('GET', `/requests/${id}`);
  }

  async updateRequestStatus(id: string, status: string, response?: string) {
    return this.request<{ request: Request }>('PUT', `/requests/${id}/status`, { status, response });
  }

  async deleteRequest(id: string) {
    return this.request('DELETE', `/requests/${id}`);
  }

  // Analytics
  async getDashboardStats() {
    return this.request('GET', '/analytics/dashboard');
  }

  async getApplicationAnalytics(params?: any) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request('GET', `/analytics/applications${queryString}`);
  }

  async getUserAnalytics() {
    return this.request('GET', '/analytics/users');
  }
}

export const apiService = new ApiService();
export const authService = apiService;

