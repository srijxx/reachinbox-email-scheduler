import axios from 'axios';
import type { AxiosInstance, AxiosError } from 'axios';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  withCredentials: true,      // Send session cookie on every request
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor: normalise errors into a consistent shape
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    if (error.response?.status === 401) {
      // Session expired — send to login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
