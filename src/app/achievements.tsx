import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { records, settle, type Instant } from '../core';
import { openAchievements } from '../platform/handler';
import { readState } from '../platform/store';
import { useCoreState } from '../platform/useCoreState';
import { BadgeTiles } from '../screens/achievements/BadgeTiles';
import { badgeSections, recordTiles } from '../screens/achievements/labels';
import { PageHeader } from '../screens/settings/parts';
import { StatusBarBackdrop } from '../screens/StatusBarBackdrop';
import { useColors } from '../theme';

/**
 * Achievements (#28), pushed from Today's tile, following the prototype's
 * `AchievementsScreen`: the Records on top (`records`), then the Badges by
 * group in catalogue order, unlocked or locked, with a New mark on those
 * unlocked since the previous visit.
 *
 * On open it reads when Achievements was last opened, keeps that for the
 * visit, then records this visit once (`openAchievements`, the core's
 * AchievementsOpened), which clears Today's new-Badge dot. So the New marks
 * stay for the whole visit and are gone on the next one.
 */
export default function Achievements() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { state, now, failed } = useCoreState();
  // The previous visit, read before this one is recorded: undefined until read.
  const [seenBefore, setSeenBefore] = useState<Instant | null>();
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    readState()
      .then((s) => {
        setSeenBefore(s.achievementsSeenAt);
        return openAchievements();
      })
      .catch((e) => {
        console.warn(`[achievements] open failed: ${e}`);
        setSeenBefore((s) => (s === undefined ? null : s));
      });
  }, []);

  const settled = state && seenBefore !== undefined ? settle(state, now) : null;

  return (
    <>
      <ScrollView
        style={{ backgroundColor: colors.background.screen }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
      >
        <PageHeader title="Achievements" />
        {!settled && failed && (
          <Text style={[styles.note, { color: colors.text.secondary }]}>{"Achievements can't be read right now."}</Text>
        )}
        {settled && (
          <>
            <View style={styles.section}>
              <Text style={[styles.heading, { color: colors.text.secondary }]} accessibilityRole="header">
                Records
              </Text>
              <View style={styles.records}>
                {recordTiles(records(settled, now)).map((r) => (
                  <View
                    key={r.label}
                    accessible
                    accessibilityLabel={`${r.label}: ${r.value}`}
                    style={[styles.record, { backgroundColor: colors.background.card, borderColor: colors.line.divider }]}
                  >
                    <Text style={[styles.recordValue, { color: colors.text.primary }]}>{r.value}</Text>
                    <Text style={[styles.recordLabel, { color: colors.text.secondary }]}>{r.label}</Text>
                  </View>
                ))}
              </View>
            </View>
            {badgeSections(settled.badges, seenBefore ?? null).map((section) => (
              <View key={section.group} style={styles.section}>
                <Text style={[styles.heading, { color: colors.text.secondary }]} accessibilityRole="header">
                  {section.label}
                </Text>
                <BadgeTiles section={section} />
              </View>
            ))}
          </>
        )}
      </ScrollView>
      <StatusBarBackdrop />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 20 },
  note: { fontSize: 15, lineHeight: 22 },
  section: { gap: 8 },
  heading: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 4 },
  records: { flexDirection: 'row', gap: 8 },
  record: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12, gap: 2 },
  recordValue: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  recordLabel: { fontSize: 13, lineHeight: 17 },
});
