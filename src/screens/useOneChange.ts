import { useRef, useState } from 'react';

/**
 * One change at a time, on Settings, the Exercise card, Today and onboarding:
 * `run(label, call)` starts a call unless one is in flight, and `busy` is true
 * while it runs, so the page can disable its controls. A ref drops a second tap in the same tick. A failure
 * is logged under `[tag]`; `onDone` runs after the call either way.
 */
export function useOneChange(tag: string) {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const run = (label: string, call: () => Promise<unknown>, onDone?: () => void) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    call()
      .catch((e: unknown) => console.warn(`[${tag}] ${label} failed: ${e}`))
      .finally(() => {
        busyRef.current = false;
        setBusy(false);
        onDone?.();
      });
  };
  return { busy, run };
}
