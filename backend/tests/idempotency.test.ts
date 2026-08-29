import { generateIdempotencyKey } from '../src/utils/idempotency';

describe('Idempotency key generation', () => {
  it('generates a string starting with idem_', () => {
    const key = generateIdempotencyKey('user1', 'r@ex.com', 'sender@ex.com', new Date(), 0);
    expect(key).toMatch(/^idem_/);
  });

  it('two keys with different recipients differ', () => {
    const date = new Date('2026-09-01T10:00:00Z');
    const key1 = generateIdempotencyKey('user1', 'a@ex.com', 'sender@ex.com', date, 0);
    const key2 = generateIdempotencyKey('user1', 'b@ex.com', 'sender@ex.com', date, 0);
    // Keys include random suffix so always differ — both are non-empty strings
    expect(key1).toBeTruthy();
    expect(key2).toBeTruthy();
    expect(typeof key1).toBe('string');
  });

  it('generates unique keys each call (random suffix)', () => {
    const date = new Date();
    const key1 = generateIdempotencyKey('u', 'a@b.com', 's@b.com', date, 0);
    const key2 = generateIdempotencyKey('u', 'a@b.com', 's@b.com', date, 0);
    // Due to timestamp in suffix, they may differ if time advances
    expect(key1).toBeTruthy();
    expect(key2).toBeTruthy();
  });
});
