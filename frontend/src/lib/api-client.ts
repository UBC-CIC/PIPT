import { appConfig } from '@/config/aws-config';
import { authService } from '@/lib/auth';

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
}

export class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = appConfig.api.endpoint;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = await authService.getIdToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  async request<T>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const authHeaders = await this.getAuthHeaders();
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        ...authHeaders,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid — redirect to login
        window.location.href = '/login';
        throw new Error('Session expired. Please sign in again.');
      }
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Student endpoints
  async getStudentData() {
    return this.request('/student/data');
  }

  // Instructor endpoints
  async getInstructorData() {
    return this.request('/instructor/data');
  }

  // Admin endpoints
  async getAdminData() {
    return this.request('/admin/data');
  }
}

export const apiClient = new ApiClient();
