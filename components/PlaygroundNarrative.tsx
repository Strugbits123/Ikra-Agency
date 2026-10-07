"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  PlaygroundBackdrop,
  PlaygroundCopy,
  PlaygroundCopyBand,
  PlaygroundHeader,
} from "./playground/PlaygroundLayers";
import RiverBand from "./playground/RiverBand";
import { riverFor } from "./playground/river";
import { createPlaygroundSequence } from "./playground/sequence";
import { CLIMB } from "./playground/timeline";

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
 * **Two compositions, and only one of them scrolls.** Where the river is the wide one (every
 * desktop, every tablet held sideways) the stage pins and the copy climbs into it over the
 * river — layered, back to front: the footage, the river, the copy, then the header; the copy
 * is deliberately *over* the river rather than beside it, because in the reference its first
 * lines cross the ribbon's upper bend and are painted on top of it. Where the river is the
 * narrow one (every phone, every tablet held upright) nothing pins and nothing climbs: the
 * stage is one viewport of footage and ribbon, and the copy is a white band under it, as
 * tall as the copy needs (`PlaygroundCopyBand`) — the client's brief, after two attempts at
 * sharing the one screen between the paragraph and the ribbon were reported as overlapping
 * and then as cramped.
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
   * Which shape the river takes, and therefore which of the two compositions this is — one
   * decision, made once, rather than a `riverIsWide` here and a `md:` class in the layers
   * that would disagree for every tablet held upright (see riverIsWide).
   *
   * `null` until the stage has been measured, and the sequence waits for it: the first commit
   * cannot know which composition it is in, and building the wide layout's pin on a phone for
   * one commit only to tear it down measured the copy in a column it never has there and
   * fired the climb's assertions on a state nobody sees.
   */
  const narrow = river ? river.narrow : null;

  /**
   * Whether this section scrolls at all. Only the wide layout has anything to drive; the
   * narrow one is two plain viewports in flow. Reduced motion takes the static end state of
   * whichever composition it is in.
   */
  const scrolls = narrow === false && !reducedMotion;

  // Gated on `mounted` as well as the motion mode, because `reducedMotion` is false for the
  // first commit whatever the reader's setting is — it cannot be read until the effect that
  // reads it has run. Without the gate a reduced-motion visitor gets a full ScrollTrigger
  // built and pinned, then reverted a commit later; the pin is what makes that more than
  // wasted work.
  useEffect(() => {
    if (!scrolls || !mounted) return;
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;

    const ctx = createPlaygroundSequence(
      section,
      { stage },
      { copy: copyRef, header: headerRef },
    );
    return () => ctx.revert();
    // `scrolls` folds `narrow` in, so the trigger is rebuilt — not just repainted — when the
    // river flips shape (a tablet being rotated, or the first commit after the stage is
    // measured).
  }, [scrolls, mounted]);

  /**
   * The section's height. The wide layout states it — the pin's length plus the viewport it
   * holds, see CLIMB — because `pinSpacing: false` means ScrollTrigger reserves nothing. The
   * narrow layout is the stage plus the band in plain flow and takes its height from them,
   * and the one commit before the stage is measured takes the wide figure so a phone does
   * not open on a one-viewport section that then doubles.
   */
  const height =
    narrow === true ? undefined : reducedMotion ? "100vh" : `${CLIMB.sectionVh}vh`;

  return (
    <section ref={sectionRef} className="relative bg-black" style={{ height }}>
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

        {narrow === false && (
          <PlaygroundCopy
            copyRef={copyRef}
            copy={copy}
            note={note}
            centred={reducedMotion}
          />
        )}

        <PlaygroundHeader headerRef={headerRef} />
      </div>

      {narrow === true && <PlaygroundCopyBand copy={copy} note={note} />}
    </section>
  );
}
