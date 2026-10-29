'use no memo';
// PROTOTYPE — throwaway. Screens whose *content* is already settled (#13): History,
// Achievements, a Settings stub, plus the small sheets every variant reuses.
// The variants differ in how they reach these and in how Today is laid out.
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BADGES, Day, Entry, markFor, MONTH, Outcome, PAST_DAY, RECORDS } from './data';

export type Api = {
  day: Day;
  pause: (label: string) => void;
  resume: () => void;
  toggleDayOff: () => void;
  edit: (id: number, outcome: Outcome) => void;
  start: (id: number) => void;
  seenBadge: () => void;
};

export const C = {
  ink: '#0f172a', sub: '#64748b', line: '#e2e8f0', bg: '#f8fafc', card: '#fff',
  done: '#16a34a', skip: '#d97706', missed: '#94a3b8', accent: '#4f46e5', off: '#0ea5e9',
};

export const outcomeColor = (o: Outcome) => (o === 'Done' ? C.done : o === 'Skip' ? C.skip : o === 'Missed' ? C.missed : C.accent);

export function EntryRow({ e, onPress, onStart, editable = true }: { e: Entry; onPress?: () => void; onStart?: () => void; editable?: boolean }) {
  return (
    <Pressable onPress={editable ? onPress : undefined} style={s.entry}>
      <Text style={s.entryTime}>{e.time}</Text>
      <View style={[s.dot, { backgroundColor: outcomeColor(e.outcome) }]} />
      <View style={{ flex: 1 }}>
        <Text style={s.entryOutcome}>
          {e.outcome === 'Outstanding' ? 'Waiting for you' : e.outcome}
          {e.snoozes ? <Text style={s.tag}>{`  snoozed ×${e.snoozes}`}</Text> : null}
        </Text>
        {e.exercises.length > 0 && <Text style={s.entryEx}>{e.exercises.join(' · ')}</Text>}
      </View>
      {e.outcome === 'Outstanding' && onStart ? (
        <Pressable onPress={onStart} style={s.startBtn}><Text style={s.startText}>Start</Text></Pressable>
      ) : editable ? <Text style={s.chev}>✎</Text> : null}
    </Pressable>
  );
}

export function EditSheet({ entry, onPick, onClose }: { entry: Entry | null; onPick: (o: Outcome) => void; onClose: () => void }) {
  return (
    <Modal visible={!!entry} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} />
      <View style={s.sheet}>
        <Text style={s.sheetTitle}>Correct {entry?.time} Reminder</Text>
        <Text style={s.sub}>Today only. Past days are locked.</Text>
        {(['Done', 'Skip', 'Missed'] as Outcome[]).map((o) => (
          <Pressable key={o} onPress={() => { onPick(o); onClose(); }} style={[s.sheetRow, entry?.outcome === o && { backgroundColor: '#eef2ff' }]}>
            <View style={[s.dot, { backgroundColor: outcomeColor(o) }]} />
            <Text style={s.sheetRowText}>{o}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

export function PauseSheet({ open, onPick, onClose }: { open: boolean; onPick: (label: string) => void; onClose: () => void }) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} />
      <View style={s.sheet}>
        <Text style={s.sheetTitle}>Pause Reminders</Text>
        {['1 hour', '2 hours', 'Rest of today'].map((l) => (
          <Pressable key={l} onPress={() => { onPick(l); onClose(); }} style={s.sheetRow}><Text style={s.sheetRowText}>{l}</Text></Pressable>
        ))}
        <Text style={[s.sub, { marginTop: 8 }]}>A Pause doesn't protect your Streak. Use Day Off for that.</Text>
      </View>
    </Modal>
  );
}

// Holds the edit/pause sheet state so each variant only has to call open*().
export function useSheets(api: Api) {
  const [editing, setEditing] = useState<Entry | null>(null);
  const [pausing, setPausing] = useState(false);
  const sheets = (
    <>
      <EditSheet entry={editing} onPick={(o) => editing && api.edit(editing.id, o)} onClose={() => setEditing(null)} />
      <PauseSheet open={pausing} onPick={api.pause} onClose={() => setPausing(false)} />
    </>
  );
  return { openEdit: setEditing, openPause: () => setPausing(true), sheets };
}

const markColor: Record<string, string> = { goal: C.done, off: C.off, missed: '#fecaca', none: 'transparent', today: 'transparent', future: 'transparent' };

export function HistoryScreen() {
  const [sel, setSel] = useState(28);
  const cells: (number | null)[] = [...Array(MONTH.firstWeekday).fill(null), ...Array.from({ length: MONTH.days }, (_, i) => i + 1)];
  const m = markFor(sel);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
      <Text style={s.h2}>{MONTH.label}</Text>
      <View style={s.weekRow}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <Text key={i} style={s.wd}>{d}</Text>)}</View>
      <View style={s.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={s.cell} />;
          const mk = markFor(d);
          return (
            <Pressable key={i} style={s.cell} onPress={() => mk !== 'future' && setSel(d)}>
              <View style={[s.cellIn, { backgroundColor: markColor[mk] }, mk === 'today' && { borderWidth: 2, borderColor: C.accent }, sel === d && { borderWidth: 2, borderColor: C.ink }]}>
                <Text style={{ color: mk === 'goal' || mk === 'off' ? '#fff' : mk === 'future' ? '#cbd5e1' : C.ink, fontWeight: '600' }}>{d}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={s.legend}>
        <Legend c={C.done} t="Goal Day" /><Legend c={C.off} t="Day Off" /><Legend c="#fecaca" t="Missed goal" />
      </View>
      <Text style={[s.h2, { marginTop: 16 }]}>Oct {sel}</Text>
      {m === 'today' ? <Text style={s.sub}>Today lives on the Today screen.</Text>
        : m === 'off' ? <Text style={s.sub}>Day Off</Text>
        : m === 'none' ? <Text style={s.sub}>No Active Hours</Text>
        : (
          <View style={s.cardFlat}>
            {PAST_DAY.slice(0, m === 'missed' ? 3 : 5).map((e) => <EntryRow key={e.id} e={e} editable={false} />)}
            {sel % 3 === 0 && <Text style={[s.sub, { padding: 8 }]}>⏸ Paused 2:00–3:00 pm</Text>}
          </View>
        )}
    </ScrollView>
  );
}

function Legend({ c, t }: { c: string; t: string }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={[s.dot, { backgroundColor: c }]} /><Text style={s.sub}>{t}</Text></View>;
}

export function AchievementsScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 16 }}>
      <View>
        <Text style={s.h2}>Records</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          {RECORDS.map((r) => (
            <View key={r.label} style={[s.cardFlat, { flex: 1, padding: 10 }]}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: C.ink }}>{r.value}</Text>
              <Text style={s.sub}>{r.label}</Text>
            </View>
          ))}
        </View>
      </View>
      {BADGES.map((g) => (
        <View key={g.group}>
          <Text style={s.h2}>{g.group}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {g.items.map((b) => (
              <View key={b.label} style={[s.badge, !b.got && { opacity: 0.35 }]}>
                <Text style={{ fontSize: 22 }}>{b.got ? '🏅' : '🔒'}</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: C.ink, textAlign: 'center' }}>{b.label}</Text>
                {b.isNew && <Text style={s.newTag}>NEW</Text>}
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

export function SettingsScreen() {
  const groups = ['Schedule: Active Hours, Interval, Snooze', 'Suggestions: Exercises per Suggestion, Body Area mode', 'Exercises: Energetic, Floor, Equipment, Difficulty', 'Excluded Exercises', 'Daily Goal', 'Permissions'];
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 8 }}>
      <Text style={s.sub}>Stub: what Settings holds is still fog on the map. Only where it lives matters here.</Text>
      {groups.map((g) => <View key={g} style={s.cardFlat}><Text style={{ padding: 12, color: C.ink }}>{g}  ›</Text></View>)}
    </ScrollView>
  );
}

export const s = StyleSheet.create({
  h2: { fontSize: 16, fontWeight: '700', color: C.ink },
  sub: { color: C.sub, fontSize: 13 },
  tag: { color: C.sub, fontSize: 12, fontWeight: '400' },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 8 },
  entryTime: { width: 64, color: C.sub, fontSize: 13 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  entryOutcome: { fontWeight: '600', color: C.ink },
  entryEx: { color: C.sub, fontSize: 13 },
  chev: { color: '#cbd5e1', fontSize: 16 },
  startBtn: { backgroundColor: C.accent, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  startText: { color: '#fff', fontWeight: '700' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: '#fff', padding: 20, paddingBottom: 40, borderTopLeftRadius: 16, borderTopRightRadius: 16, gap: 6 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: C.ink },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 10 },
  sheetRowText: { fontSize: 16, color: C.ink },
  weekRow: { flexDirection: 'row', marginTop: 8 },
  wd: { flex: 1, textAlign: 'center', color: C.sub, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  cellIn: { flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', gap: 14, marginTop: 8 },
  cardFlat: { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.line, marginTop: 8 },
  badge: { width: 76, height: 76, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', padding: 4 },
  newTag: { position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', color: '#fff', fontSize: 9, fontWeight: '800', paddingHorizontal: 4, borderRadius: 4, overflow: 'hidden' },
});
