import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { ICON_OUTPUTS, renderIcons, renderSvg, ROOT } from './icons';

describe('the committed icon PNGs', () => {
  it('match a fresh render of the SVG sources (run `npm run icons:render` after editing assets/icon/)', async () => {
    for (const { output, png } of await renderIcons()) {
      expect(readFileSync(join(ROOT, output.file)).equals(png), output.file).toBe(true);
    }
  });

  it.each(ICON_OUTPUTS.map((o) => [o.file, o] as const))('%s has its size and alpha', async (_, output) => {
    const meta = await sharp(join(ROOT, output.file)).metadata();
    expect([meta.width, meta.height, meta.hasAlpha]).toEqual([output.size, output.size, !output.opaque]);
  });
});

describe('renderSvg', () => {
  it('refuses a source that is not a bare 108×108 viewBox', async () => {
    await expect(renderSvg('<svg viewBox="0 0 24 24"/>', 48, false)).rejects.toThrow('108×108');
    await expect(renderSvg('<svg viewBox="0 0 108 108" width="108"/>', 48, false)).rejects.toThrow('108×108');
  });
});
