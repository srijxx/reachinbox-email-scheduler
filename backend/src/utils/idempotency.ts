import crypto from 'crypto';

/**
 * Generates a unique idempotency key for an email record.
 * Combines userId, recipient, subject, and scheduledAt to produce
 * a deterministic key that prevents double-scheduling the same logical email.
 * An additional random suffix ensures uniqueness for re-schedules.
 */
export function generateIdempotencyKey(
  userId: string,
  recipient: string,
  sender: string,
  scheduledAt: Date,
  index: number
): string {
  const base = `${userId}:${recipient}:${sender}:${scheduledAt.getTime()}:${index}`;
  const hash = crypto.createHash('sha256').update(base).digest('hex').slice(0, 16);
  return `idem_${hash}_${Date.now()}`;
}
