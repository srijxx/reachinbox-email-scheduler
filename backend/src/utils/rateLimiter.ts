import { redisClient } from '../config/redis';
import { logger } from './logger';

/**
 * Redis-backed hourly rate limiter.
 *
 * Key format: email-rate:{sender}:{YYYY-MM-DDTHH}
 * TTL: 3700 seconds (slightly over 1 hour to handle edge cases)
 *
 * Uses atomic INCR + EXPIRE to safely count across multiple workers.
 * The INCR returns the new count after increment, allowing us to detect
 * whether capacity existed before this increment.
 */

const RATE_LIMIT_TTL_SECONDS = 3700; // slightly over 1 hour
const NOTIFICATION_KEY_TTL_SECONDS = 3700;

/**
 * Returns the current hour window key component: "YYYY-MM-DDTHH"
 */
export function getHourWindow(date: Date = new Date()): string {
  return date.toISOString().slice(0, 13); // e.g. "2026-08-28T14"
}

/**
 * Gets the Redis key for a sender's hourly rate limit counter.
 */
export function getRateLimitKey(sender: string, hourWindow?: string): string {
  const window = hourWindow ?? getHourWindow();
  return `email-rate:${sender}:${window}`;
}

/**
 * Gets the Redis key for rate-limit notification deduplication.
 */
export function getNotificationKey(sender: string, hourWindow?: string): string {
  const window = hourWindow ?? getHourWindow();
  return `email-rate-notified:${sender}:${window}`;
}

/**
 * Returns the start of the next UTC hour (for rescheduling).
 */
export function getNextHourStart(from: Date = new Date()): Date {
  // Floor to current UTC hour, then add 1 hour (3600 * 1000 ms)
  const currentHourMs = Math.floor(from.getTime() / 3_600_000) * 3_600_000;
  return new Date(currentHourMs + 3_600_000);
}

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  sender: string;
  hourWindow: string;
  nextHourStart: Date;
}

/**
 * Atomically checks and increments the rate limit counter for a sender.
 * Returns whether the email is allowed to proceed.
 *
 * Safe for use with multiple concurrent workers because INCR is atomic.
 * If this call gets count > limit, it decrements back (pessimistic rollback).
 */
export async function checkAndIncrementRateLimit(
  sender: string,
  limit: number
): Promise<RateLimitResult> {
  const hourWindow = getHourWindow();
  const key = getRateLimitKey(sender, hourWindow);
  const nextHourStart = getNextHourStart();

  try {
    // Atomic increment
    const newCount = await redisClient.incr(key);

    // Set TTL only when first set (INCR creates the key)
    if (newCount === 1) {
      await redisClient.expire(key, RATE_LIMIT_TTL_SECONDS);
    }

    if (newCount <= limit) {
      // Capacity available
      return { allowed: true, currentCount: newCount, limit, sender, hourWindow, nextHourStart };
    } else {
      // Over limit — roll back the increment
      await redisClient.decr(key);
      return { allowed: false, currentCount: limit, limit, sender, hourWindow, nextHourStart };
    }
  } catch (error) {
    logger.error('Rate limit check failed', { error, sender });
    // Fail open: allow the email if Redis is unavailable (log the error)
    return { allowed: true, currentCount: 0, limit, sender, hourWindow, nextHourStart };
  }
}

/**
 * Gets the current usage count for a sender in the current hour window.
 */
export async function getCurrentUsage(sender: string): Promise<number> {
  const key = getRateLimitKey(sender);
  const count = await redisClient.get(key);
  return count ? parseInt(count, 10) : 0;
}

/**
 * Checks if a Slack notification has already been sent for this sender/hour.
 * Sets the flag atomically and returns whether this is the FIRST notification.
 */
export async function markNotificationSent(sender: string): Promise<boolean> {
  const hourWindow = getHourWindow();
  const key = getNotificationKey(sender, hourWindow);

  try {
    // NX = only set if not exists, returns 1 if set, 0 if already exists
    const result = await redisClient.set(key, '1', 'EX', NOTIFICATION_KEY_TTL_SECONDS, 'NX');
    return result === 'OK'; // true means this is the first notification this hour
  } catch (error) {
    logger.error('Failed to mark notification sent', { error, sender });
    return false;
  }
}
