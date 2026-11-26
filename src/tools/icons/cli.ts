/**
 * Renders the app icon's PNGs from `assets/icon/*.svg`. From `src/`:
 *
 *   npm run icons:render
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderIcons, ROOT } from './icons';

async function main() {
  for (const { output, png } of await renderIcons()) {
    writeFileSync(join(ROOT, output.file), png);
    console.log(`${output.file} (${output.size}×${output.size}) from assets/icon/${output.source}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
