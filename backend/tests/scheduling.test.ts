/**
 * Tests for scheduling delay calculation algorithm.
 */

describe('Scheduling delay calculation', () => {
  function calculateScheduleTimes(
    startTime: Date,
    delayBetweenEmails: number,
    count: number
  ): Date[] {
    return Array.from({ length: count }, (_, i) =>
      new Date(startTime.getTime() + delayBetweenEmails * i)
    );
  }

  it('recipient 1 is scheduled at startTime', () => {
    const start = new Date('2026-09-01T10:00:00Z');
    const times = calculateScheduleTimes(start, 2000, 3);
    expect(times[0].getTime()).toBe(start.getTime());
  });

  it('recipient 2 is startTime + delay', () => {
    const start = new Date('2026-09-01T10:00:00Z');
    const delay = 2000;
    const times = calculateScheduleTimes(start, delay, 3);
    expect(times[1].getTime()).toBe(start.getTime() + delay);
  });

  it('recipient N is startTime + delay * (N-1)', () => {
    const start = new Date('2026-09-01T10:00:00Z');
    const delay = 5000;
    const count = 10;
    const times = calculateScheduleTimes(start, delay, count);
    for (let i = 0; i < count; i++) {
      expect(times[i].getTime()).toBe(start.getTime() + delay * i);
    }
  });

  it('delay of 0 schedules all at the same time', () => {
    const start = new Date('2026-09-01T10:00:00Z');
    const times = calculateScheduleTimes(start, 0, 5);
    times.forEach((t) => expect(t.getTime()).toBe(start.getTime()));
  });

  it('generates correct number of schedule times', () => {
    const start = new Date();
    const times = calculateScheduleTimes(start, 1000, 100);
    expect(times).toHaveLength(100);
  });
});
