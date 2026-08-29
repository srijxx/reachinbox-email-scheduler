import { getHourWindow, getNextHourStart, getRateLimitKey } from '../src/utils/rateLimiter';

describe('Rate limiter utilities', () => {
  describe('getHourWindow', () => {
    it('returns string in YYYY-MM-DDTHH format', () => {
      const window = getHourWindow(new Date('2026-08-28T14:35:00Z'));
      expect(window).toBe('2026-08-28T14');
    });

    it('two dates in the same hour have the same window', () => {
      const a = getHourWindow(new Date('2026-08-28T14:01:00Z'));
      const b = getHourWindow(new Date('2026-08-28T14:59:00Z'));
      expect(a).toBe(b);
    });

    it('two dates in different hours have different windows', () => {
      const a = getHourWindow(new Date('2026-08-28T14:59:00Z'));
      const b = getHourWindow(new Date('2026-08-28T15:00:00Z'));
      expect(a).not.toBe(b);
    });
  });

  describe('getNextHourStart', () => {
    it('returns the start of the next hour', () => {
      const from = new Date('2026-08-28T14:35:00.000Z');
      const next = getNextHourStart(from);
      expect(next.getUTCHours()).toBe(15);
      expect(next.getUTCMinutes()).toBe(0);
      expect(next.getUTCSeconds()).toBe(0);
    });

    it('rolls over to next day at hour 23', () => {
      const from = new Date('2026-08-28T23:45:00.000Z');
      const next = getNextHourStart(from);
      expect(next.getUTCDate()).toBe(29);
      expect(next.getUTCHours()).toBe(0);
    });
  });

  describe('getRateLimitKey', () => {
    it('includes sender and hour window', () => {
      const key = getRateLimitKey('sender@example.com', '2026-08-28T14');
      expect(key).toBe('email-rate:sender@example.com:2026-08-28T14');
    });
  });
});
