"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  PlaygroundBackdrop,
  PlaygroundCopy,
  PlaygroundHeader,
  PlaygroundScrim,
} from "./playground/PlaygroundLayers";
import RiverBand from "./playground/RiverBand";
import { COPY_BOTTOM_PAD, RIVER_COPY_GAP } from "./playground/metrics";
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
 * narrow one), the copy, then the header. On the wide layout the copy is deliberately *over*
 * the river rather than beside it — in the reference its first lines cross the ribbon's upper
 * bend and are painted on top of it. On the narrow one the two are kept apart instead: the
 * copy rests on the bottom gutter and the river is solved to stay above it, which is why this
 * component measures the copy's height as well as the stage's — see `clearBelow` below.
 *
 * Reduced motion registers no ScrollTrigger and renders the static end state: one viewport
 * tall, the copy already at rest, the river drawn but not drifting.
 *
 * `copy` and `note` arrive as props rather than being read here, for the reason `AboutSection`
 * and `ApproachSection` take theirs that way: everything from this component down is a client
 * component, so the CMS read belongs to the page (`aboutIntroFromWix`). Nothing here depends on
 * how many lines either of them has — the block's height is measured, and every length the
 * sequence uses is derived from that measurement.
 */
export default function PlaygroundNarrative({
  copy,
  note,
}: {
  copy: readonly string[];
  note: readonly string[];
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  const [reducedMotion, setReducedMotion] = useState(false);
  const [mounted, setMounted] = useState(false);
  // The river is laid onto the stage in both axes, so it needs both of them.
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 });
  // And, on the narrow layout, it is bounded by the copy — so it needs the copy's height too,
  // tagged with the layout it was measured under (see the observer below for why).
  const [copyBox, setCopyBox] = useState({ h: 0, layout: "" });

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

  useEffect(() => {
    const el = copyRef.current;
    if (!el) return;
    // The block's height is what the narrow river is solved against (see `clearBelow`), and
    // it changes on its own: the webfont landing, the CMS handing down a longer paragraph, the
    // column reflowing when `narrow` flips. Same bail-out as the stage's observer above.
    //
    // The height is recorded *with the layout the block had when it was measured*. The first
    // commit lays the copy out in the wide column before the stage has been measured, and on a
    // phone that column is ~165px wide and the block ~700px tall; the commit that flips
    // `narrow` re-lays it full width, but the observer only reports the new height a commit
    // later. Reading the stale figure in between hands the river an 87px room on a 390 × 844
    // phone and fires the floor assertion on a state nobody ever sees. The tag is what lets
    // `clearBelow` tell the two apart.
    const observer = new ResizeObserver(() =>
      setCopyBox((prev) => {
        const h = el.offsetHeight;
        const layout = el.dataset.layout ?? "";
        return prev.h === h && prev.layout === layout ? prev : { h, layout };
      }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /**
   * The lowest `y` the narrow river's ink may reach: the copy's resting top edge, less a line
   * of air. The copy rests on the bottom gutter (COPY_BOTTOM_PAD — the same figure the
   * sequence's `measure` rests it on, so the river is solved against where the block actually
   * lands), and RIVER_COPY_GAP is the daylight between the two. `undefined` until the block has
   * been measured *in the narrow layout* (see the observer above), which hands the river the
   * whole stage for that commit; the observer re-solves it on the next.
   *
   * Only the narrow layout reads it — `riverFor` ignores it where the river is the wide one.
   */
  const clearBelow =
    copyBox.h > 0 && copyBox.layout === "narrow"
      ? stageBox.h - copyBox.h - COPY_BOTTOM_PAD - RIVER_COPY_GAP
      : undefined;

  // Memoised because it is an object identity props flow through: recomputed inline, every
  // render would hand RiverBand a new geometry and rebuild its path even when the stage had
  // not moved.
  const river = useMemo(
    () =>
      stageBox.w > 0 && stageBox.h > 0
        ? riverFor(stageBox.w, stageBox.h, clearBelow)
        : null,
    [stageBox.w, stageBox.h, clearBelow],
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
          note={note}
          centred={reducedMotion}
          narrow={narrow}
        />

        <PlaygroundHeader headerRef={headerRef} />
      </div>
    </section>
  );
}
