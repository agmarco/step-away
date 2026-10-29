'use no memo';
// PROTOTYPE — throwaway (agmarco/activityReminder#14, branch prototype/app-navigation).
// Three variants of app navigation + the Today screen, switchable from the floating bar.
// All state is in memory; the prototype panel loads canned days to try each layout against.
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Day, Outcome, SCENARIOS } from './data';
import { Api } from './shared';
import { VARIANTS } from './variants';

export default function App() {
  const [variantIdx, setVariantIdx] = useState(2); // start on B1
  const [scenario, setScenario] = useState(1);
  const [day, setDay] = useState<Day>(SCENARIOS[1].day());
  const [panelOpen, setPanelOpen] = useState(false);
  const [showState, setShowState] = useState(false);
  const [lastAction, setLastAction] = useState('');
  const variant = VARIANTS[variantIdx];

  const change = (what: string, f: (d: Day) => Day) => { setDay((d) => f(d)); setLastAction(what); };
  const api: Api = {
    day,
    pause: (label) => change(`Pause ${label}`, (d) => {
      const until = label === '1 hour' ? '2:35 pm' : label === '2 hours' ? '3:35 pm' : 'end of day';
      return { ...d, pausedUntil: until, next: null, pauses: [...d.pauses, { from: '1:35 pm', to: until === 'end of day' ? '6:00 pm' : until }] };
    }),
    resume: () => change('Resume', (d) => ({ ...d, pausedUntil: null, next: '2:20 pm', pauses: d.pauses.map((p, i) => (i === d.pauses.length - 1 ? { ...p, to: '1:50 pm' } : p)) })),
    toggleDayOff: () => change('Toggle Day Off', (d) => ({ ...d, dayOff: !d.dayOff, next: d.dayOff ? '2:20 pm' : null })),
    edit: (id, o: Outcome) => change(`Correct #${id} → ${o}`, (d) => ({
      ...d, entries: d.entries.map((e) => (e.id === id ? { ...e, outcome: o, exercises: o === 'Done' ? (e.exercises.length ? e.exercises : ['Shoulder Circles']) : [] } : e)),
    })),
    // Stand-in for the guided flow (#9): pretend the user did one Exercise.
    start: (id) => change(`Start #${id} (guided flow skipped) → Done`, (d) => ({
      ...d, next: '2:20 pm', entries: d.entries.map((e) => (e.id === id ? { ...e, outcome: 'Done', exercises: ['Upper Back Stretch'] } : e)),
    })),
    seenBadge: () => setDay((d) => ({ ...d, newBadge: false })),
  };

  const load = (i: number) => { setScenario(i); setDay(SCENARIOS[i].day()); setLastAction(`Loaded “${SCENARIOS[i].name}”`); };
  const cycle = (dir: number) => setVariantIdx((variantIdx + dir + VARIANTS.length) % VARIANTS.length);
  const Root = variant.Root;

  return (
    <View style={st.root}>
      <StatusBar style="dark" />
      <View style={st.panel}>
        <Pressable onPress={() => setPanelOpen(!panelOpen)} style={{ flexDirection: 'row' }}>
          <Text style={st.panelTitle}>⚙ Prototype · {SCENARIOS[scenario].name} {panelOpen ? '▾' : '▸'}</Text>
        </Pressable>
        {panelOpen && (
          <View style={{ gap: 6, marginTop: 8 }}>
            <View style={st.wrap}>
              {SCENARIOS.map((sc, i) => (
                <Pressable key={sc.name} onPress={() => load(i)} style={[st.chip, scenario === i && st.chipOn]}>
                  <Text style={[st.chipText, scenario === i && { color: '#fff' }]}>{sc.name}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setShowState(!showState)} style={[st.chip, { alignSelf: 'flex-start' }]}><Text style={st.chipText}>{showState ? 'Hide state' : 'Show state'}</Text></Pressable>
            {lastAction ? <Text style={st.hint}>Last: {lastAction}</Text> : null}
          </View>
        )}
      </View>

      {showState ? (
        <ScrollView style={{ flex: 1, padding: 12 }}>
          <Text style={st.mono}>{JSON.stringify({ variant: variant.key, day }, null, 2)}</Text>
        </ScrollView>
      ) : (
        <Root key={variant.key} api={api} />
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
  root: { flex: 1, backgroundColor: '#fff', paddingTop: 44 },
  panel: { backgroundColor: '#fef9c3', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderColor: '#fde68a' },
  panelTitle: { fontWeight: '700', color: '#713f12', fontSize: 13 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: '#a16207', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipOn: { backgroundColor: '#a16207' },
  chipText: { color: '#713f12', fontSize: 12, fontWeight: '600' },
  hint: { color: '#854d0e', fontSize: 12 },
  mono: { fontFamily: 'monospace', fontSize: 11 },
  switcher: { position: 'absolute', bottom: 140, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#111', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, elevation: 8, opacity: 0.92 },
  swText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  swLabel: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
