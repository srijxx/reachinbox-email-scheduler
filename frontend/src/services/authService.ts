import apiClient from './apiClient';
import type { User } from '../types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

export const authService = {
  /**
   * Redirects the browser to the Google OAuth flow.
   * The backend handles the full OAuth dance and redirects back to /dashboard.
   */
  loginWithGoogle(): void {
    window.location.href = `${API_BASE}/api/auth/google`;
  },

  async getMe(): Promise<User> {
    const res = await apiClient.get<User>('/api/auth/me');
    return res.data;
  },

  async logout(): Promise<void> {
    await apiClient.post('/api/auth/logout');
  },
};
