import { describe, expect, it, vi } from 'vitest';

// A fake connection that records every statement; the only expo module touched.
const log: string[] = [];
vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: async () => ({
    execAsync: async (sql: string) => {
      if (!sql.includes('PRAGMA')) log.push(sql);
    },
    // Already at the latest schema, so opening runs no migration statements.
    getFirstAsync: async () => ({ user_version: Number.MAX_SAFE_INTEGER }),
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

describe('db()', () => {
  it('retries the open after a failed one instead of caching the rejection', async () => {
    // A fresh module, so this test owns the first open of its connection.
    vi.resetModules();
    let opens = 0;
    vi.doMock('expo-sqlite', () => ({
      openDatabaseAsync: async () => {
        opens += 1;
        if (opens === 1) throw new Error('database is locked');
        return {
          execAsync: async () => {},
          getFirstAsync: async () => ({ user_version: Number.MAX_SAFE_INTEGER }),
        };
      },
    }));
    const fresh = await import('./db');
    await expect(fresh.db()).rejects.toThrow('database is locked');
    await expect(fresh.db()).resolves.toBeDefined();
    expect(opens).toBe(2);
  });
});
