// Extend Express session/request types
declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User {
      id: string;
      googleId: string;
      name: string;
      email: string;
      avatar: string | null;
      createdAt: Date;
      updatedAt: Date;
    }
  }
}

export interface AuthenticatedUser {
  id: string;
  googleId: string;
  name: string;
  email: string;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
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

export interface EmailJobData {
  emailId: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, string[]>;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded';
  services: {
    api: 'ok' | 'error';
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
    elasticsearch: 'ok' | 'error';
  };
  timestamp: string;
}
