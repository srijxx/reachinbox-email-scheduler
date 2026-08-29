import { useState, useEffect, useCallback } from 'react';
import type { User } from '../types';
import { authService } from '../services/authService';

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const fetchUser = useCallback(async () => {
    try {
      setState((s) => ({ ...s, loading: true, error: null }));
      const user = await authService.getMe();
      setState({ user, loading: false, error: null });
    } catch {
      setState({ user: null, loading: false, error: null });
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
      setState({ user: null, loading: false, error: null });
    } catch {
      // Even if server fails, clear local state
      setState({ user: null, loading: false, error: null });
    }
  }, []);

  return { ...state, logout, refetch: fetchUser };
}
