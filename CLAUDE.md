# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — start dev server at http://localhost:3000
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`)

There is no test suite in this repo.

## Architecture

Single-page Next.js 16 (App Router) marketing site. There is one route (`app/page.tsx`), which renders three sections in order: `HeroNarrative` → `DefinitionSection` → `Footer`. Nearly all of the complexity lives in the two scroll-driven sections; everything else is static markup.

### Scroll system: ScrollSmoother + GSAP pin, never CSS `sticky`

`app/layout.tsx` wraps the whole app in `components/SmoothScrollProvider.tsx`, which creates a GSAP `ScrollSmoother` over `#smooth-wrapper` / `#smooth-content`. ScrollSmoother fakes scrolling with a `transform: translate3d` on `#smooth-content` rather than native scroll, which means **`position: sticky` does not work anywhere in this app**. Any pinned/sticky-looking effect must use `ScrollTrigger.create({ pin: <el>, pinSpacing: false, scrub: 1 })` instead — see `HeroNarrative.tsx` or `DefinitionSection.tsx` for the pattern to copy, and README.md's "The one thing that will trip you up" section for the full explanation of why.

`lib/gsap.ts` registers the `ScrollTrigger`/`ScrollSmoother` plugins once (guarded by `typeof window !== "undefined"`) and re-exports `gsap` alongside them — import from `@/lib/gsap`, not directly from `"gsap"`.

### The two scroll-driven components

- `components/HeroNarrative.tsx` — a `600vh` pinned section driven by one `ScrollTrigger.onUpdate` whose `self.progress` (0–1) is split into six phases (documented in the component's docblock): a small centered clip shrinks away over the closed solid-orange "doors," the "growth creates a gap" copy fades up on the orange and back out, the doors open diagonally and **stop partway**, parking permanently as orange wedges in the bottom-left and top-right corners, then the wavy orange band and its closing line fade in bridging them. A separate, non-scroll GSAP timeline plays once on load (clip opens, headline fades in) before the scroll phases are allowed to run — gated by `introDoneRef` so the `onUpdate` that fires at `ScrollTrigger` creation doesn't snap the intro state early.
  - The doors' resting position is `DOOR_REST_X`/`DOOR_REST_Y` (fractions of the viewport) against a `DOOR_PANEL_W`-wide panel. `BAND_INSET` is *derived* from those rather than restated, so the band always lands exactly on the wedges' inner edges — adjust the rest position and the band follows. It insets 2px *less* than that edge so it tucks under each wedge and no rounding difference can show a hairline of background between the orange shapes. The panels stay oversized (`-top-1/4 h-[150%]`) because the diagonal drift would otherwise expose a panel's short edge.
  - `WavyBand` generates its outline as an SVG path from a `ResizeObserver`-measured box rather than stretching a fixed `viewBox` with `preserveAspectRatio="none"`, so wave wavelength stays constant across viewports and regenerates when the copy wraps. Its per-character text wave is a separate infinite tween on its own timeline — it is not scroll-driven and keeps running through the scroll holds. The band's vertical padding is deliberately deeper than the wave troughs plus the character rise, which is what actually guarantees the text can never escape the shape.
- `components/DefinitionSection.tsx` — a `300vh` pinned section where a circular image mask (the "ikra." wordmark's dot) scales up to a computed `maxScale` — the farthest viewport-corner distance from the circle's center, with a 15% margin — until it covers the full viewport and releases into the footer.

Both components check `prefers-reduced-motion` on mount and skip registering any `ScrollTrigger` when it's set, rendering a static end-state instead (`DefinitionSection`'s reduced-motion path even switches its section `height` to `"auto"` since there's no pin to reserve scroll distance for). Any new scroll-driven section needs the same fallback.

### Non-obvious GSAP gotchas (see README.md for full detail)

- Tweening `scale` (or any transform property) overwrites the entire inline `transform`, silently wiping Tailwind translate-centering classes (`-translate-x-1/2 -translate-y-1/2`) the instant it runs. Center via `xPercent`/`yPercent` in the same GSAP call instead.
- Don't measure an element that starts `scale-0` with `getBoundingClientRect()` — it reports `0×0` post-transform. Use `getComputedStyle(el).width/height`.
- GSAP's ticker pauses when the tab is hidden/unfocused; animations that look "stuck" in a background tab or headless screenshot are expected, not a bug.

### Styling

Tailwind CSS v4 with CSS-first config — there is no `tailwind.config.js`. Design tokens (`--color-ink`, `--color-accent`, `--color-cream`, `--color-gray`) live in `app/globals.css` under `:root` and are re-exposed to utility classes (`bg-accent`, `text-ink/70`, ...) via `@theme inline`. Add new tokens there. The variable font (`app/fonts.ts`, Zalando Sans SemiExpanded via `next/font/local`) is wired to `--font-sans` in the same block.

### Path aliases

`@/*` resolves to the repo root (`tsconfig.json`), e.g. `@/components/Logo`, `@/lib/gsap`.
