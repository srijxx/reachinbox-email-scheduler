export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed';

export interface Email {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  sender: string;
  scheduledAt: string;
  sentAt: string | null;
  status: EmailStatus;
  idempotencyKey: string;
  bullJobId: string | null;
  errorMessage: string | null;
  etherealPreviewUrl: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface ScheduleEmailRequest {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
  sender: string;
}

export interface ScheduleEmailResponse {
  message: string;
  scheduled: number;
  startTime: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SlackStatus {
  connected: boolean;
  teamName: string | null;
  channel: string | null;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, string[]>;
}

export interface HealthCheck {
  status: 'ok' | 'degraded';
  services: {
    api: 'ok' | 'error';
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
    elasticsearch: 'ok' | 'error';
  };
  timestamp: string;
}
