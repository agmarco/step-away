// PROTOTYPE — throwaway. A tiny fake Exercise Library and just enough of the
// Suggestion rules (#8) to make the Response flow feel real. Not production code.

export type BodyArea =
  | 'Neck'
  | 'Shoulders & Upper Back'
  | 'Chest & Arms'
  | 'Wrists & Forearms'
  | 'Core & Lower Back'
  | 'Hips & Legs';

export type Dose = { kind: 'reps' | 'seconds'; n: number; eachSide: boolean };

export type Exercise = {
  id: string;
  name: string;
  bodyArea: BodyArea;
  position: 'Seated' | 'Standing' | 'Either' | 'Floor';
  dose: Dose;
  cue: string;
  fallback?: boolean;
};

export const LIBRARY: Exercise[] = [
  { id: 'Side_Neck_Stretch', name: 'Side Neck Stretch', bodyArea: 'Neck', position: 'Either', dose: { kind: 'seconds', n: 20, eachSide: true }, cue: 'Drop ear to shoulder, keep shoulders down' },
  { id: 'custom/chin_tuck', name: 'Chin Tuck', bodyArea: 'Neck', position: 'Seated', dose: { kind: 'reps', n: 10, eachSide: false }, cue: 'Slide chin straight back, hold 2 s' },
  { id: 'Shoulder_Circles', name: 'Shoulder Circles', bodyArea: 'Shoulders & Upper Back', position: 'Either', dose: { kind: 'reps', n: 10, eachSide: false }, cue: 'Big slow circles, backwards' },
  { id: 'Upper_Back_Stretch', name: 'Upper Back Stretch', bodyArea: 'Shoulders & Upper Back', position: 'Standing', dose: { kind: 'seconds', n: 20, eachSide: false }, cue: 'Clasp hands forward, round your upper back' },
  { id: 'Wall_Pushups', name: 'Desk Push-ups', bodyArea: 'Chest & Arms', position: 'Standing', dose: { kind: 'reps', n: 10, eachSide: false }, cue: 'Hands on desk edge, body straight' },
  { id: 'Chair_Dips', name: 'Chair Dips', bodyArea: 'Chest & Arms', position: 'Seated', dose: { kind: 'reps', n: 10, eachSide: false }, cue: 'Elbows back, lower slowly' },
  { id: 'Wrist_Circles', name: 'Wrist Circles', bodyArea: 'Wrists & Forearms', position: 'Either', dose: { kind: 'reps', n: 10, eachSide: false }, cue: 'Both directions, fingers loose' },
  { id: 'Wrist_Flexor_Stretch', name: 'Wrist Flexor Stretch', bodyArea: 'Wrists & Forearms', position: 'Either', dose: { kind: 'seconds', n: 15, eachSide: true }, cue: 'Arm straight, pull fingers back gently' },
  { id: 'Seated_Twist', name: 'Seated Twist', bodyArea: 'Core & Lower Back', position: 'Seated', dose: { kind: 'seconds', n: 15, eachSide: true }, cue: 'Tall spine, rotate from the ribs' },
  { id: 'Standing_Side_Bend', name: 'Standing Side Bend', bodyArea: 'Core & Lower Back', position: 'Standing', dose: { kind: 'reps', n: 10, eachSide: true }, cue: 'Reach up and over, hips still' },
  { id: 'Bodyweight_Squat', name: 'Bodyweight Squat', bodyArea: 'Hips & Legs', position: 'Standing', dose: { kind: 'reps', n: 10, eachSide: false }, cue: 'Sit back, knees over toes' },
  { id: 'Calf_Raises', name: 'Calf Raises', bodyArea: 'Hips & Legs', position: 'Standing', dose: { kind: 'reps', n: 15, eachSide: false }, cue: 'Rise slowly, pause at the top' },
  { id: 'Standing_Hip_Circles', name: 'Hip Circles', bodyArea: 'Hips & Legs', position: 'Standing', dose: { kind: 'reps', n: 10, eachSide: false }, cue: 'Hands on hips, wide slow circles' },
];

export const FALLBACK: Exercise = { ...LIBRARY[2], fallback: true };

export function doseText(d: Dose): string {
  const base = d.kind === 'reps' ? `${d.n} reps` : `${d.n} s`;
  return d.eachSide ? `${base} each side` : base;
}

function shuffle<T>(xs: T[]): T[] {
  return [...xs].sort(() => Math.random() - 0.5);
}

// Distinct Body Areas, no repeat within the recent window; relaxes when short.
export function buildSuggestion(count: number, recent: string[]): Exercise[] {
  const fresh = shuffle(LIBRARY.filter((e) => !recent.includes(e.id)));
  const pool = fresh.length >= count ? fresh : shuffle(LIBRARY);
  const picked: Exercise[] = [];
  for (const e of pool) {
    if (picked.length === count) break;
    if (!picked.some((p) => p.bodyArea === e.bodyArea)) picked.push(e);
  }
  for (const e of pool) {
    if (picked.length === count) break;
    if (!picked.includes(e)) picked.push(e);
  }
  return picked;
}

// Same Body Area where possible, never something already in the Suggestion or recent.
export function swapFor(current: Exercise, inSuggestion: string[], recent: string[]): Exercise | null {
  const ok = LIBRARY.filter((e) => !inSuggestion.includes(e.id) && !recent.includes(e.id));
  const same = ok.filter((e) => e.bodyArea === current.bodyArea);
  const list = same.length ? same : ok;
  return list.length ? shuffle(list)[0] : null;
}
