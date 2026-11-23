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

/** The Exercise Library browser's filters: All the settings allow, the Excluded ones, the Customised ones. */
export const LIBRARY_FILTERS = ['All', 'Excluded', 'Customised'] as const;
export type LibraryFilter = (typeof LIBRARY_FILTERS)[number];

/** One row of the browser: the Exercise's Name, Body Area and effective Dose, and its two marks. */
export interface LibraryRow {
  id: string;
  name: string;
  bodyArea: BodyArea;
  /** The effective Dose (`doseOf`), formatted. */
  dose: string;
  excluded: boolean;
  /** Has a Dose override. */
  customised: boolean;
}

export interface LibraryBrowser {
  /** How many Exercises each filter holds, among the ones the settings allow. */
  counts: Record<LibraryFilter, number>;
  /** The filter's rows by Body Area, in `BODY_AREAS` order, by name within; no empty sections. */
  sections: { bodyArea: BodyArea; rows: LibraryRow[] }[];
}

/**
 * The Exercise Library browser for `filter`: the Exercises the settings allow
 * (`allowedBySettings`, Exclusions ignored), all of them for All, the
 * Excluded ones for Excluded, the ones with a Dose override for Customised.
 */
export function libraryBrowser(settings: Settings, library: readonly Exercise[], filter: LibraryFilter): LibraryBrowser {
  const rows: LibraryRow[] = allowedBySettings(settings, library).map((e) => ({
    id: e.id,
    name: e.name,
    bodyArea: e.bodyArea,
    dose: formatDose(doseOf(e, settings)),
    excluded: settings.excluded.includes(e.id),
    customised: isCustomised(settings, e.id),
  }));
  const inFilter: Record<LibraryFilter, (r: LibraryRow) => boolean> = {
    All: () => true,
    Excluded: (r) => r.excluded,
    Customised: (r) => r.customised,
  };
  const counts = {
    All: rows.length,
    Excluded: rows.filter(inFilter.Excluded).length,
    Customised: rows.filter(inFilter.Customised).length,
  };
  const shown = rows.filter(inFilter[filter]).sort((a, b) => a.name.localeCompare(b.name));
  const sections = BODY_AREAS.map((bodyArea) => ({ bodyArea, rows: shown.filter((r) => r.bodyArea === bodyArea) }));
  return { counts, sections: sections.filter((s) => s.rows.length > 0) };
}
