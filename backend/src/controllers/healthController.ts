import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { redisClient } from '../config/redis';
import { esClient } from '../config/elasticsearch';
import { HealthCheckResponse } from '../types';
import { logger } from '../utils/logger';

export async function healthCheck(req: Request, res: Response): Promise<void> {
  const services: HealthCheckResponse['services'] = {
    api: 'ok',
    database: 'error',
    redis: 'error',
    elasticsearch: 'error',
  };

  // Check MySQL
  try {
    await prisma.$queryRaw`SELECT 1`;
    services.database = 'ok';
  } catch (e) {
    logger.warn('Health check: database error', { error: e });
  }

  // Check Redis
  try {
    const pong = await redisClient.ping();
    if (pong === 'PONG') services.redis = 'ok';
  } catch (e) {
    logger.warn('Health check: redis error', { error: e });
  }

  // Check Elasticsearch
  try {
    await esClient.ping();
    services.elasticsearch = 'ok';
  } catch (e) {
    logger.warn('Health check: elasticsearch error', { error: e });
  }

  const allOk = Object.values(services).every((s) => s === 'ok');
  const status: HealthCheckResponse['status'] = allOk ? 'ok' : 'degraded';

  const response: HealthCheckResponse = {
    status,
    services,
    timestamp: new Date().toISOString(),
  };

  res.status(allOk ? 200 : 503).json(response);
}
