import type { RefObject } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { measureCases, type CaseMeasure } from "./measure";
import {
  MQ,
  PRE_STAGGER,
  RISE_EASE,
  RISE_END_VW,
  RISE_PCT,
  SCRUB,
} from "./timeline";

/**
 * The pinned horizontal track.
 *
 * ## Why the pin is GSAP's, and why nothing here is `sticky`
 *
 * `app/layout.tsx` wraps the page in ScrollSmoother, which fakes scrolling with a transform
 * on `#smooth-content`. Under a transformed ancestor `position: sticky` never engages and
 * `position: fixed` scrolls with the page, so the only thing that can hold this stage still
 * is ScrollTrigger's own `pin`.
 *
 * Unlike the hero and the definition section this uses `pin: true` with GSAP's own pin
 * *spacing* rather than `pinSpacing: false` against a hand-written section height. Both are
 * correct; this one belongs here because the pin's length is not a design figure at all — it
 * is the track's measured overflow, so letting ScrollTrigger reserve exactly that keeps one
 * source of truth in `end` instead of splitting it between a trigger and a stylesheet.
 *
 * ## Two clocks, and they cannot be collapsed
 *
 * The pin drives the traverse. A second, smaller trigger drives the section's vertical
 * approach, and it has to exist separately because it runs *before* the pin does — the pin
 * does not start until this section's top edge reaches the viewport top, and the approach
 * happens while that edge is still crossing the screen.
 *
 * They are not two clocks over one moment, which is this repo's most expensive recurring
 * bug. They are two *positions* feeding one paint: the rise reads the lesser of the two
 * approaches, so whichever is behind is in charge and neither can drift against the other.
 * There is one paint function, and every value it writes is a pure function of the pair —
 * paint the same pair twice and you get the same frame.
 *
 * ## What is deliberately absent
 *
 * No inner-image parallax, no card scale, no scrim, no per-line stagger, no exit animation.
 * Each was measured *out* of the reference rather than left out — see the head of ./timeline
 * for the frame evidence. The traverse plus one rise per cell is the whole section.
 */
export type CaseRefs = {
  /** The element that pins: one viewport, clipping the track either side. */
  stage: RefObject<HTMLDivElement | null>;
  /** The flex row that translates. Its overflow is the pin's whole length. */
  track: RefObject<HTMLDivElement | null>;
  /** The cells, in DOM order: heading, one per project, then the closing panel. */
  cells: RefObject<(HTMLElement | null)[]>;
  /** Each cell's content block — the thing that rises. One per cell, same order. */
  contents: RefObject<(HTMLElement | null)[]>;
  /** The section itself, which the approach trigger watches. */
  section: RefObject<HTMLElement | null>;
};

const clamp01 = gsap.utils.clamp(0, 1);

export function createCaseSequence(refs: CaseRefs) {
  const mm = gsap.matchMedia();

  mm.add(MQ, () => {
    const stage = refs.stage.current;
    const track = refs.track.current;
    const section = refs.section.current;
    if (!stage || !track || !section) return;

    const contents = refs.contents.current;
    const rise = gsap.parseEase(RISE_EASE);

    let m: CaseMeasure = measureCases(refs);
    // The section's vertical approach, 0 while it is a screen below and 1 as its top edge
    // lands at the viewport top — which is the same instant the pin engages, so the two
    // hand over with no gap and no overlap.
    let approach = 0;
    // The traverse, 0 at the frame the pin engages and 1 when the track's right edge
    // reaches the viewport's right edge.
    let traverse = 0;

    // Normalised so that every cell still reaches a full 1 by the end of the approach, and
    // only the order in which they get there is staggered.
    const spread = 1 + PRE_STAGGER * Math.max(0, m.cellLeft.length - 1);

    /** One frame, from the two positions. */
    const paint = () => {
      const V = m.viewportW;
      const d = traverse * m.distance;

      gsap.set(track, { x: -d, force3D: true });

      for (let i = 0; i < m.cellLeft.length; i++) {
        const left = m.cellLeft[i] - d;

        // The horizontal approach: begins as the cell's left edge crosses the viewport's
        // right edge, completes at RISE_END_VW. Clamped at both ends, so a cell parked
        // either side of its window holds the endpoint pose rather than running past it.
        const horizontal = clamp01((V - left) / (V * (1 - RISE_END_VW)));
        // The vertical approach, staggered by cell — see PRE_STAGGER.
        const vertical = clamp01(approach * spread - i * PRE_STAGGER);

        // The lesser of the two is in charge. Before the pin the track cannot move, so the
        // cells already on screen would read a finished horizontal approach and appear with
        // no entrance at all; after it, `vertical` is 1 and the traverse has sole charge.
        gsap.set(contents[i], {
          yPercent: RISE_PCT * (1 - rise(Math.min(horizontal, vertical))),
          force3D: true,
        });
      }
    };

    // A proxy tween, and it is not ceremony: a numeric `scrub` is implemented as a tween on
    // the *animation's* progress, so a trigger with only an `onUpdate` and no animation gets
    // no smoothing at all and receives the raw, stepped scroll position. Driving one scalar
    // and painting from its `onUpdate` is what makes SCRUB mean what it says.
    //
    // It also rules out `invalidateOnRefresh`, which would be wrong here rather than merely
    // unnecessary: invalidating re-records a tween's start value from wherever the target
    // currently is, so a refresh at half-scroll would leave this running 0.5 → 1 over the
    // whole pin. Nothing here is a function-based tween value — the measurements are re-read
    // in `onRefreshInit`, and the pin's length is a function in `end`, which is re-evaluated
    // on every refresh regardless.
    const proxy = { p: 0 };
    const driver = gsap.to(proxy, {
      p: 1,
      duration: 1,
      ease: "none",
      paused: true,
      onUpdate: () => {
        traverse = proxy.p;
        paint();
      },
    });

    // The approach. Ends exactly where the pin begins, and scrubbed rather than cued so it
    // cannot be caught half-played by a fast scroll.
    ScrollTrigger.create({
      trigger: section,
      start: "top bottom",
      end: "top top",
      scrub: true,
      onUpdate(self) {
        approach = self.progress;
        paint();
      },
      // `onUpdate` does not fire once the reader is past the window, so the terminal values
      // are written here. Without these the row would hold its last in-window pose for the
      // whole of the traverse.
      onLeave() {
        approach = 1;
        paint();
      },
      onLeaveBack() {
        approach = 0;
        paint();
      },
    });

    if (m.distance > 0) {
      ScrollTrigger.create({
        trigger: stage,
        start: "top top",
        // The track's overflow, in px, so one px of scrolling is one px of travel — the
        // reference's own relation. A function, so a resize, a rotation or a collapsing
        // mobile URL bar reserves the right distance on the next refresh;
        // `onRefreshInit` below re-reads `m` before ScrollTrigger evaluates this.
        end: () => `+=${m.distance}`,
        pin: true,
        pinSpacing: true,
        scrub: SCRUB,
        // Engages the pin a frame early, which stops a smooth-scrolled page showing a
        // one-frame jump as the stage changes over to being pinned.
        anticipatePin: 1,
        animation: driver,
        // Every figure the paint uses is viewport-relative, so a resize invalidates all of
        // them — and a refresh does not imply a scroll event, so without the repaint the
        // track would hold its pre-resize geometry until the reader next moved.
        onRefreshInit() {
          m = measureCases(refs);
        },
        onRefresh() {
          traverse = driver.progress();
          paint();
        },
      });
    }

    // The first frame, so the resting composition is correct before any scrolling.
    paint();
  });

  // Reverts every breakpoint's tweens and start states and disconnects the media queries.
  // The whole cleanup.
  return () => mm.kill(true);
}
