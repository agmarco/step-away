import type { Outcome } from '../core';

/**
 * The colour tokens. This folder is the only place in src/ where literal
 * colours may appear (enforced by the local/no-literal-colors ESLint rule).
 * Light starts from the app-navigation prototype's palette.
 */
export interface Palette {
  background: {
    /** Behind everything on a screen. */
    screen: string;
    /** Cards, tiles and sheets sitting on the screen background. */
    card: string;
    /** The chosen row in a sheet (e.g. the current outcome in the correction sheet); text.primary on it. */
    selected: string;
    /** Dims the screen behind a sheet. Translucent. */
    scrim: string;
  };
  text: {
    primary: string;
    secondary: string;
    /** Text drawn on top of accent.hero. */
    onHero: string;
  };
  line: {
    divider: string;
  };
  accent: {
    /** Primary actions and the Today hero; also links and today's ring in the week panel. */
    hero: string;
    /** The status line's panel inside the hero; text.onHero on it. */
    heroPanel: string;
  };
  /**
   * One colour per outcome of a Reminder in the Activity Log (Done, Skip,
   * Missed). Keyed by the core's Outcome type, so a new Outcome needs a colour.
   */
  outcome: Record<Lowercase<Outcome>, string>;
  /** Day states: a Day Off, and a Goal Day (one that reached the Daily Goal). */
  day: {
    dayOff: string;
    goalDay: string;
  };
}

// The outcome and day colours are all distinct from each other, in both palettes.
// contrast.test.ts checks every pairing the screens use against WCAG 2.x: text
// at least 4.5:1 on its background, marks (dots, week cells) at least 3:1.

export const light: Palette = {
  background: { screen: '#f8fafc', card: '#ffffff', selected: '#eef2ff', scrim: 'rgba(15, 23, 42, 0.4)' },
  text: { primary: '#0f172a', secondary: '#64748b', onHero: '#ffffff' },
  line: { divider: '#e2e8f0' },
  accent: { hero: '#4f46e5', heroPanel: '#4338ca' },
  outcome: {
    done: '#15803d',
    skip: '#b45309',
    missed: '#475569',
  },
  day: {
    dayOff: '#0284c7',
    goalDay: '#db2777',
  },
};

export const dark: Palette = {
  background: { screen: '#0b1120', card: '#1e293b', selected: '#312e81', scrim: 'rgba(0, 0, 0, 0.6)' },
  text: { primary: '#f1f5f9', secondary: '#94a3b8', onHero: '#0b1120' },
  line: { divider: '#334155' },
  accent: { hero: '#818cf8', heroPanel: '#a5b4fc' },
  outcome: {
    done: '#4ade80',
    skip: '#fbbf24',
    missed: '#8b9bb5',
  },
  day: {
    dayOff: '#38bdf8',
    goalDay: '#f472b6',
  },
};
