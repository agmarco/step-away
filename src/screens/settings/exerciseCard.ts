/**
 * The Exercise card's edits, pure: the whole `doseOverrides` record and the
 * whole `excluded` list after a Save, a Reset to default or an Exclude /
 * Bring back (each goes to `changeSettings` whole), and the Dose editor's
 * stepper and kind switch.
 */
import type { Dose } from '../../core';

/** The Dose amount range the core accepts. */
export const MIN_AMOUNT = 1;
export const MAX_AMOUNT = 999;
/** The stepper's step per kind: a rep at a time, a hold 5 s at a time. */
const STEP: Record<Dose['kind'], number> = { reps: 1, seconds: 5 };
/** The amount a switch to a kind other than the library's starts at. */
const START: Record<Dose['kind'], number> = { reps: 10, seconds: 30 };

type Overrides = Record<string, Dose>;

const sameDose = (a: Dose, b: Dose) => a.kind === b.kind && a.amount === b.amount && a.eachSide === b.eachSide;

/**
 * The overrides after saving `dose` on the Exercise `id` whose library Dose
 * is `libraryDose`: stored, or the Id removed when `dose` equals the library
 * Dose, so the Customised filter only shows real changes.
 */
export function withDose(overrides: Overrides, id: string, libraryDose: Dose, dose: Dose): Overrides {
  if (sameDose(dose, libraryDose)) return withoutDose(overrides, id);
  return { ...overrides, [id]: { kind: dose.kind, amount: dose.amount, eachSide: dose.eachSide } };
}

/** The overrides after Reset to default on `id`: the Id removed. */
export function withoutDose(overrides: Overrides, id: string): Overrides {
  return Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== id));
}

/** The Excluded list after Exclude (`exclude` true, the Id added once) or Bring back (removed). */
export function withExcluded(excluded: readonly string[], id: string, exclude: boolean): string[] {
  const others = excluded.filter((e) => e !== id);
  return exclude ? [...others, id] : others;
}

/** The amount one stepper tap up (1) or down (-1) gives: the next multiple of the kind's step, within 1–999. */
export function stepAmount(dose: Dose, direction: 1 | -1): number {
  const step = STEP[dose.kind];
  const next = direction === 1 ? Math.floor(dose.amount / step) * step + step : Math.ceil(dose.amount / step) * step - step;
  return Math.min(MAX_AMOUNT, Math.max(MIN_AMOUNT, next));
}

/** The draft after switching it to `kind`: the library amount for the library's kind, else 10 reps or 30 s; Each Side kept. */
export function withKind(draft: Dose, kind: Dose['kind'], libraryDose: Dose): Dose {
  const amount = kind === libraryDose.kind ? libraryDose.amount : START[kind];
  return { kind, amount, eachSide: draft.eachSide };
}
