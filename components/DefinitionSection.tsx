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
        className={`relative z-50 w-full ${reducedMotion ? "" : "h-screen overflow-hidden"}`}
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

              `overflow-hidden` is load-bearing now that the footer is the next
              screen down: the definition is parked a full frame-height below the
              top, which is exactly where the footer begins. */}
          <div
            ref={frameRef}
            /* `pt` is deliberately tight: the statement sits at the top of row 1, so
               this padding is scroll the reader spends on blank gray before the first
               line clears the bottom edge as the section rises. 80px was ~9vh of it on
               a laptop. The composition does not miss it — the circle is centred by the
               two 1fr rows, not by this. */
            className="relative grid h-screen w-full grid-rows-[1fr_auto_1fr] items-start overflow-hidden px-14 pt-10 pb-10 md:px-36 md:pt-12"
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

          {/* Mobile screens (< md): display definition in natural flow to avoid logo overlap */}
          {!reducedMotion && (
            <DictionaryInFlow className="block px-8 py-12 md:hidden" />
          )}

          {/* Reduced motion: follows the composition in normal flow */}
          {reducedMotion && (
            <DictionaryInFlow className="px-14 pb-24 md:px-36" />
          )}

          <SiteFooter
            footerRef={footerRef}
            revealRefs={revealRefs}
            slotRefs={slotRefs}
            reducedMotion={reducedMotion}
          />
        </div>

        {!reducedMotion && <FallingDots dotRefs={dotRefs} />}
      </div>
    </section>
  );
}
