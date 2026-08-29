import { Client } from '@elastic/elasticsearch';
import { env } from './env';
import { logger } from '../utils/logger';

export const esClient = new Client({
  node: env.ELASTICSEARCH_URL,
  requestTimeout: 10000,
  maxRetries: 3,
});

export const EMAILS_INDEX = 'emails';

export async function connectElasticsearch(): Promise<void> {
  try {
    const info = await esClient.info();
    logger.info('Elasticsearch connected', { version: info.version.number });
    await ensureEmailsIndex();
  } catch (error) {
    logger.error('Elasticsearch connection failed', { error });
    throw error;
  }
}

export async function ensureEmailsIndex(): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: EMAILS_INDEX });
    if (!exists) {
      await esClient.indices.create({
        index: EMAILS_INDEX,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              subject: { type: 'text' },
              body: { type: 'text' },
              sender: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              userId: { type: 'keyword' },
              etherealPreviewUrl: { type: 'keyword', index: false },
              createdAt: { type: 'date' },
            },
          },
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
          },
        },
      });
      logger.info('Elasticsearch emails index created');
    }
  } catch (error) {
    logger.error('Failed to ensure Elasticsearch index', { error });
    throw error;
  }
}
