"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  PlaygroundBackdrop,
  PlaygroundCopy,
  PlaygroundHeader,
  PlaygroundScrim,
} from "./playground/PlaygroundLayers";
import RiverBand from "./playground/RiverBand";
import { riverFor } from "./playground/river";
import { createPlaygroundSequence } from "./playground/sequence";
import { climbFor } from "./playground/timeline";

/**
 * The playground's first section, assembled on the same five-part plan as the three
 * marketing sections:
 *
 *   ./playground/timeline   every beat, in vh of real scrolling
 *   ./playground/sequence   the one ScrollTrigger that plays it
 *   ./playground/river      the ribbon's geometry, solved from the stage's measured size
 *   ./playground/metrics    every measured layout figure
 *   ./playground/*Layers    the layers themselves, driven purely through refs
 *
 * The refs and the effects stay here so each effect's dependencies sit next to the state it
 * reads; the bodies are plain functions in those modules.
 *
 * Layering, back to front: the footage, the river, the scrim (only where the river is the
 * narrow one), the copy, then the header. The copy is deliberately *over* the river rather
 * than beside it — in the reference its first lines cross the ribbon's upper bend and are
 * painted on top of it.
 *
 * Reduced motion registers no ScrollTrigger and renders the static end state: one viewport
 * tall, the copy already at rest, the river drawn but not drifting.
 *
 * `copy` arrives as a prop rather than being read here, for the reason `AboutSection` and
 * `ApproachSection` take theirs that way: everything from this component down is a client
 * component, so the CMS read belongs to the page (`playgroundCopyFromWix`). Nothing here
 * depends on how many paragraphs there are — the block's height is measured, and every length
 * the sequence uses is derived from that measurement.
 */
export default function PlaygroundNarrative({
  copy,
}: {
  copy: readonly string[];
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  const [reducedMotion, setReducedMotion] = useState(false);
  const [mounted, setMounted] = useState(false);
  // The river is laid onto the stage in both axes, so it needs both of them.
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    setMounted(true);
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    // Returning `prev` unchanged is what makes this cheap — React bails out of the render
    // entirely. The observations are not rare: GSAP writes inline width/height here when it
    // pins and again on every refresh, and on mobile a scroll that moves the URL bar changes
    // `100vh` outright, so this fires *during* scrolling, which is the one time re-solving
    // the river and re-rendering its SVG can cost a frame.
    const observer = new ResizeObserver(() =>
      setStageBox((prev) => {
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        return prev.w === w && prev.h === h ? prev : { w, h };
      }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Memoised because it is an object identity props flow through: recomputed inline, every
  // render would hand RiverBand a new geometry and rebuild its path even when the stage had
  // not moved.
  const river = useMemo(
    () =>
      stageBox.w > 0 && stageBox.h > 0
        ? riverFor(stageBox.w, stageBox.h)
        : null,
    [stageBox.w, stageBox.h],
  );

  /**
   * Which shape the river takes, and therefore where the copy goes and whether there is a
   * scrim under it — one decision, made once, rather than a `riverIsWide` here and a `md:`
   * class in the layers that would disagree for every tablet held upright (see riverIsWide).
   *
   * It defaults to the wide layout for the one commit before the stage has been measured.
   * That is not a visible flash: the copy starts below the fold in this mode and is placed by
   * the sequence's first paint, and the scrim only ever appears.
   */
  const narrow = river ? river.narrow : false;

  /**
   * How far the copy climbs, and every length that follows from it — the section's own height
   * included. Resolved from `narrow` here and handed to the sequence, so the height the
   * section renders and the pin length the sequence scales progress against cannot disagree.
   *
   * It therefore changes once, on the commit the stage is first measured, exactly as the
   * copy's layout does. Not a visible reflow: that commit happens before the reader can have
   * scrolled, and the sequence is rebuilt on the same flag below.
   */
  const climb = climbFor(narrow);

  // Gated on `mounted` as well as the motion mode, because `reducedMotion` is false for the
  // first commit whatever the reader's setting is — it cannot be read until the effect that
  // reads it has run. Without the gate a reduced-motion visitor gets a full ScrollTrigger
  // built and pinned, then reverted a commit later; the pin is what makes that more than
  // wasted work.
  useEffect(() => {
    if (reducedMotion || !mounted) return;
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;

    const ctx = createPlaygroundSequence(
      section,
      { stage },
      { copy: copyRef, header: headerRef },
      narrow,
    );
    return () => ctx.revert();
    // `narrow` is a dependency because the pin's length is derived from it: the trigger has to
    // be rebuilt, not just repainted, when the river flips shape (a tablet being rotated, or
    // the first commit after the stage is measured).
  }, [reducedMotion, mounted, narrow]);

  return (
    <section
      ref={sectionRef}
      className="relative bg-black"
      style={{ height: reducedMotion ? "100vh" : `${climb.sectionVh}vh` }}
    >
      {/* GSAP pins this element directly (see createPlaygroundSequence); CSS `sticky` does
          not work anywhere in this app. */}
      <div ref={stageRef} className="relative h-screen w-full overflow-hidden">
        <PlaygroundBackdrop reducedMotion={reducedMotion} />

        {river && (
          <RiverBand
            river={river}
            width={stageBox.w}
            height={stageBox.h}
            animate={mounted && !reducedMotion}
          />
        )}

        <PlaygroundScrim narrow={narrow} />

        <PlaygroundCopy
          copyRef={copyRef}
          copy={copy}
          centred={reducedMotion}
          narrow={narrow}
        />

        <PlaygroundHeader headerRef={headerRef} />
      </div>
    </section>
  );
}
