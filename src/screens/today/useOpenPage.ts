import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback } from 'react';

// Shared by the tiles and the week panel, so a tap on one while another's page
// is still opening is dropped too. Cleared when Today regains focus, or after
// a timeout in case the push never lands.
let opening = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const OPENING_TIMEOUT_MS = 10_000;

function clear() {
  opening = false;
  if (timer) clearTimeout(timer);
  timer = undefined;
}

/**
 * Pushes a page from Today, at most one at a time: further taps are ignored
 * until Today is focused again, so taps made while a slow page loads don't
 * stack pages on the Stack.
 */
export function useOpenPage() {
  useFocusEffect(useCallback(() => clear(), []));
  return useCallback((href: Href) => {
    if (opening) return;
    opening = true;
    timer = setTimeout(clear, OPENING_TIMEOUT_MS);
    router.push(href);
  }, []);
}
