import apiClient from './apiClient';
import type { SlackStatus } from '../types';

export const slackService = {
  async getStatus(): Promise<SlackStatus> {
    const res = await apiClient.get<SlackStatus>('/api/slack/status');
    return res.data;
  },

  /**
   * Gets the Slack OAuth URL and redirects the browser to it.
   */
  async connectSlack(): Promise<void> {
    const res = await apiClient.get<{ url: string }>('/api/slack/connect');
    window.location.href = res.data.url;
  },

  async disconnectSlack(): Promise<void> {
    await apiClient.post('/api/slack/disconnect');
  },
};
