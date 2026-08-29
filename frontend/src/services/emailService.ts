import apiClient from './apiClient';
import type {
  Email,
  PaginatedResponse,
  ScheduleEmailRequest,
  ScheduleEmailResponse,
} from '../types';

export const emailService = {
  async scheduleEmails(payload: ScheduleEmailRequest): Promise<ScheduleEmailResponse> {
    const res = await apiClient.post<ScheduleEmailResponse>('/api/emails/schedule', payload);
    return res.data;
  },

  async getScheduledEmails(
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResponse<Email>> {
    const res = await apiClient.get<PaginatedResponse<Email>>('/api/emails/scheduled', {
      params: { page, pageSize },
    });
    return res.data;
  },

  async getSentEmails(
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResponse<Email>> {
    const res = await apiClient.get<PaginatedResponse<Email>>('/api/emails/sent', {
      params: { page, pageSize },
    });
    return res.data;
  },

  async searchEmails(
    q: string,
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResponse<Email>> {
    const res = await apiClient.get<PaginatedResponse<Email>>('/api/emails/search', {
      params: { q, page, pageSize },
    });
    return res.data;
  },
};
