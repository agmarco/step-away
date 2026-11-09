/**
 * The Suggestion rules (#8, #24): which Exercises a Reminder suggests. Pure,
 * with all randomness from the injected Random.
 */

import { BODY_AREAS, DIFFICULTIES, type BodyArea, type Exercise } from './exercise';
import { localDateOf } from './localTime';
import { dayOf, sameDate } from './days';
import type { Instant, Random, Reminder, Settings, SuggestedExercise } from './types';

/** The no-repeat window: an Exercise can't reappear within this many Suggestions before. */
export const WINDOW = 5;

/** In Weighted mode, a Body Area with no Done Exercise on the Reminder's day weighs this; a covered one 1. */
const UNCOVERED_WEIGHT = 3;

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
 * The Suggestion of the Reminder firing at `firesAt`, as if built when it
 * fires: `earlier` are the Reminders before it, oldest first (its window,
 * rotation and the day's coverage come from them), `source` is from
 * `suggestionSource`. A fallback goes through the same rules with a count
 * of 1: the window, the mode and, in Strict, the rotation.
 *
 * Areas first: Weighted and Random pick a Body Area by weight among those
 * with a candidate, then an Exercise uniformly within it, each Exercise from
 * a different area while it can. Strict takes the next areas of the rotation
 * that have something in `source` (before the window) and picks within each.
 *
 * Relaxation, in order: repeated areas (keeping as many distinct as it can);
 * the window shrinks from 5 Suggestions to 1, keeping the largest that still
 * gives the full count; fewer Exercises (window 1); window 0 only when the
 * whole source was in the previous Suggestion.
 */
export function buildSuggestion(
  firesAt: Instant,
  earlier: readonly Reminder[],
  source: { exercises: Exercise[]; fallback: boolean },
  settings: Settings,
  random: Random,
): BuiltSuggestion {
  const count = source.fallback ? 1 : settings.exercisesPerSuggestion;
  let draw: (available: Exercise[]) => Exercise[];
  let rotation: number | undefined;
  if (settings.bodyAreaMode === 'Strict') {
    const walk = strictAreas(source.exercises, count, rotationStart(earlier));
    draw = (available) => drawPinned(available, walk.areas, random);
    rotation = walk.rotation;
  } else {
    const weighted = settings.bodyAreaMode === 'Weighted';
    const covered = weighted ? coveredAreas(firesAt, earlier, settings.timeZone) : new Set<BodyArea>();
    const weight = (area: BodyArea) => (covered.has(area) ? 1 : UNCOVERED_WEIGHT);
    draw = (available) => drawByWeight(available, count, weight, random);
  }

  let picks: Exercise[] = [];
  for (let size = WINDOW; size >= 1 && picks.length < count; size--) {
    picks = draw(without(source.exercises, windowIds(earlier, size)));
  }
  if (picks.length === 0) picks = draw(source.exercises);

  return {
    suggestion: picks.map(snapshotOf),
    ...(source.fallback ? { fallback: true as const } : {}),
    ...(rotation !== undefined ? { rotation } : {}),
  };
}

/** The Exercise Ids of the last `size` Suggestions of `earlier` (the newest), swapped-out ones included. */
export function windowIds(earlier: readonly Reminder[], size: number): Set<string> {
  const recent = size > 0 ? earlier.slice(-size) : [];
  return new Set(recent.flatMap((r) => [...r.suggestion.map((e) => e.id), ...(r.swappedOut ?? [])]));
}

/** `exercises` minus those whose Id is in `ids`. */
export function without(exercises: readonly Exercise[], ids: ReadonlySet<string>): Exercise[] {
  return exercises.filter((e) => !ids.has(e.id));
}

/** The text snapshot a Suggestion keeps of an Exercise. */
export function snapshotOf({ id, name, dose, cue, bodyArea }: Exercise): SuggestedExercise {
  return { id, name, dose, cue, bodyArea };
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
function rotationStart(earlier: readonly Reminder[]): number {
  for (let i = earlier.length - 1; i >= 0; i--) {
    const { rotation } = earlier[i];
    if (rotation !== undefined) return rotation;
  }
  return 0;
}

/** Weighted coverage: the Body Areas in the `done` lists of the `done` Reminders of `firesAt`'s local day. */
function coveredAreas(firesAt: Instant, earlier: readonly Reminder[], timeZone: string): Set<BodyArea> {
  const day = localDateOf(firesAt, timeZone);
  const covered = new Set<BodyArea>();
  for (const r of earlier) {
    if (r.status !== 'done' || !sameDate(dayOf(r, timeZone), day)) continue;
    for (const e of r.done ?? []) covered.add(e.bodyArea);
  }
  return covered;
}
