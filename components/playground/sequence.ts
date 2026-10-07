import type { RefObject } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { CLIMB, CLIMB_EASE, HEADER_EXIT, HEADER_EXIT_EASE } from "./timeline";

export type SequenceEls = {
  /** Pinned by the ScrollTrigger: one viewport, holding every layer. */
  stage: HTMLDivElement;
};

export type SequenceRefs = {
  /** The copy block. */
  copy: RefObject<HTMLDivElement | null>;
  /** The header lockup, which leaves with it — see HEADER_EXIT. */
  header: RefObject<HTMLElement | null>;
};

/**
 * The section's one scroll-driven sequence: a pin, and a single per-frame paint that places
 * the copy. Beat map in ./timeline.
 *
 * A plain function, not a hook — the caller owns the effect, and everything created here is
 * collected by the returned context.
 *
 * There is only one clock, which is worth saying out loud because this repo's most expensive
 * recurring bug is two of them over one shared moment. The copy and the header both hang off
 * this one, so they cannot drift apart however fast the reader scrolls. The river does not
 * move at all (it is measured stationary in the viewport across the whole reference clip) and
 * its marquee is deliberately independent of scroll, so there is no moment left for a second
 * clock to drift against.
 *
 * Only the wide layout builds this. Where the river is the narrow one the copy is a band under
 * the stage and nothing scrolls — see `PlaygroundNarrative`.
 */
export function createPlaygroundSequence(
  section: HTMLElement,
  els: SequenceEls,
  refs: SequenceRefs,
) {
  const { stage } = els;

  return gsap.context(() => {
    const { travelFrac, climbVh, pinVh } = CLIMB;

    /**
     * Where the block rests and how far it has to come, both measured rather than stated.
     *
     * The order is: solve where *centred* would be, since that is the composition every
     * figure here was measured against — the block is laid out at the stage's top edge (see
     * PlaygroundCopy for why it cannot centre itself), so half the leftover height is the
     * offset that centres it, and the full travel follows from the block starting with its
     * top edge on the fold, a whole stage height down. Then take CLIMB_TRAVEL_FRAC of that
     * travel and let `restY` fall out of it, rather than the other way round: the fraction is
     * a share of a measured distance, so stating a resting position instead would need the
     * same measurement done twice and could drift from it.
     *
     * At a fraction of 1 this is exactly the centred original — `restY` collapses back to
     * `centredY`. Below it the block rests lower, and below the fraction the assertion works
     * out it hangs past the fold; see CLIMB_TRAVEL_FRAC.
     *
     * Read once per refresh rather than per frame: this paints on every scroll event and
     * ticker tick, and on a phone the address bar collapsing changes `stage.offsetHeight`
     * mid-scroll, so a live read would multiply a moving progress by a moving height and
     * show as flicker. Same reasoning as `definition/measure`'s `statementLiftPx`.
     */
    const m = { restY: 0, travel: 0, headerTravel: 0 };
    const measure = () => {
      const copy = refs.copy.current;
      const stageH = stage.offsetHeight;
      const blockH = copy?.offsetHeight ?? 0;
      const centredY = (stageH - blockH) / 2;
      m.travel = (stageH - centredY) * travelFrac;
      m.restY = stageH - m.travel;
      // Far enough that the lockup's last pixel clears the top edge, not just its first.
      // `offsetHeight` already includes the header's own top padding, so this is the whole
      // distance from the viewport's top edge to the bottom of the descriptor.
      m.headerTravel = refs.header.current?.offsetHeight ?? 0;

      if (process.env.NODE_ENV !== "production") {
        // A block taller than the stage can never be wholly on screen, wherever it rests —
        // at a full climb it is clipped at both ends at once. A real possibility on a short
        // wide window, where the column is narrow and the type is still sized off the width.
        //
        // Deliberately still the *stage* it is checked against and not the resting position:
        // below CLIMB_TRAVEL_FRAC ~0.65 the block is meant to hang past the fold, so a check
        // on how much of it shows would fire on the intended composition.
        if (blockH > stageH) {
          console.error(
            `[Playground] the copy is ${Math.round(blockH)}px tall against a ` +
            `${Math.round(stageH)}px stage, so it cannot be wholly on screen at any ` +
            "resting position. Shorten the copy, or cap its size against the height the " +
            "way CARD_MAX_VH does.",
          );
        } else if (m.travel < blockH) {
          // The complaint this section was retuned for, stated against the boxes rather than
          // the constant: the climb has to cover at least the block's own height or its foot
          // is still below the fold when the composition is supposed to be assembled — and
          // HOLD_VH then holds the reader on a cut-off paragraph. The fraction that clears it
          // is 2·blockH / (stageH + blockH), which moves with reflow, so it is worked out here
          // rather than written down next to CLIMB_TRAVEL_FRAC.
          const needed = (2 * blockH) / (stageH + blockH);
          console.error(
            `[Playground] the copy rests with ${Math.round(blockH - m.travel)}px of itself ` +
            `below the fold: a ${travelFrac} climb covers ${Math.round(m.travel)}px against ` +
            `a ${Math.round(blockH)}px block. Raise CLIMB_TRAVEL_FRAC to at least ` +
            `${needed.toFixed(2)} at this viewport, or shorten the copy.`,
          );
        }
      }
    };
    measure();

    /** One frame, from the pin's progress. Named so a re-measure can repaint at it too. */
    const render = (progress: number) => {
      // Progress as real scroll distance through the pin, in vh — the pin runs
      // `top top → bottom bottom`, so progress 0→1 covers `height − 100vh`.
      const vh = progress * pinVh;
      const climbRaw = gsap.utils.clamp(0, 1, vh / climbVh);
      const climbP = CLIMB_EASE(climbRaw);
      gsap.set(refs.copy.current, {
        y: m.restY + (1 - climbP) * m.travel,
        // The block ships hidden (see PlaygroundCopy) and is lit here rather than in its own
        // effect, so it becomes visible on the same write that first puts it somewhere — there
        // is no frame where it is both shown and unplaced.
        opacity: 1,
        force3D: true,
      });

      // The header rides the same clock over a window near the end of the climb, so the two
      // are one coupled gesture in both directions — see HEADER_EXIT. Off the *raw* climb
      // rather than the eased one: the window is a position in the copy's travel, and easing
      // it twice would move where it fires.
      const [from, to] = HEADER_EXIT;
      const headerP = HEADER_EXIT_EASE(
        gsap.utils.clamp(0, 1, (climbRaw - from) / (to - from)),
      );
      gsap.set(refs.header.current, {
        y: -headerP * m.headerTravel,
        force3D: true,
      });
    };

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "bottom bottom",
      /**
       * **`true`, not a number, and that is load-bearing here rather than a taste.**
       *
       * A numeric `scrub` eases `self.progress` toward the scroll over that many seconds, so
       * the painted climb lags the scroll — but the *pin* is not scrubbed, it tracks the raw
       * scroll and releases the instant the section's bottom edge reaches the fold. Two clocks
       * over one moment, which is this repo's most expensive recurring bug (the hero's wash,
       * its door close, DefinitionSection's wordmark slide), and it drifts by exactly the
       * reader's speed.
       *
       * It cost the whole point of the section. Measured through one continuous flick at
       * 1440x900, the copy was still at 335 — a viewport's own height short of its resting 289
       * — on the frame the pin let go, and was then carried past centre and off the top at page
       * speed. The composition never assembled; what the reader saw was the section being
       * taken away mid-climb while the next one rose over it. Slow, stepped scrolling hid it
       * completely, because the lag has time to settle between notches.
       *
       * `scrub: true` puts both on one clock, so the copy parks exactly as the section begins
       * to leave at every scroll rate. Nothing is lost in smoothness: ScrollSmoother already
       * eases the scroll position ScrollTrigger reads (`smooth: 1.2`), so the input to this is
       * a smoothed value, not raw wheel steps — a second ease on top of it only buys lag.
       */
      scrub: true,
      pin: stage,
      // The section states its own height (CLIMB.sectionVh), so ScrollTrigger must not
      // reserve a second copy of it — same as the hero's and DefinitionSection's pins, and
      // unlike CaseStudies', whose length is measured rather than designed.
      pinSpacing: false,
      onUpdate: (self) => render(self.progress),
      onRefresh: (self) => {
        measure();
        render(self.progress);
      },
    });

    // The webfont landing reflows the copy and changes its height, which moves both figures
    // above. Nothing else would put the block back in register — a scrub does not paint until
    // the reader moves.
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      measure();
      render(trigger.progress);
    });

    // Resting state for a restored scroll position, for the same reason.
    render(trigger.progress);

    return () => {
      cancelled = true;
    };
  });
}
