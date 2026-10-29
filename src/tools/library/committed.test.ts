import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildLibrary } from './build';
import {
  LIBRARY_FILE,
  PHOTO_INDEX_FILE,
  readBuildInput,
  serializeLibrary,
  SOURCE_COMMIT,
  SOURCE_FILE,
  SOURCE_NOTE_FILE,
} from './files';

describe('the committed Exercise Library', () => {
  it('is what the build makes of the vendored source and the curation files: rerun `npm run library:build`', () => {
    const { exercises, photoIndex } = buildLibrary(readBuildInput());

    expect(readFileSync(LIBRARY_FILE, 'utf8')).toBe(serializeLibrary(exercises));
    expect(readFileSync(PHOTO_INDEX_FILE, 'utf8')).toBe(photoIndex);
  });
});

describe('the vendored source', () => {
  const note = readFileSync(SOURCE_NOTE_FILE, 'utf8');

  it('is the file SOURCE.md records, byte for byte', () => {
    const sha256 = createHash('sha256').update(readFileSync(SOURCE_FILE)).digest('hex');

    expect(note).toContain(sha256);
  });

  it('is pinned in SOURCE.md to the commit the photo download uses', () => {
    expect(note).toContain(SOURCE_COMMIT);
  });
});
