import { describe, expect, it } from 'vitest';
import { BADGES } from '../../core';
import { badgeLabel, badgeSections, celebrationLine, groupLabel, recordTiles } from './labels';

describe('Badge labels (the prototype)', () => {
  it('names each Badge within its group', () => {
    expect(badgeLabel('streak-3')).toBe('3 days');
    expect(badgeLabel('streak-100')).toBe('100 days');
    expect(badgeLabel('done-1')).toBe('1');
    expect(badgeLabel('done-500')).toBe('500');
    expect(badgeLabel('variety-10')).toBe('10 Exercises');
    expect(badgeLabel('variety-50')).toBe('50 Exercises');
    expect(badgeLabel('balance')).toBe('Balance');
    expect(badgeLabel('perfect-day')).toBe('Perfect day');
  });

  it('names the groups', () => {
    expect(['Streak', 'Total Done', 'Variety', 'One-day'].map((g) => groupLabel(g as never))).toEqual([
      'Streak',
      'Total Done',
      'Variety',
      'One-day',
    ]);
  });

  it('names a Badge on its own, with its group where the label needs it, for the celebration card', () => {
    expect(celebrationLine('streak-7')).toBe('Streak: 7 days');
    expect(celebrationLine('done-10')).toBe('Total Done: 10');
    expect(celebrationLine('variety-25')).toBe('Variety: 25 Exercises');
    expect(celebrationLine('balance')).toBe('Balance');
    expect(celebrationLine('perfect-day')).toBe('Perfect day');
  });
});

describe('the Records row', () => {
  it('shows the Longest Streak in days, and the most Done in a day and in a week', () => {
    expect(recordTiles({ longestStreak: 12, mostDoneInDay: 7, mostDoneInWeek: 28 })).toEqual([
      { label: 'Longest Streak', value: '12 days' },
      { label: 'Most Done in a day', value: '7' },
      { label: 'Most Done in a week', value: '28' },
    ]);
  });

  it('says 1 day, not 1 days', () => {
    expect(recordTiles({ longestStreak: 1, mostDoneInDay: 0, mostDoneInWeek: 0 })[0].value).toBe('1 day');
  });
});

describe('the Badge sections', () => {
  it('lists every Badge by group in catalogue order, all locked with none unlocked', () => {
    const sections = badgeSections([], null);
    expect(sections.map((s) => s.group)).toEqual(['Streak', 'Total Done', 'Variety', 'One-day']);
    expect(sections.flatMap((s) => s.badges.map((b) => b.id))).toEqual(BADGES.map((b) => b.id));
    expect(sections.flatMap((s) => s.badges).every((b) => !b.unlocked && !b.isNew)).toBe(true);
    expect(sections[3].badges).toEqual([
      { id: 'balance', label: 'Balance', unlocked: false, isNew: false },
      { id: 'perfect-day', label: 'Perfect day', unlocked: false, isNew: false },
    ]);
  });

  it('marks New only the Badges unlocked after the previous visit', () => {
    const sections = badgeSections(
      [
        { id: 'done-1', unlockedAt: 100 },
        { id: 'streak-3', unlockedAt: 200 },
        { id: 'balance', unlockedAt: 300 },
      ],
      200,
    );
    const byId = new Map(sections.flatMap((s) => s.badges).map((b) => [b.id, b]));
    expect(byId.get('done-1')).toEqual({ id: 'done-1', label: '1', unlocked: true, isNew: false });
    // Unlocked at the very instant of the visit: seen (the core's strict after).
    expect(byId.get('streak-3')).toEqual({ id: 'streak-3', label: '3 days', unlocked: true, isNew: false });
    expect(byId.get('balance')).toEqual({ id: 'balance', label: 'Balance', unlocked: true, isNew: true });
    expect(byId.get('done-10')).toEqual({ id: 'done-10', label: '10', unlocked: false, isNew: false });
  });

  it('marks every unlocked Badge New when Achievements was never opened', () => {
    const sections = badgeSections([{ id: 'variety-10', unlockedAt: 100 }], null);
    const unlocked = sections.flatMap((s) => s.badges).filter((b) => b.unlocked);
    expect(unlocked).toEqual([{ id: 'variety-10', label: '10 Exercises', unlocked: true, isNew: true }]);
  });
});
