import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  historyRange,
  isDayOff,
  localDateOf,
  monthMarks,
  settle,
  type LocalDate,
  type YearMonth,
} from '../core';
import { setDayOff } from '../platform/handler';
import { useCoreState } from '../platform/useCoreState';
import { ActionSheet } from '../screens/ActionSheet';
import { Calendar } from '../screens/history/Calendar';
import { DayPanel } from '../screens/history/DayPanel';
import { longDayOf } from '../screens/history/format';
import { dayKindOf, monthBefore, selectionAfterStep, shiftMonth } from '../screens/history/month';
import { PageHeader } from '../screens/settings/parts';
import { StatusBarBackdrop } from '../screens/StatusBarBackdrop';
import { useOneChange } from '../screens/useOneChange';
import { useColors } from '../theme';

/** The Day Off sheet's wording for `day`, by whether it is today and already a Day Off. */
function confirmOf(day: LocalDate, isToday: boolean, off: boolean) {
  return off
    ? {
        day,
        title: isToday ? "Undo today's Day Off?" : `Undo the Day Off on ${longDayOf(day)}?`,
        label: 'Undo Day Off',
      }
    : {
        day,
        title: isToday ? 'Take today off?' : `Mark ${longDayOf(day)} as a Day Off?`,
        description: isToday
          ? 'No more Reminders today. A Day Off neither breaks nor extends your Streak.'
          : 'No Reminders that day. A Day Off neither breaks nor extends your Streak.',
        label: 'Mark as Day Off',
      };
}

/**
 * History (#27), pushed from Today's History tile and week panel: a month
 * calendar (`Calendar`, by `monthMarks`) that opens on the current month and
 * steps month by month within `historyRange`, and the selected day under it
 * (`DayPanel`), today at first. Stepping to another month selects today in
 * today's month and no day elsewhere (`selectionAfterStep`), where the panel
 * just asks for a tap. A past day is read only. Today and a day
 * ahead have Mark as Day Off / Undo Day Off, confirmed in an `ActionSheet`,
 * then `setDayOff`; the calendar redraws when the write lands (`useCoreState`
 * re-reads after every write). The stored state is settled at `now` first, as
 * on Today.
 */
export default function History() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state: stored, now, failed } = useCoreState();
  const [shown, setShown] = useState<YearMonth | null>(null);
  // `undefined` until the first tap or step (today), `null` for no day.
  const [selected, setSelected] = useState<LocalDate | null | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const { busy, run } = useOneChange('history');
  const state = stored && settle(stored, now);

  if (!state) {
    return (
      <>
        <ScrollView
          style={{ backgroundColor: colors.background.screen }}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
        >
          <PageHeader title="History" />
          {failed && (
            <Text style={[styles.note, { color: colors.text.secondary }]}>{"History can't be read right now."}</Text>
          )}
        </ScrollView>
        <StatusBarBackdrop />
      </>
    );
  }

  const today = localDateOf(now, state.settings.timeZone);
  const { first, last } = historyRange(state, now);
  const month = shown ?? { year: today.year, month: today.month };
  const day = selected === undefined ? today : selected;
  const kind = day && dayKindOf(day, today);
  const off = day !== null && isDayOff(state, day);
  const confirm = day && confirmOf(day, kind === 'today', off);

  return (
    <>
      <ScrollView
        style={{ backgroundColor: colors.background.screen }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
      >
        <PageHeader title="History" />
        <Calendar
          month={month}
          marks={monthMarks(state, month, now)}
          selected={day}
          canGoBack={monthBefore(first, month)}
          canGoForward={monthBefore(month, last)}
          onStep={(by) => {
            const next = shiftMonth(month, by);
            setShown(next);
            setSelected(selectionAfterStep(next, today));
          }}
          onSelect={setSelected}
        />
        {day && kind ? (
          <DayPanel state={state} now={now} date={day} kind={kind} busy={busy} onDayOff={() => setConfirming(true)} />
        ) : (
          <Text style={[styles.note, { color: colors.text.secondary }]}>Tap a day to see it.</Text>
        )}
      </ScrollView>
      <StatusBarBackdrop />
      <ActionSheet
        visible={confirming && confirm !== null}
        title={confirm?.title ?? ''}
        description={confirm?.description}
        actions={
          confirm
            ? [{ key: 'dayOff', label: confirm.label, onPress: () => run(confirm.label, () => setDayOff(confirm.day, !off)) }]
            : []
        }
        onClose={() => setConfirming(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 20 },
  note: { fontSize: 15, lineHeight: 22 },
});
