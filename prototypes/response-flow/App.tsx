'use no memo';
// PROTOTYPE — throwaway (agmarco/activityReminder#9, branch prototype/response-flow).
// Three variants of the Response flow, switchable from the floating bar at the bottom.
// All state is in memory; times are scaled down (Snooze = 10 s instead of 10 min).
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { buildSuggestion, doseText, FALLBACK, swapFor } from './data';
import { Reminder, VARIANTS } from './variants';

const SNOOZE_SECONDS = 10;
const NO_REPEAT = 5;

type LogEntry = { at: string; reminderId: number; what: string; detail?: string };

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

async function setupNotifications() {
  await Notifications.requestPermissionsAsync();
  await Notifications.setNotificationChannelAsync('reminders', { name: 'Reminders', importance: Notifications.AndroidImportance.HIGH });
  for (const v of VARIANTS) {
    const actions = (snooze: boolean) =>
      v.notificationActions
        .filter((a) => snooze || a.id !== 'snooze')
        .map((a) => ({ identifier: a.id, buttonTitle: a.title, options: { opensAppToForeground: !!a.foreground } }));
    await Notifications.setNotificationCategoryAsync(`rem${v.key}`, actions(true));
    await Notifications.setNotificationCategoryAsync(`rem${v.key}_ns`, actions(false));
  }
}

export default function App() {
  const [variantIdx, setVariantIdx] = useState(0);
  const [count, setCount] = useState(1);
  const [nothingEligible, setNothingEligible] = useState(false);
  const [showState, setShowState] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [, bump] = useState(0);
  const store = useRef({ reminder: null as Reminder | null, notifId: null as string | null, recent: [] as string[], log: [] as LogEntry[], nextId: 1 });
  const variant = VARIANTS[variantIdx];
  const variantRef = useRef(variant);
  variantRef.current = variant;

  const log = (what: string, detail?: string) => {
    const r = store.current.reminder;
    store.current.log.unshift({ at: new Date().toLocaleTimeString(), reminderId: r?.id ?? 0, what, detail });
  };

  const notify = async (r: Reminder, seconds: number) => {
    const lines = r.items.map((it) => `${it.ex.name} · ${doseText(it.ex.dose)} — ${it.ex.cue}`);
    if (r.fallback) lines.unshift('No Exercises match your settings — here’s one anyway.');
    const v = variantRef.current;
    store.current.notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: r.snoozes ? `Time to move (snoozed ${r.snoozes}×)` : 'Time to move',
        body: lines.join('\n'),
        categoryIdentifier: r.snoozes >= 2 ? `rem${v.key}_ns` : `rem${v.key}`,
        data: { reminderId: r.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: 'reminders' },
    });
  };

  const clearNotif = async () => {
    if (store.current.notifId) await Notifications.dismissNotificationAsync(store.current.notifId).catch(() => {});
  };

  const fire = async (withNotification: boolean) => {
    const st = store.current;
    if (st.reminder) { log('Missed', 'replaced by a new Reminder'); await clearNotif(); }
    const exs = nothingEligible ? [FALLBACK] : buildSuggestion(count, st.recent);
    st.recent = [...exs.map((e) => e.id), ...st.recent].slice(0, NO_REPEAT * 3);
    st.reminder = { id: st.nextId++, items: exs.map((ex) => ({ ex, done: true })), snoozes: 0, fallback: nothingEligible };
    log('Fired', exs.map((e) => e.name).join(', '));
    if (withNotification) await notify(st.reminder, 5);
    bump((n) => n + 1);
  };

  const finish = async (what: string, detail?: string) => {
    log(what, detail);
    await clearNotif();
    store.current.reminder = null;
    bump((n) => n + 1);
  };

  const onDone = (ids: string[]) => {
    const r = store.current.reminder;
    if (!r) return;
    finish('Done', r.items.filter((x) => ids.includes(x.ex.id)).map((x) => x.ex.name).join(', '));
  };
  const onSkip = () => store.current.reminder && finish('Skip');
  const onSnooze = async () => {
    const r = store.current.reminder;
    if (!r || r.snoozes >= 2) return;
    r.snoozes++;
    log('Snooze', `${r.snoozes}/2, back in ${SNOOZE_SECONDS}s`);
    await clearNotif();
    await notify(r, SNOOZE_SECONDS);
    bump((n) => n + 1);
  };
  const onSwap = (i: number) => {
    const r = store.current.reminder;
    if (!r) return;
    const old = r.items[i].ex;
    const repl = swapFor(old, r.items.map((x) => x.ex.id), store.current.recent);
    if (!repl) return log('Swap', 'nothing else eligible');
    r.items[i] = { ex: repl, done: r.items[i].done };
    store.current.recent = [repl.id, ...store.current.recent];
    log('Swap', `${old.name} → ${repl.name}`);
    bump((n) => n + 1);
  };
  const onToggle = (i: number) => {
    const r = store.current.reminder;
    if (r) { r.items[i].done = !r.items[i].done; bump((n) => n + 1); }
  };

  const handlers = useRef({ onDone, onSkip, onSnooze });
  handlers.current = { onDone, onSkip, onSnooze };

  useEffect(() => {
    setupNotifications();
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      const a = res.actionIdentifier;
      const r = store.current.reminder;
      log('Notification tap', `action=${a} appState=${AppState.currentState}`);
      if (!r || res.notification.request.content.data?.reminderId !== r.id) return bump((n) => n + 1);
      if (a === 'done') handlers.current.onDone(r.items.map((x) => x.ex.id));
      else if (a === 'skip') handlers.current.onSkip();
      else if (a === 'snooze') handlers.current.onSnooze();
      else bump((n) => n + 1); // 'open' or the body tap: the app is now in front, showing the variant screen
    });
    return () => sub.remove();
  }, []);

  // Categories depend on the variant, so re-register when it changes.
  useEffect(() => { setupNotifications(); }, [variantIdx]);

  const r = store.current.reminder;
  const Screen = variant.Screen;
  const cycle = (d: number) => setVariantIdx((variantIdx + d + VARIANTS.length) % VARIANTS.length);

  return (
    <View style={st.root}>
      <StatusBar style="auto" />
      <View style={st.panel}>
        <Pressable onPress={() => setPanelOpen(!panelOpen)}><Text style={st.panelTitle}>⚙ Prototype controls {panelOpen ? '▾' : '▸'}</Text></Pressable>
        {panelOpen && (
          <View style={{ gap: 8, marginTop: 8 }}>
            <View style={st.row}>
              <Text style={st.lbl}>Exercises per Suggestion</Text>
              {[1, 2, 3].map((n) => (
                <Pressable key={n} onPress={() => setCount(n)} style={[st.seg, count === n && st.segOn]}><Text style={count === n ? { color: '#fff' } : undefined}>{n}</Text></Pressable>
              ))}
            </View>
            <View style={st.row}>
              <Text style={st.lbl}>Nothing eligible (fallback)</Text>
              <Switch value={nothingEligible} onValueChange={setNothingEligible} />
            </View>
            <View style={st.row}>
              <Pressable style={st.act} onPress={() => fire(true)}><Text style={st.actText}>Fire Reminder in 5 s</Text></Pressable>
              <Pressable style={st.act} onPress={() => fire(false)}><Text style={st.actText}>Open screen now</Text></Pressable>
              <Pressable style={st.act} onPress={() => setShowState(!showState)}><Text style={st.actText}>{showState ? 'Hide' : 'State'}</Text></Pressable>
            </View>
            <Text style={st.hint}>Tip: fire, then lock the phone or go home to try the notification buttons.</Text>
          </View>
        )}
      </View>

      {showState ? (
        <ScrollView style={{ flex: 1, padding: 12 }}>
          <Text style={st.mono}>{JSON.stringify({ variant: variant.key, reminder: r && { ...r, items: r.items.map((x) => ({ id: x.ex.id, done: x.done })) }, recent: store.current.recent.slice(0, NO_REPEAT), activityLog: store.current.log.slice(0, 15) }, null, 2)}</Text>
        </ScrollView>
      ) : r ? (
        <Screen reminder={r} onDone={onDone} onSkip={onSkip} onSnooze={onSnooze} onSwap={onSwap} onToggle={onToggle} />
      ) : (
        <View style={st.idle}>
          <Text style={st.idleText}>No Reminder outstanding.</Text>
          {store.current.log[0] && <Text style={st.hint}>Last: {store.current.log[0].what} {store.current.log[0].detail ?? ''}</Text>}
        </View>
      )}

      {__DEV__ && (
        <View style={st.switcher}>
          <Pressable onPress={() => cycle(-1)} hitSlop={12}><Text style={st.swText}>‹</Text></Pressable>
          <Text style={st.swLabel}>{variant.key} ({variant.name})</Text>
          <Pressable onPress={() => cycle(1)} hitSlop={12}><Text style={st.swText}>›</Text></Pressable>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff', paddingTop: 48 },
  panel: { backgroundColor: '#f1f5f9', padding: 12, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  panelTitle: { fontWeight: '700', color: '#334155' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  lbl: { flex: 1, color: '#334155' },
  seg: { width: 34, height: 30, borderRadius: 6, borderWidth: 1, borderColor: '#94a3b8', alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: '#334155', borderColor: '#334155' },
  act: { backgroundColor: '#334155', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
  actText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  hint: { color: '#64748b', fontSize: 12 },
  mono: { fontFamily: 'monospace', fontSize: 11 },
  idle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  idleText: { fontSize: 18, color: '#64748b' },
  switcher: { position: 'absolute', bottom: 24, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#111', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, elevation: 8 },
  swText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  swLabel: { color: '#fff', fontWeight: '600' },
});
