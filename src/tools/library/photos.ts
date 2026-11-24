/**
 * The Exercise photo step of the library pipeline. Node only, never bundled.
 *
 * A photo key (`<id>/0.jpg`, `<id>/1.jpg`) is the source's own image path: it
 * names the file in the free-exercise-db download URL, in the source data and
 * in `library.json`. The bundled file is a compressed WebP beside it, so only
 * the extension changes: key `Plank/0.jpg` is file `library/photos/Plank/0.webp`.
 */
import sharp from 'sharp';

/** The bundled file of a photo key, relative to the photo folder: `Plank/0.jpg` → `Plank/0.webp`. */
export function photoFile(key: string): string {
  return key.replace(/\.jpg$/, '.webp');
}

/**
 * The photo keys `library:photos` still has to download and compress, in their
 * order: those whose bundled file is not there yet. A present `.webp` is never
 * redone, so a rerun downloads nothing.
 */
export function missingPhotos(keys: readonly string[], exists: (key: string) => boolean): string[] {
  return keys.filter((key) => !exists(key));
}

/**
 * The box every photo is shrunk to cover: 440 px wide, at the screens' 850:567
 * shape (294 = round(440 × 567 / 850)). The screens show each photo cover-fit
 * in an `aspectRatio: 850 / 567` box, at most about 443 physical px wide (the
 * Exercise card; about 369 on the guided screen), so 440 is roughly 1:1.
 */
export const PHOTO_BOX_WIDTH = 440;
export const PHOTO_BOX_HEIGHT = 294;

/**
 * Lossy WebP at quality 60, effort 6 (the slowest, smallest encoding): the
 * owner's pick in #59 CP1 (candidate B, 2.99 MiB for all 400 photos, from
 * 17.6 MiB). The photos are visual aids, and at on-screen size they look like
 * the source.
 */
export const PHOTO_QUALITY = 60;
export const PHOTO_EFFORT = 6;

// One thread and no operation cache, so the output never depends on scheduling
// or on what ran before: #59 CP1 got byte-identical files on every run this way.
sharp.concurrency(1);
sharp.cache(false);

/**
 * A source JPEG, compressed into the bundled WebP: shrunk to just cover the
 * photo box at its own aspect ratio (never enlarged, never cropped), encoded
 * with the settings above, with no metadata (sharp drops EXIF, ICC and XMP by
 * default). Deterministic: the same input gives the same bytes on every run,
 * with the pinned sharp version. Another sharp version may change the bytes;
 * then the bundled photos are redone (delete `library/photos/`, rerun
 * `npm run library:photos`).
 */
export async function compressPhoto(jpeg: Buffer): Promise<Buffer> {
  return sharp(jpeg)
    .resize({ width: PHOTO_BOX_WIDTH, height: PHOTO_BOX_HEIGHT, fit: 'outside', withoutEnlargement: true, kernel: 'lanczos3' })
    .webp({ quality: PHOTO_QUALITY, effort: PHOTO_EFFORT })
    .toBuffer();
}
