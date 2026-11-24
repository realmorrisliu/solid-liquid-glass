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
| Press | `GlassButton` | Clear or tinted glass button that swells under the pointer. |
| Merge | `GlassActionButton` | Async action button whose arrow droplet melts into the body. |
| Travel | `GlassTabs` / `GlassLens` | Segmented control whose active selection travels as a magnifying lens. |
| Flow | `GlassBadge` | Pill badge with live refracted backdrop text. |
| Drag | `GlassSlideToConfirm` | Slide-to-confirm control with spring snap-back. |
| Hold | `GlassCard` | Frosted/refractive glass card (`live` mode for moving backdrops). |
| Share | `GlassButtonGroup` | Related actions sharing one unified body of glass. |
| Open | `GlassDropdownMenu` | Menu that swells out of its trigger as one gooey body of glass. |
| Unfold | `GlassPopover` | Popover surface unfolding smoothly from its anchor. |
| Stretch | `GlassSelect` | Select listbox connected to its trigger on a stretching glass neck. |
| Base | `GlassLayer` / `GlassStyles` | Low-level WebGL2 glass surface and CSS fallback utilities. |

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
