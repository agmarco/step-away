/**
 * Domain-core types. Pure TypeScript: nothing here may import React, React
 * Native or Expo (enforced by ESLint's no-restricted-imports on src/core/**).
 *
 * These are a skeleton. Later tickets grow each union with the events and
 * intents described in the v1 spec (#17, Modules -> Domain core).
 */

/** Epoch milliseconds. */
export type Instant = number;

/** The final outcome of a Reminder in the Activity Log. */
export type Outcome = 'Done' | 'Skip' | 'Missed';

/** Everything the core knows. Adapters persist it; the core never does. */
export interface CoreState {
  /** When the app was last opened, or null if never. */
  lastAppOpenAt: Instant | null;
}

/** Something that happened, fed into the core by an adapter or screen. */
export type CoreEvent = { type: 'AppOpened' };

/** Something the core wants the platform to do. Adapters carry these out. */
export type Intent =
  | { type: 'ScheduleReminder'; at: Instant }
  | { type: 'CancelReminder' };

/** Injected source of the current time. The core never reads the system clock. */
export interface Clock {
  now(): Instant;
}

/** Injected source of randomness. The core never calls Math.random. */
export interface Random {
  /** A number in [0, 1). */
  next(): number;
}

export interface CoreDeps {
  clock: Clock;
  random: Random;
}

export interface CoreResult {
  state: CoreState;
  intents: Intent[];
}
