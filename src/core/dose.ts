import type { Dose } from './exercise';

/** A Dose as people read it: "10 reps", "20 s", "20 s each side", "10 reps each side". */
export function formatDose(dose: Dose): string {
  const amount = dose.kind === 'reps' ? `${dose.amount} reps` : `${dose.amount} s`;
  return dose.eachSide ? `${amount} each side` : amount;
}
