import type { Exercise } from '../../core';
import type { LibraryGroup, SourceExercise } from './types';

/** A fatal problem in the source or the curation files. The build stops. */
export class LibraryBuildError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LibraryBuildError';
  }
}

export interface BuildInput {
  /** The parsed vendored `exercises.json`. */
  source: SourceExercise[];
  /** Curation YAML text per group, e.g. `{ base: '…', floor: '…' }`. */
  curation: Partial<Record<LibraryGroup, string>>;
  /** Whether a vendored photo exists, by photo key relative to the photo folder (e.g. `Plank/0.jpg`). */
  photoExists: (relPath: string) => boolean;
}

export interface BuildResult {
  /** Every curated Exercise, sorted by Id. */
  exercises: Exercise[];
  /**
   * Generated TypeScript module text. It sits beside the `photos/` folder and
   * maps each photo key to a static require, one line per photo, in Id order
   * (start before end):
   *
   *   'Plank/0.jpg': require('./photos/Plank/0.jpg'),
   */
  photoIndex: string;
  /** Non-fatal findings, e.g. a `sourceId` rename. */
  warnings: string[];
}

/**
 * Merge the source and the curation files into the bundled Exercise Library.
 * Pure: no fs, no network. Throws LibraryBuildError on fatal problems.
 */
export function buildLibrary(input: BuildInput): BuildResult {
  void input;
  throw new Error('not implemented');
}
