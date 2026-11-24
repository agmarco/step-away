import { describe, expect, it } from 'vitest';
import {
  hasNewBadge,
  initialState,
  reduce,
  seededRandom,
  settle,
  type CoreDeps,
  type CoreState,
  type Reminder,
  type SuggestedExercise,
} from './index';

// Local times are Europe/Madrid in November 2026: CET, UTC+1. 2 November 2026 is a Monday.
const ZONE = 'Europe/Madrid';
const local = (date: string, time: string): number => Date.parse(`${date}T${time}:00+01:00`);
const MON = '2026-11-02';

const NECK: SuggestedExercise = {
  id: 'Side_Neck_Stretch',
  name: 'Side Neck Stretch',
  dose: { kind: 'seconds', amount: 20, eachSide: true },
  cue: 'Ear to shoulder, shoulders stay down',
  bodyArea: 'Neck',
};
const reminder = (time: string, status: Reminder['status']): Reminder => ({
  id: `reminder-${local(MON, time)}`,
  firesAt: local(MON, time),
  suggestion: [NECK],
  status,
  ...(status === 'done' && { done: [{ id: NECK.id, name: NECK.name, bodyArea: NECK.bodyArea }] }),
});
const idAt = (time: string) => `reminder-${local(MON, time)}`;

const inMadrid = (reminders: Reminder[], extra: Partial<CoreState> = {}): CoreState => ({
  ...initialState,
  settings: { ...initialState.settings, timeZone: ZONE },
  reminders,
  ...extra,
});

const depsAt = (when: number): CoreDeps => ({ clock: { now: () => when }, random: seededRandom(7), library: [] });
const opened = (state: CoreState, when: number) => reduce(state, { type: 'AchievementsOpened' }, depsAt(when));
const doneResponse = (state: CoreState, reminderId: string, when: number) =>
  reduce(state, { type: 'Response', reminderId, kind: 'Done', did: [NECK.id] }, depsAt(when));

const UNLOCKED_AT = local(MON, '09:50');
const withDone1 = (achievementsSeenAt: number | null) =>
  inMadrid([reminder('09:45', 'done')], { badges: [{ id: 'done-1', unlockedAt: UNLOCKED_AT }], achievementsSeenAt });

describe('New-Badge dot: hasNewBadge', () => {
  it('a fresh install has no Badges, has never opened Achievements, and shows no dot', () => {
    expect(initialState.badges).toStrictEqual([]);
    expect(initialState.achievementsSeenAt).toBeNull();
    expect(hasNewBadge(initialState)).toBe(false);
  });

  it('shows with a Badge and Achievements never opened', () => {
    expect(hasNewBadge(withDone1(null))).toBe(true);
  });

  it('shows for a Badge unlocked after Achievements was last opened, not at or before it', () => {
    expect(hasNewBadge(withDone1(UNLOCKED_AT - 1))).toBe(true);
    expect(hasNewBadge(withDone1(UNLOCKED_AT))).toBe(false);
    expect(hasNewBadge(withDone1(UNLOCKED_AT + 1))).toBe(false);
  });
});

describe('New-Badge dot: AchievementsOpened', () => {
  it('settles, sets achievementsSeenAt to now, returns no intents, and clears the dot', () => {
    // 09:45 outstanding with 10:30 fired: settling makes 09:45 Missed.
    const state = inMadrid([reminder('09:45', 'scheduled'), reminder('10:30', 'scheduled')], {
      badges: [{ id: 'done-1', unlockedAt: local('2026-10-30', '09:50') }],
    });
    const now = local(MON, '10:40');
    expect(hasNewBadge(state)).toBe(true);

    const result = opened(state, now);

    expect(result).toStrictEqual({ state: { ...settle(state, now), achievementsSeenAt: now }, intents: [] });
    expect(result.state.reminders[0].status).toBe('missed');
    expect(hasNewBadge(result.state)).toBe(false);
  });

  it('the dot comes back with a later unlock', () => {
    const seen = opened(inMadrid([reminder('09:45', 'scheduled')]), local(MON, '09:00')).state;
    expect(hasNewBadge(seen)).toBe(false);

    const unlocked = doneResponse(seen, idAt('09:45'), local(MON, '09:50')).state;

    expect(unlocked.badges.map((b) => b.id)).toStrictEqual(['done-1']);
    expect(hasNewBadge(unlocked)).toBe(true);

    expect(hasNewBadge(opened(unlocked, local(MON, '10:00')).state)).toBe(false);
  });
});
