/**
 * The guided Response flow (#23): one full-screen card per Exercise of the
 * Reminder's Suggestion, opened by Start or a tap on the notification (or
 * Start on Today). Each card is answered Did it or Not this one; after the
 * last, the Done goes through the shared handler with the Ids marked Did it
 * (the core counts none as a Skip). Snooze and Skip are break links across the
 * flow. Leaving early records nothing: the Reminder stays outstanding.
 *
 * Thin: whether the Reminder can still be answered is the core's
 * `outstandingReminder`, asked once when the screen opens; the handler's guard
 * decides the rest. Swap (#24) and the celebration card (#28) aren't here yet.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDose, MAX_SNOOZES, outstandingReminder, type Reminder, type SuggestedExercise } from '../../core';
import { exercises, photoSource } from '../../library';
import { respond } from '../../platform/handler';
import { dismissReminder } from '../../platform/notifications';
import { readState } from '../../platform/store';
import { useCoreState } from '../../platform/useCoreState';
import { type Palette, useColors } from '../../theme';

const backToToday = () => router.dismissTo('/');

export default function Guided() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { reminderId } = useLocalSearchParams<{ reminderId: string }>();
  // Only for `now`, refreshed once a minute: whether the Snooze link shows.
  const { now } = useCoreState();
  // The Reminder as it was when the screen opened, from a fresh read: undefined
  // until read, null if it isn't outstanding (or a Response turned out a no-op).
  const [reminder, setReminder] = useState<Reminder | null>();
  const [step, setStep] = useState(0);
  const [did, setDid] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dismissReminder(reminderId);
  }, [reminderId]);

  useEffect(() => {
    let alive = true;
    readState()
      .then((state) => {
        const outstanding = outstandingReminder(state, Date.now());
        if (alive) setReminder(outstanding?.id === reminderId ? outstanding : null);
      })
      .catch((e) => console.warn(`[guided] read failed: ${e}`));
    return () => {
      alive = false;
    };
  }, [reminderId]);

  const send = (event: Parameters<typeof respond>[0]) => {
    setBusy(true);
    respond(event, 'app')
      .then((accepted) => (accepted ? backToToday() : setReminder(null)))
      .catch((e) => console.warn(`[guided] ${event.kind} ${reminderId} failed: ${e}`))
      .finally(() => setBusy(false));
  };

  const answer = (done: boolean) => {
    if (!reminder) return;
    const exercise = reminder.suggestion[step];
    const next = done ? [...did, exercise.id] : did;
    if (step + 1 < reminder.suggestion.length) {
      setDid(next);
      setStep(step + 1);
    } else {
      send({ type: 'Response', reminderId, kind: 'Done', did: next });
    }
  };

  const screen = { backgroundColor: colors.background.screen };
  if (reminder === undefined) return <View style={[styles.root, screen]} />;
  if (reminder === null || reminder.suggestion.length === 0) {
    return (
      <View style={[styles.root, styles.ended, screen, { paddingTop: insets.top + 24 }]}>
        <Text style={[styles.endedTitle, { color: colors.text.primary }]}>This Reminder has ended</Text>
        <Text style={[styles.body, { color: colors.text.secondary }]}>
          It was answered, or a newer Reminder has replaced it.
        </Text>
        <Pressable onPress={backToToday} accessibilityRole="link">
          <Text style={[styles.link, { color: colors.accent.hero }]}>Back to Today</Text>
        </Pressable>
      </View>
    );
  }

  const total = reminder.suggestion.length;
  // The core's Snooze rule, for showing the link: fewer than 2 Snoozes and no re-fire pending.
  const snoozeAllowed = (reminder.snoozes ?? 0) < MAX_SNOOZES && !(reminder.refiresAt !== undefined && reminder.refiresAt > now);

  return (
    <ScrollView
      style={screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.topBar}>
        <Pressable onPress={backToToday} accessibilityRole="link" hitSlop={8}>
          <Text style={[styles.small, { color: colors.accent.hero }]}>‹ Today</Text>
        </Pressable>
        <Text style={[styles.counter, { color: colors.text.secondary }]}>
          {step + 1} of {total}
        </Text>
      </View>

      <Card key={`${reminder.id}-${step}`} exercise={reminder.suggestion[step]} colors={colors} />

      <View style={styles.answers}>
        <Pressable
          onPress={() => answer(true)}
          disabled={busy}
          accessibilityRole="button"
          style={[styles.button, { backgroundColor: colors.accent.hero, opacity: busy ? 0.5 : 1 }]}
        >
          <Text style={[styles.buttonText, { color: colors.text.onHero }]}>Did it ✓</Text>
        </Pressable>
        <Pressable
          onPress={() => answer(false)}
          disabled={busy}
          accessibilityRole="button"
          style={[styles.button, styles.outline, { borderColor: colors.line.divider, opacity: busy ? 0.5 : 1 }]}
        >
          <Text style={[styles.buttonText, { color: colors.text.primary }]}>Not this one</Text>
        </Pressable>
      </View>

      <View style={styles.breaks}>
        {snoozeAllowed && (
          <Pressable
            onPress={() => send({ type: 'Response', reminderId, kind: 'Snooze' })}
            disabled={busy}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={[styles.link, { color: colors.text.secondary }]}>Snooze</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => send({ type: 'Response', reminderId, kind: 'Skip' })}
          disabled={busy}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={[styles.link, { color: colors.text.secondary }]}>Skip</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/** One Exercise: Body Area, Name, the Dose large, the Cue, its photos, and a timer for a seconds Dose. */
function Card({ exercise, colors }: { exercise: SuggestedExercise; colors: Palette }) {
  // The snapshot has no photos: look the Exercise up by Id; none if it's gone from the library.
  const photos = exercises.find((e) => e.id === exercise.id)?.photos;
  const start = photos ? photoSource(photos.start) : undefined;
  const end = photos ? photoSource(photos.end) : undefined;
  return (
    <View style={[styles.card, { backgroundColor: colors.background.card, borderColor: colors.line.divider }]}>
      {/* A Suggestion stored before #23 whose Exercise left the library has no Body Area. */}
      {exercise.bodyArea && (
        <Text style={[styles.bodyArea, { color: colors.text.secondary }]}>{exercise.bodyArea.toUpperCase()}</Text>
      )}
      <Text style={[styles.name, { color: colors.text.primary }]}>{exercise.name}</Text>
      <Text style={[styles.dose, { color: colors.accent.hero }]}>{formatDose(exercise.dose)}</Text>
      <Text style={[styles.cue, { color: colors.text.primary }]}>{exercise.cue}</Text>
      {(start !== undefined || end !== undefined) && (
        <View style={styles.photos}>
          {start !== undefined && <Photo source={start} label={`${exercise.name}, start`} />}
          {end !== undefined && <Photo source={end} label={`${exercise.name}, end`} />}
        </View>
      )}
      {exercise.dose.kind === 'seconds' && (
        <Timer seconds={exercise.dose.amount} eachSide={exercise.dose.eachSide} colors={colors} />
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

/** A restartable countdown for a seconds Dose; for an each-side Dose the user restarts it for the second side. */
function Timer({ seconds, eachSide, colors }: { seconds: number; eachSide: boolean; colors: Palette }) {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    const tick = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt) clearInterval(tick);
    }, 250);
    return () => clearInterval(tick);
  }, [endsAt]);

  const left = endsAt === null ? seconds : Math.max(0, Math.ceil((endsAt - now) / 1000));
  const finished = endsAt !== null && left === 0;
  const start = () => {
    const t = Date.now();
    setNow(t);
    setEndsAt(t + seconds * 1000);
  };

  return (
    <View style={styles.timer}>
      <Text style={[styles.countdown, { color: finished ? colors.outcome.done : colors.text.primary }]}>
        {finished ? "Time's up" : `${left} s`}
      </Text>
      {finished && eachSide && (
        <Text style={[styles.body, { color: colors.text.secondary }]}>Restart it for the other side.</Text>
      )}
      <Pressable
        onPress={start}
        accessibilityRole="button"
        style={[styles.timerButton, styles.outline, { borderColor: colors.accent.hero }]}
      >
        <Text style={[styles.timerButtonText, { color: colors.accent.hero }]}>
          {endsAt === null ? 'Start timer' : 'Restart timer'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  content: { flexGrow: 1, paddingHorizontal: 20, gap: 16 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  small: { fontSize: 14 },
  counter: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  card: { flexGrow: 1, borderWidth: 1, borderRadius: 16, padding: 20, gap: 8 },
  bodyArea: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  name: { fontSize: 26, fontWeight: '800' },
  dose: { fontSize: 44, fontWeight: '800', fontVariant: ['tabular-nums'] },
  cue: { fontSize: 17, fontStyle: 'italic', lineHeight: 24 },
  photos: { flexDirection: 'row', gap: 8, marginTop: 8 },
  // The source photos are 850×567; the box sets the size (see app/debug/library.tsx).
  photoBox: { flex: 1, aspectRatio: 850 / 567, borderRadius: 8, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  timer: { alignItems: 'center', gap: 8, marginTop: 12 },
  countdown: { fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timerButton: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  timerButtonText: { fontSize: 16, fontWeight: '700' },
  answers: { gap: 10 },
  button: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  outline: { borderWidth: 2 },
  buttonText: { fontSize: 18, fontWeight: '700' },
  breaks: { flexDirection: 'row', justifyContent: 'center', gap: 32 },
  link: { fontSize: 16, fontWeight: '600' },
  ended: { justifyContent: 'center', gap: 12 },
  endedTitle: { fontSize: 24, fontWeight: '800' },
  body: { fontSize: 14, lineHeight: 20 },
});
