/**
 * WCAG 2.x contrast of the colour tokens, in both palettes (#25): text at
 * least 4.5:1 on the background it sits on, non-text marks (the Daily Goal
 * dots, the week panel's cells, outcome dots) at least 3:1, and the outcome
 * and day colours all distinct from each other.
 */
import { describe, expect, it } from 'vitest';
import { dark, light, type Palette } from './colors';

/** sRGB channel (0-255) to linear light, per WCAG 2.x. */
function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`not a #rrggbb colour: ${hex}`);
  const [r, g, b] = m.slice(1).map((h) => linear(parseInt(h, 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const NON_TEXT = 3;

type Pair = [name: string, foreground: string, background: string];

/** Text tokens and the backgrounds they are drawn on. */
function textPairs(p: Palette): Pair[] {
  const onSurfaces: [string, string][] = [
    ['text.primary', p.text.primary],
    ['text.secondary', p.text.secondary],
    ['outcome.done', p.outcome.done],
    ['outcome.skip', p.outcome.skip],
    ['outcome.missed', p.outcome.missed],
    ['accent.hero', p.accent.hero],
  ];
  const surfaces: [string, string][] = [
    ['background.screen', p.background.screen],
    ['background.card', p.background.card],
  ];
  return [
    ...onSurfaces.flatMap(([n, fg]) => surfaces.map(([bn, bg]): Pair => [`${n} on ${bn}`, fg, bg])),
    ['text.primary on background.selected', p.text.primary, p.background.selected],
    // The guided screen's fallback banner: its line and its Settings link.
    ['text.primary on background.banner', p.text.primary, p.background.banner],
    ['accent.hero on background.banner', p.accent.hero, p.background.banner],
    ['text.onHero on accent.hero', p.text.onHero, p.accent.hero],
    ['text.onHero on accent.heroPanel', p.text.onHero, p.accent.heroPanel],
  ];
}

/** Marks that carry meaning without text: Daily Goal dots, week cells, outcome dots. */
function markPairs(p: Palette): Pair[] {
  const marks: [string, string][] = [
    ['day.goalDay', p.day.goalDay],
    ['day.dayOff', p.day.dayOff],
    ['outcome.done', p.outcome.done],
    ['outcome.skip', p.outcome.skip],
    ['outcome.missed', p.outcome.missed],
    // The ring around today's week cell.
    ['accent.hero', p.accent.hero],
  ];
  return [
    ...marks.map(([n, c]): Pair => [`${n} on background.card`, c, p.background.card]),
    // The Daily Goal dots in the hero, filled and empty (a ring), drawn in text.onHero.
    ['goal dot (text.onHero) on accent.hero', p.text.onHero, p.accent.hero],
  ];
}

describe.each([
  ['light', light],
  ['dark', dark],
] as const)('the %s palette', (_name, palette) => {
  it.each(textPairs(palette))('text: %s is at least 4.5:1', (_pair, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(TEXT);
  });

  it.each(markPairs(palette))('mark: %s is at least 3:1', (_pair, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it('keeps the outcome and day colours distinct from each other', () => {
    const colours = [...Object.values(palette.outcome), ...Object.values(palette.day)].map((c) => c.toLowerCase());
    expect(new Set(colours).size).toBe(colours.length);
  });
});
