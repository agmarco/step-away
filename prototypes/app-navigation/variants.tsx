'use no memo';
// PROTOTYPE — throwaway. Three structurally different answers to "how is the app
// navigated, and how is Today laid out?" (#14). Each variant owns its navigation
// AND its Today layout; they can be mixed ("tabs from A, Today from C").
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Day, tally } from './data';
import { AchievementsScreen, Api, C, EntryRow, HistoryScreen, s as sh, SettingsScreen, useSheets } from './shared';

export type Variant = { key: string; name: string; Root: (p: { api: Api }) => React.JSX.Element };

type Status = { text: string; action?: { label: string; kind: 'pause' | 'resume' | 'undoOff' } };
function status(d: Day): Status {
  if (d.dayOff) return { text: 'Day Off: no Reminders today', action: { label: 'Undo', kind: 'undoOff' } };
  if (d.pausedUntil) return { text: `Paused until ${d.pausedUntil}`, action: { label: 'Resume', kind: 'resume' } };
  if (d.entries.some((e) => e.outcome === 'Outstanding')) return { text: 'A Reminder is waiting', action: { label: 'Pause', kind: 'pause' } };
  return { text: `Next Reminder about ${d.next}`, action: { label: 'Pause', kind: 'pause' } };
}
function runStatus(api: Api, openPause: () => void, kind: 'pause' | 'resume' | 'undoOff') {
  if (kind === 'pause') openPause();
  else if (kind === 'resume') api.resume();
  else api.toggleDayOff();
}

function useBack(onBack: (() => void) | null) {
  useEffect(() => {
    if (!onBack) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => sub.remove();
  }, [onBack]);
}

function TabBar<T extends string>({ tabs, cur, onPick, dots = {} }: { tabs: { key: T; label: string; icon: string }[]; cur: T; onPick: (t: T) => void; dots?: Partial<Record<T, boolean>> }) {
  return (
    <View style={s.tabBar}>
      {tabs.map((t) => (
        <Pressable key={t.key} onPress={() => onPick(t.key)} style={s.tab}>
          <View>
            <Text style={[s.tabIcon, cur === t.key && { opacity: 1 }]}>{t.icon}</Text>
            {dots[t.key] && <View style={s.newDot} />}
          </View>
          <Text style={[s.tabLabel, cur === t.key && { color: C.accent, fontWeight: '700' }]}>{t.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={s.header}>
      {onBack && <Pressable onPress={onBack} hitSlop={12}><Text style={s.back}>‹</Text></Pressable>}
      <Text style={s.headerTitle}>{title}</Text>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

// ───────────────────────────── A — Four bottom tabs, Today as a stack of cards
function TodayA({ api }: { api: Api }) {
  const d = api.day;
  const t = tally(d);
  const st = status(d);
  const { openEdit, openPause, sheets } = useSheets(api);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 140 }}>
      <View style={[s.card, { alignItems: 'center', paddingVertical: 20 }]}>
        <Text style={s.kicker}>Daily Goal</Text>
        <Text style={s.bigNum}>{t.done}<Text style={s.bigOf}> / {d.goal}</Text></Text>
        <View style={s.segRow}>
          {Array.from({ length: d.goal }, (_, i) => <View key={i} style={[s.seg, i < t.done && { backgroundColor: C.done }]} />)}
        </View>
        <Text style={s.streakLine}>🔥 {d.streak}-day Streak{t.done >= d.goal ? '  ·  Goal Day ✓' : ''}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Stat n={t.done} l="Done" c={C.done} /><Stat n={t.skip} l="Skipped" c={C.skip} /><Stat n={t.missed} l="Missed" c={C.missed} /><Stat n={t.exercises} l="Exercises" c={C.ink} />
      </View>
      <View style={[s.card, s.rowCenter, d.dayOff && { backgroundColor: '#e0f2fe' }]}>
        <Text style={{ flex: 1, color: C.ink, fontWeight: '600' }}>{st.text}</Text>
        {st.action && <Pressable onPress={() => runStatus(api, openPause, st.action!.kind)} style={s.pill}><Text style={s.pillText}>{st.action.label}</Text></Pressable>}
      </View>
      <View style={s.card}>
        <Text style={[s.kicker, { padding: 8 }]}>Today</Text>
        {d.entries.length === 0 && <Text style={[sh.sub, { padding: 8 }]}>{d.dayOff ? 'Enjoy the day off.' : 'No Reminders yet today.'}</Text>}
        {d.entries.map((e) => <EntryRow key={e.id} e={e} onPress={() => openEdit(e)} onStart={() => api.start(e.id)} />)}
        {d.pauses.map((p) => <Text key={p.from} style={[sh.sub, { padding: 8 }]}>⏸ Paused {p.from}–{p.to}</Text>)}
      </View>
      {!d.dayOff && <Pressable onPress={api.toggleDayOff}><Text style={s.link}>Take today off</Text></Pressable>}
      {sheets}
    </ScrollView>
  );
}
function Stat({ n, l, c }: { n: number; l: string; c: string }) {
  return <View style={[s.card, { flex: 1, alignItems: 'center', paddingVertical: 10 }]}><Text style={{ fontSize: 20, fontWeight: '800', color: c }}>{n}</Text><Text style={sh.sub}>{l}</Text></View>;
}

type TabA = 'today' | 'history' | 'achievements' | 'settings';
function RootA({ api }: { api: Api }) {
  const [tab, setTab] = useState<TabA>('today');
  useBack(tab !== 'today' ? () => setTab('today') : null);
  const pick = (t: TabA) => { if (t === 'achievements') api.seenBadge(); setTab(t); };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={{ today: 'Today', history: 'History', achievements: 'Achievements', settings: 'Settings' }[tab]} />
      <View style={{ flex: 1 }}>
        {tab === 'today' && <TodayA api={api} />}
        {tab === 'history' && <HistoryScreen />}
        {tab === 'achievements' && <AchievementsScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </View>
      <TabBar<TabA>
        tabs={[{ key: 'today', label: 'Today', icon: '☀️' }, { key: 'history', label: 'History', icon: '📅' }, { key: 'achievements', label: 'Achievements', icon: '🏅' }, { key: 'settings', label: 'Settings', icon: '⚙️' }]}
        cur={tab} onPick={pick} dots={{ achievements: api.day.newBadge }} />
    </View>
  );
}

// ───────────────────────────── B — Today is the hub; everything else is pushed on top
// How Settings is reached from the hub: the original bare gear, a labelled pill in the
// hero, a third link card, or a 3-up tile row under the hero replacing the link cards.
type SettingsEntry = 'gear' | 'pill' | 'card' | 'tiles';
const settingsSummary = '9 am–6 pm · every 45 min · 1 Exercise';

function TodayB({ api, go, entry }: { api: Api; go: (p: PageB) => void; entry: SettingsEntry }) {
  const d = api.day;
  const t = tally(d);
  const st = status(d);
  const { openEdit, openPause, sheets } = useSheets(api);
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
      <View style={s.heroB}>
        <View style={s.rowCenter}>
          <Text style={{ color: '#c7d2fe', flex: 1 }}>Thursday, 29 October</Text>
          {entry === 'gear' && <Pressable onPress={() => go('settings')} hitSlop={12}><Text style={{ fontSize: 20 }}>⚙️</Text></Pressable>}
          {entry === 'pill' && <Pressable onPress={() => go('settings')} hitSlop={8} style={s.heroPill}><Text style={{ color: '#fff', fontWeight: '700' }}>⚙️  Settings</Text></Pressable>}
        </View>
        <Text style={s.heroStreak}>🔥 {d.streak}</Text>
        <Text style={{ color: '#e0e7ff' }}>day Streak</Text>
        <View style={[s.rowCenter, { gap: 10, marginTop: 16 }]}>
          {Array.from({ length: d.goal }, (_, i) => <View key={i} style={[s.goalDot, i < t.done && { backgroundColor: '#fff' }]} />)}
          <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 6 }}>{t.done} of {d.goal} today</Text>
        </View>
        <View style={[s.rowCenter, s.heroStatus]}>
          <Text style={{ flex: 1, color: '#fff' }}>{st.text}</Text>
          {st.action && <Pressable onPress={() => runStatus(api, openPause, st.action!.kind)}><Text style={{ color: '#fff', fontWeight: '800' }}>{st.action.label}</Text></Pressable>}
        </View>
      </View>
      {entry === 'tiles' && (
        <View style={s.tileRow}>
          <Tile icon="📅" label="History" onPress={() => go('history')} />
          <Tile icon="🏅" label="Achievements" dot={d.newBadge} onPress={() => { api.seenBadge(); go('achievements'); }} />
          <Tile icon="⚙️" label="Settings" onPress={() => go('settings')} />
        </View>
      )}
      <View style={{ padding: 16, gap: 12 }}>
        <View>
          <Text style={sh.sub}>{t.done} done · {t.skip} skipped · {t.missed} missed · {t.exercises} Exercises</Text>
          {d.entries.length === 0 && <Text style={[sh.sub, { paddingVertical: 8 }]}>{d.dayOff ? 'Enjoy the day off.' : 'Nothing yet. Your first Reminder comes at ' + d.next + '.'}</Text>}
          {[...d.entries].reverse().map((e) => <EntryRow key={e.id} e={e} onPress={() => openEdit(e)} onStart={() => api.start(e.id)} />)}
          {d.pauses.map((p) => <Text key={p.from} style={[sh.sub, { padding: 8 }]}>⏸ Paused {p.from}–{p.to}</Text>)}
        </View>
        {entry !== 'tiles' && <>
        <Pressable onPress={() => go('history')} style={[s.card, { gap: 8 }]}>
          <View style={s.rowCenter}><Text style={[sh.h2, { flex: 1 }]}>History</Text><Text style={s.chev}>›</Text></View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {['M', 'T', 'W', 'T', 'F'].map((w, i) => (
              <View key={i} style={{ alignItems: 'center', gap: 4, flex: 1 }}>
                <View style={[s.weekCell, { backgroundColor: i === 3 ? '#e2e8f0' : i === 1 ? '#fecaca' : C.done }]} />
                <Text style={sh.sub}>{w}</Text>
              </View>
            ))}
          </View>
        </Pressable>
        <Pressable onPress={() => { api.seenBadge(); go('achievements'); }} style={[s.card, s.rowCenter, { gap: 12 }]}>
          <Text style={{ fontSize: 28 }}>🏅</Text>
          <View style={{ flex: 1 }}>
            <Text style={sh.h2}>Achievements</Text>
            <Text style={sh.sub}>{d.newBadge ? 'New: 7-day Streak Badge!' : '9 Badges · longest Streak 12'}</Text>
          </View>
          {d.newBadge && <View style={[s.newDot, { position: 'relative', top: 0, right: 0 }]} />}
          <Text style={s.chev}>›</Text>
        </Pressable>
        {entry === 'card' && (
          <Pressable onPress={() => go('settings')} style={[s.card, s.rowCenter, { gap: 12 }]}>
            <Text style={{ fontSize: 28 }}>⚙️</Text>
            <View style={{ flex: 1 }}>
              <Text style={sh.h2}>Settings</Text>
              <Text style={sh.sub}>{settingsSummary}</Text>
            </View>
            <Text style={s.chev}>›</Text>
          </Pressable>
        )}
        </>}
        {!d.dayOff && <Pressable onPress={api.toggleDayOff}><Text style={s.link}>Take today off</Text></Pressable>}
      </View>
      {sheets}
    </ScrollView>
  );
}

function Tile({ icon, label, onPress, dot }: { icon: string; label: string; onPress: () => void; dot?: boolean }) {
  return (
    <Pressable onPress={onPress} style={s.tile}>
      <View><Text style={{ fontSize: 24 }}>{icon}</Text>{dot && <View style={s.newDot} />}</View>
      <Text style={{ fontWeight: '700', color: C.ink, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

type PageB = 'history' | 'achievements' | 'settings';
const rootB = (entry: SettingsEntry) => ({ api }: { api: Api }) => <RootB api={api} entry={entry} />;
function RootB({ api, entry }: { api: Api; entry: SettingsEntry }) {
  const [page, setPage] = useState<PageB | null>(null);
  useBack(page ? () => setPage(null) : null);
  if (!page) return <View style={{ flex: 1, backgroundColor: C.bg }}><TodayB api={api} go={setPage} entry={entry} /></View>;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={{ history: 'History', achievements: 'Achievements', settings: 'Settings' }[page]} onBack={() => setPage(null)} />
      {page === 'history' && <HistoryScreen />}
      {page === 'achievements' && <AchievementsScreen />}
      {page === 'settings' && <SettingsScreen />}
    </View>
  );
}

// ───────────────────────────── C — Three tabs + header gear; Today is a timeline of the day
const toMin = (t: string) => {
  const [hm, ap] = t.split(' ');
  const [h, m] = hm.split(':').map(Number);
  return ((h % 12) + (ap === 'pm' ? 12 : 0)) * 60 + m;
};
const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`;

function TodayC({ api }: { api: Api }) {
  const d = api.day;
  const t = tally(d);
  const st = status(d);
  const { openEdit, openPause, sheets } = useSheets(api);
  const from = Math.floor(toMin(d.activeHours.from) / 60);
  const to = Math.floor(toMin(d.activeHours.to) / 60);
  const now = d.entries.length ? toMin(d.entries[d.entries.length - 1].time) + 20 : toMin('9:20 am');
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  return (
    <View style={{ flex: 1 }}>
      <View style={s.goalBarWrap}>
        <View style={s.rowCenter}>
          <Text style={{ fontWeight: '800', color: C.ink, fontSize: 18 }}>{t.done}/{d.goal}</Text>
          <Text style={[sh.sub, { marginLeft: 6, flex: 1 }]}>Daily Goal · {t.skip} skipped · {t.missed} missed</Text>
          <Text style={{ fontWeight: '700', color: C.ink }}>🔥 {d.streak}</Text>
        </View>
        <View style={s.goalBar}><View style={[s.goalFill, { width: `${Math.min(100, (t.done / d.goal) * 100)}%` }]} /></View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 200 }}>
        {d.dayOff ? <Text style={[sh.sub, { padding: 24, textAlign: 'center' }]}>Day Off. No Reminders today, and your Streak is safe.</Text> : hours.map((h) => {
          const inHour = d.entries.filter((e) => Math.floor(toMin(e.time) / 60) === h);
          const paused = d.pauses.find((p) => Math.floor(toMin(p.from) / 60) <= h && h < Math.floor(toMin(p.to) / 60));
          const nextHere = d.next && !d.pausedUntil && Math.floor(toMin(d.next) / 60) === h;
          const nowHere = Math.floor(now / 60) === h;
          const past = (h + 1) * 60 <= now;
          return (
            <View key={h} style={s.hourRow}>
              <Text style={[s.hourLabel, past && { color: '#cbd5e1' }]}>{hourLabel(h)}</Text>
              <View style={[s.hourBody, paused && { backgroundColor: '#f1f5f9' }]}>
                {paused && <Text style={sh.sub}>⏸ Paused {paused.from}–{paused.to}</Text>}
                {inHour.map((e) => <EntryRow key={e.id} e={e} onPress={() => openEdit(e)} onStart={() => api.start(e.id)} />)}
                {nextHere && <View style={s.ghost}><Text style={{ color: C.accent }}>○ ~{d.next}  next Reminder</Text></View>}
                {nowHere && <View style={s.nowLine}><Text style={s.nowText}>now</Text></View>}
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View style={s.footerC}>
        <Text style={{ flex: 1, color: '#fff', fontWeight: '600' }}>{st.text}</Text>
        {st.action && <Pressable onPress={() => runStatus(api, openPause, st.action!.kind)} style={s.footBtn}><Text style={{ color: C.ink, fontWeight: '700' }}>{st.action.label}</Text></Pressable>}
        {!d.dayOff && <Pressable onPress={api.toggleDayOff} style={s.footBtn}><Text style={{ color: C.ink, fontWeight: '700' }}>Day Off</Text></Pressable>}
      </View>
      {sheets}
    </View>
  );
}

type TabC = 'today' | 'history' | 'achievements';
function RootC({ api }: { api: Api }) {
  const [tab, setTab] = useState<TabC>('today');
  const [settings, setSettings] = useState(false);
  useBack(settings ? () => setSettings(false) : tab !== 'today' ? () => setTab('today') : null);
  if (settings) return <View style={{ flex: 1, backgroundColor: C.bg }}><Header title="Settings" onBack={() => setSettings(false)} /><SettingsScreen /></View>;
  const pick = (t: TabC) => { if (t === 'achievements') api.seenBadge(); setTab(t); };
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={{ today: 'Today', history: 'History', achievements: 'Achievements' }[tab]} right={<Pressable onPress={() => setSettings(true)} hitSlop={12}><Text style={{ fontSize: 20 }}>⚙️</Text></Pressable>} />
      <View style={{ flex: 1 }}>
        {tab === 'today' && <TodayC api={api} />}
        {tab === 'history' && <HistoryScreen />}
        {tab === 'achievements' && <AchievementsScreen />}
      </View>
      <TabBar<TabC> tabs={[{ key: 'today', label: 'Today', icon: '☀️' }, { key: 'history', label: 'History', icon: '📅' }, { key: 'achievements', label: 'Achievements', icon: '🏅' }]} cur={tab} onPick={pick} dots={{ achievements: api.day.newBadge }} />
    </View>
  );
}

export const VARIANTS: Variant[] = [
  { key: 'A', name: '4 tabs · card stack', Root: RootA },
  { key: 'B', name: 'hub · gear (original)', Root: rootB('gear') },
  { key: 'B1', name: 'hub · labelled Settings pill', Root: rootB('pill') },
  { key: 'B2', name: 'hub · Settings link card', Root: rootB('card') },
  { key: 'B3', name: 'hub · 3 tiles under hero', Root: rootB('tiles') },
  { key: 'C', name: '3 tabs + gear · day timeline', Root: RootC },
];

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: C.line },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.ink },
  back: { fontSize: 28, color: C.ink, marginTop: -4 },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderColor: C.line, paddingBottom: 18, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: { fontSize: 20, opacity: 0.45 },
  tabLabel: { fontSize: 11, color: C.sub },
  newDot: { position: 'absolute', top: -2, right: -6, width: 9, height: 9, borderRadius: 5, backgroundColor: '#ef4444' },
  card: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12 },
  kicker: { color: C.sub, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  bigNum: { fontSize: 56, fontWeight: '900', color: C.ink },
  bigOf: { fontSize: 28, fontWeight: '700', color: C.sub },
  segRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  seg: { width: 44, height: 10, borderRadius: 5, backgroundColor: C.line },
  streakLine: { marginTop: 12, color: C.ink, fontWeight: '600' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  pill: { backgroundColor: C.ink, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  pillText: { color: '#fff', fontWeight: '700' },
  link: { color: C.accent, textAlign: 'center', fontWeight: '600', padding: 8 },
  chev: { fontSize: 22, color: '#cbd5e1' },
  heroB: { backgroundColor: C.accent, padding: 20, paddingTop: 16 },
  heroStreak: { fontSize: 64, fontWeight: '900', color: '#fff', marginTop: 8 },
  goalDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#fff' },
  heroStatus: { marginTop: 18, backgroundColor: 'rgba(255,255,255,0.15)', padding: 12, borderRadius: 12 },
  heroPill: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  tileRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: -18 },
  tile: { flex: 1, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingVertical: 12, alignItems: 'center', gap: 4, elevation: 3 },
  weekCell: { height: 26, alignSelf: 'stretch', borderRadius: 6 },
  goalBarWrap: { backgroundColor: '#fff', padding: 12, borderBottomWidth: 1, borderColor: C.line, gap: 8 },
  goalBar: { height: 8, borderRadius: 4, backgroundColor: C.line, overflow: 'hidden' },
  goalFill: { height: 8, backgroundColor: C.done },
  hourRow: { flexDirection: 'row', minHeight: 52, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  hourLabel: { width: 48, paddingTop: 8, color: C.sub, fontSize: 12 },
  hourBody: { flex: 1, borderLeftWidth: 2, borderColor: C.line, paddingLeft: 6, justifyContent: 'center' },
  ghost: { borderWidth: 1, borderStyle: 'dashed', borderColor: C.accent, borderRadius: 8, padding: 8, margin: 4 },
  nowLine: { height: 2, backgroundColor: '#ef4444', marginVertical: 4, justifyContent: 'center' },
  nowText: { position: 'absolute', left: -2, top: -16, color: '#ef4444', fontSize: 10, fontWeight: '800' },
  footerC: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: C.ink, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  footBtn: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
});
