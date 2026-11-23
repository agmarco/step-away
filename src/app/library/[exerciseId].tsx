import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  allowedBySettings,
  doseOf,
  formatDose,
  isCustomised,
  MAX_DOSE_AMOUNT,
  MIN_DOSE_AMOUNT,
  sameDose,
  type Dose,
  type Exercise,
} from '../../core';
import { exercises, photoSource } from '../../library';
import { changeSettings } from '../../platform/handler';
import { useCoreState } from '../../platform/useCoreState';
import { stepAmount, withDose, withExcluded, withKind, withoutDose } from '../../screens/settings/exerciseCard';
import { Chip, ChipsRow, Divider, PageHeader, Section, SwitchRow } from '../../screens/settings/parts';
import { useOneChange } from '../../screens/useOneChange';
import { StatusBarBackdrop } from '../../screens/StatusBarBackdrop';
import { type Palette, useColors } from '../../theme';

const KINDS: { kind: Dose['kind']; label: string }[] = [
  { kind: 'reps', label: 'Reps' },
  { kind: 'seconds', label: 'Seconds' },
];

/**
 * An Exercise card (#30), opened from the Exercise Library browser: photos,
 * Body Area, Name, the effective Dose (`doseOf`), the Cue, the numbered
 * steps and "Also works" (the `secondaryMuscles`, when there are any).
 *
 * The Dose editor holds a draft (reps or seconds, the amount by a stepper,
 * Each Side) until Save, which sends the whole `doseOverrides` record through
 * `changeSettings`; a draft equal to the library Dose removes the Id instead
 * (`withDose`). Reset to default, shown while the Exercise has an override
 * and no draft is being edited, removes it. Exclude / Bring back sends the
 * whole `excluded` list. When the settings don't allow the Exercise
 * (`allowedBySettings`), a note says it isn't suggested; Exclude / Bring back
 * and the Dose editor still work on it. One change at a time
 * (`useOneChange`); the page shows only what is stored.
 */
export default function ExerciseCard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const { state } = useCoreState();
  const { busy, run } = useOneChange('exercise card');
  // The Dose being edited; null shows the stored effective Dose.
  const [draft, setDraft] = useState<Dose | null>(null);

  const screen = { backgroundColor: colors.background.screen };
  const exercise = exercises.find((e) => e.id === exerciseId);
  if (!state) return <View style={[styles.root, screen]} />;

  const content = [styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }];
  if (!exercise) {
    return (
      <>
        <ScrollView style={[styles.root, screen]} contentContainerStyle={content}>
          <PageHeader title="Exercise" backLabel="Back to the Exercise Library" />
          <Text style={[styles.body, { color: colors.text.secondary }]}>{"This Exercise isn't in the library any more."}</Text>
        </ScrollView>
        <StatusBarBackdrop />
      </>
    );
  }

  const settings = state.settings;
  const effective = doseOf(exercise, settings);
  const shown = draft ?? effective;
  const customised = isCustomised(settings, exercise.id);
  const excluded = settings.excluded.includes(exercise.id);
  const allowed = allowedBySettings(settings, [exercise]).length > 0;
  const changed = !sameDose(shown, effective);
  const edit = (dose: Dose) => setDraft(dose);

  const save = () =>
    run('save Dose', () => changeSettings({ doseOverrides: withDose(settings.doseOverrides, exercise.id, exercise.dose, shown) }), () =>
      setDraft(null),
    );
  const reset = () =>
    run('reset Dose', () => changeSettings({ doseOverrides: withoutDose(settings.doseOverrides, exercise.id) }), () =>
      setDraft(null),
    );
  const toggleExcluded = () =>
    run(excluded ? 'bring back' : 'exclude', () =>
      changeSettings({ excluded: withExcluded(settings.excluded, exercise.id, !excluded) }),
    );

  return (
    <>
      <ScrollView style={[styles.root, screen]} contentContainerStyle={content}>
        <PageHeader title={exercise.name} backLabel="Back to the Exercise Library" />

        {excluded && (
          <View style={[styles.banner, { backgroundColor: colors.background.banner }]}>
            <Text style={[styles.bannerText, { color: colors.text.primary }]}>
              Excluded: this Exercise is never suggested. Bring it back to have it suggested again.
            </Text>
          </View>
        )}

        {!allowed && (
          <Text style={[styles.body, { color: colors.text.secondary }]}>
            {"Your settings don't allow this Exercise (Difficulty, Energetic, Floor or Equipment), so it isn't suggested."}
          </Text>
        )}

        <About exercise={exercise} dose={effective} colors={colors} />

        <Section title="Dose">
          <ChipsRow label="Kind">
            {KINDS.map(({ kind, label }) => (
              <Chip
                key={kind}
                label={label}
                selected={shown.kind === kind}
                disabled={busy}
                onPress={() => shown.kind !== kind && edit(withKind(shown, kind, exercise.dose))}
              />
            ))}
          </ChipsRow>
          <Divider />
          <View style={styles.stepperRow}>
            <Text style={[styles.label, { color: colors.text.primary }]}>{shown.kind === 'reps' ? 'Reps' : 'Seconds'}</Text>
            <View style={styles.stepper}>
              <StepButton
                label="−"
                a11y="Fewer"
                disabled={busy || shown.amount <= MIN_DOSE_AMOUNT}
                onPress={() => edit({ ...shown, amount: stepAmount(shown, -1) })}
                colors={colors}
              />
              <Text style={[styles.amount, { color: colors.text.primary }]}>{shown.amount}</Text>
              <StepButton
                label="+"
                a11y="More"
                disabled={busy || shown.amount >= MAX_DOSE_AMOUNT}
                onPress={() => edit({ ...shown, amount: stepAmount(shown, 1) })}
                colors={colors}
              />
            </View>
          </View>
          <Divider />
          <SwitchRow
            label="Each side"
            note="Done once on each side."
            value={shown.eachSide}
            disabled={busy}
            onChange={(eachSide) => edit({ ...shown, eachSide })}
          />
          <Divider />
          <View style={styles.doseActions}>
            <Text style={[styles.note, { color: colors.text.secondary }]}>
              {customised ? `Default: ${formatDose(exercise.dose)}` : 'The default Dose.'}
            </Text>
            {changed && (
              <View style={styles.buttons}>
                <Button label="Cancel" onPress={() => setDraft(null)} disabled={busy} colors={colors} />
                <Button label={`Save ${formatDose(shown)}`} onPress={save} disabled={busy} filled colors={colors} />
              </View>
            )}
            {customised && !changed && (
              <Button label="Reset to default" onPress={reset} disabled={busy} colors={colors} />
            )}
          </View>
        </Section>

        <Button
          label={excluded ? 'Bring back' : 'Exclude: never suggest'}
          onPress={toggleExcluded}
          disabled={busy}
          filled={excluded}
          colors={colors}
        />
      </ScrollView>
      <StatusBarBackdrop />
    </>
  );
}

/** The Exercise itself: photos, Body Area, the effective Dose, the Cue, the steps and "Also works". */
function About({ exercise, dose, colors }: { exercise: Exercise; dose: Dose; colors: Palette }) {
  const start = exercise.photos ? photoSource(exercise.photos.start) : undefined;
  const end = exercise.photos ? photoSource(exercise.photos.end) : undefined;
  const also = exercise.secondaryMuscles ?? [];
  return (
    <View style={[styles.card, { backgroundColor: colors.background.card, borderColor: colors.line.divider }]}>
      {(start !== undefined || end !== undefined) && (
        <View style={styles.photos}>
          {start !== undefined && <Photo source={start} label={`${exercise.name}, start`} />}
          {end !== undefined && <Photo source={end} label={`${exercise.name}, end`} />}
        </View>
      )}
      <Text style={[styles.bodyArea, { color: colors.text.secondary }]}>{exercise.bodyArea.toUpperCase()}</Text>
      <Text style={[styles.dose, { color: colors.accent.hero }]}>{formatDose(dose)}</Text>
      <Text style={[styles.cue, { color: colors.text.primary }]}>{exercise.cue}</Text>
      {exercise.steps.map((step, i) => (
        <View key={i} style={styles.step}>
          <Text style={[styles.stepNumber, { color: colors.text.secondary }]}>{i + 1}.</Text>
          <Text style={[styles.body, styles.stepText, { color: colors.text.primary }]}>{step}</Text>
        </View>
      ))}
      {also.length > 0 && (
        <Text style={[styles.body, { color: colors.text.secondary }]}>Also works: {also.join(', ')}</Text>
      )}
    </View>
  );
}

function Photo({ source, label }: { source: number; label: string }) {
  return (
    <View style={styles.photoBox}>
      <Image source={source} style={styles.photo} resizeMode="cover" accessibilityLabel={label} />
    </View>
  );
}

function StepButton({
  label,
  a11y,
  disabled,
  onPress,
  colors,
}: {
  label: string;
  a11y: string;
  disabled: boolean;
  onPress: () => void;
  colors: Palette;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      style={[styles.stepButton, { borderColor: colors.accent.hero }, disabled && styles.disabled]}
    >
      <Text style={[styles.stepButtonText, { color: colors.accent.hero }]}>{label}</Text>
    </Pressable>
  );
}

function Button({
  label,
  onPress,
  disabled,
  filled,
  colors,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  filled?: boolean;
  colors: Palette;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[
        styles.button,
        { borderColor: colors.accent.hero },
        filled && { backgroundColor: colors.accent.hero },
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, { color: filled ? colors.text.onHero : colors.accent.hero }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  banner: { borderRadius: 12, padding: 14 },
  bannerText: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  photos: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  // The source photos are 850×567; the box sets the size (see app/guided/[reminderId].tsx).
  photoBox: { flex: 1, aspectRatio: 850 / 567, borderRadius: 8, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  bodyArea: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  dose: { fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  cue: { fontSize: 17, fontStyle: 'italic', lineHeight: 24 },
  step: { flexDirection: 'row', gap: 6 },
  stepNumber: { fontSize: 14, lineHeight: 20, fontWeight: '700', minWidth: 18 },
  stepText: { flex: 1 },
  body: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 16 },
  note: { fontSize: 13, lineHeight: 18 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  stepper: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12 },
  stepButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepButtonText: { fontSize: 22, fontWeight: '700', marginTop: -2 },
  amount: { fontSize: 22, fontWeight: '800', minWidth: 48, textAlign: 'center', fontVariant: ['tabular-nums'] },
  doseActions: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  buttons: { flexDirection: 'row', gap: 10 },
  button: { flexGrow: 1, borderWidth: 2, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
