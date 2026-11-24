/**
 * The Exercise Library CLI: thin fs and network wrappers around the pure build
 * and draft functions. Run through the npm scripts, from `src/`:
 *
 *   npm run library:build            write library/library.json and library/photos.ts
 *   npm run library:draft -- <group> print the draft candidates for a group as YAML
 *   npm run library:photos           download and compress the missing photos of every curated source Exercise
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';
import { buildLibrary, LibraryBuildError } from './build';
import { draftCandidates, renderDraftYaml } from './draft';
import {
  LIBRARY_FILE,
  PHOTO_INDEX_FILE,
  photoExists,
  PHOTOS_DIR,
  readBuildInput,
  readCuration,
  readSource,
  serializeLibrary,
  SOURCE_COMMIT,
  SOURCE_REPO,
} from './files';
import { isLibraryGroup, LIBRARY_GROUPS, photoKeys } from './mapping';
import { compressPhoto, missingPhotos, photoFile } from './photos';

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
  if (!group || !isLibraryGroup(group)) {
    throw new LibraryBuildError(`Usage: npm run library:draft -- <group>, one of ${LIBRARY_GROUPS.join(', ')}.`);
  }
  const entries = draftCandidates({ source: readSource(), group, curatedIds: curatedIds() });
  process.stdout.write(renderDraftYaml(entries));
}

/**
 * Downloads each photo whose bundled WebP is missing from the pinned source
 * commit and writes it compressed (`compressPhoto`). The source JPEG is never
 * written to disk.
 */
async function photos() {
  const { exercises } = buildLibrary({ ...readBuildInput(), photoExists: () => true });
  const keys = photoKeys(exercises);
  const missing = missingPhotos(keys, (key) => photoExists(key));
  for (const key of missing) {
    const url = `https://raw.githubusercontent.com/${SOURCE_REPO}/${SOURCE_COMMIT}/exercises/${key}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`GET ${url}: ${response.status} ${response.statusText}`);
    const target = join(PHOTOS_DIR, photoFile(key));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, await compressPhoto(Buffer.from(await response.arrayBuffer())));
    console.log(`fetched ${key} -> ${photoFile(key)}`);
  }
  console.log(`${missing.length} photos downloaded and compressed, ${keys.length - missing.length} already present.`);
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
