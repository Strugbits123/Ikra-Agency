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

**CSS scroll-snap does not work here either**, and for exactly the same reason — the browser has no real scroll offset to snap to. `ScrollTrigger`'s own `snap` option does work (it drives `ScrollTrigger.scroll()` itself), but **nothing in this site snaps, deliberately**: a snap is a boundary cue, and the sections are supposed to read as one continuous page. The hero→definition hand-off is a cross-fade instead (see `DefinitionSection`). Full-page/one-section-per-viewport scrolling is off the table too: both scroll-driven sections need multiple viewports of scroll distance to play their sequences.

`position: fixed` **is also broken here**, and catches people out more than `sticky` does: a transformed ancestor becomes the containing block for fixed descendants, so anything `fixed` inside `#smooth-content` scrolls with the page instead of staying put. To pin something to the viewport for real, `createPortal` it to `document.body` — see the custom cursor in `HeroNarrative`.

`lib/gsap.ts` registers the `ScrollTrigger`/`ScrollSmoother` plugins once (guarded by `typeof window !== "undefined"`) and re-exports `gsap` alongside them — import from `@/lib/gsap`, not directly from `"gsap"`.

### The two scroll-driven components

- `components/HeroNarrative.tsx` — a `460vh` pinned section driven by one `ScrollTrigger.onUpdate`, split into six phases (documented in the component's docblock). Phase boundaries are written in **vh of actual scrolling**, not 0–1 fractions: `onUpdate` converts progress via `PIN_VH` first. Note `SECTION_VH = PIN_VH + 100` — because the pin runs `top top` → `bottom bottom`, progress 0→1 covers `height − 100vh`, so multiplying progress by the *section* height overstates real scroll by ~30%. The vh framing exists so dead scroll is visible: the last phase ends at 315vh and the pin runs to 360vh, i.e. 45vh of screen where scrolling does nothing. Keep that tail short — a long one reads as being stuck, and makes the release into the next section feel like a jolt. The phases are: a small centered clip shrinks away over the closed solid-orange "doors," the "growth creates a gap" copy fades up on the orange and back out, the doors open diagonally and **stop partway**, parking permanently as orange wedges in the bottom-left and top-right corners, then the wavy orange band and its closing line fade in bridging them. A separate, non-scroll GSAP timeline plays once on load (clip opens, headline fades in) before the scroll phases are allowed to run — gated by `introDoneRef` so the `onUpdate` that fires at `ScrollTrigger` creation doesn't snap the intro state early.
  - The doors' resting position is `DOOR_REST_X`/`DOOR_REST_Y` (fractions of the viewport) against a `DOOR_PANEL_W`-wide panel. `BAND_INSET` is *derived* from those rather than restated, so the band always lands exactly on the wedges' inner edges — adjust the rest position and the band follows. It insets 2px *less* than that edge so it tucks under each wedge and no rounding difference can show a hairline of background between the orange shapes. The panels stay oversized (`-top-1/4 h-[150%]`) because the diagonal drift would otherwise expose a panel's short edge.
  - `WavyBand` is a slim ribbon: one wave definition (`waveRun`) offset up and down by half the thickness produces both parallel edges, and the copy rides an SVG `<textPath>` along the same wave — which is what tilts each character tangent to it. It marquees right-to-left forever via a linear tween on the `startOffset` attribute, shifted by exactly one repetition of the phrase so the loop is seamless; that length is measured *after* `document.fonts.ready`, since a fallback-font measurement puts a visible jump in every repeat. Not scroll-driven — it keeps running through the scroll holds.
  - **The ribbon's ends must land exactly on the wedges' inner corners** — left cap's top edge on the left wedge's top edge, right cap's bottom edge on the right wedge's bottom edge. Anything less shows a notch, because the left wedge exists only *below* its top edge and the right one only *above* its bottom edge. This is why the centre line is a straight baseline between those two anchor points **plus a sine with a whole number of half-waves** (`humps`): `sin()` is then exactly zero at both ends, so amplitude, thickness and hump count can be retuned freely without ever moving the endpoints. Keep `humps` a whole number and keep `startY`/`endY` derived from the wedge edges. A dev-only assertion in `bandGeometry` fires if either breaks.
  - The band's vertical extent is *solved*, not sampled: because the baseline tilts, the wave's extremes are not `baseline ± amplitude`, so `bandGeometry` finds the turning points from `cos(ωx) = slope/(A·ω)`. A sampled scan undershoots by a fraction of a pixel and clips the sharpest crest.
  - Amplitude is held to 15–25px for a gentle wave, with a second ceiling from the tilt budget: glyphs rotate with the path, so past roughly 40° they push out through the ribbon's edges. That ceiling only binds on a narrow phone span. If you widen the wave, shorten the span, or raise `DOOR_REST_X`, re-check it.
- `components/DefinitionSection.tsx` — a `360vh` pinned section (`PIN_VH = 260`, same vh-of-real-scroll convention and the same `SECTION_VH = PIN_VH + 100` caveat as the hero). The statement leaves, then a round window opens over a photo, the "ikra." wordmark slides left, and the dictionary definition travels up the right-hand side into the composition beside it. After the statement, **everything runs concurrently from 50vh** — see the component docblock for the phase table.
  - **The photo does not scale; the window does.** The photo is a `100vw × 100vh` `object-cover` layer *inside* the round mask, counter-scaled by exactly `1/s` against the mask's own scale every frame (`placePhoto`), so it is full-bleed and pin-sharp from the first frame and the growing circle merely uncovers more of it. Scaling the mask with the photo inside it instead — the original approach — magnified a circle-sized photo ~6× past its rendered resolution. This is also why `sizes` is `100vw`: the element genuinely is.
  - `maxScale` is the farthest viewport-corner distance from the circle's measured centre, plus a 15% margin. Coverage therefore always lands at ~85% of the growth window, whatever its length — that ratio is the knob if the fade timing has to change. The fade currently starts at the growth's *midpoint*, i.e. **deliberately before coverage**, leaving 20–34% of the screen gray so the photo blooms and dissolves rather than sitting full-bleed.
  - The hero→definition seam is dissolved by **a gradient strip this section owns that extends 100vh above its own top edge** and paints over the hero's tail (`z-40`, because the hero's layers reach `z-30` and its section establishes no stacking context). Transparent at the top, `--color-gray` at the bottom where it meets this section's background, so neither edge is visible. It replaced a snap-only `handoff` trigger that tried to rush past the seam rather than remove it.
  - Paint order in the stacked composition is plain tree order — circle, wordmark, definition — held together by both the circle and the wordmark being `relative`. Neither may take a `z-index`: positioned siblings paint above non-positioned ones regardless of DOM order, so making one positioned and not the other silently reverses them, and the definition has to stay above the wordmark where they overlap on a phone.

Both components check `prefers-reduced-motion` on mount and skip registering any `ScrollTrigger` when it's set, rendering a static end-state instead (`DefinitionSection`'s reduced-motion path even switches its section `height` to `"auto"` since there's no pin to reserve scroll distance for). Any new scroll-driven section needs the same fallback.

### Non-obvious GSAP gotchas (see README.md for full detail)

- Tweening `scale` (or any transform property) overwrites the entire inline `transform`, silently wiping Tailwind translate-centering classes (`-translate-x-1/2 -translate-y-1/2`) the instant it runs. Center via `xPercent`/`yPercent` in the same GSAP call instead.
- Don't measure an element that starts `scale-0` with `getBoundingClientRect()` — it reports `0×0` post-transform. Use `getComputedStyle(el).width/height`.
- GSAP's ticker pauses when the tab is hidden/unfocused; animations that look "stuck" in a background tab or headless screenshot are expected, not a bug.

### Styling

Tailwind CSS v4 with CSS-first config — there is no `tailwind.config.js`. Design tokens (`--color-ink`, `--color-accent`, `--color-cream`, `--color-gray`) live in `app/globals.css` under `:root` and are re-exposed to utility classes (`bg-accent`, `text-ink/70`, ...) via `@theme inline`. Add new tokens there. The variable font (`app/fonts.ts`, Zalando Sans SemiExpanded via `next/font/local`) is wired to `--font-sans` in the same block.

### Path aliases

`@/*` resolves to the repo root (`tsconfig.json`), e.g. `@/components/Logo`, `@/lib/gsap`.
