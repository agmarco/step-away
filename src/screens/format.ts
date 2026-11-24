/**
 * Display-only date and time formatting (device locale, 24-hour times):
 * `timeOf` on Today and History, `weekdayOf` and `longDateOf` in Today's hero.
 */

export const timeOf = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export const weekdayOf = (at: number) => new Date(at).toLocaleDateString(undefined, { weekday: 'short' });

export const longDateOf = (at: number) =>
  new Date(at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
