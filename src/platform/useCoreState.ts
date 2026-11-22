/**
 * The stored core state for screens, plus "now". Re-reads after every write
 * in this JS context, just after the next Reminder becomes due (its fire
 * time, or a pending Snooze re-fire, by the core's `nextReminder`), and once
 * a minute as a backstop, so a Reminder that has just fired shows up, and the
 * one it replaced settles, without user action. `failed` is true while the
 * latest read failed (the state stays the last one read, null if none).
 */
import { useEffect, useRef, useState } from 'react';
import { effectiveFire, nextReminder, type CoreState } from '../core';
import { onStateChanged, readState } from './store';

const REFRESH_MS = 60_000;
/** How long after the next Reminder becomes due the one-shot refresh runs. */
const AFTER_DUE_MS = 500;

type Snapshot = { state: CoreState | null; now: number; failed: boolean };

export function useCoreState(): Snapshot {
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({ state: null, now: Date.now(), failed: false }));
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      readState()
        .then((state) => alive && setSnapshot({ state, now: Date.now(), failed: false }))
        .catch((e) => {
          console.warn(`[useCoreState] read failed: ${e}`);
          if (alive) setSnapshot((s) => (s.failed ? s : { ...s, failed: true }));
        });
    };
    refreshRef.current = refresh;
    refresh();
    const unsubscribe = onStateChanged(refresh);
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      alive = false;
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  // One-shot refresh just after the next Reminder is due: re-armed on every snapshot, cleared on unmount.
  useEffect(() => {
    if (!snapshot.state) return;
    const next = nextReminder(snapshot.state, snapshot.now);
    if (!next) return;
    const delay = Math.max(0, effectiveFire(next) - Date.now()) + AFTER_DUE_MS;
    const timer = setTimeout(() => refreshRef.current(), delay);
    return () => clearTimeout(timer);
  }, [snapshot]);

  return snapshot;
}
