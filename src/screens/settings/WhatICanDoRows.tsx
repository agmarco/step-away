import { DIFFICULTIES, EQUIPMENT, exerciseGroups, type Equipment, type Settings, type SettingsChange } from '../../core';
import { exercises } from '../../library';
import { Chip, ChipsRow, Divider, Row, SwitchRow } from './parts';

/** The groups that have Exercises: Floor and each Equipment chip show only for these. */
const GROUPS = exerciseGroups(exercises);

const capitalised = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The "What I can do" rows shared by Settings and onboarding's "What do you
 * have nearby?": the Difficulty ceiling (Settings only, with `showDifficulty`),
 * Energetic Exercises, Floor Exercises and the Equipment chips. Each edit is
 * one `SettingsChange` passed to `onChange`.
 */
export function WhatICanDoRows({
  settings: s,
  disabled,
  showDifficulty = false,
  onChange,
}: {
  settings: Settings;
  disabled: boolean;
  showDifficulty?: boolean;
  onChange: (change: SettingsChange) => void;
}) {
  const toggleEquipment = (item: Equipment) => {
    const owned = new Set(s.equipment);
    if (owned.has(item)) owned.delete(item);
    else owned.add(item);
    onChange({ equipment: EQUIPMENT.filter((e) => owned.has(e)) });
  };

  return (
    <>
      {showDifficulty && (
        <>
          <ChipsRow label="Difficulty ceiling" note="Only Exercises at or below it.">
            {DIFFICULTIES.map((d) => (
              <Chip
                key={d}
                label={d}
                selected={s.difficulty === d}
                disabled={disabled}
                onPress={() => s.difficulty !== d && onChange({ difficulty: d })}
              />
            ))}
          </ChipsRow>
          <Divider />
        </>
      )}
      <SwitchRow
        label="Energetic Exercises"
        note="Jumping, skipping and other bursts."
        value={s.energetic}
        disabled={disabled}
        onChange={(energetic) => onChange({ energetic })}
      />
      {GROUPS.floor && (
        <>
          <Divider />
          <SwitchRow
            label="Floor Exercises"
            note="Lying, kneeling or in a plank."
            value={s.floor}
            disabled={disabled}
            onChange={(floor) => onChange({ floor })}
          />
        </>
      )}
      <Divider />
      {GROUPS.equipment.length > 0 ? (
        <ChipsRow label="Equipment" note="What you own. Exercises needing other Equipment aren't suggested.">
          {GROUPS.equipment.map((item) => (
            <Chip
              key={item}
              label={capitalised(item)}
              role="checkbox"
              selected={s.equipment.includes(item)}
              disabled={disabled}
              onPress={() => toggleEquipment(item)}
            />
          ))}
        </ChipsRow>
      ) : (
        <Row label="Equipment" note="No Equipment Exercises yet." />
      )}
    </>
  );
}
