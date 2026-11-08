/**
 * The guided Response flow (#23, #41): one full-screen card per Exercise of
 * the Reminder's Suggestion, opened by Start or a tap on the notification (or
 * Start on Today). Each card is answered Did it or Not this one. Opening the
 * screen cancels a pending Snooze re-fire (the core's GuidedStarted, through
 * the handler), so it can't arrive mid-flow.
 *
 * The screen opens on the outstanding Reminder, and also on one of today's
 * that settled as Missed or dropped (e.g. just replaced by a newer Reminder,
 * or past closing): Start on a Today that hasn't redrawn yet never dead-ends.
 *
 * Until the first card is answered, Skip is a break link, and Snooze too
 * while the Reminder is still outstanding and can be snoozed (a Response
 * through the handler). From then on End here takes their place. Skip, the
 * last card's answer and End here all finish through the handler's
 * `finishGuided` (Skip with no Ids, the others with the Ids marked Did it so
 * far), then go back to Today, recorded or not: on the outstanding Reminder
 * that is the Done (none counts as a Skip); if the Reminder isn't outstanding
 * (a newer one fired, or it was answered from the shade), a finish with a Did
 * it is saved as a correction of today's Reminder to Done, and no Did its turns
 * Missed or dropped into a Skip (never overwriting an answer).
 *
 * Back (the ‹ Today link, Android back or the back gesture): before any card
 * is answered it leaves and records nothing, and doesn't bring the re-fire
 * back. Once a card is answered it saves exactly like End here, then goes to
 * Today. A ref tracks the finish, so back during a finish doesn't finish
 * twice, and the finish's own navigation to Today is let through.
 *
 * Thin: whether the Reminder can be opened is the core's `guidedStart`, asked
 * once when the screen opens, on the state `startGuided` returns; the screen
 * keeps that Reminder for the whole session. Whether Snooze shows is the
 * core's `isOutstanding` and `canSnooze` on the latest snapshot; what a
 * finish records is the core's `guidedFinish`. The fallback ("isn't waiting
 * any more") shows when `guidedStart` refused the Reminder at open (already
 * answered, from another day, or unknown), when its Suggestion is empty, or
 * when a Snooze wasn't accepted. Swap (#24) and the celebration card (#28) aren't here yet.
 */
import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { canSnooze, formatDose, guidedStart, isOutstanding, outstandingReminder, type Reminder, type SuggestedExercise } from '../../core';
import { exercises, photoSource } from '../../library';
import { finishGuided, respond, startGuided } from '../../platform/handler';
import { dismissReminder } from '../../platform/notifications';
import { useCoreState } from '../../platform/useCoreState';
import { type Palette, useColors } from '../../theme';

const backToToday = () => router.dismissTo('/');

export default function Guided() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { reminderId } = useLocalSearchParams<{ reminderId: string }>();
  // Only for whether the Snooze link shows: is the Reminder still outstanding, and can it be snoozed.
  const { state, now } = useCoreState();
  // The Reminder as it was when the screen opened, from the state startGuided
  // returns: undefined until then, null if guidedStart refused it (or a Snooze
  // turned out a no-op). Kept for the session even once it stops being outstanding.
  const [reminder, setReminder] = useState<Reminder | null>();
  const [step, setStep] = useState(0);
  const [did, setDid] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  // Where a finish is: a second one while it runs (back during End here) is ignored, and once it is
  // done its own navigation back to Today is let through instead of being turned into another finish.
  // A ref, so the back handler sees it in the same tick; `finished` lifts the prevention on render.
  const leaving = useRef<'no' | 'finishing' | 'finished'>('no');
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    dismissReminder(reminderId);
  }, [reminderId]);

  useEffect(() => {
    let alive = true;
    // Once, on open, after the dismissal above: cancels a pending re-fire, if any.
    startGuided(reminderId)
      .then(({ state, now }) => {
        const opened = guidedStart(state, reminderId, now);
        if (alive) setReminder(opened ?? null);
      })
      .catch((e) => console.warn(`[guided] open failed: ${e}`));
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

  // Once a card is answered, leaving by Android back or the back gesture saves like End here.
  // Before any answer, back leaves without recording.
  const allowLeave = usePreventRemove(step > 0 && !finished, ({ repeat }) => {
    // The finish's own navigation, if the prevention hadn't lifted yet: let it through.
    if (leaving.current === 'finished') repeat();
    else finish(did);
  });

  // Recorded or not, back to Today: a finish that records nothing has nothing new to record.
  function finish(didSoFar: string[]) {
    if (leaving.current !== 'no') return;
    leaving.current = 'finishing';
    setBusy(true);
    finishGuided(reminderId, didSoFar)
      .catch((e) => console.warn(`[guided] finish ${reminderId} failed: ${e}`))
      .finally(() => {
        setBusy(false);
        leaving.current = 'finished';
        setFinished(true);
        allowLeave();
        backToToday();
      });
  }

  // The ‹ Today link: the same as back.
  const leave = () => (step > 0 ? finish(did) : backToToday());

  const answer = (done: boolean) => {
    if (!reminder) return;
    const exercise = reminder.suggestion[step];
    const next = done ? [...did, exercise.id] : did;
    if (step + 1 < reminder.suggestion.length) {
      setDid(next);
      setStep(step + 1);
    } else {
      finish(next);
    }
  };

  const screen = { backgroundColor: colors.background.screen };
  if (reminder === undefined) return <View style={[styles.root, screen]} />;
  if (reminder === null || reminder.suggestion.length === 0) {
    return (
      <View style={[styles.root, styles.ended, screen, { paddingTop: insets.top + 24 }]}>
        <Text style={[styles.endedTitle, { color: colors.text.primary }]}>{"This Reminder isn't waiting any more"}</Text>
        <Text style={[styles.body, { color: colors.text.secondary }]}>
          {"It was already answered, or it isn't one of today's. You can change today's answers on Today."}
        </Text>
        <Pressable onPress={backToToday} accessibilityRole="link">
          <Text style={[styles.link, { color: colors.accent.hero }]}>Back to Today</Text>
        </Pressable>
      </View>
    );
  }

  const total = reminder.suggestion.length;
  const outstanding = state && isOutstanding(state, reminderId, now) ? outstandingReminder(state, now) : undefined;
  const snoozeAllowed = outstanding !== undefined && canSnooze(outstanding, now);

  return (
    <ScrollView
      style={screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.topBar}>
        <Pressable onPress={leave} disabled={busy} accessibilityRole="link" hitSlop={8}>
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
        {step > 0 ? (
          <Pressable onPress={() => finish(did)} disabled={busy} accessibilityRole="button" hitSlop={8}>
            <Text style={[styles.link, { color: colors.text.secondary }]}>End here</Text>
          </Pressable>
        ) : (
          <>
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
              onPress={() => finish([])}
              disabled={busy}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={[styles.link, { color: colors.text.secondary }]}>Skip</Text>
            </Pressable>
          </>
        )}
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
