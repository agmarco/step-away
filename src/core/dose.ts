import type { Dose, Exercise } from './exercise';
import type { Settings } from './types';

/** A Dose as people read it: "10 reps", "20 s", "20 s each side", "10 reps each side". */
export function formatDose(dose: Dose): string {
  const amount = dose.kind === 'reps' ? `${dose.amount} reps` : `${dose.amount} s`;
  return dose.eachSide ? `${amount} each side` : amount;
}

/** The Dose an Exercise is suggested with: its override in `settings`, else its library Dose. */
export function doseOf(exercise: Exercise, settings: Settings): Dose {
  return settings.doseOverrides[exercise.id] ?? exercise.dose;
}
