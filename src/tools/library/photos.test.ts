import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { photoExists } from './files';
import sharp from 'sharp';
import { compressPhoto, missingPhotos, photoFile } from './photos';

/** A source JPEG from `__fixtures__/photos/`: two real free-exercise-db photos and one small one made from a third. */
const sourcePhoto = (name: string) => readFileSync(new URL(`./__fixtures__/photos/${name}`, import.meta.url));
const LANDSCAPE = 'landscape-850x567.jpg'; // Overhead_Stretch/1.jpg, the usual source shape
const PORTRAIT = 'portrait-500x750.jpg'; // Bottoms_Up/0.jpg, one of the four portrait Exercises
const SMALL = 'small-300x200-exif-icc.jpg'; // smaller than the box, with EXIF and an ICC profile added

/** A fresh photo folder holding exactly these files (paths relative to it). */
function photoFolder(...files: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'library-photos-'));
  for (const file of files) {
    mkdirSync(join(dir, file, '..'), { recursive: true });
    writeFileSync(join(dir, file), '');
  }
  return dir;
}

describe('photoFile', () => {
  it('maps a photo key to its bundled WebP file, keeping the folder and the start/end name', () => {
    expect(photoFile('Plank/0.jpg')).toBe('Plank/0.webp');
    expect(photoFile('Arm_Circles_Standing/1.jpg')).toBe('Arm_Circles_Standing/1.webp');
  });

  it('only rewrites the extension at the end of the key', () => {
    expect(photoFile('3_4_Sit-Up.jpg_x/0.jpg')).toBe('3_4_Sit-Up.jpg_x/0.webp');
  });
});

describe('photoExists', () => {
  it('finds a photo key by its bundled WebP file', () => {
    expect(photoExists('Plank/0.jpg', photoFolder('Plank/0.webp'))).toBe(true);
  });

  it('does not count a JPEG under the key itself as the bundled photo', () => {
    expect(photoExists('Plank/0.jpg', photoFolder('Plank/0.jpg'))).toBe(false);
  });
});

describe('missingPhotos', () => {
  it('lists the photo keys whose bundled photo is not there yet, in their order', () => {
    const present = new Set(['Plank/0.jpg', 'Star_Jump/1.jpg']);
    const keys = ['Plank/0.jpg', 'Plank/1.jpg', 'Star_Jump/0.jpg', 'Star_Jump/1.jpg'];

    expect(missingPhotos(keys, (key) => present.has(key))).toEqual(['Plank/1.jpg', 'Star_Jump/0.jpg']);
  });

  it('is empty when every photo is there, so a rerun downloads nothing', () => {
    expect(missingPhotos(['Plank/0.jpg', 'Plank/1.jpg'], () => true)).toEqual([]);
  });
});

describe('compressPhoto', () => {
  it('encodes the photo as WebP', async () => {
    const out = await compressPhoto(sourcePhoto(LANDSCAPE));

    expect(out.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(out.subarray(8, 12).toString('latin1')).toBe('WEBP');
    expect((await sharp(out).metadata()).format).toBe('webp');
  });

  it('shrinks an 850×567 photo to just cover the 440×294 box', async () => {
    const { width, height } = await sharp(await compressPhoto(sourcePhoto(LANDSCAPE))).metadata();

    // 441, not 440: the box is rounded to 294 rows (440 × 567 / 850 = 293.5), so
    // covering it takes the height's scale, 294 / 567, and 850 × 294 / 567 = 440.7.
    expect([width, height]).toEqual([441, 294]);
  });

  it('keeps a portrait photo whole, at its own shape, just covering the box', async () => {
    const { width, height } = await sharp(await compressPhoto(sourcePhoto(PORTRAIT))).metadata();

    expect([width, height]).toEqual([440, 660]); // 500×750 × 0.88: not cropped to 294 rows
  });

  it('never enlarges a photo smaller than the box', async () => {
    const { width, height } = await sharp(await compressPhoto(sourcePhoto(SMALL))).metadata();

    expect([width, height]).toEqual([300, 200]);
  });

  it('drops the EXIF and ICC metadata of the source', async () => {
    const before = await sharp(sourcePhoto(SMALL)).metadata();
    const after = await sharp(await compressPhoto(sourcePhoto(SMALL))).metadata();

    expect([before.exif !== undefined, before.icc !== undefined]).toEqual([true, true]); // the fixture has both
    expect([after.exif, after.icc, after.xmp]).toEqual([undefined, undefined, undefined]);
  });

  it('gives the same bytes on every run', async () => {
    const [first, second] = await Promise.all([compressPhoto(sourcePhoto(PORTRAIT)), compressPhoto(sourcePhoto(PORTRAIT))]);

    expect(first.equals(second)).toBe(true);
  });

  it('gives the pinned bytes for a known photo, so a sharp upgrade that changes them fails here', async () => {
    const sha256 = createHash('sha256')
      .update(await compressPhoto(sourcePhoto(LANDSCAPE)))
      .digest('hex');

    // Overhead_Stretch/1.jpg as #59 CP1 encoded it with the chosen settings (sharp 0.35.5).
    expect(
      sha256,
      'compressPhoto output changed (sharp, libvips or libwebp, or the settings): the bundled photos are stale. ' +
        'Delete library/photos/, rerun `npm run library:photos` and `npm run library:build`, then update this hash.',
    ).toBe('1985d3d124c03ed0a3e7aeab4b122346cb2643b853701cb21cb6626b030e591e');
  });
});
