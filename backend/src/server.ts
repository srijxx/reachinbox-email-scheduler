import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import { createClient } from 'redis';
import RedisStore from 'connect-redis';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import { env } from './config/env';
import { connectDatabase } from './config/database';
import { connectElasticsearch } from './config/elasticsearch';
import { redis, redisClient } from './config/redis';
import './config/passport';
import passport from './config/passport';

import authRoutes from './routes/authRoutes';
import emailRoutes from './routes/emailRoutes';
import slackRoutes from './routes/slackRoutes';
import healthRoutes from './routes/healthRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { emailQueue } from './queues/emailQueue';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  const app = express();

  // ─── Security & logging ────────────────────────────────────────────────────
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    })
  );

  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

  // ─── Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ─── Session + Redis store ─────────────────────────────────────────────────
  const redisSessionClient = createClient({
    socket: {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
    },
    password: env.REDIS_PASSWORD || undefined,
  });

  redisSessionClient.on('error', (err: Error) => logger.error('Session Redis error', { error: err.message }));
  await redisSessionClient.connect();

  const sessionStore = new RedisStore({ client: redisSessionClient as any, prefix: 'sess:' });

  app.use(
    session({
      store: sessionStore,
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      },
    })
  );

  // ─── Passport ─────────────────────────────────────────────────────────────
  app.use(passport.initialize());
  app.use(passport.session());

  // ─── Bull Board (live queue dashboard) ────────────────────────────────────
  const bullBoardAdapter = new ExpressAdapter();
  bullBoardAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue) as any],
    serverAdapter: bullBoardAdapter,
  });

  app.use('/admin/queues', bullBoardAdapter.getRouter());
  logger.info('Bull Board available at /admin/queues');

  // ─── API Routes ────────────────────────────────────────────────────────────
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/emails', emailRoutes);
  app.use('/api/slack', slackRoutes);

  // ─── Error handling ────────────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  // ─── Connect to external services ─────────────────────────────────────────
  await connectDatabase();

  try {
    await connectElasticsearch();
  } catch (err) {
    logger.warn('Elasticsearch unavailable — search features will be degraded', { err });
  }

  // ─── Start server ──────────────────────────────────────────────────────────
  const server = app.listen(env.PORT, () => {
    logger.info(`Server started on port ${env.PORT}`, {
      env: env.NODE_ENV,
      frontend: env.FRONTEND_URL,
    });
  });

  // ─── Graceful shutdown ─────────────────────────────────────────────────────
  async function shutdown(signal: string): Promise<void> {
    logger.info(`${signal} received — shutting down`);
    server.close(async () => {
      await redisClient.quit();
      await redis.quit();
      await redisSessionClient.quit();
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
