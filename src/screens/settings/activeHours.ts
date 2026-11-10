import { WEEKDAYS, type ActiveWindow, type Settings, type Weekday } from '../../core';

export type ActiveHours = Settings['activeHours'];

const sameWindow = (a: ActiveWindow | null, b: ActiveWindow | null) =>
  a !== null && b !== null && a.start === b.start && a.end === b.end;

/**
 * The main window: the most common window among the enabled days, a tie going
 * to the one of the earliest weekday. Null with every day off.
 */
export function mainWindow(hours: ActiveHours): ActiveWindow | null {
  let best: ActiveWindow | null = null;
  let bestCount = 0;
  for (const day of WEEKDAYS) {
    const window = hours[day];
    if (!window) continue;
    const count = WEEKDAYS.filter((d) => sameWindow(hours[d], window)).length;
    // Strictly more: an equal count keeps the earlier weekday's window.
    if (count > bestCount) {
      best = window;
      bestCount = count;
    }
  }
  return best && { start: best.start, end: best.end };
}

/** One weekday on the page: off, on the main window, or on its own window (an override). */
export type DayRow = { day: Weekday } & ({ kind: 'off' } | { kind: 'main' } | { kind: 'own'; window: ActiveWindow });

/** Every weekday, Mon–Sun, as the page shows it against the main window. */
export function dayRows(hours: ActiveHours): DayRow[] {
  const main = mainWindow(hours);
  return WEEKDAYS.map((day): DayRow => {
    const window = hours[day];
    if (!window) return { day, kind: 'off' };
    if (sameWindow(window, main)) return { day, kind: 'main' };
    return { day, kind: 'own', window: { start: window.start, end: window.end } };
  });
}

/** The window a day gets when it is turned on while every day is off: 09:00–18:00. */
const FIRST_WINDOW: ActiveWindow = { start: 9 * 60, end: 18 * 60 };

/** Turns a day on (on the main window, or 09:00–18:00 when it is the only one) or off. */
export function withDay(hours: ActiveHours, day: Weekday, on: boolean): ActiveHours {
  return { ...hours, [day]: on ? (mainWindow(hours) ?? { ...FIRST_WINDOW }) : null };
}

/** Moves every day on the main window to `window`; days on their own window and days off stay. */
export function withMainWindow(hours: ActiveHours, window: ActiveWindow): ActiveHours {
  const next = { ...hours };
  for (const row of dayRows(hours)) if (row.kind === 'main') next[row.day] = { start: window.start, end: window.end };
  return next;
}

/** Gives an enabled day its own window, or puts it back on the main window (`'main'`). A day off stays off. */
export function withDayWindow(hours: ActiveHours, day: Weekday, window: ActiveWindow | 'main'): ActiveHours {
  if (!hours[day]) return hours;
  const next = window === 'main' ? mainWindow(hours) : window;
  return next ? { ...hours, [day]: { start: next.start, end: next.end } } : hours;
}

const STEP = 15;
const DAY = 24 * 60;
const pad = (n: number) => String(n).padStart(2, '0');

/** Minutes after midnight as HH:MM; the end of the day is 24:00. */
export function formatTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** A window as `HH:MM–HH:MM`. */
export function formatWindow(window: ActiveWindow): string {
  return `${formatTime(window.start)}–${formatTime(window.end)}`;
}

/** Every 15-minute step from `from` to `to`, both included. */
const steps = (from: number, to: number) =>
  Array.from({ length: Math.floor((to - from) / STEP) + 1 }, (_, i) => from + i * STEP);

/** The starts a window can take, in 15-minute steps, before `end`. */
export function startTimes(end: number): number[] {
  return steps(0, DAY - STEP).filter((t) => t < end);
}

/** The ends a window can take, in 15-minute steps, after `start`, up to 24:00. */
export function endTimes(start: number): number[] {
  return steps(STEP, DAY).filter((t) => t > start);
}
