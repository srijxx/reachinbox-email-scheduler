import { esClient, EMAILS_INDEX } from '../config/elasticsearch';
import { Email } from '@prisma/client';
import { logger } from '../utils/logger';

export interface EmailDocument {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  sender: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
  userId: string;
  etherealPreviewUrl: string | null;
  createdAt: string;
}

function emailToDocument(email: Email): EmailDocument {
  return {
    id: email.id,
    recipient: email.recipient,
    subject: email.subject,
    body: email.body,
    sender: email.sender,
    status: email.status,
    scheduledAt: email.scheduledAt.toISOString(),
    sentAt: email.sentAt?.toISOString() ?? null,
    userId: email.userId,
    etherealPreviewUrl: email.etherealPreviewUrl,
    createdAt: email.createdAt.toISOString(),
  };
}

/**
 * Indexes (or updates) an email document in Elasticsearch.
 * Uses the email's database ID as the ES document ID.
 * Called after scheduling and after each status change.
 */
export async function indexEmail(email: Email): Promise<void> {
  try {
    await esClient.index({
      index: EMAILS_INDEX,
      id: email.id,
      document: emailToDocument(email),
      refresh: 'wait_for',
    });
    logger.debug('Email indexed in Elasticsearch', { emailId: email.id });
  } catch (error) {
    // ES indexing failures must not fail email sending — log and continue
    logger.error('Elasticsearch indexing failed', { emailId: email.id, error });
  }
}

/**
 * Updates specific fields of an existing Elasticsearch email document.
 */
export async function updateEmailDocument(
  emailId: string,
  updates: Partial<EmailDocument>
): Promise<void> {
  try {
    await esClient.update({
      index: EMAILS_INDEX,
      id: emailId,
      doc: updates,
      retry_on_conflict: 3,
    });
    logger.debug('Email updated in Elasticsearch', { emailId });
  } catch (error) {
    logger.error('Elasticsearch update failed', { emailId, error });
  }
}

export interface SearchEmailsOptions {
  query: string;
  userId: string;
  page?: number;
  pageSize?: number;
}

export interface SearchEmailsResult {
  emails: EmailDocument[];
  total: number;
}

/**
 * Full-text searches emails for a given user.
 * Searches across recipient, subject, sender, and status fields.
 * Always filters by userId to ensure data isolation.
 */
export async function searchEmails(options: SearchEmailsOptions): Promise<SearchEmailsResult> {
  const { query, userId, page = 1, pageSize = 20 } = options;
  const from = (page - 1) * pageSize;

  try {
    const response = await esClient.search({
      index: EMAILS_INDEX,
      from,
      size: pageSize,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: ['recipient^2', 'subject^2', 'sender', 'status', 'body'],
                type: 'best_fields',
                fuzziness: 'AUTO',
              },
            },
          ],
          filter: [
            { term: { userId } },
          ],
        },
      },
      sort: [{ createdAt: { order: 'desc' } }],
    });

    const total =
      typeof response.hits.total === 'number'
        ? response.hits.total
        : response.hits.total?.value ?? 0;

    const emails = response.hits.hits.map((hit) => hit._source as EmailDocument);

    return { emails, total };
  } catch (error) {
    logger.error('Elasticsearch search failed', { error });
    throw new Error('Search failed');
  }
}
