'use no memo';
// PROTOTYPE — throwaway (#12). Fires Reminders, mirrors the SQLite tables, and can hammer
// the database from the foreground while background Responses arrive.
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CONTEXT_ID, heartbeat, recordResponse, reset, snapshot } from './db';
import { fireReminder, handleAction, setup } from './notify';

type Snap = Awaited<ReturnType<typeof snapshot>>;

export default function Probe() {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [hammer, setHammer] = useState(false);
  const [started, setStarted] = useState<number | null>(null);
  const add = (s: string) => setLog((l) => [`${new Date().toLocaleTimeString()} ${s}`, ...l].slice(0, 30));
  const refresh = () => snapshot().then(setSnap).catch((e) => add(`snapshot failed: ${e}`));

  useEffect(() => {
    setup().then(() => add(`setup ok, context ${CONTEXT_ID}`)).catch((e) => add(`setup failed: ${e}`));
    refresh();
    // Also handles Snooze/Skip if Android delivers them here while the app is alive: the
    // guarded transition decides which path wins.
    const sub = Notifications.addNotificationResponseReceivedListener(async (res) => {
      const a = res.actionIdentifier;
      const data = res.notification.request.content.data as { reminderId?: number };
      add(`listener: ${a} appState=${AppState.currentState}`);
      if (a === 'start' || a === Notifications.DEFAULT_ACTION_IDENTIFIER) setStarted(data.reminderId ?? null);
      else add(await handleAction(a, data, res.notification.request.identifier, 'fg-listener'));
      refresh();
    });
    const app = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => { sub.remove(); app.remove(); };
  }, []);

  // Foreground write load: one row every 20 ms while on, so background writes have to contend.
  const hammerRef = useRef(false);
  useEffect(() => {
    hammerRef.current = hammer;
    if (!hammer) return;
    let n = 0;
    const loop = async () => {
      while (hammerRef.current) {
        await heartbeat().catch((e) => add(`heartbeat failed: ${e}`));
        if (++n % 50 === 0) refresh();
        await new Promise((r) => setTimeout(r, 20));
      }
    };
    loop();
  }, [hammer]);

  const fire = async (count: number) => {
    for (let i = 0; i < count; i++) add(`fired #${await fireReminder(5)}`);
    refresh();
  };

  return (
    <View style={st.root}>
      <StatusBar style="auto" />
      <Text style={st.h}>Background Responses probe · ctx {CONTEXT_ID}</Text>
      <View style={st.row}>
        <Btn t="Fire 1 in 5 s" on={() => fire(1)} />
        <Btn t="Fire 5 in 5 s" on={() => fire(5)} />
        <Btn t={hammer ? 'Stop hammer' : 'Hammer DB'} on={() => setHammer(!hammer)} />
        <Btn t="Refresh" on={refresh} />
        <Btn t="Reset" on={() => reset().then(refresh)} />
      </View>
      {started != null && (
        <View style={st.card}>
          <Text>Started Reminder #{started}</Text>
          <Btn t="Did it (record Done)" on={async () => { add(`Done #${started} ${(await recordResponse(started, 'Done', 'ui')) ? 'won' : 'lost'}`); setStarted(null); refresh(); }} />
        </View>
      )}
      {snap && (
        <View style={[st.card, (snap.dupes.length || snap.lost.length || snap.errors.length) ? st.bad : st.good]}>
          <Text style={st.b}>
            duplicates {snap.dupes.length} · lost {snap.lost.length} · write errors {snap.errors.length} · heartbeats {snap.heartbeats}
          </Text>
          <Text style={st.b}>
            attempts {snap.attempts.length} (bg-task {snap.attempts.filter((a) => a.source === 'bg-task').length}, fg-listener {snap.attempts.filter((a) => a.source === 'fg-listener').length}, lost races {snap.attempts.filter((a) => !a.won && !a.error).length})
          </Text>
        </View>
      )}
      <ScrollView style={{ flex: 1 }}>
        <Text style={st.mono}>{log.join('\n')}</Text>
        {snap && <Text style={st.mono}>{JSON.stringify({ reminders: snap.reminders, responses: snap.responses, attempts: snap.attempts, taskCalls: snap.taskCalls }, null, 1)}</Text>}
      </ScrollView>
    </View>
  );
}

function Btn({ t, on }: { t: string; on: () => void }) {
  return <Pressable style={st.btn} onPress={on}><Text style={st.btnT}>{t}</Text></Pressable>;
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff', paddingTop: 48, paddingHorizontal: 12, gap: 8 },
  h: { fontWeight: '700', color: '#334155' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  btn: { backgroundColor: '#334155', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
  btnT: { color: '#fff', fontWeight: '600', fontSize: 13 },
  card: { padding: 10, borderRadius: 8, backgroundColor: '#f1f5f9', gap: 6 },
  good: { backgroundColor: '#dcfce7' },
  bad: { backgroundColor: '#fee2e2' },
  b: { fontWeight: '600', color: '#334155' },
  mono: { fontFamily: 'monospace', fontSize: 10 },
});
