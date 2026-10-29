/**
 * TEMPORARY debug screen (#19): lists every bundled Exercise with all its
 * fields, so the curation can be reviewed on a phone. Remove it, and its link
 * on Today, once the real Exercise screens land.
 */
import { Link } from 'expo-router';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Dose, Exercise } from '../../core';
import { exercises, photoSource } from '../../library';
import { type Palette, useColors } from '../../theme';

function doseText({ kind, amount, eachSide }: Dose): string {
  const base = kind === 'reps' ? `${amount} reps` : `${amount} s`;
  return eachSide ? `${base} each side` : base;
}

function Photo({ photoKey, colors }: { photoKey: string; colors: Palette }) {
  const source = photoSource(photoKey);
  if (source === undefined) {
    return (
      <View style={[styles.photoBox, styles.missing, { borderColor: colors.line.divider }]}>
        <Text style={{ color: colors.text.secondary }}>missing</Text>
      </View>
    );
  }
  return (
    <View style={styles.photoBox}>
      <Image source={source} style={styles.photo} resizeMode="cover" accessibilityLabel={photoKey} />
    </View>
  );
}

function ExerciseCard({ exercise, colors }: { exercise: Exercise; colors: Palette }) {
  const facts = [
    exercise.bodyArea,
    exercise.exerciseType,
    exercise.difficulty,
    exercise.position,
    exercise.equipment ?? 'no equipment',
    exercise.energetic ? 'Energetic' : 'not energetic',
  ].join(' · ');

  return (
    <View style={[styles.card, { backgroundColor: colors.background.card, borderColor: colors.line.divider }]}>
      {exercise.photos && (
        <View style={styles.photos}>
          <Photo photoKey={exercise.photos.start} colors={colors} />
          <Photo photoKey={exercise.photos.end} colors={colors} />
        </View>
      )}
      <Text style={[styles.name, { color: colors.text.primary }]}>{exercise.name}</Text>
      <Text style={[styles.small, { color: colors.text.secondary }]}>{exercise.id}</Text>
      <Text style={[styles.body, { color: colors.text.secondary }]}>{facts}</Text>
      <Text style={[styles.dose, { color: colors.accent.hero }]}>{doseText(exercise.dose)}</Text>
      <Text style={[styles.cue, { color: colors.text.primary }]}>{exercise.cue}</Text>
      {exercise.steps.map((step, i) => (
        <Text key={i} style={[styles.body, { color: colors.text.primary }]}>
          {i + 1}. {step}
        </Text>
      ))}
    </View>
  );
}

export default function LibraryDebug() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <FlatList
      style={{ backgroundColor: colors.background.screen }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
      data={exercises}
      keyExtractor={(e) => e.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <Link href="/" style={[styles.small, { color: colors.accent.hero }]}>
            ‹ Today
          </Link>
          <Text style={[styles.title, { color: colors.text.primary }]}>Exercise Library (debug)</Text>
          <Text style={[styles.body, { color: colors.text.secondary }]}>{exercises.length} Exercises bundled</Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={[styles.body, { color: colors.text.secondary }]}>
          No Exercises bundled yet. Add curation entries and run npm run library:build.
        </Text>
      }
      renderItem={({ item }) => <ExerciseCard exercise={item} colors={colors} />}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 16 },
  header: { gap: 4 },
  title: { fontSize: 28, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  photos: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  // The source photos are 850×567. The box sets the size: on web an Image's own
  // aspectRatio loses to the asset's intrinsic height.
  photoBox: { flex: 1, aspectRatio: 850 / 567, borderRadius: 8, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  missing: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 18, fontWeight: '700' },
  small: { fontSize: 12 },
  body: { fontSize: 14, lineHeight: 20 },
  dose: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  cue: { fontSize: 15, fontStyle: 'italic', marginBottom: 4 },
});
