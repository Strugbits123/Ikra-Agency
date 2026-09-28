"use client";

import type { RefObject } from "react";
import ArrowLink from "../ArrowLink";
import Logo from "../Logo";
import { LOGO_DOTS, MARK_WIDTH } from "./dots";
import { STATEMENT_LIFT_VH, VEIL_OVERHANG_PX, VEIL_VH } from "./timeline";

/**
 * The static layers of the pinned stage. None of them holds any timing — every one
 * is driven from ./sequence through the ref it is handed.
 */

/**
 * The round window's resting diameter — written once and used for both axes, since a
 * circle whose width and height could drift apart is an ellipse waiting to happen.
 *
 * Term for term MARK_WIDTH's, scaled by 19/29 so the wordmark's 1.5× overhang holds at
 * every width including through the crowding cap. See the Composition docblock.
 */
const CIRCLE_SIZE = "max(160px, min(19vw, 35vh, 340px, 38vw - 262px))";

/**
 * The veil: a slab of this section's own gray reaching VEIL_VH *above* its top
 * edge, so it blankets the whole viewport for the entire hand-off out of the hero.
 * Its opacity is scrubbed by `veilTrigger`; flat gray, not a gradient, so the
 * dissolve is uniform and in place rather than a wash sweeping up the screen.
 *
 * Sizing it rather than pinning it is what removes the "two sections at once"
 * problem: across that whole range the viewport is covered by veil above and this
 * section's identical `bg-gray` below, so there is no scroll position where a
 * boundary is visible. A `fixed` overlay would have been the obvious way to blanket
 * the screen, but `fixed` does not work inside ScrollSmoother's transformed
 * #smooth-content.
 *
 * z-40 because HeroNarrative's layers go up to z-30 and its section never
 * establishes a stacking context, so those z-indexes compete directly with this one.
 * The stage then has to beat it.
 *
 * Only rendered when motion is allowed: under reduced motion the hero collapses to
 * 100vh and this would gray it out permanently.
 */
export function Veil({ veilRef }: { veilRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div
      ref={veilRef}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-40 bg-gray opacity-0"
      style={{
        top: `-${VEIL_VH}vh`,
        // Overhangs rather than stopping on the edge — see VEIL_OVERHANG_PX.
        height: `calc(${VEIL_VH}vh + ${VEIL_OVERHANG_PX}px)`,
      }}
    />
  );
}

/**
 * The editorial statement.
 *
 * GSAP drives `y` on the outer wrapper for the exit and on the element inside it
 * for the entrance, so the two compose instead of one clobbering the other.
 *
 * `items-start` on the grid row keeps this hugging its text rather than stretching
 * to fill it, which matters beyond looks: `statementTravel` is measured from this
 * element's bottom edge, and a stretched box would send the statement flying further
 * than it needs to.
 */
export function Statement({
  statementRef,
  revealRef,
  reducedMotion,
}: {
  statementRef: RefObject<HTMLDivElement | null>;
  revealRef: RefObject<HTMLDivElement | null>;
  reducedMotion: boolean;
}) {
  return (
    <div ref={statementRef} className="row-start-1">
      {/* Hidden from the first paint rather than only from the first
          render pass, and inline so it holds before the effect has run;
          the scrubbed reveal owns it from there. Left visible under
          reduced motion, where no trigger is ever created to turn it on.

          A `transform` rather than Tailwind's `translate-y-8`: in v4 that
          compiles to the separate `translate` property, which GSAP's `y`
          does not write, so the two would stack and the paragraph would
          start 64px low. */}
      <div
        ref={revealRef}
        style={
          reducedMotion
            ? undefined
            : {
              opacity: 0,
              transform: `translateY(${-STATEMENT_LIFT_VH * 100}vh)`,
            }
        }
      >
        {/* Four lines from `lg` up, and kept to the left half of the screen.
            `max-w-4xl` was 896px, which is three lines at 35px and a block that
            runs 112–432px past the middle of the screen at every width below
            2560. 42rem is the width 1024 already had — where this wrapped to four
            lines and nothing else about it was wrong — so pinning it there makes
            every viewport from `lg` up read the same way.

            The negative margin is the other half of it: a 672px block still
            crosses the centre line when it starts at the frame's own 176px
            gutter, so from `lg` the paragraph alone steps out into that gutter.
            It is deliberately not a change to the frame's padding — `measure`
            reads `paddingLeft` to place the wordmark's slide, so moving the frame
            would move the logo's resting position with it. */}
        <p className="max-w-4xl text-[26px] leading-[1.3] font-normal text-ink md:text-[35px] lg:-ml-20 lg:max-w-[42rem]">
          We are rebranding agency for the most discerning ambitions.
          Our work transforms a simple idea into an experience of true
          rarity and prestige.
        </p>

        {/* The one call to action on this screen, drawn by the same component as the
            case-study cards' "explore project" so the two are one affordance rather than two
            near-identical buttons — see components/ArrowLink.

            Inside `revealRef` rather than beside it, so it lifts and fades in on the
            statement's own entrance and leaves on its exit. That also keeps it honest with
            `statementTravel`, which ./measure reads as this block's bottom edge: the exit
            carries the whole block off the top, so a link parked outside would be left
            behind on screen with the copy gone.

            **The added height cannot crowd the composition below it, and that is the grid's
            doing rather than a margin chosen carefully.** The frame is `1fr auto 1fr` with
            the statement in row 1: a 1fr row cannot shrink below its content, so on a
            viewport too short for both, row 3 gives up its share and the circle and wordmark
            slide *down*. See the frame's own note in DefinitionSection.

            `lg:-ml-20` matches the paragraph's own step out into the frame's gutter, so the
            two share a left edge at every width; without it the link would sit 80px inboard
            from `lg` up. The top margin is the only new figure here and it is a plain
            rhythm rather than a measurement — there is no reference frame for this link,
            since it is an addition to the composition rather than a transcription of it. */}
        <div className="mt-8 md:mt-10 lg:-ml-20">
          <ArrowLink label="More About Us" href="/about" size="display" />
        </div>
      </div>
    </div>
  );
}

/**
 * The round window and the "ikra." wordmark, stacked in one grid cell.
 *
 * The middle row is sized to its own content, so the 1fr rows either side can
 * balance it on the frame's centre line.
 *
 * Grid stacking: both children sit in the same cell, so the wordmark layers over the
 * photo with no absolute positioning and no translate-centring for GSAP to overwrite
 * later.
 *
 * Both are sized against vw *and* vh, capped in px, with a px floor. The vw term
 * makes them big on a wide screen; the vh term stops them growing into the statement
 * on a short one, which is what keeps the no-overlap guarantee honest; the floor
 * stops the vw term collapsing them below 100px on a phone.
 *
 * The last term of each is the crowding cap, and it is why they carry a fourth term at
 * all — see MARK_WIDTH. `38vw - 262px` is exactly `58vw - 400px` scaled by 19/29, so
 * the disc gives way by the same proportion the wordmark does and the 1.5× below holds
 * *through* the squeeze. Without it the wordmark would shrink onto the disc around
 * 1180px and the overhang either side would drop from ~24% of the circle to ~13%.
 *
 * The wordmark stays a consistent 1.5× the circle at every breakpoint, because the
 * overhang either side of the disc is the composition rather than a coincidence. The
 * resting size is genuinely free to change: `baseSize` is read from the computed
 * style and `maxScale` is solved from it, so a smaller disc simply scales further to
 * reach the same full-bleed frame at the same sharpness.
 */
export function Composition({
  circleRef,
  photoRef,
  markRef,
  reducedMotion,
}: {
  circleRef: RefObject<HTMLDivElement | null>;
  photoRef: RefObject<HTMLDivElement | null>;
  markRef: RefObject<HTMLDivElement | null>;
  reducedMotion: boolean;
}) {
  return (
    <div className="relative row-start-2 grid place-items-center">
      {/* `relative` is load-bearing: `<Image fill>` is absolute, so
          without it the photo would resolve against the grid group above
          and — since overflow only clips absolute descendants whose
          containing block is inside the clipper — escape the round mask
          entirely. */}
      <div
        ref={circleRef}
        aria-hidden
        className="relative col-start-1 row-start-1 overflow-hidden rounded-full"
        style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
      >
        {/* Deliberately NOT sized to the circle: it is a full-bleed
            viewport-cover layer, and the circle is only a window onto it.
            `w-screen h-screen` rather than measured pixels so a resize is
            the browser's job — and `sizes` can honestly say 100vw, which
            is the other half of the sharpness fix.

            Reduced motion never runs placePhoto, so there it falls back
            to simply filling the circle. */}
        <div
          ref={photoRef}
          style={{ willChange: "transform" }}
          className={
            reducedMotion
              ? "absolute inset-0"
              : "absolute top-0 left-0 h-screen w-screen"
          }
        >
          <video
            src="/video/caviar-falling-video.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            style={{ transform: "translateZ(0)", willChange: "transform" }}
            className="h-full w-full object-cover pointer-events-none"
          />
        </div>
      </div>

      {/* Wider than the circle on purpose — 1.5× it in every term — so
          the wordmark overhangs it on both sides. Wrapped so the width
          can be a multi-term min(); Logo takes its height from its own
          ~2.44:1 aspect ratio, which is why the circle sets the
          composition's height. */}
      {/* `relative` here for paint order, and it is load-bearing:
          positioned siblings paint above non-positioned ones regardless
          of DOM order, so once the circle became `relative` it started
          covering this. Making both positioned restores plain tree order.

          Deliberately no z-index. The definition must still paint above
          this, but that is now a backstop rather than the load-bearing
          case it used to be: the two no longer share any horizontal band
          at any width, since the panel's width is capped against
          MARK_WIDTH above `lg` and below it the definition renders in
          normal flow (see DictionaryPanel). Keep the ordering anyway —
          it is what makes a regression there read as a stacking bug
          rather than as silently reversed layers. */}
      <div
        ref={markRef}
        className="relative col-start-1 row-start-1"
        style={{ width: MARK_WIDTH }}
      >
        <Logo className="w-full" color="var(--color-accent)" />
      </div>
    </div>
  );
}

/**
 * The falling dots. Children of the stage rather than the track so the camera does
 * not move them, and outside the frame so its clip cannot cut them off. Sized by
 * `measure`, and hidden until the wordmark begins to dissolve — see
 * LOGO_FADE_ABOVE_FRAC for why that is not optional.
 */
export function FallingDots({
  dotRefs,
}: {
  dotRefs: RefObject<(HTMLSpanElement | null)[]>;
}) {
  return (
    <>
      {LOGO_DOTS.map((_, i) => (
        <span
          key={i}
          aria-hidden
          ref={(el) => {
            dotRefs.current[i] = el;
          }}
          className="pointer-events-none invisible absolute top-0 left-0 rounded-full bg-accent"
        />
      ))}
    </>
  );
}
