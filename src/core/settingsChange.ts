/**
 * ChangeSettings validation (#29, #30): whether a settings change is one the
 * app could make. The event can come from an untyped caller (a stale store, a
 * bug), so every field is checked at runtime.
 */

import { DIFFICULTIES, EQUIPMENT, type Dose } from './exercise';
import type { AppearanceSetting, BodyAreaMode, SettingsChange, Weekday } from './types';

/**
 * A list naming every member of `T`: one missing is a type error at the list,
 * one not in `T` too. `allOf<T>()([...])` keeps the literal tuple type.
 */
const allOf =
  <T>() =>
  <const L extends readonly T[]>(list: L & ([Exclude<T, L[number]>] extends [never] ? unknown : never)): L =>
    list;

/** The Interval choices: 15–120 min in 5-min steps. */
export const INTERVALS: readonly number[] = Array.from({ length: 22 }, (_, i) => 15 + i * 5);
/** The Snooze delay choices, in minutes. */
export const SNOOZE_DELAYS: readonly number[] = [5, 10, 15, 20, 30];
/** Every Body Area mode, in the order the Settings page lists them. */
export const BODY_AREA_MODES = allOf<BodyAreaMode>()(['Weighted', 'Random', 'Strict']);
/** Every Appearance setting, in the order the Settings page lists them. */
export const APPEARANCE_SETTINGS = allOf<AppearanceSetting>()(['System', 'Light', 'Dark']);
/** Mon–Sun: the order the Settings page shows the days in and its main-window ties are broken in. */
export const WEEKDAYS = allOf<Weekday>()(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

const DAY_MINUTES = 24 * 60;

const isIntegerIn = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

const isBoolean = (value: unknown) => typeof value === 'boolean';

const isOneOf =
  <T>(options: readonly T[]) =>
  (value: unknown) => options.some((option) => option === value);

const isEquipmentList = (value: unknown) =>
  Array.isArray(value) &&
  value.every(isOneOf(EQUIPMENT)) &&
  new Set(value).size === value.length;

const isStringList = (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === 'string');

/** A record: a plain object, not null and not an array. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const DOSE_KINDS = allOf<Dose['kind']>()(['reps', 'seconds']);

/** A Dose: exactly `kind` (reps or seconds), `amount` (an integer 1–999) and `eachSide` (a boolean). */
const isDose = (value: unknown) =>
  isRecord(value) &&
  Object.keys(value).length === 3 &&
  isOneOf(DOSE_KINDS)(value.kind) &&
  isIntegerIn(value.amount, 1, 999) &&
  isBoolean(value.eachSide);

/** Dose overrides: a record whose every value is a Dose. Its keys are any Exercise Ids, unchecked. */
const isDoseOverrides = (value: unknown) => isRecord(value) && Object.values(value).every(isDose);

/** `null` (a day off) or an integer `[start, end)` window within the day. */
const isDay = (value: unknown): boolean => {
  if (value === null) return true;
  if (typeof value !== 'object') return false;
  const { start, end } = value as { start: unknown; end: unknown };
  return isIntegerIn(start, 0, DAY_MINUTES) && isIntegerIn(end, 0, DAY_MINUTES) && start < end;
};

/** A complete record: exactly the 7 weekdays, each a valid day. */
const isActiveHours = (value: unknown) => {
  if (!isRecord(value)) return false;
  const days = Object.keys(value);
  return (
    days.length === WEEKDAYS.length &&
    WEEKDAYS.every((day) => days.includes(day) && isDay((value as Record<string, unknown>)[day]))
  );
};

const RULES: Record<keyof SettingsChange, (value: unknown) => boolean> = {
  activeHours: isActiveHours,
  intervalMinutes: isOneOf(INTERVALS),
  snoozeMinutes: isOneOf(SNOOZE_DELAYS),
  exercisesPerSuggestion: (value) => isIntegerIn(value, 1, 3),
  bodyAreaMode: isOneOf(BODY_AREA_MODES),
  difficulty: isOneOf(DIFFICULTIES),
  energetic: isBoolean,
  floor: isBoolean,
  equipment: isEquipmentList,
  excluded: isStringList,
  doseOverrides: isDoseOverrides,
  appearance: isOneOf(APPEARANCE_SETTINGS),
};

/** Whether every field of `change` is valid. Any other key, `timeZone` included, makes it invalid. */
export function isValidChange(change: SettingsChange): boolean {
  return Object.entries(change).every(
    ([key, value]) => Object.hasOwn(RULES, key) && RULES[key as keyof SettingsChange](value),
  );
}
