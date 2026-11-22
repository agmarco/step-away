import type { PauseLength } from '../../core';
import { ActionSheet } from '../ActionSheet';

const LENGTHS: { length: PauseLength; label: string }[] = [
  { length: 'hour', label: '1 hour' },
  { length: 'twoHours', label: '2 hours' },
  { length: 'restOfToday', label: 'Rest of today' },
];

/**
 * The Pause sheet (an `ActionSheet`): 1 hour, 2 hours or Rest of today.
 * Picking one closes the sheet and calls `onPick`; Cancel, the scrim and
 * Android back close it with nothing changed.
 */
export function PauseSheet({
  visible,
  onPick,
  onClose,
}: {
  visible: boolean;
  onPick: (length: PauseLength) => void;
  onClose: () => void;
}) {
  return (
    <ActionSheet
      visible={visible}
      title="Pause Reminders"
      description="No Reminders until the Pause ends."
      actions={LENGTHS.map(({ length, label }) => ({ key: length, label, onPress: () => onPick(length) }))}
      onClose={onClose}
    />
  );
}
