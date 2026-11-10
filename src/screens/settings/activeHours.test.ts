import { describe, expect, it } from 'vitest';
import {
  dayRows,
  endTimes,
  formatTime,
  formatWindow,
  mainWindow,
  startTimes, withDay, withDayWindow, withMainWindow, type ActiveHours } from './activeHours';

const nine = { start: 540, end: 1080 };
const eight = { start: 480, end: 1020 };
const late = { start: 600, end: 1320 };
const off = null;

const week = (mon: ActiveHours['mon'], tue = mon, wed = mon, thu = mon, fri = mon, sat: ActiveHours['sat'] = off, sun: ActiveHours['sun'] = off): ActiveHours => ({
  mon, tue, wed, thu, fri, sat, sun,
});

describe('the main window', () => {
  it('is the window shared by every enabled day', () => {
    expect(mainWindow(week(nine))).toEqual(nine);
  });

  it('is the most common window among the enabled days', () => {
    expect(mainWindow(week(late, nine, nine, eight, nine))).toEqual(nine);
  });

  it('goes to the earliest weekday on a tie', () => {
    expect(mainWindow(week(eight, nine, eight, nine, off))).toEqual(eight);
    expect(mainWindow(week(off, nine, eight, eight, nine))).toEqual(nine);
  });

  it('ignores days off', () => {
    expect(mainWindow(week(off, off, off, off, off, late, late))).toEqual(late);
  });

  it('is null with every day off', () => {
    expect(mainWindow(week(off))).toBeNull();
  });
});

describe('the day rows', () => {
  it('shows each enabled day on the main window as Main hours, and the others off', () => {
    expect(dayRows(week(nine))).toEqual([
      { day: 'mon', kind: 'main' },
      { day: 'tue', kind: 'main' },
      { day: 'wed', kind: 'main' },
      { day: 'thu', kind: 'main' },
      { day: 'fri', kind: 'main' },
      { day: 'sat', kind: 'off' },
      { day: 'sun', kind: 'off' },
    ]);
  });

  it('shows a day with another window as its own window', () => {
    expect(dayRows(week(nine, nine, nine, nine, late, eight))).toEqual([
      { day: 'mon', kind: 'main' },
      { day: 'tue', kind: 'main' },
      { day: 'wed', kind: 'main' },
      { day: 'thu', kind: 'main' },
      { day: 'fri', kind: 'own', window: { start: 600, end: 1320 } },
      { day: 'sat', kind: 'own', window: { start: 480, end: 1020 } },
      { day: 'sun', kind: 'off' },
    ]);
  });
});

describe('editing Active Hours', () => {
  it('turns a day on with the main window', () => {
    expect(withDay(week(nine, nine, nine, nine, late), 'sat', true)).toEqual(week(nine, nine, nine, nine, late, nine));
  });

  it('turns the first day on with 09:00–18:00 when every day is off', () => {
    expect(withDay(week(off), 'wed', true)).toEqual(week(off, off, nine, off, off));
  });

  it('turns a day off, whatever its window', () => {
    expect(withDay(week(nine, nine, nine, nine, late), 'fri', false)).toEqual(week(nine, nine, nine, nine, off));
  });

  it('moves the days on the main window to a new one, keeping own windows and days off', () => {
    expect(withMainWindow(week(nine, nine, nine, nine, late, off, eight), { start: 420, end: 960 })).toEqual(
      week({ start: 420, end: 960 }, { start: 420, end: 960 }, { start: 420, end: 960 }, { start: 420, end: 960 }, late, off, eight),
    );
  });

  it('changes nothing when every day is off', () => {
    expect(withMainWindow(week(off), late)).toEqual(week(off));
  });

  it('gives a day its own window', () => {
    expect(withDayWindow(week(nine), 'wed', late)).toEqual(week(nine, nine, late, nine, nine));
  });

  it('puts a day back on the main window', () => {
    expect(withDayWindow(week(nine, nine, late, nine, nine), 'wed', 'main')).toEqual(week(nine));
  });

  it('leaves a day off alone', () => {
    expect(withDayWindow(week(nine), 'sun', late)).toEqual(week(nine));
  });
});

describe('times', () => {
  it('formats minutes after midnight as HH:MM, the end of the day as 24:00', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(555)).toBe('09:15');
    expect(formatTime(1440)).toBe('24:00');
  });

  it('formats a window', () => {
    expect(formatWindow(nine)).toBe('09:00–18:00');
  });

  it('offers starts in 15-minute steps from 00:00 up to before the end', () => {
    expect(startTimes(60)).toEqual([0, 15, 30, 45]);
    expect(startTimes(1440)).toHaveLength(96);
  });

  it('offers ends in 15-minute steps after the start, up to 24:00', () => {
    expect(endTimes(1380)).toEqual([1395, 1410, 1425, 1440]);
    expect(endTimes(0)).toHaveLength(96);
  });
});
