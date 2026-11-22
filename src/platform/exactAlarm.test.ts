import { describe, expect, it } from 'vitest';
import { exactAlarmGrantNeededFor } from './exactAlarm';

describe('exactAlarmGrantNeededFor (the Android permissions in the app config)', () => {
  it('is false with USE_EXACT_ALARM, granted at install (the config today)', () => {
    expect(exactAlarmGrantNeededFor(['USE_EXACT_ALARM'])).toBe(false);
  });

  it('is true with SCHEDULE_EXACT_ALARM and no USE_EXACT_ALARM', () => {
    expect(exactAlarmGrantNeededFor(['SCHEDULE_EXACT_ALARM'])).toBe(true);
    expect(exactAlarmGrantNeededFor(['android.permission.SCHEDULE_EXACT_ALARM'])).toBe(true);
  });

  it('is false when USE_EXACT_ALARM is there too, in either spelling', () => {
    expect(exactAlarmGrantNeededFor(['SCHEDULE_EXACT_ALARM', 'android.permission.USE_EXACT_ALARM'])).toBe(false);
    expect(exactAlarmGrantNeededFor(['android.permission.SCHEDULE_EXACT_ALARM', 'USE_EXACT_ALARM'])).toBe(false);
  });

  it('is false with neither, or no list at all', () => {
    expect(exactAlarmGrantNeededFor(['VIBRATE'])).toBe(false);
    expect(exactAlarmGrantNeededFor([])).toBe(false);
    expect(exactAlarmGrantNeededFor(undefined)).toBe(false);
  });
});
