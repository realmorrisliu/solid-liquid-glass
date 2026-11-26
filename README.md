# solid-liquid-glass

A **Solid 2.0 + `@ui-sdk/solid`** port of [`bilalgursen/liquid-glass`](https://github.com/bilalgursen/liquid-glass) by [Bilal Abdullah Gürşen](https://onemorethink.dev/).

Glass components for Solid 2.0, drawn by a single shared WebGL2 refraction shader (`engine.ts` + `dom-snapshot.ts`), with accessible keyboard, focus, and popup behaviors powered by Vercel Labs' UI SDK (`@ui-sdk/core` + `@ui-sdk/solid`).

## Credits & Upstream License

- **Original React implementation & WebGL2 optical engine**: [`bilalgursen/liquid-glass`](https://github.com/bilalgursen/liquid-glass) ([onemorethink.dev](https://onemorethink.dev/)) — MIT License, Copyright (c) 2026 Bilal Abdullah Gürşen.
- **Solid 2.0 + `@ui-sdk/solid` port**: Native SolidJS fine-grained reactive bindings (`solid-js@^2.0.0`, `@ui-sdk/solid`), plus `(prefers-reduced-transparency: reduce)` accessibility fallbacks — MIT License.

See [LICENSE](./LICENSE) and [NOTICE](./NOTICE) for full details.

## Components

| Verb | Component | Description |
| --- | --- | --- |
| Press | `GlassButton` | Clear or tinted glass button that swells, stretches when pulled (`pull`), and melts into neighbors (`Cohesion`). |
| Merge | `GlassActionButton` | Async action button whose arrow droplet melts into the body. |
| Travel | `GlassTabs` / `GlassLens` | Segmented control whose active selection travels as a magnifying lens. |
| Flow | `GlassBadge` | Pill badge with live refracted backdrop text. |
| Drag | `GlassSlideToConfirm` | Slide-to-confirm control with spring snap-back. |
| Hold | `GlassCard` | Frosted/refractive glass card (`live` mode for moving backdrops). |
| Share | `GlassButtonGroup` | Related actions sharing one unified body of glass. |
| Grow | `GlassMenu` | Menu whose trigger's own glass grows seamlessly into the panel (`opening: 'grow'`), supporting radio, checkbox, shortcuts, and submenus. |
| Open | `GlassDropdownMenu` | Menu that swells out of its trigger as one gooey body of glass. |
| Unfold | `GlassPopover` | Popover surface unfolding smoothly from its anchor. |
| Stretch | `GlassSelect` | Select listbox connected to its trigger on a stretching glass neck. |
| Base | `GlassLayer` / `GlassStyles` | Low-level WebGL2 glass surface and CSS fallback utilities. |

## What's New in 2.0.6 (synced to upstream `6b3913f` + Apple-restrained tactile preset)

- **COHESION Stacking & Opt-Out Isolation**: Sticky/fixed stacking layers never melt into scrolling page buttons passing beneath them, hidden (`opacity: 0` / `visibility: hidden`) elements are skipped by `cohere()`, and `swell="subtle"` (or `cohesion={false}`) keeps buttons visually sovereign without carving bites into neighbors.
- **Restrained Tactile Preset (`swell="subtle"` & `subtleTrigger`)**: Opt-in Apple-calm button and popup trigger mode — delivers silky critically-damped hover lift, floating shadow elevation, WebGL2 specular rim highlights, and crisp `0.965–0.975` tactile press depression (with immediate popup open on press), without underdamped X/Y jelly wobble or rubber-band pulling.
- **Cohesion (`COHESION`)**: Nearby glass buttons smoothly fuse into one liquid body via distance-field union when pulled together, sharing bevels, refraction, shadows, rim mirrors, and transmitted press light across the bridge.
- **Rubber-Band Pull (`PULL`) & Press Light (`LIGHT`)**: Held buttons follow and stretch along pointer drag on the GPU shader rather than naïve CSS scaling, lighting the glass directly beneath the press point.
- **`GlassMenu`**: Native `@ui-sdk/solid/menu` component where the button outline pours into the menu panel (`opening: 'grow'`), with full keyboard navigation, submenus, radio groups, checkboxes, and shortcuts.
- **Safari & Seam Fixes**: Eliminates WebKit's magenta clipping artifact (`SOFT_MIN`) and trigger-popup seam dark lines, with tuned popup close-fade timing.
- **Engine 2.0.2 & Card 2.0.3 GPU/Idle Performance**: Eliminates idle loop wake-ups on closed `GlassMenu`/`GlassPopover` (`landed`), skips unchanged GPU uploads & dirty-uniform syncs, culls out-of-region DOM siblings/invisible text in `dom-snapshot`, caches scroll snapshots in popups, trims empty shadow padding on `GlassCard`, and downsamples large frosted surfaces via `FROST_PASS`/`BACK_SKIP`.

## Usage with Tailwind CSS v4

1. Import the library styles and register the package source so Tailwind v4 scans its utility classes:

```css
@import "tailwindcss";
@import "solid-liquid-glass/styles.css";
@source "../node_modules/solid-liquid-glass/src";
```

2. Mount `<GlassStyles />` once at your app root and render components:

```tsx
import { GlassStyles, GlassButton, GlassTabs } from "solid-liquid-glass";

export function App() {
  return (
    <>
      <GlassStyles />
      <GlassButton material="tinted" class="bg-orange-500 text-white">
        Download
      </GlassButton>
    </>
  );
}
```

## Development

```sh
pnpm install
pnpm dev
pnpm typecheck
pnpm build
```
