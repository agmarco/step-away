import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { exercises } from '../../library';
import { useCoreState } from '../../platform/useCoreState';
import { LIBRARY_FILTERS, libraryBrowser, type LibraryFilter, type LibraryRow } from '../../screens/settings/libraryBrowser';
import { Chip, Divider, PageHeader, Section } from '../../screens/settings/parts';
import { type Palette, useColors } from '../../theme';

/** What each filter shows when it has nothing. */
const EMPTY: Record<LibraryFilter, string> = {
  All: 'No Exercises fit your settings. Widen What I can do in Settings to see more.',
  Excluded: 'Nothing is Excluded. Exclude an Exercise on its card and it shows here.',
  Customised: "No Dose is changed. Change an Exercise's Dose on its card and it shows here.",
};

/**
 * The Exercise Library browser (#30), pushed from Settings: the Exercises the
 * settings allow (Exclusions ignored), with All / Excluded / Customised
 * filter chips and their counts. Rows by Body Area, then by name
 * (`libraryBrowser`): Name, the effective Dose and the Excluded and
 * Customised marks. A row opens its Exercise card (`library/[exerciseId]`).
 * Read only: every change is made on the card.
 */
export default function LibraryBrowserPage() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state } = useCoreState();
  const [filter, setFilter] = useState<LibraryFilter>('All');

  if (!state) return <View style={[styles.root, { backgroundColor: colors.background.screen }]} />;

  const { counts, sections } = libraryBrowser(state.settings, exercises, filter);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background.screen }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
    >
      <PageHeader title="Exercise Library" backLabel="Back to Settings" />
      <Text style={[styles.intro, { color: colors.text.secondary }]}>
        The Exercises your settings allow. Open one to change its Dose or Exclude it.
      </Text>
      <View style={styles.chips}>
        {LIBRARY_FILTERS.map((f) => (
          <Chip key={f} label={`${f} ${counts[f]}`} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </View>

      {sections.length === 0 ? (
        <Text style={[styles.empty, { color: colors.text.secondary }]}>{EMPTY[filter]}</Text>
      ) : (
        sections.map(({ bodyArea, rows }) => (
          <Section key={bodyArea} title={bodyArea}>
            {rows.map((row, i) => (
              <View key={row.id}>
                {i > 0 && <Divider />}
                <ExerciseRow row={row} colors={colors} />
              </View>
            ))}
          </Section>
        ))
      )}
    </ScrollView>
  );
}

function ExerciseRow({ row, colors }: { row: LibraryRow; colors: Palette }) {
  const marks = [row.excluded && 'Excluded', row.customised && 'Customised'].filter(Boolean).join(', ');
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/library/[exerciseId]', params: { exerciseId: row.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${row.name}, ${row.bodyArea}, ${row.dose}${marks ? `, ${marks}` : ''}`}
      style={styles.row}
    >
      <View style={styles.rowText}>
        <Text style={[styles.name, { color: row.excluded ? colors.text.secondary : colors.text.primary }]}>{row.name}</Text>
        <View style={styles.meta}>
          <Text style={[styles.dose, { color: colors.text.secondary }]}>{row.dose}</Text>
          {row.customised && <Mark label="Customised" color={colors.accent.hero} />}
          {row.excluded && <Mark label="Excluded" color={colors.outcome.skip} />}
        </View>
      </View>
      <Text style={[styles.chevron, { color: colors.text.secondary }]}>›</Text>
    </Pressable>
  );
}

/** A small outlined tag in one colour token. */
function Mark({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.mark, { borderColor: color }]}>
      <Text style={[styles.markText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  intro: { fontSize: 14, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  empty: { fontSize: 15, lineHeight: 22, textAlign: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 56 },
  rowText: { flex: 1, gap: 4 },
  name: { fontSize: 16, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  dose: { fontSize: 14 },
  mark: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  markText: { fontSize: 12, fontWeight: '700' },
  chevron: { fontSize: 22, marginTop: -2 },
});
