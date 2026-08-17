"use client";

import { useEffect, useRef, useState } from "react";
import {
  Composition,
  FallingDots,
  Statement,
  Veil,
} from "./definition/DefinitionLayers";
import { DictionaryInFlow, DictionaryPanel } from "./definition/Dictionary";
import { createDefinitionSequence } from "./definition/sequence";
import SiteFooter from "./definition/SiteFooter";
import { SECTION_VH } from "./definition/timeline";

/**
 * The stage's and the frame's clip, with the **top edge left open**.
 *
 * Both used to be `overflow-hidden`, and that clipped the one thing that has to
 * escape them. The statement arrives by being lifted up to `STATEMENT_LIFT_VH` of a
 * viewport above its resting place (see the entrance in ./definition/timeline) —
 * deliberately, because it has to be on screen while this section's top edge is still
 * below the fold — but it sits only ~5vh under the frame's own top edge. So for the
 * whole of its entrance it was *above its own clipping container*: entirely invisible
 * across the stretch where the hero washes to gray, which is what made that read as an
 * empty gray screen, then emerging with 92% of it cut off, which is the clipping.
 *
 * Only the top is opened. The other three edges are the load-bearing ones: the bottom
 * hides the definition parked a full frame below (exactly where the footer begins) and
 * gives the camera its one-viewport window, and the sides clip the growing circle.
 *
 * Nothing is exposed by opening it. Above the frame's top edge is the stage's, and
 * above the stage's is the hero — which by this point is washed to the identical
 * `--color-gray`, with this stage at z-50 painting over it. Once either is pinned
 * their top edge *is* the viewport's, so there is nothing above them to draw into.
 *
 * 100vh of headroom against a 40vh lift: enough for the paragraph's own height on top
 * of the lift, at any viewport, with room to spare.
 */
const OPEN_TOP_CLIP = "inset(-100vh 0 0 0)";

/**
 * The editorial statement, with the round photo and the "ikra." wordmark stacked
 * below it, the wordmark layered over the photo — and then the wordmark's own dots
 * carrying the page into the footer.
 *
 * Assembled from five parts:
 *
 *   ./definition/timeline   every beat, in vh of real scrolling, and the phase map
 *   ./definition/sequence   the pin, the two edge triggers, and the tail's clock
 *   ./definition/measure    the layout figures every frame is computed against
 *   ./definition/dots       the wordmark's dots and their solved ballistics
 *   ./definition/*.tsx      the layers themselves, driven purely through refs
 *
 * The refs and the effects stay here, so each effect's dependencies are visible next
 * to the state they read; the bodies are plain functions in those modules.
 *
 * The stage is the camera: exactly one viewport, pinned, clipping a track that is
 * two screens tall. Pinned with GSAP rather than CSS `sticky`, which does not work
 * under ScrollSmoother's transform-based fake scroll (see the note in
 * HeroNarrative).
 *
 * Reduced motion registers no ScrollTrigger and renders a static end state: no veil,
 * no pin, no falling dots, and the definition in normal flow below the composition.
 * The section's `height` goes to `auto` with it, since there is no pin left to
 * reserve scroll distance for.
 */
export default function DefinitionSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const statementRef = useRef<HTMLDivElement>(null);
  const statementRevealRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const dictionaryRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const revealRefs = useRef<(HTMLDivElement | null)[]>([]);
  const slotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const dotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  // The whole scroll-driven sequence — see createDefinitionSequence.
  useEffect(() => {
    if (reducedMotion) return;
    const section = sectionRef.current;
    const stage = stageRef.current;
    const track = trackRef.current;
    const frame = frameRef.current;
    const circle = circleRef.current;
    if (!section || !stage || !track || !frame || !circle) return;

    const ctx = createDefinitionSequence(
      section,
      { stage, track, frame, circle },
      {
        photo: photoRef,
        statement: statementRef,
        statementReveal: statementRevealRef,
        veil: veilRef,
        mark: markRef,
        dictionary: dictionaryRef,
        footer: footerRef,
        reveals: revealRefs,
        slots: slotRefs,
        dots: dotRefs,
      },
    );

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section
      ref={sectionRef}
      className="relative bg-gray"
      style={{ height: reducedMotion ? "auto" : `${SECTION_VH}vh` }}
    >
      {!reducedMotion && <Veil veilRef={veilRef} />}

      {/* The stage is the camera: exactly one viewport, pinned, clipping a track
          that is two screens tall. The flying dots are its direct children
          rather than the track's, so their coordinates are plain screen
          coordinates and the camera's own movement only enters where it is
          wanted — through the endpoints, which are recomputed per frame. */}
      <div
        ref={stageRef}
        className={`relative z-50 w-full ${reducedMotion ? "" : "h-screen"}`}
        style={reducedMotion ? undefined : { clipPath: OPEN_TOP_CLIP }}
      >
        <div ref={trackRef} className="relative w-full">
          {/* Screen one. One composition, not two layers: the statement and the
              composition used to be siblings in normal flow, so once the stage
              was pinned its centred wordmark simply landed on top of the text.
              Both now live in the same grid, so they cannot overlap.

              Three rows — 1fr, auto, 1fr — with the statement first and the
              composition second. The two 1fr rows take equal shares of what the
              middle leaves, which puts the circle on the frame's own centre line
              instead of in the middle of the space *below* the statement.

              A grid rather than absolute positioning because it degrades in the
              right direction: a 1fr row cannot shrink below its content, so on a
              viewport too short for both, the third row gives up its share and
              the composition slides *down*, never up into the copy.

              The clip is load-bearing now that the footer is the next screen down:
              the definition is parked a full frame-height below the top, which is
              exactly where the footer begins. It leaves the top edge open so the
              statement's entrance is not cut off — see OPEN_TOP_CLIP. */}
          <div
            ref={frameRef}
            /* `pt` is deliberately tight: the statement sits at the top of row 1, so
               this padding is scroll the reader spends on blank gray before the first
               line clears the bottom edge as the section rises. 80px was ~9vh of it on
               a laptop. The composition does not miss it — the circle is centred by the
               two 1fr rows, not by this. */
            className="relative grid h-screen w-full grid-rows-[1fr_auto_1fr] items-start px-14 pt-10 pb-10 md:px-44 md:pt-12"
            style={{ clipPath: OPEN_TOP_CLIP }}
          >
            <Statement
              statementRef={statementRef}
              revealRef={statementRevealRef}
              reducedMotion={reducedMotion}
            />

            <Composition
              circleRef={circleRef}
              photoRef={photoRef}
              markRef={markRef}
              reducedMotion={reducedMotion}
            />

            {!reducedMotion && <DictionaryPanel panelRef={dictionaryRef} />}
          </div>

          {/* Phones *and* tablets (< lg): the definition sits in normal flow, because
              below `lg` the frame has no room to hold it beside the wordmark — see
              DictionaryPanel for the measurement. It was `md:hidden`, which put the
              travelling panel on 768–1023px viewports where its resting box overlapped
              the wordmark's by up to 83px.

              Gutters match the frame's at each breakpoint so the column does not step
              in and out as the layout changes around it. */}
          {!reducedMotion && (
            <DictionaryInFlow className="block px-14 py-12 md:px-36 lg:hidden" />
          )}

          {/* Reduced motion: follows the composition in normal flow */}
          {reducedMotion && (
            <DictionaryInFlow className="px-14 pb-24 md:px-36" />
          )}

          {/* The ref arrays stay here and the footer is handed writers into them,
              rather than the arrays themselves — see SiteFooter's props. */}
          <SiteFooter
            footerRef={footerRef}
            registerReveal={(i, el) => {
              revealRefs.current[i] = el;
            }}
            registerSlot={(i, el) => {
              slotRefs.current[i] = el;
            }}
            reducedMotion={reducedMotion}
          />
        </div>

        {!reducedMotion && <FallingDots dotRefs={dotRefs} />}
      </div>
    </section>
  );
}
