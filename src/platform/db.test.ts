import { describe, expect, it, vi } from 'vitest';

// A fake connection that records every statement; the only expo module touched.
const log: string[] = [];
vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => ({
    execAsync: async (sql: string) => {
      if (!sql.includes('PRAGMA')) log.push(sql);
    },
  }),
}));

const { write } = await import('./db');

/** Yields to the event loop a few times, like a native bridge call would. */
const tick = () => new Promise((r) => setTimeout(r, 1));

describe('write()', () => {
  it('runs commit and the scheduling inside one critical section per JS context', async () => {
    log.length = 0;
    // Two writers started together, the way a Skip and a Rearm can be.
    const writer = (name: string) =>
      write(async () => {
        log.push(`save ${name}`);
        await tick();
        log.push(`schedule ${name}`);
        await tick();
      });
    await Promise.all([writer('A'), writer('B')]);
    expect(log).toEqual(['BEGIN IMMEDIATE', 'save A', 'schedule A', 'COMMIT', 'BEGIN IMMEDIATE', 'save B', 'schedule B', 'COMMIT']);
  });

  it('rolls back when scheduling throws, and the next write still runs', async () => {
    log.length = 0;
    const failed = write(async () => {
      log.push('save A');
      throw new Error('cancel failed');
    });
    const next = write(async () => {
      log.push('save B');
    });
    await expect(failed).rejects.toThrow('cancel failed');
    await next;
    expect(log).toEqual(['BEGIN IMMEDIATE', 'save A', 'ROLLBACK', 'BEGIN IMMEDIATE', 'save B', 'COMMIT']);
  });
});
