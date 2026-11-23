/**
 * The Suggestion rules (#8, #24): which Exercises a Reminder suggests. Pure,
 * with all randomness from the injected Random.
 */

import { BODY_AREAS, DIFFICULTIES, type BodyArea, type Exercise } from './exercise';
import { addDays, instantAt, localDateOf } from './localTime';
import { dateKey, dayOf } from './days';
import { doseOf } from './dose';
import type { Instant, Random, Reminder, Settings, SuggestedExercise } from './types';

/** The no-repeat window: an Exercise can't reappear within this many Suggestions before. */
export const WINDOW = 5;

/** In Weighted mode, a Body Area with no Done Exercise on the Reminder's day weighs this; a covered one 1. */
const UNCOVERED_WEIGHT = 3;

/** No Body Area covered. */
const NONE: ReadonlySet<BodyArea> = new Set();

/**
 * What Suggestions are drawn from under `settings`: the eligible pool, or,
 * when it is empty, the fallback set with `fallback: true`. undefined when
 * there is no fallback candidate either: then nothing is scheduled.
 */
export function suggestionSource(
  settings: Settings,
  library: readonly Exercise[],
): { exercises: Exercise[]; fallback: boolean } | undefined {
  const pool = eligiblePool(settings, library);
  if (pool.length > 0) return { exercises: pool, fallback: false };
  const fallbackSet = fallbackSetOf(library);
  return fallbackSet.length > 0 ? { exercises: fallbackSet, fallback: true } : undefined;
}

/**
 * The eligible pool: Difficulty at or below the ceiling, Energetic only when
 * switched on, Position Floor only when Floor is on, no Equipment or owned
 * Equipment, and not Excluded.
 */
export function eligiblePool(settings: Settings, library: readonly Exercise[]): Exercise[] {
  return library.filter((e) => eligible(e, settings));
}

function eligible(e: Exercise, settings: Settings): boolean {
  return (
    DIFFICULTIES.indexOf(e.difficulty) <= DIFFICULTIES.indexOf(settings.difficulty) &&
    (settings.energetic || !e.energetic) &&
    (settings.floor || e.position !== 'Floor') &&
    (e.equipment === null || settings.equipment.includes(e.equipment)) &&
    !settings.excluded.includes(e.id)
  );
}

/** The fallback set (the base set): no Equipment, Position not Floor; Exclusions, the ceiling and Energetic ignored. */
export function fallbackSetOf(library: readonly Exercise[]): Exercise[] {
  return library.filter((e) => e.equipment === null && e.position !== 'Floor');
}

/** What a Reminder carries from its Suggestion. Keys are absent, not undefined, when they don't apply. */
export type BuiltSuggestion = Pick<Reminder, 'suggestion' | 'fallback' | 'rotation'>;

/**
 * What a Suggestion is built from, besides its source and settings, as if
 * built when its Reminder fires. The chain rebuild carries it forward from
 * one Reminder to the next rather than rescanning, so it stays linear.
 */
export interface SuggestionHistory {
  /** The Reminders before it, oldest first: its no-repeat window is their tail. */
  earlier: readonly Reminder[];
  /** Where a Strict rotation starts: the `rotation` of the latest of `earlier` that has one, else 0 (`rotationStart`). */
  rotation: number;
  /** Weighted coverage: the Body Areas Done on its local day, by the `done` Reminders of `earlier` (`coverageOf`). */
  covered: ReadonlySet<BodyArea>;
}

/**
 * The Suggestion of a Reminder from its `history` (see `SuggestionHistory`);
 * `source` is from `suggestionSource`. A fallback goes through the same rules
 * with a count of 1: the window, the mode and, in Strict, the rotation.
 *
 * Areas first: Weighted and Random pick a Body Area by weight among those
 * with a candidate, then an Exercise uniformly within it, each Exercise from
 * a different area while it can. Strict takes the next areas of the rotation
 * that have something in `source` (before the window) and picks within each.
 *
 * Relaxation, in order: repeated areas (keeping as many distinct as it can);
 * the window shrinks from 5 Suggestions to 1, keeping the largest that still
 * gives the full count; fewer Exercises (window 1); in Strict, when its
 * areas have nothing left even at window 1, the rest of the source as Random
 * draws it (the rotation still advances); window 0 only when the whole source
 * was in the previous Suggestion.
 */
export function buildSuggestion(
  { earlier, rotation: start, covered }: SuggestionHistory,
  source: { exercises: Exercise[]; fallback: boolean },
  settings: Settings,
  random: Random,
): BuiltSuggestion {
  const count = source.fallback ? 1 : settings.exercisesPerSuggestion;
  let draw: (available: Exercise[]) => Exercise[];
  let rotation: number | undefined;
  if (settings.bodyAreaMode === 'Strict') {
    const walk = strictAreas(source.exercises, count, start);
    draw = (available) => drawPinned(available, walk.areas, random);
    rotation = walk.rotation;
  } else {
    const dayCovered = settings.bodyAreaMode === 'Weighted' ? covered : NONE;
    const weight = (area: BodyArea) => (dayCovered.has(area) ? 1 : UNCOVERED_WEIGHT);
    draw = (available) => drawByWeight(available, count, weight, random);
  }

  let picks: Exercise[] = [];
  for (let size = WINDOW; size >= 1 && picks.length < count; size--) {
    picks = draw(without(source.exercises, windowIds(earlier, size)));
  }
  if (picks.length === 0) {
    // Strict with its pinned areas used up: the rest of the source, areas first at weight 1, before window 0.
    const unused = without(source.exercises, windowIds(earlier, 1));
    picks =
      settings.bodyAreaMode === 'Strict' && unused.length > 0
        ? drawByWeight(unused, count, () => 1, random)
        : draw(source.exercises);
  }

  return {
    suggestion: picks.map((e) => snapshotOf(e, settings)),
    ...(source.fallback ? { fallback: true as const } : {}),
    ...(rotation !== undefined ? { rotation } : {}),
  };
}

/** The Exercise Ids of the last `size` Suggestions of `earlier` (the newest), swapped-out ones included. */
export function windowIds(earlier: readonly Reminder[], size: number): Set<string> {
  const ids = new Set<string>();
  for (let i = Math.max(0, earlier.length - size); i < earlier.length; i++) {
    for (const e of earlier[i].suggestion) ids.add(e.id);
    for (const id of earlier[i].swappedOut ?? []) ids.add(id);
  }
  return ids;
}

/** `exercises` minus those whose Id is in `ids`. */
export function without(exercises: readonly Exercise[], ids: ReadonlySet<string>): Exercise[] {
  return exercises.filter((e) => !ids.has(e.id));
}

/** The text snapshot a Suggestion keeps of an Exercise, with its Dose under `settings` (`doseOf`). */
export function snapshotOf(exercise: Exercise, settings: Settings): SuggestedExercise {
  const { id, name, cue, bodyArea } = exercise;
  return { id, name, dose: doseOf(exercise, settings), cue, bodyArea };
}

/**
 * Areas first: a Body Area among those of `candidates`, with probability
 * proportional to `weight`, then one of its Exercises uniformly.
 */
export function pickByArea(
  candidates: readonly Exercise[],
  weight: (area: BodyArea) => number,
  random: Random,
): Exercise {
  const areas = BODY_AREAS.filter((area) => candidates.some((e) => e.bodyArea === area));
  let roll = random.next() * areas.reduce((sum, area) => sum + weight(area), 0);
  const area = areas.find((a) => (roll -= weight(a)) < 0) ?? areas[areas.length - 1];
  const within = candidates.filter((e) => e.bodyArea === area);
  return within[Math.floor(random.next() * within.length)];
}

/** Up to `count` distinct Exercises of `available`, areas first, from Body Areas not yet picked while there are any. */
function drawByWeight(
  available: readonly Exercise[],
  count: number,
  weight: (area: BodyArea) => number,
  random: Random,
): Exercise[] {
  const picks: Exercise[] = [];
  let left = [...available];
  while (picks.length < count && left.length > 0) {
    const used = new Set(picks.map((e) => e.bodyArea));
    const fresh = left.filter((e) => !used.has(e.bodyArea));
    const pick = pickByArea(fresh.length > 0 ? fresh : left, weight, random);
    picks.push(pick);
    left = left.filter((e) => e !== pick);
  }
  return picks;
}

/** One distinct Exercise of `available` per area of `areas`, uniformly within it; an area with none left is skipped. */
function drawPinned(available: readonly Exercise[], areas: readonly BodyArea[], random: Random): Exercise[] {
  const picks: Exercise[] = [];
  for (const area of areas) {
    const within = available.filter((e) => e.bodyArea === area && !picks.includes(e));
    if (within.length > 0) picks.push(within[Math.floor(random.next() * within.length)]);
  }
  return picks;
}

/**
 * Strict rotation: the next `count` Body Areas from `BODY_AREAS` index
 * `start`, wrapping, skipping those with nothing in `exercises` (an area
 * repeats only when fewer have something), and the index the next Strict
 * Suggestion starts from.
 */
function strictAreas(
  exercises: readonly Exercise[],
  count: number,
  start: number,
): { areas: BodyArea[]; rotation: number } {
  const areas: BodyArea[] = [];
  let index = start;
  while (areas.length < count) {
    const area = BODY_AREAS[index];
    index = (index + 1) % BODY_AREAS.length;
    if (exercises.some((e) => e.bodyArea === area)) areas.push(area);
  }
  return { areas, rotation: index };
}

/** Where a Strict Suggestion starts: the `rotation` of the latest earlier Reminder that has one, else 0. */
export function rotationStart(earlier: readonly Reminder[]): number {
  for (let i = earlier.length - 1; i >= 0; i--) {
    const { rotation } = earlier[i];
    if (rotation !== undefined) return rotation;
  }
  return 0;
}

/**
 * Weighted coverage, computed once from `reminders`: for an instant, the Body
 * Areas in the `done` lists of the `done` Reminders of its local day. It
 * remembers the last day looked up, so instants in fire order resolve their
 * local day (an Intl call) about once per day, not once each.
 */
export function coverageOf(reminders: readonly Reminder[], timeZone: string): (at: Instant) => ReadonlySet<BodyArea> {
  const byDay = new Map<number, Set<BodyArea>>();
  for (const r of reminders) {
    if (r.status !== 'done') continue;
    const day = dateKey(dayOf(r, timeZone));
    const covered = byDay.get(day) ?? new Set<BodyArea>();
    for (const e of r.done ?? []) covered.add(e.bodyArea);
    byDay.set(day, covered);
  }
  let last = { start: Infinity, end: -Infinity, covered: NONE };
  return (at) => {
    if (at < last.start || at >= last.end) {
      const date = localDateOf(at, timeZone);
      const start = instantAt(date, 0, timeZone);
      const end = instantAt(addDays(date, 1), 0, timeZone);
      last = { start, end, covered: byDay.get(dateKey(date)) ?? NONE };
    }
    return last.covered;
  };
}
