/**
 * Whether onboarding (#31) has run, for screens: read once on mount (the
 * store's rule: done, pending, or, absent, done when settings are stored).
 */
import { useEffect, useState } from 'react';
import { readOnboardingDone } from './store';

/** True when onboarding has run, false when not, null until the first read. */
export function useOnboardingDone(): boolean | null {
  const [done, setDone] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    readOnboardingDone()
      .then((d) => alive && setDone(d))
      .catch((e) => {
        // A failed read shows Today rather than nothing: onboarding is skippable, a blank app isn't.
        console.warn(`[onboarding] read failed: ${e}`);
        if (alive) setDone(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  return done;
}
