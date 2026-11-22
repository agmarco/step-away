import { useState } from 'react';
import { INTERVALS, type Settings, type SettingsChange } from '../../core';
import { ActiveHoursRows } from './ActiveHoursRows';
import { minutes } from './format';
import { Divider, Row } from './parts';
import { PickerSheet } from './PickerSheet';

/**
 * The Schedule rows shared by Settings and onboarding's "Your day": Active
 * Hours and the Interval (with its picker). Each edit is one `SettingsChange`
 * passed to `onChange`.
 */
export function ScheduleRows({
  settings,
  disabled,
  onChange,
}: {
  settings: Settings;
  disabled: boolean;
  onChange: (change: SettingsChange) => void;
}) {
  const [picking, setPicking] = useState(false);
  return (
    <>
      <ActiveHoursRows hours={settings.activeHours} disabled={disabled} onChange={(activeHours) => onChange({ activeHours })} />
      <Divider />
      <Row
        label="Interval"
        note="Time between Reminders."
        value={minutes(settings.intervalMinutes)}
        onPress={() => setPicking(true)}
        disabled={disabled}
      />
      <PickerSheet
        visible={picking}
        title="Interval"
        sub="Time between Reminders."
        options={INTERVALS}
        value={settings.intervalMinutes}
        label={minutes}
        onPick={(intervalMinutes) => onChange({ intervalMinutes })}
        onClose={() => setPicking(false)}
      />
    </>
  );
}
