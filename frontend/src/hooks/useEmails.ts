import { useState, useCallback } from 'react';
import type { Email, PaginatedResponse } from '../types';
import { emailService } from '../services/emailService';

export function useScheduledEmails() {
  const [data, setData] = useState<PaginatedResponse<Email> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    setError(null);
    try {
      const res = await emailService.getScheduledEmails(page, pageSize);
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed to load scheduled emails');
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetch };
}

export function useSentEmails() {
  const [data, setData] = useState<PaginatedResponse<Email> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    setError(null);
    try {
      const res = await emailService.getSentEmails(page, pageSize);
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed to load sent emails');
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetch };
}

export function useSearchEmails() {
  const [data, setData] = useState<PaginatedResponse<Email> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (q: string, page = 1, pageSize = 20) => {
    if (!q.trim()) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await emailService.searchEmails(q, page, pageSize);
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, search };
}
