/**
 * The Exercise Library on disk: where the CLI and the staleness test find the
 * vendored source, the curation files and the photos. Node only, never bundled.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type BuildInput, LibraryBuildError } from './build';
import type { LibraryGroup, SourceExercise } from './types';

/** The free-exercise-db commit `library/source/exercises.json` was fetched at. SOURCE.md records the same SHA. */
export const SOURCE_COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5';
export const SOURCE_REPO = 'yuhonas/free-exercise-db';

export const LIBRARY_DIR = fileURLToPath(new URL('../../library/', import.meta.url));
export const SOURCE_FILE = join(LIBRARY_DIR, 'source', 'exercises.json');
export const SOURCE_NOTE_FILE = join(LIBRARY_DIR, 'source', 'SOURCE.md');
export const CURATION_DIR = join(LIBRARY_DIR, 'curation');
export const PHOTOS_DIR = join(LIBRARY_DIR, 'photos');
export const LIBRARY_FILE = join(LIBRARY_DIR, 'library.json');
export const PHOTO_INDEX_FILE = join(LIBRARY_DIR, 'photos.ts');

export function readSource(): SourceExercise[] {
  return JSON.parse(readFileSync(SOURCE_FILE, 'utf8'));
}

/** Files the curation folder may hold besides the `<group>.yaml` files. */
const CURATION_EXTRAS = ['README.md', '.gitkeep'];

/**
 * Every `curation/*.yaml`, keyed by file name. Names are passed through as
 * they are, so `buildLibrary` rejects a file that isn't one of the groups.
 * Any file that is neither `.yaml` nor README.md or .gitkeep (e.g. a `base.yml`
 * typo) fails, so it can't be skipped silently.
 */
export function readCuration(): BuildInput['curation'] {
  const entries = existsSync(CURATION_DIR) ? readdirSync(CURATION_DIR) : [];
  const stray = entries.filter((f) => !f.endsWith('.yaml') && !CURATION_EXTRAS.includes(f));
  if (stray.length > 0) {
    throw new LibraryBuildError(
      `Unexpected file ${stray.join(', ')} in library/curation/: it may hold only <group>.yaml files and README.md.`,
    );
  }
  const files = entries.filter((f) => f.endsWith('.yaml'));
  const curation: Record<string, string> = {};
  for (const file of files.sort()) curation[file.slice(0, -'.yaml'.length)] = readFileSync(join(CURATION_DIR, file), 'utf8');
  return curation as Partial<Record<LibraryGroup, string>>;
}

export function photoExists(relPath: string): boolean {
  return existsSync(join(PHOTOS_DIR, relPath));
}

export function readBuildInput(): BuildInput {
  return { source: readSource(), curation: readCuration(), photoExists };
}

/** library.json as the build writes it: pretty-printed, newline-terminated. */
export function serializeLibrary(exercises: unknown[]): string {
  return `${JSON.stringify(exercises, null, 2)}\n`;
}
