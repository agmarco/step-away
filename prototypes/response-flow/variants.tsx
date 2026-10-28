'use no memo';
// PROTOTYPE — throwaway. Three structurally different answers to
// "how does the user respond to a Reminder?" Each variant owns its whole layout.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { doseText, Exercise } from './data';

export type Item = { ex: Exercise; done: boolean };
export type Reminder = { id: number; items: Item[]; snoozes: number; fallback: boolean };

export type VariantProps = {
  reminder: Reminder;
  onDone: (doneIds: string[]) => void;
  onSkip: () => void;
  onSnooze: () => void;
  onSwap: (index: number) => void;
  onToggle: (index: number) => void;
};

export type Variant = {
  key: string;
  name: string;
  // Buttons on the real notification for this variant.
  notificationActions: { id: 'done' | 'skip' | 'snooze' | 'open'; title: string; foreground?: boolean }[];
  Screen: (p: VariantProps) => React.JSX.Element;
};

function FallbackBanner() {
  return (
    <View style={s.banner}>
      <Text style={s.bannerText}>No Exercises match your settings — here's one anyway.</Text>
      <Text style={s.bannerLink}>Open Settings ›</Text>
    </View>
  );
}

function Btn({ title, onPress, kind = 'plain', disabled }: { title: string; onPress: () => void; kind?: 'primary' | 'plain' | 'ghost'; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[s.btn, kind === 'primary' && s.btnPrimary, kind === 'ghost' && s.btnGhost, disabled && { opacity: 0.35 }]}>
      <Text style={[s.btnText, kind === 'primary' && { color: '#fff' }]}>{title}</Text>
    </Pressable>
  );
}

// A — The notification is the UI. Done means "did all of it". The app screen is a
// glanceable mirror of the notification, only opened if you tap it.
function ScreenA({ reminder, onDone, onSkip, onSnooze, onSwap }: VariantProps) {
  return (
    <View style={s.fill}>
      {reminder.fallback && <FallbackBanner />}
      <Text style={s.kicker}>Time to move</Text>
      {reminder.items.map((it, i) => (
        <View key={it.ex.id} style={s.lineA}>
          <View style={{ flex: 1 }}>
            <Text style={s.nameA}>{it.ex.name} · {doseText(it.ex.dose)}</Text>
            <Text style={s.cue}>{it.ex.cue}</Text>
          </View>
          <Pressable onPress={() => onSwap(i)}><Text style={s.swapIcon}>↻</Text></Pressable>
        </View>
      ))}
      <View style={s.rowA}>
        <Btn title="Done" kind="primary" onPress={() => onDone(reminder.items.map((x) => x.ex.id))} />
        <Btn title="Skip" onPress={onSkip} />
        <Btn title={`Snooze (${2 - reminder.snoozes})`} onPress={onSnooze} disabled={reminder.snoozes >= 2} />
      </View>
    </View>
  );
}

// B — Tap through to a checklist. Untick what you didn't do; Done records exactly
// what's ticked. Swap per row.
function ScreenB({ reminder, onDone, onSkip, onSnooze, onSwap, onToggle }: VariantProps) {
  const done = reminder.items.filter((x) => x.done);
  return (
    <View style={s.fill}>
      {reminder.fallback && <FallbackBanner />}
      <Text style={s.h1}>Your movement break</Text>
      <Text style={s.sub}>Tick what you did</Text>
      {reminder.items.map((it, i) => (
        <Pressable key={it.ex.id} onPress={() => onToggle(i)} style={[s.rowB, it.done && s.rowBOn]}>
          <Text style={s.check}>{it.done ? '☑' : '☐'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.nameB}>{it.ex.name}</Text>
            <Text style={s.meta}>{doseText(it.ex.dose)} · {it.ex.bodyArea} · {it.ex.position}</Text>
            <Text style={s.cue}>{it.ex.cue}</Text>
          </View>
          <Pressable onPress={() => onSwap(i)} style={s.swapB}><Text style={s.swapBText}>Swap</Text></Pressable>
        </Pressable>
      ))}
      <View style={{ flex: 1 }} />
      <View style={s.barB}>
        <Btn title={`Snooze${reminder.snoozes >= 2 ? '' : ' 10 min'}`} kind="ghost" onPress={onSnooze} disabled={reminder.snoozes >= 2} />
        <Btn title="Skip" kind="ghost" onPress={onSkip} />
        <Btn title={`Done (${done.length}/${reminder.items.length})`} kind="primary" disabled={!done.length} onPress={() => onDone(done.map((x) => x.ex.id))} />
      </View>
    </View>
  );
}

// C — Guided, one Exercise at a time, full screen, with a timer for held stretches.
// Finishing the walk-through *is* the Response.
function ScreenC({ reminder, onDone, onSkip, onSnooze, onSwap }: VariantProps) {
  const [idx, setIdx] = useState(0);
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => { setIdx(0); setDoneIds([]); setLeft(null); }, [reminder.id]);
  useEffect(() => {
    if (left === null || left <= 0) return;
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const it = reminder.items[idx];
  const next = (did: boolean) => {
    const ids = did ? [...doneIds, it.ex.id] : doneIds;
    setDoneIds(ids);
    setLeft(null);
    if (idx + 1 < reminder.items.length) setIdx(idx + 1);
    else ids.length ? onDone(ids) : onSkip();
  };
  if (!it) return <View />;
  const d = it.ex.dose;
  return (
    <View style={[s.fill, { backgroundColor: '#0f172a' }]}>
      <View style={s.topC}>
        <Text style={s.stepC}>{idx + 1} of {reminder.items.length}</Text>
        <Pressable onPress={onSnooze} disabled={reminder.snoozes >= 2}><Text style={[s.linkC, reminder.snoozes >= 2 && { opacity: 0.3 }]}>Snooze</Text></Pressable>
        <Pressable onPress={onSkip}><Text style={s.linkC}>Skip break</Text></Pressable>
      </View>
      {reminder.fallback && <FallbackBanner />}
      <View style={s.centerC}>
        <Text style={s.areaC}>{it.ex.bodyArea}</Text>
        <Text style={s.nameC}>{it.ex.name}</Text>
        <Text style={s.doseC}>{left !== null ? `${left}s` : doseText(d)}</Text>
        <Text style={s.cueC}>{it.ex.cue}</Text>
        {d.kind === 'seconds' && left === null && (
          <Pressable onPress={() => setLeft(d.n)} style={s.timerC}><Text style={s.timerCText}>▶ Start {d.n}s timer</Text></Pressable>
        )}
      </View>
      <View style={s.barC}>
        <Pressable onPress={() => onSwap(idx)} style={s.cBtn}><Text style={s.cBtnText}>↻ Swap</Text></Pressable>
        <Pressable onPress={() => next(false)} style={s.cBtn}><Text style={s.cBtnText}>Not this one</Text></Pressable>
        <Pressable onPress={() => next(true)} style={[s.cBtn, { backgroundColor: '#22c55e' }]}><Text style={[s.cBtnText, { color: '#052e16' }]}>Did it ✓</Text></Pressable>
      </View>
    </View>
  );
}

export const VARIANTS: Variant[] = [
  {
    key: 'A', name: 'Notification-first',
    notificationActions: [{ id: 'done', title: 'Done' }, { id: 'skip', title: 'Skip' }, { id: 'snooze', title: 'Snooze' }],
    Screen: ScreenA,
  },
  {
    key: 'B', name: 'Checklist screen',
    notificationActions: [{ id: 'snooze', title: 'Snooze' }, { id: 'skip', title: 'Skip' }, { id: 'open', title: 'Tick off', foreground: true }],
    Screen: ScreenB,
  },
  {
    key: 'C', name: 'Guided one-by-one',
    notificationActions: [{ id: 'open', title: 'Start', foreground: true }, { id: 'snooze', title: 'Snooze' }],
    Screen: ScreenC,
  },
];

const s = StyleSheet.create({
  fill: { flex: 1, padding: 20, gap: 12 },
  banner: { backgroundColor: '#fef3c7', borderRadius: 10, padding: 12 },
  bannerText: { color: '#78350f' },
  bannerLink: { color: '#b45309', fontWeight: '600', marginTop: 4 },
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#e5e7eb', flexGrow: 1, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#2563eb' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#cbd5e1' },
  btnText: { fontWeight: '600', color: '#111827' },
  kicker: { fontSize: 13, textTransform: 'uppercase', color: '#6b7280', letterSpacing: 1 },
  lineA: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#e5e7eb', paddingVertical: 8 },
  nameA: { fontSize: 16, fontWeight: '600' },
  cue: { color: '#4b5563', marginTop: 2 },
  swapIcon: { fontSize: 22, paddingHorizontal: 8, color: '#2563eb' },
  rowA: { flexDirection: 'row', gap: 8, marginTop: 8 },
  h1: { fontSize: 24, fontWeight: '700' },
  sub: { color: '#6b7280', marginTop: -6 },
  rowB: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center' },
  rowBOn: { backgroundColor: '#dbeafe' },
  check: { fontSize: 26 },
  nameB: { fontSize: 17, fontWeight: '600' },
  meta: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  swapB: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#93c5fd' },
  swapBText: { color: '#2563eb', fontWeight: '600' },
  barB: { flexDirection: 'row', gap: 8, marginBottom: 70 },
  topC: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepC: { color: '#94a3b8' },
  linkC: { color: '#cbd5e1', fontWeight: '600' },
  centerC: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  areaC: { color: '#38bdf8', textTransform: 'uppercase', letterSpacing: 1 },
  nameC: { color: '#fff', fontSize: 32, fontWeight: '800', textAlign: 'center' },
  doseC: { color: '#fde047', fontSize: 44, fontWeight: '800' },
  cueC: { color: '#e2e8f0', fontSize: 18, textAlign: 'center' },
  timerC: { marginTop: 10, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: '#fde047' },
  timerCText: { color: '#fde047', fontWeight: '700' },
  barC: { flexDirection: 'row', gap: 8, marginBottom: 70 },
  cBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: '#1e293b', alignItems: 'center' },
  cBtnText: { color: '#f1f5f9', fontWeight: '700' },
});
