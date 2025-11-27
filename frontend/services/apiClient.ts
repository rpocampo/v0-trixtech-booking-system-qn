interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

interface RequestOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
}

class ApiClient {
  private baseURL: string;
  private defaultTimeout = 10000; // 10 seconds
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isRetryableError(error: any): boolean {
    // Retry on network errors, timeouts, and 5xx server errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) return true;
    if (error.name === 'AbortError') return true;
    if (error instanceof Response && error.status >= 500) return true;
    return false;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      retries = this.maxRetries,
      retryDelay = this.retryDelay,
      timeout = this.defaultTimeout,
      ...fetchOptions
    } = options;

    const url = `${this.baseURL}${endpoint}`;

    // Add authorization header if token exists
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token && !fetchOptions.headers) {
      fetchOptions.headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
    } else if (token && fetchOptions.headers) {
      (fetchOptions.headers as any)['Authorization'] = `Bearer ${token}`;
    } else if (!fetchOptions.headers) {
      fetchOptions.headers = {
        'Content-Type': 'application/json'
      };
    }

    let lastError: any;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Handle HTTP errors
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));

          // Don't retry on client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            return {
              success: false,
              error: errorData.message || `HTTP ${response.status}`,
              message: errorData.message
            };
          }

          // Retry on server errors (5xx)
          if (response.status >= 500 && attempt < retries) {
            lastError = new Error(`HTTP ${response.status}: ${errorData.message || 'Server error'}`);
            await this.delay(retryDelay * Math.pow(2, attempt)); // Exponential backoff
            continue;
          }

          return {
            success: false,
            error: errorData.message || `HTTP ${response.status}`,
            message: errorData.message
          };
        }

        const data = await response.json();
        return {
          success: true,
          data,
          message: data.message
        };

      } catch (error: any) {
        lastError = error;

        // Don't retry on certain errors
        if (!this.isRetryableError(error) || attempt >= retries) {
          break;
        }

        console.warn(`API request failed (attempt ${attempt + 1}/${retries + 1}):`, error.message);
        await this.delay(retryDelay * Math.pow(2, attempt)); // Exponential backoff
      }
    }

    // All retries exhausted
    console.error('API request failed after all retries:', lastError);

    // Check if it's a connectivity issue
    if (lastError?.name === 'TypeError' && lastError.message.includes('fetch')) {
      return {
        success: false,
        error: 'Network connection failed. Please check your internet connection and try again.',
        message: 'Connectivity issue'
      };
    }

    if (lastError?.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timed out. Please try again.',
        message: 'Timeout'
      };
    }

    return {
      success: false,
      error: lastError?.message || 'An unexpected error occurred',
      message: 'Request failed'
    };
  }

  // HTTP methods
  async get<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async put<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async patch<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'DELETE' });
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get('/health', { timeout: 5000 });
      return response.success;
    } catch {
      return false;
    }
  }
}

// Create and export API client instance
const apiClient = new ApiClient(
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
);

export default apiClient;
export { ApiClient };