/**
 * The bundled Exercise Library as the app reads it. Thin on purpose: it only
 * types the generated `library.json` and looks up photos in the generated
 * `photos.ts`. Both are written by `npm run library:build`; see README.md.
 */
import type { Exercise } from '../core';
import library from './library.json';
import photos from './photos';

/** Every bundled Exercise, sorted by Id. */
export const exercises: Exercise[] = library as Exercise[];

/** The bundled image for a photo key (e.g. `Plank/0.jpg`), or undefined if it isn't bundled. */
export function photoSource(key: string): number | undefined {
  return photos[key];
}
