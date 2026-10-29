/**
 * The Exercise Library CLI: thin fs and network wrappers around the pure build
 * and draft functions. Run through the npm scripts, from `src/`:
 *
 *   npm run library:build            write library/library.json and library/photos.ts
 *   npm run library:draft -- <group> print the draft candidates for a group as YAML
 *   npm run library:photos           download the photos of every curated source Exercise
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';
import { buildLibrary, LibraryBuildError } from './build';
import { draftCandidates, renderDraftYaml } from './draft';
import {
  LIBRARY_FILE,
  PHOTO_INDEX_FILE,
  PHOTOS_DIR,
  readBuildInput,
  readCuration,
  readSource,
  serializeLibrary,
  SOURCE_COMMIT,
  SOURCE_REPO,
} from './files';
import { LIBRARY_GROUPS } from './mapping';
import type { LibraryGroup } from './types';

function build() {
  const { exercises, photoIndex, warnings } = buildLibrary(readBuildInput());
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  writeFileSync(LIBRARY_FILE, serializeLibrary(exercises));
  writeFileSync(PHOTO_INDEX_FILE, photoIndex);
  console.log(`Built ${exercises.length} Exercises into library/library.json and library/photos.ts.`);
}

/** Every Id in the existing curation files (their top-level keys). */
function curatedIds(): Set<string> {
  const ids = new Set<string>();
  for (const text of Object.values(readCuration())) {
    const parsed: unknown = parse(text ?? '');
    if (parsed && typeof parsed === 'object') for (const id of Object.keys(parsed)) ids.add(id);
  }
  return ids;
}

function draft(group: string | undefined) {
  if (!group || !(LIBRARY_GROUPS as readonly string[]).includes(group)) {
    throw new LibraryBuildError(`Usage: npm run library:draft -- <group>, one of ${LIBRARY_GROUPS.join(', ')}.`);
  }
  const entries = draftCandidates({ source: readSource(), group: group as LibraryGroup, curatedIds: curatedIds() });
  process.stdout.write(renderDraftYaml(entries));
}

async function photos() {
  const { exercises } = buildLibrary({ ...readBuildInput(), photoExists: () => true });
  const keys = exercises.flatMap((e) => (e.photos ? [e.photos.start, e.photos.end] : []));
  let fetched = 0;
  for (const key of keys) {
    const target = join(PHOTOS_DIR, key);
    if (existsSync(target)) continue;
    const url = `https://raw.githubusercontent.com/${SOURCE_REPO}/${SOURCE_COMMIT}/exercises/${key}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`GET ${url}: ${response.status} ${response.statusText}`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(await response.arrayBuffer()));
    fetched += 1;
    console.log(`fetched ${key}`);
  }
  console.log(`${fetched} photos downloaded, ${keys.length - fetched} already present.`);
}

async function main(command: string | undefined, args: string[]) {
  switch (command) {
    case 'build':
      return build();
    case 'draft':
      return draft(args[0]);
    case 'photos':
      return photos();
    default:
      throw new Error(`Unknown command ${command}: use build, draft or photos.`);
  }
}

main(process.argv[2], process.argv.slice(3)).catch((error: unknown) => {
  console.error(error instanceof LibraryBuildError ? `library: ${error.message}` : error);
  process.exitCode = 1;
});
