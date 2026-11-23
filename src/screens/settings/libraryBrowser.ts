import {
  allowedBySettings,
  BODY_AREAS,
  doseOf,
  formatDose,
  isCustomised,
  type BodyArea,
  type Exercise,
  type Settings,
} from '../../core';

/** The Exercise Library browser's filters: All the settings allow, every Excluded one, every Customised one. */
export const LIBRARY_FILTERS = ['All', 'Excluded', 'Customised'] as const;
export type LibraryFilter = (typeof LIBRARY_FILTERS)[number];

/** One row of the browser: the Exercise's Name, Body Area and effective Dose, and its marks. */
export interface LibraryRow {
  id: string;
  name: string;
  bodyArea: BodyArea;
  /** The effective Dose (`doseOf`), formatted. */
  dose: string;
  /** The settings allow it (`allowedBySettings`); false only on an Excluded or Customised row. */
  allowed: boolean;
  excluded: boolean;
  /** Has a Dose override. */
  customised: boolean;
}

export interface LibraryBrowser {
  /** How many Exercises each filter holds, by the same rules as its rows. */
  counts: Record<LibraryFilter, number>;
  /** The filter's rows by Body Area, in `BODY_AREAS` order, by name within; no empty sections. */
  sections: { bodyArea: BodyArea; rows: LibraryRow[] }[];
}

/**
 * The Exercise Library browser for `filter`. All: the Exercises the settings
 * allow (`allowedBySettings`, Exclusions ignored). Excluded: every library
 * Exercise in `settings.excluded`. Customised: every library Exercise with a
 * Dose override. Excluded and Customised list the ones the settings don't
 * allow too (`allowed` false), so an Exclusion or a Dose change can always be
 * undone.
 */
export function libraryBrowser(settings: Settings, library: readonly Exercise[], filter: LibraryFilter): LibraryBrowser {
  const allowedIds = new Set(allowedBySettings(settings, library).map((e) => e.id));
  const rows: LibraryRow[] = library.map((e) => ({
    id: e.id,
    name: e.name,
    bodyArea: e.bodyArea,
    dose: formatDose(doseOf(e, settings)),
    allowed: allowedIds.has(e.id),
    excluded: settings.excluded.includes(e.id),
    customised: isCustomised(settings, e.id),
  }));
  const inFilter: Record<LibraryFilter, (r: LibraryRow) => boolean> = {
    All: (r) => r.allowed,
    Excluded: (r) => r.excluded,
    Customised: (r) => r.customised,
  };
  const counts = {
    All: rows.filter(inFilter.All).length,
    Excluded: rows.filter(inFilter.Excluded).length,
    Customised: rows.filter(inFilter.Customised).length,
  };
  const shown = rows.filter(inFilter[filter]).sort((a, b) => a.name.localeCompare(b.name));
  const sections = BODY_AREAS.map((bodyArea) => ({ bodyArea, rows: shown.filter((r) => r.bodyArea === bodyArea) }));
  return { counts, sections: sections.filter((s) => s.rows.length > 0) };
}
