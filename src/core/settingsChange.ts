/**
 * ChangeSettings validation (#29): whether a change from the Settings page is
 * one the page could make. The event can come from an untyped caller (a stale
 * store, a bug), so every field is checked at runtime.
 */

import { DIFFICULTIES, EQUIPMENT } from './exercise';
import type { Settings, Weekday } from './types';

export type SettingsChange = Partial<Omit<Settings, 'timeZone'>>;

const SNOOZE_DELAYS: readonly number[] = [5, 10, 15, 20, 30];
const BODY_AREA_MODES: readonly unknown[] = ['Weighted', 'Random', 'Strict'];
const APPEARANCES: readonly unknown[] = ['System', 'Light', 'Dark'];
const DAY_MINUTES = 24 * 60;
const WEEKDAYS: readonly string[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] satisfies Weekday[];

const isIntegerIn = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

const isInterval = (value: unknown) => isIntegerIn(value, 15, 120) && (value as number) % 5 === 0;

const isBoolean = (value: unknown) => typeof value === 'boolean';

const isOneOf = (options: readonly unknown[]) => (value: unknown) => options.includes(value);

const isEquipmentList = (value: unknown) =>
  Array.isArray(value) &&
  value.every((item) => (EQUIPMENT as readonly unknown[]).includes(item)) &&
  new Set(value).size === value.length;

const isStringList = (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === 'string');

/** `null` (a day off) or an integer `[start, end)` window within the day. */
const isDay = (value: unknown): boolean => {
  if (value === null) return true;
  if (typeof value !== 'object') return false;
  const { start, end } = value as { start: unknown; end: unknown };
  return isIntegerIn(start, 0, DAY_MINUTES) && isIntegerIn(end, 0, DAY_MINUTES) && start < end;
};

/** A complete record: exactly the 7 weekdays, each a valid day. */
const isActiveHours = (value: unknown) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const days = Object.keys(value);
  return (
    days.length === WEEKDAYS.length &&
    WEEKDAYS.every((day) => days.includes(day) && isDay((value as Record<string, unknown>)[day]))
  );
};

const RULES: Record<keyof SettingsChange, (value: unknown) => boolean> = {
  activeHours: isActiveHours,
  intervalMinutes: isInterval,
  snoozeMinutes: isOneOf(SNOOZE_DELAYS),
  exercisesPerSuggestion: (value) => isIntegerIn(value, 1, 3),
  bodyAreaMode: isOneOf(BODY_AREA_MODES),
  difficulty: isOneOf(DIFFICULTIES),
  energetic: isBoolean,
  floor: isBoolean,
  equipment: isEquipmentList,
  excluded: isStringList,
  appearance: isOneOf(APPEARANCES),
};

/** Whether every field of `change` is valid. Any other key, `timeZone` included, makes it invalid. */
export function isValidChange(change: SettingsChange): boolean {
  return Object.entries(change).every(
    ([key, value]) => Object.hasOwn(RULES, key) && RULES[key as keyof SettingsChange](value),
  );
}
