import { XML } from 'expo/config-plugins';
import { describe, expect, it } from 'vitest';
import { pauseShortcutsXml, withPauseShortcutStrings, withShortcutsMetaData } from './withPauseShortcuts';

const PREVIEW = { scheme: 'activityreminder', package: 'com.agmarco.activityreminder' };
const DEV = { scheme: 'activityreminder-dev', package: 'com.agmarco.activityreminder.dev' };

type Attributes = Record<string, string>;
interface Parsed {
  shortcuts?: { $?: Attributes; shortcut?: { $: Attributes; intent?: { $: Attributes }[] }[] };
}

/** The XML's root attributes and its shortcuts (id, labels, intents' attributes); empty when there are none. */
async function shortcutsOf(xml: string) {
  const parsed = (await XML.parseXMLAsync(xml).catch(() => null)) as Parsed | null;
  return {
    root: parsed?.shortcuts?.$ ?? {},
    shortcuts: (parsed?.shortcuts?.shortcut ?? []).map((s) => ({
      id: s.$['android:shortcutId'],
      short: s.$['android:shortcutShortLabel'],
      long: s.$['android:shortcutLongLabel'],
      intents: (s.intent ?? []).map((i) => i.$),
    })),
  };
}

describe('pauseShortcutsXml', () => {
  it('has the three Pause shortcuts, each a VIEW intent on its pause deep link aimed at the variant', async () => {
    const { root, shortcuts } = await shortcutsOf(pauseShortcutsXml(DEV));
    expect(root['xmlns:android']).toBe('http://schemas.android.com/apk/res/android');
    expect(shortcuts).toEqual([
      {
        id: 'pause_hour',
        short: '@string/pause_hour_short',
        long: '@string/pause_hour_long',
        intents: [
          {
            'android:action': 'android.intent.action.VIEW',
            'android:data': 'activityreminder-dev://pause/hour',
            'android:targetPackage': 'com.agmarco.activityreminder.dev',
            'android:targetClass': 'com.agmarco.activityreminder.dev.MainActivity',
          },
        ],
      },
      {
        id: 'pause_two_hours',
        short: '@string/pause_two_hours_short',
        long: '@string/pause_two_hours_long',
        intents: [
          {
            'android:action': 'android.intent.action.VIEW',
            'android:data': 'activityreminder-dev://pause/twoHours',
            'android:targetPackage': 'com.agmarco.activityreminder.dev',
            'android:targetClass': 'com.agmarco.activityreminder.dev.MainActivity',
          },
        ],
      },
      {
        id: 'pause_rest_of_today',
        short: '@string/pause_rest_of_today_short',
        long: '@string/pause_rest_of_today_long',
        intents: [
          {
            'android:action': 'android.intent.action.VIEW',
            'android:data': 'activityreminder-dev://pause/restOfToday',
            'android:targetPackage': 'com.agmarco.activityreminder.dev',
            'android:targetClass': 'com.agmarco.activityreminder.dev.MainActivity',
          },
        ],
      },
    ]);
  });
});

describe('pauseShortcutsXml, for the preview variant', () => {
  it("aims every intent at the preview app's scheme, package and MainActivity", async () => {
    const { shortcuts } = await shortcutsOf(pauseShortcutsXml(PREVIEW));
    expect(shortcuts.flatMap((s) => s.intents)).toEqual(
      ['hour', 'twoHours', 'restOfToday'].map((length) => ({
        'android:action': 'android.intent.action.VIEW',
        'android:data': `activityreminder://pause/${length}`,
        'android:targetPackage': 'com.agmarco.activityreminder',
        'android:targetClass': 'com.agmarco.activityreminder.MainActivity',
      })),
    );
  });
});

describe('withPauseShortcutStrings', () => {
  it('adds the short and long label of each shortcut, keeping the strings already there', () => {
    const strings = withPauseShortcutStrings({
      resources: { string: [{ $: { name: 'app_name' }, _: 'Activity Reminder' }] },
    });
    expect(strings.resources.string?.map((s) => [s.$.name, s._])).toEqual([
      ['app_name', 'Activity Reminder'],
      ['pause_hour_short', 'Pause 1 h'],
      ['pause_hour_long', 'Pause for 1 hour'],
      ['pause_two_hours_short', 'Pause 2 h'],
      ['pause_two_hours_long', 'Pause for 2 hours'],
      ['pause_rest_of_today_short', 'Pause today'],
      ['pause_rest_of_today_long', 'Pause for the rest of today'],
    ]);
  });
});

describe('withShortcutsMetaData', () => {
  const SHORTCUTS = { $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' } };
  const activity = () => ({
    $: { 'android:name': '.MainActivity' },
    'intent-filter': [{ action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }] }],
  });

  it('points the activity at @xml/shortcuts, keeping its intent filters', () => {
    const result = withShortcutsMetaData(activity());
    expect(result['meta-data']).toEqual([SHORTCUTS]);
    expect(result['intent-filter']).toEqual(activity()['intent-filter']);
  });

  it('adds it once, however many times the plugin runs', () => {
    expect(withShortcutsMetaData(withShortcutsMetaData(activity()))['meta-data']).toEqual([SHORTCUTS]);
  });
});
