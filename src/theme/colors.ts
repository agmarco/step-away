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
    /** Cards and sheets sitting on the screen background. */
    card: string;
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
    /** Primary actions and the Today hero. */
    hero: string;
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

export const light: Palette = {
  background: { screen: '#f8fafc', card: '#ffffff' },
  text: { primary: '#0f172a', secondary: '#64748b', onHero: '#ffffff' },
  line: { divider: '#e2e8f0' },
  accent: { hero: '#4f46e5' },
  outcome: {
    done: '#16a34a',
    skip: '#d97706',
    missed: '#94a3b8',
  },
  day: {
    dayOff: '#0ea5e9',
    goalDay: '#db2777',
  },
};

export const dark: Palette = {
  background: { screen: '#0b1120', card: '#1e293b' },
  text: { primary: '#f1f5f9', secondary: '#94a3b8', onHero: '#0b1120' },
  line: { divider: '#334155' },
  accent: { hero: '#818cf8' },
  outcome: {
    done: '#4ade80',
    skip: '#fbbf24',
    missed: '#64748b',
  },
  day: {
    dayOff: '#38bdf8',
    goalDay: '#f472b6',
  },
};
