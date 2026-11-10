import { describe, expect, it } from 'vitest';
import { defaultSettings, initialState, reduce, seededRandom, type CoreEvent, type CoreState } from './index';

// CP1 decision 2 (#29): booleans, a complete Active Hours record, and no unknown keys.
// Monday 2026-11-02 10:20, Europe/Madrid (CET, UTC+1).
const NOW = Date.parse('2026-11-02T10:20:00+01:00');
type Change = Extract<CoreEvent, { type: 'ChangeSettings' }>['change'];
// Casts stand for what an untyped caller (a stale store, a bug) could send.
const loose = (c: Record<string, unknown>) => c as Change;
const change = (state: CoreState, c: Change) =>
  reduce(state, { type: 'ChangeSettings', change: c }, { clock: { now: () => NOW }, random: seededRandom(7) });
const start: CoreState = { ...initialState, settings: { ...defaultSettings, timeZone: 'Europe/Madrid' } };
const { mon: _mon, ...withoutMonday } = defaultSettings.activeHours;

describe('ChangeSettings: strict validation (booleans, a complete Active Hours record, no unknown keys)', () => {
  it.each<[string, Change]>([
    ["Energetic 'yes'", loose({ energetic: 'yes' })],
    ['Energetic 1', loose({ energetic: 1 })],
    ['Floor null', loose({ floor: null })],
    ["Floor 'true'", loose({ floor: 'true' })],
    ['Active Hours with Monday missing', loose({ activeHours: withoutMonday })],
    ['Active Hours with only Monday', loose({ activeHours: { mon: { start: 540, end: 1080 } } })],
    ['Active Hours with an unknown day', loose({ activeHours: { ...defaultSettings.activeHours, holiday: null } })],
    ['Active Hours as an empty array', loose({ activeHours: [] })],
    ['the time zone', loose({ timeZone: 'America/New_York' })],
    ['an unknown key', loose({ volume: 3 })],
    ['a valid change plus an unknown key', loose({ intervalMinutes: 30, volume: 3 })],
  ])('rejects %s: the same state object, no intents', (_label, invalid) => {
    const result = change(start, invalid);

    expect(result.state).toBe(start);
    expect(result.intents).toEqual([]);
  });

  it.each<[string, Change]>([
    ['Energetic and Floor off', { energetic: false, floor: false }],
    ['a complete Active Hours record, every day off', {
      activeHours: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null },
    }],
  ])('accepts %s', (_label, valid) => {
    const result = change(start, valid);

    expect(result.state.settings).toEqual({ ...start.settings, ...valid });
    expect(result.intents.map((i) => i.type)).toEqual(['ScheduleChain']);
  });
});
