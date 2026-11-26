/**
 * Whether the guided screen's card at `index` (0-based) of a Suggestion of
 * `count` Exercises shows **Next exercise →**: only when another card follows.
 * Hidden on a one-Exercise Reminder (Skip and Swap cover it) and on the last
 * card (End here saves what was done so far).
 */
export function showsNext(index: number, count: number): boolean {
  return index < count - 1;
}
