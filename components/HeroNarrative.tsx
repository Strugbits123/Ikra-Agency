"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Logo from "./Logo";
import { bandGeometry } from "./hero/band";
import BandLayer from "./hero/BandLayer";
import { attachHeroCursor } from "./hero/cursor";
import { useBackgroundFootage } from "./hero/footage";
import GapCopy, { gapCopyFontSize } from "./hero/GapCopy";
import {
  ClipWindow,
  DoorPanels,
  HeroBackdrop,
  HeroCursor,
} from "./hero/HeroLayers";
import { playHeroIntro } from "./hero/intro";
import { createHeroSequence } from "./hero/sequence";
import { SECTION_VH } from "./hero/timeline";

// Re-exported because DefinitionSection has always imported it from this module,
// and it is this section's hand-off to publish (see ./hero/timeline).
export { HERO_CLOSE_TAIL_VH, HERO_GRAY_TAIL_VH } from "./hero/timeline";

/**
 * One continuous pinned sequence, assembled from four parts:
 *
 *   ./hero/timeline   every beat, in vh of real scrolling, and the phase map
 *   ./hero/sequence   the one ScrollTrigger that plays it
 *   ./hero/intro      the load timeline, which runs before any of it
 *   ./hero/HeroLayers the layers themselves, driven purely through refs
 *
 * The refs and the effects stay here, so each effect's dependencies are visible
 * next to the state they read; the bodies are plain functions in those modules.
 *
 * Layering (back to front): the background still with the footage over it, the wavy
 * band, the doors, the hero copy, the gray wash, then the header. The band sits
 * *under* the doors deliberately — both are the same orange, but it means a ribbon
 * caught mid-close is swallowed by the returning panels rather than floating over
 * them. The wash sits over the copy and under the header for the same kind of
 * reason: everything it covers is already gone by the time it arrives, and the one
 * thing that isn't is the wordmark.
 *
 * Reduced motion registers no ScrollTrigger and renders a static end state: doors
 * parked open over the footage, copy as a plain column, ribbon drawn in full.
 */
export default function HeroNarrative() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoBoxRef = useRef<HTMLDivElement>(null);
  const panelLeftRef = useRef<HTMLDivElement>(null);
  const panelRightRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const gapLineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const ribbonRef = useRef<HTMLDivElement>(null);
  const leapRef = useRef<HTMLDivElement>(null);
  const grayRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLSpanElement>(null);
  const headlineRef = useRef<HTMLParagraphElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const clipVideoRef = useRef<HTMLVideoElement>(null);
  // Latches, not elements: play() is asynchronous, so the elements' own `paused`
  // still reads stale on the next frame and would be called again every frame.
  const bgCoveredRef = useRef(false);
  const clipSealedRef = useRef(false);
  // Set by the load timeline, read by the scroll sequence.
  const introDoneRef = useRef(false);
  // The other half of that hand-off: the sequence writes its per-frame dispatch here
  // and the load timeline calls it once, on landing. A ref rather than a prop because
  // the two live in separate effects and only ever meet at runtime — see
  // SequenceRefs.catchUp for why the latch alone cannot do the job.
  const catchUpRef = useRef<(() => void) | null>(null);
  // And the reverse: the load timeline writes a "finish quickly" here and the sequence
  // calls it as soon as the reader scrolls. The opening is 20vh of scroll long, so the
  // hand-off has to happen near the top of the section or there is nothing left to
  // play — see SequenceRefs.hurryIntro.
  const hurryIntroRef = useRef<(() => void) | null>(null);

  const [reducedMotion, setReducedMotion] = useState(false);
  const [mounted, setMounted] = useState(false);
  // The ribbon is pinned to the wedges' corners, so it needs both axes of the
  // stage's real size, not just its width.
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    // Returning `prev` unchanged is what makes this cheap: React bails out of the
    // render entirely. Without the comparison every observation committed a fresh
    // object and re-rendered the whole hero — and the observations are not rare or
    // idle-time. GSAP writes inline width/height onto this element when it pins and
    // again on every refresh, and on mobile a scroll that moves the URL bar changes
    // `100vh` outright, so the observer fires *during* scrolling, which is the one
    // time a re-render of the band and the copy can cost a frame.
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

  // Memoised because it is an object identity that props flow through: recomputed
  // inline, every render handed BandLayer a new `band` and re-rendered the ribbon and
  // its SVG geometry even when the stage had not moved.
  const band = useMemo(
    () =>
      stageBox.w > 0 && stageBox.h > 0
        ? bandGeometry(stageBox.w, stageBox.h)
        : null,
    [stageBox.w, stageBox.h],
  );

  useEffect(() => {
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    setMounted(true);
  }, []);

  const { bgSrc, bgPlaying, setBgPlaying } = useBackgroundFootage(
    mounted,
    reducedMotion,
  );

  // Load sequence (plays once, not scroll-driven) — see playHeroIntro.
  useEffect(() => {
    if (!mounted) return;
    const box = videoBoxRef.current;
    const headline = headlineRef.current;
    const logo = logoRef.current;
    if (!box || !headline || !logo) return;
    return playHeroIntro(
      box,
      headline,
      logo,
      introDoneRef,
      catchUpRef,
      hurryIntroRef,
      reducedMotion,
    );
  }, [reducedMotion, mounted]);

  // The single scroll-driven sequence covering every phase — see createHeroSequence.
  //
  // Gated on `mounted` as well as the motion mode, because `reducedMotion` is false
  // for the first commit whatever the user's setting is — it cannot be read until the
  // effect that reads it has run. Without the gate a reduced-motion visitor got a full
  // ScrollTrigger built and pinned, then reverted a commit later; the pin is the part
  // that makes that more than wasted work.
  useEffect(() => {
    if (reducedMotion || !mounted) return;
    const section = sectionRef.current;
    const box = videoBoxRef.current;
    if (!section || !box) return;

    const ctx = createHeroSequence(section, box, {
      stage: stageRef,
      headline: headlineRef,
      panelLeft: panelLeftRef,
      panelRight: panelRightRef,
      content: contentRef,
      gapLines: gapLineRefs,
      ribbon: ribbonRef,
      leap: leapRef,
      gray: grayRef,
      bgVideo: bgVideoRef,
      clipVideo: clipVideoRef,
      bgCovered: bgCoveredRef,
      clipSealed: clipSealedRef,
      introDone: introDoneRef,
      catchUp: catchUpRef,
      hurryIntro: hurryIntroRef,
    });

    return () => ctx.revert();
  }, [reducedMotion, mounted]);

  useEffect(() => {
    if (reducedMotion || !mounted) return;
    const section = sectionRef.current;
    const cursor = cursorRef.current;
    if (!section || !cursor) return;
    return attachHeroCursor(section, cursor);
  }, [reducedMotion, mounted]);

  return (
    <section
      ref={sectionRef}
      className="relative bg-accent [&_*]:!cursor-none cursor-none"
      style={{ height: reducedMotion ? "100vh" : `${SECTION_VH}vh` }}
    >
      {mounted && !reducedMotion && <HeroCursor cursorRef={cursorRef} />}

      {/* GSAP pins this element directly (see createHeroSequence); CSS `sticky`
          does not work here. `relative` still gives next/image `fill` something to
          resolve against before pinning kicks in. */}
      <div ref={stageRef} className="relative h-screen w-full overflow-hidden">
        <div className="relative h-full w-full">
          <HeroBackdrop
            bgSrc={bgSrc}
            bgPlaying={bgPlaying}
            onPlaying={() => setBgPlaying(true)}
            videoRef={bgVideoRef}
          />

          <DoorPanels
            leftRef={panelLeftRef}
            rightRef={panelRightRef}
            reducedMotion={reducedMotion}
          />

          <ClipWindow boxRef={videoBoxRef} videoRef={clipVideoRef} />

          {/* The turn-over from orange to the next section's gray (Phase 7). Above
            the panels and everything they carry, but deliberately below the header:
            the wordmark survives into the gray rather than being painted out along
            with the orange.

            Nothing but GSAP ever raises it, so it stays at opacity 0 under reduced
            motion — where the doors are parked open over the footage and a gray
            screen would be plainly wrong. */}
          <div
            ref={grayRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[25] bg-gray opacity-0"
          />

          {/* Starts hidden in the markup, exactly like the clip box and the
            headline, and for the same reason. The load timeline is what fades it
            in; the effect that sets its start state cannot run until after the
            first paint — one commit to flip `mounted`, another for the effect
            itself — so a wordmark left visible here is painted at full strength,
            blanked a frame or two later, then faded back in. Restored explicitly
            under reduced motion, where nothing fades it. */}
          <header className="absolute top-0 left-0 z-30 w-full px-8 py-8 md:px-16">
            <Logo
              ref={logoRef}
              className="w-[90px] opacity-0 md:w-[120px]"
              color="var(--color-ink)"
            />
          </header>

          {/* No translate-centring classes on purpose: GSAP animates `y` here and
            owns xPercent/yPercent instead, in both motion modes. Safe to leave
            uncentred for the frame before that runs because `opacity-0` starts it
            hidden. */}
          <p
            ref={headlineRef}
            className="absolute top-1/2 left-1/2 z-30 w-full max-w-5xl px-8 text-center text-[32px] leading-[1.3] font-light text-white/80 opacity-0 md:text-[52px] lg:max-w-[1300px] lg:text-[68px]"
          >
            eventually, success becomes your
            <br />
            biggest branding problem
          </p>

          <div
            aria-hidden
            className="absolute bottom-8 left-1/2 z-10 h-1 w-10 -translate-x-1/2 rounded-full bg-ink/70"
          />

          {reducedMotion && (
            /* Nothing animates here, so the opening copy has to live where it
               won't collide with the ribbon, which is pinned to the wedges in
               both modes. */
            <div className="absolute inset-x-8 top-[10%] z-20 text-center md:inset-x-16">
              <GapCopy />
            </div>
          )}

          {!reducedMotion && (
            /* No flex column and no padding of its own: every line is seated
               absolutely at its centre and carries its own gutters, so the one
               arriving lands exactly where the one leaving sat. */
            <div
              ref={contentRef}
              className="pointer-events-none absolute inset-0 z-30 opacity-0"
            >
              <GapCopy
                overlay
                lineRefs={gapLineRefs}
                fontSize={gapCopyFontSize(stageBox.w)}
              />
            </div>
          )}

          <BandLayer
            band={band}
            reducedMotion={reducedMotion}
            ribbonRef={ribbonRef}
            leapRef={leapRef}
          />
        </div>
      </div>
    </section>
  );
}
