import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export const env = {
  NODE_ENV: optionalEnv('NODE_ENV', 'development'),
  PORT: parseInt(optionalEnv('PORT', '5000'), 10),

  // Database
  DATABASE_URL: requireEnv('DATABASE_URL'),

  // Redis
  REDIS_HOST: optionalEnv('REDIS_HOST', 'localhost'),
  REDIS_PORT: parseInt(optionalEnv('REDIS_PORT', '6379'), 10),
  REDIS_PASSWORD: optionalEnv('REDIS_PASSWORD', ''),

  // Elasticsearch
  ELASTICSEARCH_URL: optionalEnv('ELASTICSEARCH_URL', 'http://localhost:9200'),

  // Worker
  WORKER_CONCURRENCY: parseInt(optionalEnv('WORKER_CONCURRENCY', '5'), 10),

  // Email throttle
  MIN_EMAIL_DELAY_MS: parseInt(optionalEnv('MIN_EMAIL_DELAY_MS', '2000'), 10),
  MAX_EMAILS_PER_HOUR: parseInt(optionalEnv('MAX_EMAILS_PER_HOUR', '200'), 10),

  // Google OAuth
  GOOGLE_CLIENT_ID: optionalEnv('GOOGLE_CLIENT_ID', ''),
  GOOGLE_CLIENT_SECRET: optionalEnv('GOOGLE_CLIENT_SECRET', ''),
  GOOGLE_CALLBACK_URL: optionalEnv('GOOGLE_CALLBACK_URL', 'http://localhost:5000/api/auth/google/callback'),

  // Slack OAuth
  SLACK_CLIENT_ID: optionalEnv('SLACK_CLIENT_ID', ''),
  SLACK_CLIENT_SECRET: optionalEnv('SLACK_CLIENT_SECRET', ''),
  SLACK_REDIRECT_URI: optionalEnv('SLACK_REDIRECT_URI', 'http://localhost:5000/api/slack/callback'),

  // Ethereal SMTP
  ETHEREAL_HOST: optionalEnv('ETHEREAL_HOST', 'smtp.ethereal.email'),
  ETHEREAL_PORT: parseInt(optionalEnv('ETHEREAL_PORT', '587'), 10),
  ETHEREAL_USER: optionalEnv('ETHEREAL_USER', ''),
  ETHEREAL_PASSWORD: optionalEnv('ETHEREAL_PASSWORD', ''),

  // Session
  SESSION_SECRET: optionalEnv('SESSION_SECRET', 'change-me-in-production'),

  // Frontend
  FRONTEND_URL: optionalEnv('FRONTEND_URL', 'http://localhost:5173'),
};
