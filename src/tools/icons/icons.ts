/**
 * The app icon's PNGs, rendered from the SVG sources in `assets/icon/` (see its
 * README). Node only, never bundled. Run through `npm run icons:render`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

/** The Expo root (`src/`). */
export const ROOT = join(__dirname, '..', '..');
const SOURCES = join(ROOT, 'assets', 'icon');

export type IconOutput = {
  /** The PNG, relative to the Expo root. */
  file: string;
  /** The SVG in `assets/icon/`. */
  source: string;
  /** Width and height in px. */
  size: number;
  /** Drop the alpha channel (the full-bleed composed icon). */
  opaque: boolean;
};

export const ICON_OUTPUTS: readonly IconOutput[] = [
  { file: 'assets/android-icon-foreground.png', source: 'foreground.svg', size: 1024, opaque: false },
  { file: 'assets/android-icon-background.png', source: 'background.svg', size: 1024, opaque: true },
  { file: 'assets/android-icon-monochrome.png', source: 'monochrome.svg', size: 1024, opaque: false },
  { file: 'assets/icon.png', source: 'composed.svg', size: 1024, opaque: true },
  { file: 'assets/favicon.png', source: 'composed.svg', size: 48, opaque: true },
  { file: 'assets/notification-icon.png', source: 'notification.svg', size: 96, opaque: false },
];

// One thread and no operation cache, so the output never depends on scheduling
// or on what ran before (as in tools/library/photos.ts).
sharp.concurrency(1);
sharp.cache(false);

/**
 * An SVG with only a viewBox, rasterised at `size` px square. The size goes on
 * the root element, so librsvg renders the vectors at full resolution (no
 * resample). Deterministic with the pinned sharp version.
 */
export async function renderSvg(svg: string, size: number, opaque: boolean): Promise<Buffer> {
  if (!/^<svg [^>]*viewBox="0 0 108 108"/.test(svg) || /^<svg [^>]*\swidth=/.test(svg)) {
    throw new Error('An icon source must be a 108×108 viewBox with no width or height.');
  }
  const sized = svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
  const image = sharp(Buffer.from(sized), { density: 72 });
  return (opaque ? image.removeAlpha() : image).png({ compressionLevel: 9 }).toBuffer();
}

/** Every output's PNG bytes, rendered from its source on disk. */
export async function renderIcons(): Promise<{ output: IconOutput; png: Buffer }[]> {
  const rendered = [];
  for (const output of ICON_OUTPUTS) {
    const svg = readFileSync(join(SOURCES, output.source), 'utf8');
    rendered.push({ output, png: await renderSvg(svg, output.size, output.opaque) });
  }
  return rendered;
}
