"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { CaseTrack } from "./cases/CaseLayers";
import { createCaseSequence } from "./cases/sequence";

/**
 * The case studies: a pinned stage across which a horizontal track travels right-to-left as
 * the reader scrolls down. The track is the heading, one cell per project, and a closing
 * call-to-action — all the same width, all sliding together.
 *
 * Assembled from five parts, so only one of them knows about position:
 *
 *   ./cases/projects   the typed content, and the only file to edit for it
 *   ./cases/timeline   every number, each one measured off the reference recording
 *   ./cases/measure    the layout figures every frame is computed against
 *   ./cases/sequence   the matchMedia, the pin, the approach, and the one paint
 *   ./cases/CaseLayers the track and its cells, driven purely through refs
 *
 * This file is only refs, effects and markup: no timing and no math.
 *
 * **Nothing here touches the hero or the definition section.** It is a sibling in
 * `app/page.tsx` with its own triggers and its own pin, so the existing sequences are
 * untouched by construction rather than by care.
 *
 * Reduced motion builds no ScrollTrigger and renders a static end state: the heading, the
 * projects and the closing panel as one plain vertical column, with no pin to reserve
 * distance for.
 */

/**
 * `useLayoutEffect` where it exists, `useEffect` on the server.
 *
 * GSAP wants the layout effect, and here it is what removes the need for any start state in
 * the markup: the sequence paints its resting frame before the browser paints at all, so
 * there is never a commit showing the cells untransformed. In a passive effect that frame
 * would be visible. React warns about `useLayoutEffect` during SSR, hence the swap rather
 * than a bare import.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * The motion preference, read as an external store rather than into state from an effect.
 *
 * The other two sections do the latter, and it is the one convention here worth breaking: a
 * `setState` in an effect body is what `react-hooks/set-state-in-effect` objects to — those
 * call sites are the whole of this repo's lint error count — and it needs a second `mounted`
 * flag to paper over the commit where the value is still wrong. This is correct on the first
 * render after hydration and tracks a visitor changing the setting.
 *
 * Module scope because both callbacks must be referentially stable, or the store resubscribes
 * on every render.
 */
const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (onChange: () => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const readMotion = () => window.matchMedia(REDUCED).matches;
// No `window` on the server, and the animated path is the honest default there.
const readMotionOnServer = () => false;

export default function CaseStudies() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLElement | null)[]>([]);
  const contentRefs = useRef<(HTMLElement | null)[]>([]);

  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    readMotion,
    readMotionOnServer,
  );

  useIsomorphicLayoutEffect(() => {
    if (reducedMotion) return;
    // Cleanup is `mm.kill(true)`: it reverts every breakpoint's tweens and start states and
    // disconnects the media queries, so an unmount or a Fast Refresh cannot leave a duplicate
    // ScrollTrigger behind. Returned rather than a context because matchMedia already *is* a
    // set of contexts — see createCaseSequence.
    return createCaseSequence({
      section: sectionRef,
      stage: stageRef,
      track: trackRef,
      cells: cellRefs,
      contents: contentRefs,
    });
  }, [reducedMotion]);

  // The two writers handed down to the cells. Stable, so a cell's `ref` callback is not a new
  // function on every render — React would otherwise detach and reattach every one of them.
  // Declared here because this is where the arrays are declared: writing to a ref that arrived
  // as a prop is what `react-hooks/immutability` objects to, and rightly.
  const registerCell = useCallback((i: number, el: HTMLElement | null) => {
    cellRefs.current[i] = el;
  }, []);
  const registerContent = useCallback((i: number, el: HTMLElement | null) => {
    contentRefs.current[i] = el;
  }, []);

  const track = (
    <CaseTrack
      trackRef={trackRef}
      registerCell={registerCell}
      registerContent={registerContent}
      reducedMotion={reducedMotion}
    />
  );

  /* The reference's stage is a light field with a faint top-to-bottom gradient. Its exact
     range (#fcfcfc → #d5d5d5) is not usable verbatim here: the definition section above ends
     on this site's flat `--color-gray`, so opening at near-white would put a hard band across
     the seam. The gradient keeps the reference's direction and its subtlety, anchored to the
     token the previous section ends on so the boundary stays invisible. */
  const field = "bg-linear-to-b from-gray to-[#cfcece]";

  if (reducedMotion) {
    return (
      <section ref={sectionRef} className={`relative w-full ${field}`}>
        {track}
      </section>
    );
  }

  return (
    /* No height of its own: the pin reserves its own distance (`pinSpacing: true`), and that
       distance is the track's measured overflow. Writing a height here as well would split one
       source of truth across two files — the opposite trade to the two existing sections,
       which need `pinSpacing: false` against a stated height.

       No `overflow` here either, deliberately. The clipping the track needs is on the stage
       below; putting `overflow-hidden`/`clip` on this element instead risks making it a scroll
       container, which is not something to hand a pinned subtree under ScrollSmoother. */
    <section ref={sectionRef} className={`relative w-full ${field}`}>
      {/* The element GSAP pins: exactly one viewport. `overflow-hidden` is load-bearing rather
          than decorative — it is the frame the track travels across, and what hides every cell
          not yet arrived and every cell already gone. */}
      <div
        ref={stageRef}
        className="relative h-screen w-full overflow-hidden"
      >
        {track}
      </div>
    </section>
  );
}
