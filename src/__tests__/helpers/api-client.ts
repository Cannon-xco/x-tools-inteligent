/**
 * API Test Helper
 * Provides utilities for testing Next.js API routes
 */

export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
  headers: Record<string, string>;
}

/**
 * Test client for making API requests
 * Uses native fetch - works with any HTTP server
 */
export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Make a GET request
   */
  async get<T = unknown>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.defaultHeaders,
    });

    // Get raw text first
    const text = await response.text();
    
    // Try to parse as JSON, fallback to text
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    
    return {
      status: response.status,
      body: body as T,
      headers: Object.fromEntries(response.headers.entries()),
    };
  }

  /**
   * Make a POST request
   */
  async post<T = unknown>(path: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(new URL(path, this.baseUrl).toString(), {
      method: 'POST',
      headers: this.defaultHeaders,
      body: data ? JSON.stringify(data) : undefined,
    });

    const text = await response.text();
    
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    return {
      status: response.status,
      body: body as T,
      headers: Object.fromEntries(response.headers.entries()),
    };
  }

  /**
   * Make a PUT request
   */
  async put<T = unknown>(path: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(new URL(path, this.baseUrl).toString(), {
      method: 'PUT',
      headers: this.defaultHeaders,
      body: data ? JSON.stringify(data) : undefined,
    });

    const text = await response.text();
    
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    return {
      status: response.status,
      body: body as T,
      headers: Object.fromEntries(response.headers.entries()),
    };
  }

  /**
   * Make a DELETE request
   */
  async delete<T = unknown>(path: string): Promise<ApiResponse<T>> {
    const response = await fetch(new URL(path, this.baseUrl).toString(), {
      method: 'DELETE',
      headers: this.defaultHeaders,
    });

    const text = await response.text();
    
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    return {
      status: response.status,
      body: body as T,
      headers: Object.fromEntries(response.headers.entries()),
    };
  }

  /**
   * Set authorization header
   */
  setAuth(token: string): void {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  /**
   * Clear authorization header
   */
  clearAuth(): void {
    delete this.defaultHeaders['Authorization'];
  }
}

/**
 * Create a test API client with base URL
 */
export function createApiClient(baseUrl?: string): ApiClient {
  return new ApiClient(baseUrl);
}
