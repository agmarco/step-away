// PROTOTYPE — throwaway. Fake Activity Log data shaped by "Define the Activity Log view" (#13),
// just enough to judge navigation and the Today layout. Not production code.

export type Outcome = 'Done' | 'Skip' | 'Missed' | 'Outstanding';

export type Entry = {
  id: number;
  time: string; // when the Reminder first fired
  outcome: Outcome;
  exercises: string[]; // Done only
  snoozes: number;
};

export type PauseLine = { from: string; to: string };

export type Day = {
  goal: number;
  streak: number;
  entries: Entry[];
  pauses: PauseLine[];
  next: string | null; // next Reminder time
  pausedUntil: string | null;
  dayOff: boolean;
  newBadge: boolean;
  activeHours: { from: string; to: string };
};

export const doneCount = (d: Day) => d.entries.filter((e) => e.outcome === 'Done').length;
export const tally = (d: Day) => ({
  done: doneCount(d),
  skip: d.entries.filter((e) => e.outcome === 'Skip').length,
  missed: d.entries.filter((e) => e.outcome === 'Missed').length,
  exercises: d.entries.reduce((n, e) => n + e.exercises.length, 0),
});

const base: Day = {
  goal: 4,
  streak: 6,
  entries: [],
  pauses: [],
  next: '9:45 am',
  pausedUntil: null,
  dayOff: false,
  newBadge: false,
  activeHours: { from: '9:00 am', to: '6:00 pm' },
};

const midDay: Entry[] = [
  { id: 1, time: '9:45 am', outcome: 'Done', exercises: ['Side Neck Stretch'], snoozes: 0 },
  { id: 2, time: '10:32 am', outcome: 'Done', exercises: ['Bodyweight Squat'], snoozes: 1 },
  { id: 3, time: '11:20 am', outcome: 'Skip', exercises: [], snoozes: 2 },
  { id: 4, time: '12:05 pm', outcome: 'Missed', exercises: [], snoozes: 0 },
  { id: 5, time: '12:50 pm', outcome: 'Done', exercises: ['Wrist Circles', 'Seated Twist'], snoozes: 0 },
];

export const SCENARIOS: { name: string; day: () => Day }[] = [
  { name: 'Morning, nothing yet', day: () => ({ ...base }) },
  { name: 'Mid-day, 3 / 4', day: () => ({ ...base, entries: midDay.map((e) => ({ ...e })), next: '1:35 pm' }) },
  {
    name: 'Reminder outstanding',
    day: () => ({ ...base, entries: [...midDay.map((e) => ({ ...e })), { id: 6, time: '1:35 pm', outcome: 'Outstanding', exercises: [], snoozes: 1 }], next: null }),
  },
  {
    name: 'Paused',
    day: () => ({ ...base, entries: midDay.map((e) => ({ ...e })), next: null, pausedUntil: '3:00 pm', pauses: [{ from: '2:00 pm', to: '3:00 pm' }] }),
  },
  {
    name: 'Goal reached + new Badge',
    day: () => ({
      ...base,
      streak: 7,
      newBadge: true,
      entries: [...midDay.map((e) => ({ ...e })), { id: 6, time: '1:35 pm', outcome: 'Done', exercises: ['Calf Raises'], snoozes: 0 }],
      next: '2:20 pm',
    }),
  },
  { name: 'Day Off', day: () => ({ ...base, dayOff: true, next: null }) },
];

// History: October 2026, today = 29th (Thu). Weekends have no Active Hours.
export type DayMark = 'goal' | 'off' | 'missed' | 'none' | 'today' | 'future';
export const MONTH = { label: 'October 2026', firstWeekday: 3 /* Thu, Mon=0 */, days: 31, today: 29 };
export function markFor(d: number): DayMark {
  if (d === MONTH.today) return 'today';
  if (d > MONTH.today) return 'future';
  const wd = (MONTH.firstWeekday + d - 1) % 7;
  if (wd >= 5) return 'none';
  if (d === 9 || d === 10) return 'off';
  if (d === 6 || d === 15 || d === 21) return 'missed';
  return 'goal';
}
export const PAST_DAY: Entry[] = [
  { id: 101, time: '9:30 am', outcome: 'Done', exercises: ['Shoulder Circles'], snoozes: 0 },
  { id: 102, time: '10:15 am', outcome: 'Done', exercises: ['Chin Tuck'], snoozes: 0 },
  { id: 103, time: '11:05 am', outcome: 'Missed', exercises: [], snoozes: 0 },
  { id: 104, time: '11:50 am', outcome: 'Done', exercises: ['Desk Push-ups'], snoozes: 2 },
  { id: 105, time: '2:10 pm', outcome: 'Done', exercises: ['Hip Circles'], snoozes: 0 },
];

export const BADGES: { group: string; items: { label: string; got: boolean; isNew?: boolean }[] }[] = [
  { group: 'Streak', items: [{ label: '3 days', got: true }, { label: '7 days', got: true, isNew: true }, { label: '14', got: false }, { label: '30', got: false }, { label: '60', got: false }, { label: '100', got: false }] },
  { group: 'Total Done', items: [{ label: '1', got: true }, { label: '10', got: true }, { label: '50', got: true }, { label: '100', got: false }, { label: '250', got: false }, { label: '500', got: false }] },
  { group: 'Variety', items: [{ label: '10 Exercises', got: true }, { label: '25', got: false }, { label: '50', got: false }] },
  { group: 'One-day', items: [{ label: 'Balance', got: true }, { label: 'Perfect day', got: false }] },
];
export const RECORDS = [
  { label: 'Longest Streak', value: '12 days' },
  { label: 'Most Done in a day', value: '7' },
  { label: 'Most Done in a week', value: '28' },
];
