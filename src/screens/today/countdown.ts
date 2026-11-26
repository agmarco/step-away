const MINUTE = 60_000;

/**
 * How long until `at`, for the hero's "Next Reminder at HH:MM · in …": whole
 * minutes rounded up (so a Reminder never reads as sooner than it is), as
 * "in 43 min", "in 1 h", "in 1 h 5 min"; "now" once `at` has come.
 */
export function countdownOf(at: number, now: number): string {
  if (at <= now) return 'now';
  const minutes = Math.ceil((at - now) / MINUTE);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `in ${hours} h` : `in ${hours} h ${rest} min`;
}
