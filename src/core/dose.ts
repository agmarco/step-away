import type { Dose, Exercise } from './exercise';
import type { Settings } from './types';

/** The Dose amount range: an integer from 1 to 999, reps or seconds. */
export const MIN_DOSE_AMOUNT = 1;
export const MAX_DOSE_AMOUNT = 999;

/** A Dose as people read it: "10 reps", "20 s", "20 s each side", "10 reps each side". */
export function formatDose(dose: Dose): string {
  const amount = dose.kind === 'reps' ? `${dose.amount} reps` : `${dose.amount} s`;
  return dose.eachSide ? `${amount} each side` : amount;
}

/** Whether two Doses are the same: same kind, amount and Each Side. */
export function sameDose(a: Dose, b: Dose): boolean {
  return a.kind === b.kind && a.amount === b.amount && a.eachSide === b.eachSide;
}

/** Whether the Exercise `id` has a Dose override in `settings`: an own key, so an Id like `constructor` isn't misread. */
export function isCustomised(settings: Settings, id: string): boolean {
  return Object.hasOwn(settings.doseOverrides, id);
}

/** The Dose an Exercise is suggested with: its override in `settings`, else its library Dose. */
export function doseOf(exercise: Exercise, settings: Settings): Dose {
  return isCustomised(settings, exercise.id) ? settings.doseOverrides[exercise.id] : exercise.dose;
}
