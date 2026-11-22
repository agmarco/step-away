import Constants from 'expo-constants';
import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APPEARANCE_SETTINGS, BODY_AREA_MODES, SNOOZE_DELAYS, type BodyAreaMode, type SettingsChange } from '../core';
import { changeSettings, resetSettings, setDailyGoal } from '../platform/handler';
import { useCoreState } from '../platform/useCoreState';
import { openSystemSettings, useNotificationsOn } from '../platform/notificationPermission';
import { appVariant, isDevelopment } from '../platform/variant';
import { dailyGoalRow } from '../screens/settings/dailyGoal';
import { minutes } from '../screens/settings/format';
import { Chip, ChipsRow, Divider, PageHeader, RadioRow, Row, Section } from '../screens/settings/parts';
import { PickerSheet } from '../screens/settings/PickerSheet';
import { ScheduleRows } from '../screens/settings/ScheduleRows';
import { WhatICanDoRows } from '../screens/settings/WhatICanDoRows';
import { useColors } from '../theme';

const GOALS = Array.from({ length: 12 }, (_, i) => i + 1);
const COUNTS = [1, 2, 3];
/** Each Body Area mode's label and note: a mode missing here is a type error. */
const MODE_TEXT: Record<BodyAreaMode, { label: string; note: string }> = {
  Weighted: { label: 'Weighted', note: "Favours the Body Areas you haven't done today." },
  Random: { label: 'Random', note: 'Any Body Area, all equally likely.' },
  Strict: { label: 'Strict rotation', note: 'Goes through the Body Areas in order.' },
};

type Picker = 'snooze' | 'goal' | null;

/**
 * Settings (#29): one scrolling page, every row showing its current value
 * from the stored state, in #15's order: Schedule, Daily Goal, Suggestions,
 * What I can do, Exercise Library (a placeholder until #30) and App. Every
 * change goes through the handler (`changeSettings`, `setDailyGoal`,
 * `resetSettings`); a change the core rejects writes nothing, so the row keeps
 * its value. One change at a time: the controls are disabled while one is in
 * flight.
 */
export default function Settings() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, now } = useCoreState();
  const notificationsOn = useNotificationsOn();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [picker, setPicker] = useState<Picker>(null);

  /** Runs one handler call at a time; a second tap in the same tick is dropped. */
  const run = (label: string, call: () => Promise<boolean>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    call()
      .catch((e: unknown) => console.warn(`[settings] ${label} failed: ${e}`))
      .finally(() => {
        busyRef.current = false;
        setBusy(false);
      });
  };
  const change = (c: SettingsChange) => run(Object.keys(c).join(', '), () => changeSettings(c));

  if (!state) return <View style={[styles.root, { backgroundColor: colors.background.screen }]} />;

  const s = state.settings;
  const goal = dailyGoalRow(state, now);
  const closePicker = () => setPicker(null);

  const confirmReset = () =>
    Alert.alert(
      'Reset settings to defaults?',
      'Every setting goes back to its default, Appearance included, and the Daily Goal from tomorrow. Your Activity Log is kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => run('reset', resetSettings) },
      ],
    );

  const version = Constants.expoConfig?.version ?? 'unknown';

  return (
    <View style={[styles.root, { backgroundColor: colors.background.screen }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
        <PageHeader title="Settings" />

        <Section title="Schedule">
          <ScheduleRows settings={s} disabled={busy} onChange={change} />
          <Divider />
          <Row
            label="Snooze delay"
            note="A snoozed Reminder comes back after this."
            value={minutes(s.snoozeMinutes)}
            onPress={() => setPicker('snooze')}
            disabled={busy}
          />
        </Section>

        <Section title="Daily Goal">
          <Row
            label="Daily Goal"
            note={
              goal.tomorrow !== goal.today
                ? `${goal.tomorrow} from tomorrow. Today's goal stays ${goal.today}.`
                : 'Done Reminders a day. A change applies from tomorrow.'
            }
            value={`${goal.today} a day`}
            onPress={() => setPicker('goal')}
            disabled={busy}
          />
        </Section>

        <Section title="Suggestions">
          <ChipsRow label="Exercises per Suggestion">
            {COUNTS.map((n) => (
              <Chip
                key={n}
                label={String(n)}
                selected={s.exercisesPerSuggestion === n}
                disabled={busy}
                onPress={() => s.exercisesPerSuggestion !== n && change({ exercisesPerSuggestion: n })}
              />
            ))}
          </ChipsRow>
          <Divider />
          <View style={styles.subheading}>
            <Text style={[styles.label, { color: colors.text.primary }]}>Body Area mode</Text>
          </View>
          {BODY_AREA_MODES.map((mode) => (
            <RadioRow
              key={mode}
              label={MODE_TEXT[mode].label}
              note={MODE_TEXT[mode].note}
              selected={s.bodyAreaMode === mode}
              disabled={busy}
              onPress={() => s.bodyAreaMode !== mode && change({ bodyAreaMode: mode })}
            />
          ))}
        </Section>

        <Section title="What I can do">
          <WhatICanDoRows settings={s} disabled={busy} difficulty onChange={change} />
        </Section>

        <Section title="Exercise Library">
          {/* Placeholder until the Exercise Library browser (#30). */}
          <Row label="Browse and exclude Exercises: coming soon" disabled />
        </Section>

        <Section title="App">
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={[styles.label, { color: colors.text.primary }]}>Notifications</Text>
              {notificationsOn === false && (
                <Text style={[styles.note, { color: colors.text.secondary }]}>{"Reminders can't reach you."}</Text>
              )}
            </View>
            <Text style={[styles.value, { color: colors.text.secondary }]}>
              {notificationsOn === null ? '…' : notificationsOn ? 'On' : 'Off'}
            </Text>
            {notificationsOn === false && (
              <Pressable
                onPress={openSystemSettings}
                accessibilityRole="button"
                style={[styles.turnOn, { backgroundColor: colors.accent.hero }]}
              >
                <Text style={[styles.turnOnText, { color: colors.text.onHero }]}>Turn on</Text>
              </Pressable>
            )}
          </View>
          <Divider />
          <ChipsRow label="Appearance">
            {APPEARANCE_SETTINGS.map((a) => (
              <Chip
                key={a}
                label={a}
                selected={s.appearance === a}
                disabled={busy}
                onPress={() => s.appearance !== a && change({ appearance: a })}
              />
            ))}
          </ChipsRow>
          <Divider />
          <Pressable onPress={confirmReset} disabled={busy} accessibilityRole="button" style={styles.row}>
            <Text style={[styles.label, { color: colors.accent.hero }]}>Reset settings to defaults</Text>
          </Pressable>
          <Divider />
          <Row label="Version" value={isDevelopment ? `${version} (${appVariant})` : version} />
        </Section>
      </ScrollView>

      <PickerSheet
        visible={picker === 'snooze'}
        title="Snooze delay"
        sub="Applies to the next Snooze, the current Reminder's included."
        options={SNOOZE_DELAYS}
        value={s.snoozeMinutes}
        label={minutes}
        onPick={(snoozeMinutes) => change({ snoozeMinutes })}
        onClose={closePicker}
      />
      <PickerSheet
        visible={picker === 'goal'}
        title="Daily Goal from tomorrow"
        sub={`Today's goal stays ${goal.today}.`}
        options={GOALS}
        value={goal.tomorrow}
        label={(n) => `${n} a day`}
        onPick={(n) => run('daily goal', () => setDailyGoal(n))}
        onClose={closePicker}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 20 },
  subheading: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, minHeight: 52 },
  rowText: { flex: 1, gap: 2 },
  label: { fontSize: 16 },
  note: { fontSize: 13, lineHeight: 18 },
  value: { fontSize: 15, fontWeight: '600' },
  turnOn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  turnOnText: { fontSize: 14, fontWeight: '700' },
});
