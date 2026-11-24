import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Outcome, Reminder } from '../../core';
import { correct } from '../../platform/handler';
import { type Palette, useColors } from '../../theme';
import { timeOf } from '../format';

const OUTCOMES: Outcome[] = ['Done', 'Skip', 'Missed'];

/** The outcome a settled status shows as; a dropped Reminder has none yet. */
const CURRENT: Partial<Record<Reminder['status'], Outcome>> = { done: 'Done', skipped: 'Skip', missed: 'Missed' };

/**
 * The correction sheet for one of today's answered Reminders: Done, Skip or
 * Missed, and for Done which of the Suggestion's Exercises were done
 * (pre-checked from its current `done` list; Save needs at least one). Save
 * runs the handler's `correct`; a correction the core rejects (e.g. the day
 * has ended meanwhile) just closes with nothing changed. Android back and a
 * tap on the scrim close it too.
 */
export function CorrectionSheet({ reminder, onClose }: { reminder: Reminder | null; onClose: () => void }) {
  const colors = useColors();
  return (
    <Modal visible={reminder !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.scrim, { backgroundColor: colors.background.scrim }]} onPress={onClose} accessibilityLabel="Close" />
      {reminder && <Sheet key={reminder.id} reminder={reminder} onClose={onClose} colors={colors} />}
    </Modal>
  );
}

function Sheet({ reminder, onClose, colors }: { reminder: Reminder; onClose: () => void; colors: Palette }) {
  const insets = useSafeAreaInsets();
  const [to, setTo] = useState<Outcome | undefined>(CURRENT[reminder.status]);
  const [did, setDid] = useState(() => new Set((reminder.done ?? []).map((e) => e.id)));
  const [busy, setBusy] = useState(false);
  const canSave = !busy && to !== undefined && (to !== 'Done' || did.size > 0);

  const toggle = (id: string) =>
    setDid((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = () => {
    if (!canSave || to === undefined) return;
    setBusy(true);
    // In Suggestion order; the core keeps only Ids in the Suggestion anyway.
    const ids = to === 'Done' ? reminder.suggestion.map((e) => e.id).filter((id) => did.has(id)) : undefined;
    correct(reminder.id, to, ids)
      .catch((e: unknown) => console.warn(`[today] correction failed: ${e}`))
      .finally(onClose);
  };

  return (
    <View style={[styles.sheet, { backgroundColor: colors.background.card, paddingBottom: insets.bottom + 20 }]}>
      <ScrollView contentContainerStyle={styles.sheetContent}>
        <Text style={[styles.title, { color: colors.text.primary }]}>Correct the {timeOf(reminder.firesAt)} Reminder</Text>
        <Text style={[styles.sub, { color: colors.text.secondary }]}>Today only. Past days are locked.</Text>

        {OUTCOMES.map((o) => (
          <Pressable
            key={o}
            onPress={() => setTo(o)}
            accessibilityRole="radio"
            accessibilityState={{ checked: to === o }}
            style={[styles.option, to === o && { backgroundColor: colors.background.selected }]}
          >
            <View style={[styles.dot, { backgroundColor: outcomeColor(o, colors) }]} />
            <Text style={[styles.optionText, { color: colors.text.primary }]}>{o}</Text>
            {to === o && <Text style={[styles.optionText, { color: colors.accent.hero }]}>✓</Text>}
          </Pressable>
        ))}

        {to === 'Done' && (
          <View style={styles.checklist}>
            <Text style={[styles.sub, { color: colors.text.secondary }]}>Which Exercises did you do?</Text>
            {reminder.suggestion.map((e) => {
              const checked = did.has(e.id);
              return (
                <Pressable
                  key={e.id}
                  onPress={() => toggle(e.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  style={styles.check}
                >
                  <View
                    style={[
                      styles.box,
                      { borderColor: colors.accent.hero },
                      checked && { backgroundColor: colors.accent.hero },
                    ]}
                  >
                    {checked && <Text style={[styles.tick, { color: colors.text.onHero }]}>✓</Text>}
                  </View>
                  <Text style={[styles.optionText, styles.shrink, { color: colors.text.primary }]}>{e.name}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.actions}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={[styles.button, styles.outline, { borderColor: colors.line.divider }]}
          >
            <Text style={[styles.buttonText, { color: colors.text.primary }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={save}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave }}
            style={[styles.button, { backgroundColor: colors.accent.hero, opacity: canSave ? 1 : 0.5 }]}
          >
            <Text style={[styles.buttonText, { color: colors.text.onHero }]}>Save</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function outcomeColor(o: Outcome, colors: Palette): string {
  return o === 'Done' ? colors.outcome.done : o === 'Skip' ? colors.outcome.skip : colors.outcome.missed;
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  sheet: { maxHeight: '80%', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 20 },
  sheetContent: { paddingHorizontal: 20, gap: 6 },
  title: { fontSize: 18, fontWeight: '700' },
  sub: { fontSize: 14 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  optionText: { fontSize: 16, flexGrow: 1 },
  shrink: { flexShrink: 1 },
  checklist: { gap: 4, marginTop: 8 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tick: { fontSize: 14, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  button: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  outline: { borderWidth: 2 },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
