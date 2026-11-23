import { describe, expect, it } from 'vitest';
import { clockTime, createTracer, describeNotification } from './trace';

/** A tracer on a hand-driven clock, collecting its lines. */
function fixture(start: number) {
  let t = start;
  const lines: string[] = [];
  const tracer = createTracer({ ctx: 'ab12', clock: () => t, log: (l) => lines.push(l) });
  return { tracer, lines, advance: (ms: number) => (t += ms) };
}

const at = (h: number, m: number, s: number, ms = 0) => new Date(2026, 10, 8, h, m, s, ms).getTime();

describe('clockTime', () => {
  it('is local HH:MM:SS.mmm, zero-padded', () => {
    expect(clockTime(at(9, 4, 2, 5))).toBe('09:04:02.005');
    expect(clockTime(at(21, 30, 26, 500))).toBe('21:30:26.500');
  });
});

describe('a span', () => {
  it('logs its start, each step since the previous one and since the start, and the total', () => {
    const { tracer, lines, advance } = fixture(at(9, 30, 38, 189));
    const span = tracer.span('bg-task', 'Snooze reminder-1');
    advance(12);
    span.step('dismiss');
    advance(300);
    span.step('load', '5031 reminders');
    advance(5);
    span.end('accepted as Snooze');
    expect(lines).toEqual([
      '[trace] ab12 #1 bg-task Snooze reminder-1 | start at 09:30:38.189',
      '[trace] ab12 #1 bg-task Snooze reminder-1 | dismiss +12ms (12ms)',
      '[trace] ab12 #1 bg-task Snooze reminder-1 | load +300ms (312ms) 5031 reminders',
      '[trace] ab12 #1 bg-task Snooze reminder-1 | total 317ms: accepted as Snooze',
    ]);
  });

  it('numbers spans per tracer, so interleaved ones stay apart', () => {
    const { tracer, lines } = fixture(0);
    tracer.span('bg-task', 'Skip r').step('dismiss');
    tracer.span('fg-listener', 'Skip r').step('dismiss');
    expect(lines.filter((l) => l.includes('dismiss')).map((l) => l.split(' | ')[0])).toEqual([
      '[trace] ab12 #1 bg-task Skip r',
      '[trace] ab12 #2 fg-listener Skip r',
    ]);
  });
});

describe('describeNotification', () => {
  const now = at(9, 25, 35);

  it('names the action, identifier, Reminder Id and how old the notification is', () => {
    expect(
      describeNotification({ what: 'response', actionId: 'snooze', identifier: 'reminder-1', reminderId: 'reminder-1', date: at(9, 15, 53), now }),
    ).toBe('response action=snooze identifier=reminder-1 reminderId=reminder-1 date=09:15:53.000 (582s ago)');
  });

  it('flags an identifier that differs from the Reminder Id in the payload', () => {
    expect(describeNotification({ what: 'received', identifier: 'reminder-2', reminderId: 'reminder-1', date: now, now })).toBe(
      'received identifier=reminder-2 reminderId=reminder-1 ID MISMATCH date=09:25:35.000 (0s ago)',
    );
  });

  it('marks what is missing', () => {
    expect(describeNotification({ what: 'response', actionId: 'skip', now })).toBe(
      'response action=skip identifier=? reminderId=? date=?',
    );
  });
});
