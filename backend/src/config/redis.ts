import IORedis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

const redisConfig = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  lazyConnect: false,
};

// Primary Redis connection (for BullMQ)
export const redis = new IORedis(redisConfig);

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err) => {
  logger.error('Redis connection error', { error: err.message });
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

// Separate connection for rate limiting and general use
export const redisClient = new IORedis({
  ...redisConfig,
  maxRetriesPerRequest: 3,
});

redisClient.on('connect', () => {
  logger.info('Redis client connected');
});

redisClient.on('error', (err) => {
  logger.error('Redis client error', { error: err.message });
});

export default redis;
