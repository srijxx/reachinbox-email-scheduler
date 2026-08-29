import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Singleton Prisma client (prevents too many connections in dev with hot reload)
export const prisma: PrismaClient =
  global.__prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }]
      : [{ emit: 'event', level: 'error' }],
  });

if (process.env.NODE_ENV === 'development') {
  global.__prisma = prisma;
}

(prisma as any).$on('error', (e: any) => {
  logger.error('Prisma error', { message: e.message, target: e.target });
});

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected');
  } catch (error) {
    logger.error('Database connection failed', { error });
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
