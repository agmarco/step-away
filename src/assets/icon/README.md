# App icon

"Walker in the ring" (#70, variant H of the `app-icon` prototype): a walking figure with motion lines behind it, inside a lime goal ring three-quarters full, on a dark gradient. These SVGs are the source of truth; the PNGs in `assets/` are rendered from them.

Every SVG is a 108×108 viewBox (Android's adaptive-icon canvas; a launcher shows the middle 72×72 under its mask). The motifs sit in `translate(54 54) scale(.78) translate(-54 -54)`, with round caps and joins, exactly as in the prototype.

| SVG | PNG (from `src/`) | What it is |
|---|---|---|
| `foreground.svg` | `assets/android-icon-foreground.png`, 1024², transparent | The ring track (white at .18), the lime arc, the walker and the motion lines (white at .55). Shared by both variants. |
| `background.svg` | `assets/android-icon-background.png`, 1024², opaque | The gradient `#111827` → `#1f2937`, top-left to bottom-right. `preview` only. |
| `monochrome.svg` | `assets/android-icon-monochrome.png`, 1024², transparent | Themed icons (Android 13+) use only its alpha: the arc, walker and motion lines, all opaque white. No faint track: themed icons can't show partial opacity well. |
| `composed.svg` | `assets/icon.png`, 1024², and `assets/favicon.png`, 48², both opaque | Background plus foreground, zoomed 1.5× to the 72×72 a launcher shows, as the prototype draws it. |
| `notification.svg` | `assets/notification-icon.png`, 96², transparent | The status-bar icon: the walker and motion lines only, no ring, opaque white, scaled up to fill the canvas so it reads at 24 dp. Android shows only the alpha, tinted with the plugin's `color`. |

The artwork is repeated in `foreground.svg`, `monochrome.svg`, `composed.svg` and `notification.svg`, so a change to the drawing goes into each of them.

In `app.config.ts`: both variants use the foreground and monochrome layers; `preview` adds the background image over `backgroundColor: '#111827'`; `development` keeps a plain amber `backgroundColor: '#F59E0B'` (no image) so the dev app stands out on the launcher. The `expo-notifications` plugin gets `icon: './assets/notification-icon.png'` and `color: '#a3e635'` (the ring's lime).

## Regenerate

After editing an SVG, from `src/`:

```sh
npm run icons:render
```

It renders every PNG with `sharp` (the pinned devDependency, through librsvg) at full size from the vectors, one thread and no cache, so the same SVGs give the same bytes on every run. Commit the SVGs and PNGs together: `tools/icons/committed.test.ts` fails if a committed PNG differs from a fresh render (also after a sharp upgrade; then rerun the script). The icon is native: a new icon reaches the phone only with a new EAS build.
