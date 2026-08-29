import { isValidEmail, filterValidEmails, normalizeEmail } from '../src/utils/emailValidator';

describe('Email validator', () => {
  describe('isValidEmail', () => {
    it('accepts a standard email', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
    });

    it('accepts email with subdomain', () => {
      expect(isValidEmail('user@mail.example.co.uk')).toBe(true);
    });

    it('accepts email with plus sign', () => {
      expect(isValidEmail('user+tag@example.com')).toBe(true);
    });

    it('rejects email without @', () => {
      expect(isValidEmail('notanemail')).toBe(false);
    });

    it('rejects email without domain', () => {
      expect(isValidEmail('user@')).toBe(false);
    });

    it('rejects email without TLD', () => {
      expect(isValidEmail('user@example')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidEmail('')).toBe(false);
    });

    it('rejects whitespace only', () => {
      expect(isValidEmail('   ')).toBe(false);
    });
  });

  describe('filterValidEmails', () => {
    it('filters out invalid emails', () => {
      const input = ['valid@example.com', 'notanemail', 'also@valid.org', ''];
      const result = filterValidEmails(input);
      expect(result).toEqual(['valid@example.com', 'also@valid.org']);
    });

    it('deduplicates emails', () => {
      const input = ['user@example.com', 'USER@EXAMPLE.COM', 'user@example.com'];
      const result = filterValidEmails(input);
      expect(result).toHaveLength(1);
    });

    it('normalizes to lowercase', () => {
      const input = ['USER@EXAMPLE.COM'];
      const result = filterValidEmails(input);
      expect(result[0]).toBe('user@example.com');
    });

    it('returns empty array for all invalid', () => {
      expect(filterValidEmails(['bad', '', 'also bad'])).toEqual([]);
    });
  });

  describe('normalizeEmail', () => {
    it('trims and lowercases', () => {
      expect(normalizeEmail('  USER@EXAMPLE.COM  ')).toBe('user@example.com');
    });
  });
});
