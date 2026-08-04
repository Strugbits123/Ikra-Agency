# ikra — rebranding agency site

Single-page marketing site for **ikra**, a rebranding agency. Built with Next.js (App Router), Tailwind CSS v4, and GSAP (ScrollTrigger + ScrollSmoother) for the scroll-driven sequences.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4** (CSS-first config via `@theme` in `app/globals.css` — no `tailwind.config.js`)
- **GSAP 3.15** — `ScrollTrigger`, `ScrollSmoother`. All plugins are free since Webflow's GSAP acquisition; nothing here needs a Club GreenSock license.
- `next/font/local` for the Zalando Sans SemiExpanded variable font (`app/fonts.ts`)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Structure

```
app/
  layout.tsx          Wraps everything in <SmoothScrollProvider>
  page.tsx             HeroNarrative → DefinitionSection → Footer
  fonts.ts             next/font/local config for Zalando Sans
  globals.css          Tailwind v4 @theme tokens (--color-ink, --color-accent, etc.)
components/
  SmoothScrollProvider.tsx   ScrollSmoother wrapper (#smooth-wrapper / #smooth-content)
  HeroNarrative.tsx    Hero: a rectangular hole onto fixed-size footage opens
                       on load then collapses on scroll, orange "doors" open
                       diagonally but stop partway as corner wedges, slim wavy
                       orange ribbon draws in right-to-left bridging them,
                       copy marqueeing along the wave
  DefinitionSection.tsx  Editorial statement + giant "ikra." wordmark whose
                         photo "dot" grows into a full-screen circle reveal
  Logo.tsx             "ikra." wordmark, recoloured via CSS mask
  Footer.tsx
lib/
  gsap.ts              Registers ScrollTrigger + ScrollSmoother once
  useRevealOnView.ts   IntersectionObserver fade-in-on-scroll hook
public/
  fonts/, img/, video/
```

## ⚠️ The one thing that will trip you up: CSS `sticky` does not work here

`position: sticky` **does not function** anywhere inside `<SmoothScrollProvider>`. Every pinned/sticky-looking effect in this codebase (`HeroNarrative`, `DefinitionSection`) uses GSAP's `ScrollTrigger` `pin` option instead. If you reach for the `sticky` class for a new section, it will silently do nothing.

**Why:** ScrollSmoother doesn't use the browser's native scroll. It keeps `#smooth-wrapper` at `position: fixed; overflow: hidden` and fakes scrolling by applying a CSS `transform: translate3d(...)` to `#smooth-content`. `position: sticky` computes itself relative to the nearest ancestor with a scroll container — that becomes `#smooth-wrapper` — but that element's own scroll offset never changes (only its child's *transform* does), so `sticky` has nothing to react to.

**The pattern to copy** (see `HeroNarrative.tsx` or `DefinitionSection.tsx`):

```tsx
const sectionRef = useRef<HTMLElement>(null); // outer <section>, sets scroll distance via style={{height: "300vh"}}
const stageRef = useRef<HTMLDivElement>(null); // the element you want "stuck"

useEffect(() => {
  const trigger = ScrollTrigger.create({
    trigger: sectionRef.current,
    start: "top top",
    end: "bottom bottom",
    scrub: 1,
    pin: stageRef.current,     // <- pins this element, not the trigger
    pinSpacing: false,          // <- the outer section already reserves scroll
    onUpdate(self) { /* self.progress: 0–1 across the pin */ },
  });
  return () => trigger.kill();
}, []);
```

- `pinSpacing: false` because the outer `<section>` already has an explicit `height` (e.g. `300vh`) that reserves the scroll distance. Leaving `pinSpacing` at its default (`true`) would insert *additional* space on top of that.
- Give the pinned element `relative` (not `sticky`) in its className — it's just there so `next/image fill` and absolutely-positioned children have something to resolve against before/without the pin.
- Always add a `reducedMotion` fallback that skips the `ScrollTrigger` entirely and just renders the end state, since these pins are the main way content becomes visible in these sections.

## Other non-obvious things

- **GSAP's `scale` (and any transform property) overwrites the *entire* inline `transform` style.** If an element is centered via Tailwind's `-translate-x-1/2 -translate-y-1/2`, the moment GSAP touches `scale` on that element it silently wipes the translate-based centering (inline styles fully replace whichever CSS rule wins, not just the property you touched). Fix: center via GSAP's own `xPercent: -50, yPercent: -50` in the same `gsap.set`/`gsap.to` call instead of Tailwind's translate classes, so GSAP's internal transform cache always includes it.
- **Don't measure a scaled-to-0 element with `getBoundingClientRect()`.** Elements that start hidden via a `scale-0` class (to avoid a flash-of-unstyled-content before the entrance animation runs) report `0×0` from `getBoundingClientRect()`, since it returns the *post-transform, on-screen* size. Use `getComputedStyle(el).width/height` instead — it reflects the underlying layout box and ignores `transform` entirely. The live example is `DefinitionSection.tsx`, which reads the circle's resting diameter that way before scaling it up.
- **GSAP's ticker (and therefore any scrub/tween) pauses when the tab isn't visible/focused** (`document.hidden`). Don't be alarmed if animations appear "stuck" in a background tab or an automated screenshot tool — that's expected, not a bug.
- **Background footage is still a placeholder.** `HeroNarrative.tsx` has a `BACKGROUND_VIDEO_SRC` constant (currently `null`, falling back to a still image). Drop the real footage in `public/video/` and set the constant — the `<video>` markup is already wired with `autoPlay muted loop playsInline` and the still as its poster, so no other changes are needed.
- **Possible mobile overflow to check:** at narrow viewports, the giant "ikra." wordmark in `DefinitionSection` may render wider than the screen (flagged but not yet fixed — the circle-growth math self-corrects regardless, so it's a visual/layout concern, not a functional one).
