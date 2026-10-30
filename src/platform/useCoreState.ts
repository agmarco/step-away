/**
 * The stored core state for screens, plus "now". Re-reads after every write
 * in this JS context and once a minute, so a Reminder that has just fired
 * shows up without user action.
 */
import { useEffect, useState } from 'react';
import type { CoreState } from '../core';
import { onStateChanged, readState } from './store';

const REFRESH_MS = 60_000;

export function useCoreState(): { state: CoreState | null; now: number } {
  const [snapshot, setSnapshot] = useState<{ state: CoreState | null; now: number }>(() => ({ state: null, now: Date.now() }));

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      readState()
        .then((state) => alive && setSnapshot({ state, now: Date.now() }))
        .catch((e) => console.warn(`[useCoreState] read failed: ${e}`));
    };
    refresh();
    const unsubscribe = onStateChanged(refresh);
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      alive = false;
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  return snapshot;
}
