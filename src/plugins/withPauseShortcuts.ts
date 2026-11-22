/**
 * The Pause launcher shortcuts (#45): long-press the app icon for Pause 1 h,
 * Pause 2 h and Pause today. Static Android shortcuts, each a VIEW intent on
 * the `<scheme>://pause/<length>` deep link (app/pause/[length].tsx), aimed at
 * the variant's package and its MainActivity. The plugin writes
 * res/xml/shortcuts.xml, adds the labels to res/values/strings.xml and points
 * the launcher MainActivity at the file with an `android.app.shortcuts`
 * meta-data. The XML-building parts are the pure functions below.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  AndroidConfig,
  type ConfigPlugin,
  withAndroidManifest,
  withDangerousMod,
  withStringsXml,
} from 'expo/config-plugins';
import type { PauseLength } from '../core';

// The library's activity type has no meta-data, though an activity can carry it.
type ManifestActivity = AndroidConfig.Manifest.ManifestActivity & {
  'meta-data'?: AndroidConfig.Manifest.ManifestMetaData[];
};
type ResourceXML = AndroidConfig.Resources.ResourceXML;

/** Which app the shortcuts open: the variant's deep-link scheme and Android package. */
export interface ShortcutTarget {
  scheme: string;
  package: string;
}

/** One shortcut per PauseLength, in launcher order. */
export const PAUSE_SHORTCUTS: readonly { id: string; length: PauseLength; short: string; long: string }[] = [
  { id: 'pause_hour', length: 'hour', short: 'Pause 1 h', long: 'Pause for 1 hour' },
  { id: 'pause_two_hours', length: 'twoHours', short: 'Pause 2 h', long: 'Pause for 2 hours' },
  { id: 'pause_rest_of_today', length: 'restOfToday', short: 'Pause today', long: 'Pause for the rest of today' },
];

/** The `res/xml/shortcuts.xml` for a variant. */
export function pauseShortcutsXml(target: ShortcutTarget): string {
  const shortcuts = PAUSE_SHORTCUTS.map(
    ({ id, length }) => `  <shortcut
    android:shortcutId="${id}"
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutShortLabel="@string/${id}_short"
    android:shortcutLongLabel="@string/${id}_long">
    <intent
      android:action="android.intent.action.VIEW"
      android:data="${target.scheme}://pause/${length}"
      android:targetPackage="${target.package}"
      android:targetClass="${target.package}.MainActivity" />
  </shortcut>
`,
  ).join('');
  return `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
${shortcuts}</shortcuts>
`;
}

/** The strings.xml contents with the shortcut labels added (replacing any of the same name). */
export function addPauseShortcutStrings(strings: ResourceXML): ResourceXML {
  const labels = PAUSE_SHORTCUTS.flatMap(({ id, short, long }) => [
    AndroidConfig.Resources.buildResourceItem({ name: `${id}_short`, value: short }),
    AndroidConfig.Resources.buildResourceItem({ name: `${id}_long`, value: long }),
  ]);
  return AndroidConfig.Strings.setStringItem(labels, strings);
}

/** The activity with the `android.app.shortcuts` meta-data pointing at @xml/shortcuts, added once. */
export function addShortcutsMetaData(activity: ManifestActivity): ManifestActivity {
  const others = (activity['meta-data'] ?? []).filter((m) => m.$['android:name'] !== SHORTCUTS_META_DATA);
  return {
    ...activity,
    'meta-data': [...others, { $: { 'android:name': SHORTCUTS_META_DATA, 'android:resource': '@xml/shortcuts' } }],
  };
}

const SHORTCUTS_META_DATA = 'android.app.shortcuts';

const withPauseShortcuts: ConfigPlugin<ShortcutTarget> = (config, target) => {
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const xmlDir = path.join(await AndroidConfig.Paths.getResourceFolderAsync(config.modRequest.projectRoot), 'xml');
      await fs.promises.mkdir(xmlDir, { recursive: true });
      await fs.promises.writeFile(path.join(xmlDir, 'shortcuts.xml'), pauseShortcutsXml(target));
      return config;
    },
  ]);
  config = withStringsXml(config, (config) => {
    config.modResults = addPauseShortcutStrings(config.modResults);
    return config;
  });
  config = withAndroidManifest(config, (config) => {
    const main: ManifestActivity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
    main['meta-data'] = addShortcutsMetaData(main)['meta-data'];
    return config;
  });
  return config;
};

export default withPauseShortcuts;
