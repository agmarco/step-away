/**
 * Timing and Id logs for diagnosing #39 (shade taps: stale Reminder Id,
 * minutes-late delivery, seconds to commit). Logging only: nothing here
 * changes what the app does.
 *
 * Every line starts with `[trace]` and this JS context's tag (four random
 * characters, new per JS context), so a headless task's lines and the UI's
 * can be told apart in logcat (`ReactNativeJS`) even in one process. A span
 * times one handler call: one line when it starts, one per step (ms since the
 * previous step, and since the start), one with the total.
 */

/** Where a line goes; `console.log` in the app. */
export type Log = (line: string) => void;

export const TRACE_PREFIX = '[trace]';

/** A local wall-clock time, `HH:MM:SS.mmm`, to line up with logcat's timestamps. */
export function clockTime(ms: number): string {
  const t = new Date(ms);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(t.getHours())}:${two(t.getMinutes())}:${two(t.getSeconds())}.${String(t.getMilliseconds()).padStart(3, '0')}`;
}

/** One timed handler call. */
export interface Span {
  /** Logs a step: ms since the previous step and since the start, with an optional detail. */
  step(name: string, detail?: string): void;
  /** Logs the total and how the call ended. */
  end(outcome: string): void;
}

export interface Tracer {
  /** This JS context's tag. */
  ctx: string;
  /** Starts a span for `label` (e.g. `Skip reminder-123`) from `source` (`bg-task`, `fg-listener`, `app`). */
  span(source: string, label: string): Span;
  /** Logs one free-standing line under this context's tag. */
  line(text: string): void;
}

export function createTracer({ ctx, clock, log }: { ctx: string; clock: () => number; log: Log }): Tracer {
  let seq = 0;
  const line = (text: string) => log(`${TRACE_PREFIX} ${ctx} ${text}`);
  return {
    ctx,
    line,
    span(source, label) {
      const head = `#${++seq} ${source} ${label} |`;
      const start = clock();
      let last = start;
      line(`${head} start at ${clockTime(start)}`);
      return {
        step(name, detail) {
          const t = clock();
          line(`${head} ${name} +${t - last}ms (${t - start}ms)${detail ? ` ${detail}` : ''}`);
          last = t;
        },
        end(outcome) {
          line(`${head} total ${clock() - start}ms: ${outcome}`);
        },
      };
    },
  };
}

/** What a notification response or a received notification carried, as one line's text. */
export function describeNotification(fields: {
  what: string;
  actionId?: string;
  identifier?: string;
  reminderId?: string;
  date?: number;
  now: number;
}): string {
  const { what, actionId, identifier, reminderId, date, now } = fields;
  const parts = [what];
  if (actionId !== undefined) parts.push(`action=${actionId}`);
  parts.push(`identifier=${identifier ?? '?'}`, `reminderId=${reminderId ?? '?'}`);
  // The identifier is the Reminder Id (notifications.ts): a mismatch means the payload came from another notification.
  if (identifier !== undefined && reminderId !== undefined && identifier !== reminderId) parts.push('ID MISMATCH');
  parts.push(date ? `date=${clockTime(date)} (${Math.round((now - date) / 1000)}s ago)` : 'date=?');
  return parts.join(' ');
}

/** The app's tracer: one per JS context. Only adapters touch Date.now and Math.random. */
export const trace: Tracer = createTracer({
  ctx: Math.random().toString(36).slice(2, 6).padEnd(4, '0'),
  clock: Date.now,
  log: (l) => console.log(l),
});
