import { Fragment, useState } from 'react';
import type { Weekday } from '../../core';
import {
  dayRows,
  formatWindow,
  mainWindow,
  withDay,
  withDayWindow,
  withMainWindow,
  WEEKDAYS,
  type ActiveHours,
} from './activeHours';
import { Chip, ChipsRow, Divider, Row } from './parts';
import { WindowSheet } from './WindowSheet';

const SHORT: Record<Weekday, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const LONG: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

/**
 * Active Hours: day chips Mon–Sun, the main window for the enabled days, and
 * one row per enabled day showing "Main hours" or its own window (an
 * override). The main window is derived from the record (`activeHours.ts`):
 * the most common window among the enabled days. Every edit is a whole new
 * record passed to `onChange`.
 */
export function ActiveHoursRows({
  hours,
  disabled,
  onChange,
}: {
  hours: ActiveHours;
  disabled: boolean;
  onChange: (next: ActiveHours) => void;
}) {
  const [editing, setEditing] = useState<'main' | Weekday | null>(null);
  const main = mainWindow(hours);
  const rows = dayRows(hours);
  const editedRow = editing && editing !== 'main' ? rows.find((r) => r.day === editing) : undefined;
  const close = () => setEditing(null);

  return (
    <>
      <ChipsRow label="Active Hours" note="The days Reminders come on.">
        {WEEKDAYS.map((day) => {
          const on = hours[day] !== null;
          return (
            <Chip
              key={day}
              label={SHORT[day]}
              role="checkbox"
              selected={on}
              disabled={disabled}
              onPress={() => onChange(withDay(hours, day, !on))}
            />
          );
        })}
      </ChipsRow>
      <Divider />
      <Row
        label="Main hours"
        note="For every day without its own hours."
        value={main ? formatWindow(main) : 'No days on'}
        onPress={main ? () => setEditing('main') : undefined}
        disabled={disabled || !main}
      />
      {rows.map((row) =>
        row.kind === 'off' ? null : (
          <Fragment key={row.day}>
            <Divider />
            <Row
              label={LONG[row.day]}
              value={row.kind === 'main' ? 'Main hours' : formatWindow(row.window)}
              onPress={() => setEditing(row.day)}
              disabled={disabled}
            />
          </Fragment>
        ),
      )}

      <WindowSheet
        title={editing === 'main' ? 'Main hours' : editing ? `${LONG[editing]} hours` : ''}
        window={editing === 'main' ? main : editing ? hours[editing] : null}
        onClose={close}
        onSave={(window) => {
          if (editing === 'main') onChange(withMainWindow(hours, window));
          else if (editing) onChange(withDayWindow(hours, editing, window));
        }}
        onUseMain={editedRow?.kind === 'own' ? () => onChange(withDayWindow(hours, editedRow.day, 'main')) : undefined}
      />
    </>
  );
}
